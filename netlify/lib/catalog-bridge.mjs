import { bridgeConfig } from './catalog-config.mjs';
import { publicTable } from './catalog-contract.mjs';

export async function readBridge(sheet, get) {
  const { url, secret } = bridgeConfig(get);
  // Preserve the working bridge and its retry budget during migration.
  for (let attempt = 0; attempt < 2; attempt++) {
    let reason = 'network', retryable = true;
    try {
      const response = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'catalog.read', sheet, secret }),
        signal: AbortSignal.timeout(attempt === 0 ? 12000 : 5000),
      });
      if (!response.ok) {
        reason = `http_${response.status}`;
        retryable = response.status === 429 || response.status >= 500;
        await response.body?.cancel();
        throw new Error('Upstream unavailable');
      }
      reason = 'invalid_response'; retryable = false;
      const data = await response.json();
      if (data.ok !== true) throw new Error('Private source rejected request');
      return publicTable(sheet, data.table);
    } catch (error) {
      if (['TimeoutError', 'AbortError'].includes(error?.name)) reason = 'timeout';
      console.warn(JSON.stringify({ event: 'catalog_read_failed', sheet, attempt: attempt + 1, reason }));
      if (!retryable || attempt === 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
}
