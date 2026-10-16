import { createHash, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { catalogRanges, catalogScope, directConfig } from './catalog-config.mjs';
import { publicTable, tableFromValues } from './catalog-contract.mjs';

const READ_BUDGET_MS = 6000;
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
const AUTH_URL = 'https://oauth2.googleapis.com/token';
function failure(reason, retryable = false) {
  return Object.assign(new Error('Private catalog unavailable'), { reason, retryable });
}
function classify(error) {
  if (error?.reason) return error;
  if (['TimeoutError', 'AbortError'].includes(error?.name) || ['TimeoutError', 'AbortError'].includes(error?.code)) return failure('timeout');
  const status = error?.response?.status;
  if (Number.isInteger(status)) return failure(`http_${status}`, status === 429 || status >= 500);
  return failure('network', true);
}
function until(promise, signal) {
  if (signal.aborted) {
    promise.catch(() => {});
    return Promise.reject(signal.reason);
  }
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}
async function readJSON(response, signal) {
  if (Number(response.headers.get('content-length')) > MAX_RESPONSE_BYTES) {
    await response.body?.cancel(); throw failure('response_too_large');
  }
  if (!response.body) throw failure('invalid_response');
  const reader = response.body.getReader(), chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await until(reader.read(), signal);
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) throw failure('response_too_large');
      chunks.push(value);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { throw failure('invalid_response'); }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

// Only OAuth tokens are reused. Every catalog read reaches Sheets again.
export function createDirectReader({ fetchImpl = (...args) => fetch(...args), budgetMs = READ_BUDGET_MS, now = Date.now } = {}) {
  let identity, cached, pending;
  function credentials(get) {
    const config = directConfig(get);
    const fingerprint = createHash('sha256').update(JSON.stringify(config)).digest('hex');
    if (identity?.fingerprint !== fingerprint) {
      identity = { ...config, fingerprint }; cached = undefined; pending = undefined;
    }
    return identity;
  }
  async function token(config, signal) {
    signal.throwIfAborted();
    if (cached?.identity === config && cached.expires > now() + 60000) return cached.value;
    if (pending?.identity !== config) {
      const entry = { identity: config, promise: undefined };
      pending = entry;
      entry.promise = (async () => {
        const { JWT } = await import('google-auth-library');
        const client = new JWT({
          email: config.email, key: config.key, keyId: config.keyId, scopes: [catalogScope],
          transporterOptions: {
            retry: false, signal: AbortSignal.timeout(budgetMs), timeout: budgetMs,
            fetchImplementation: (url, options) => {
              if (String(url) !== AUTH_URL) throw failure('invalid_auth_endpoint');
              return fetchImpl(url, { ...options, redirect: 'error' });
            },
          },
        });
        const result = await client.authorize();
        if (typeof result.access_token !== 'string' || !result.access_token || !Number.isFinite(result.expiry_date) || result.expiry_date <= now() + 60000) throw failure('invalid_auth_response');
        if (identity === config) cached = { identity: config, value: result.access_token, expires: result.expiry_date };
        return result.access_token;
      })().catch(error => { throw classify(error); }).finally(() => { if (pending === entry) pending = undefined; });
    }
    return until(pending.promise, signal);
  }
  return async function readDirect(sheet, get, requestSignal) {
    if (!Object.hasOwn(catalogRanges, sheet)) throw failure('invalid_sheet');
    const started = performance.now();
    const signal = AbortSignal.any([AbortSignal.timeout(budgetMs), ...(requestSignal ? [requestSignal] : [])]);
    const timings = { auth_ms: 0, sheets_ms: 0, projection_ms: 0 };
    let attempt = 0, reason = 'configuration';
    try {
      const config = credentials(get);
      const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${encodeURIComponent(catalogRanges[sheet])}`);
      url.search = new URLSearchParams({ valueRenderOption: 'UNFORMATTED_VALUE', dateTimeRenderOption: 'SERIAL_NUMBER', majorDimension: 'ROWS' }).toString();
      for (attempt = 1; attempt <= 2; attempt++) {
        try {
          let at = performance.now(), accessToken;
          try { accessToken = await token(config, signal); } finally { timings.auth_ms += performance.now() - at; }
          at = performance.now();
          let values;
          try {
            const response = await fetchImpl(url, { headers: { Authorization: `Bearer ${accessToken}` }, signal, redirect: 'error' });
            if (!response.ok) {
              await response.body?.cancel();
              if (response.status === 401 && cached?.value === accessToken) cached = undefined;
              throw failure(`http_${response.status}`, response.status === 401 || response.status === 429 || response.status >= 500);
            }
            const data = await readJSON(response, signal);
            if (data.majorDimension !== undefined && data.majorDimension !== 'ROWS') throw failure('invalid_response');
            values = data.values;
          } finally { timings.sheets_ms += performance.now() - at; }
          signal.throwIfAborted(); at = performance.now();
          let table;
          try { table = publicTable(sheet, tableFromValues(sheet, values)); }
          catch { throw failure('invalid_response'); }
          finally { timings.projection_ms += performance.now() - at; }
          signal.throwIfAborted(); reason = 'ok';
          return table;
        } catch (error) {
          const safe = classify(error);
          reason = signal.aborted ? 'timeout' : safe.reason;
          if (!safe.retryable || signal.aborted || attempt === 2) throw safe;
          await delay(200, undefined, { signal });
        }
      }
    } finally {
      console.info(JSON.stringify({ event: 'catalog_read', read_id: randomUUID(), source: 'direct', sheet, attempt, reason: signal.aborted ? 'timeout' : reason, ...Object.fromEntries(Object.entries(timings).map(([key, value]) => [key, Math.round(value)])), total_ms: Math.round(performance.now() - started) }));
    }
  };
}
export const readDirect = createDirectReader();
