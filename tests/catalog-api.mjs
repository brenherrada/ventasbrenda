import assert from 'node:assert/strict';
import handler from '../netlify/functions/catalog.mts';
const originalFetch = globalThis.fetch, originalWarn = console.warn;
const table = { cols: [{ label: 'safe' }], rows: [] };
const good = () => new Response(`google.visualization.Query.setResponse(${JSON.stringify({ table })});`);
let calls = [], logs = [];
console.warn = value => logs.push(JSON.parse(value));
const request = sheet => new Request(`https://fixture.test/api/catalog?sheet=${sheet}`);
try {
  for (const failure of ['503', '429', 'timeout', 'network']) {
    calls = []; logs = [];
    globalThis.fetch = async (url, options) => {
      calls.push({ url: new URL(url), signal: options.signal });
      if (calls.length > 1) return good();
      if (failure === 'timeout') throw new DOMException('private upstream detail', 'TimeoutError');
      if (failure === 'network') throw new TypeError('private upstream detail');
      return new Response('private upstream detail', { status: Number(failure) });
    };
    const response = await handler(request('Catalogo'));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { table });
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(calls.length, 2);
    assert.ok(calls.every(call => call.signal instanceof AbortSignal));
    assert.equal(logs.length, 1);
    assert.ok(!JSON.stringify(logs).includes('private'));
  }
  for (const failure of ['403', '503', 'malformed']) {
    calls = [];
    globalThis.fetch = async url => { calls.push(url); return failure === 'malformed' ? new Response('private malformed data') : new Response('private data', { status: Number(failure) }); };
    const response = await handler(request('Config'));
    assert.equal(response.status, 503);
    assert.equal(calls.length, failure === '503' ? 2 : 1);
    assert.deepEqual(await response.json(), { error: 'Catalog temporarily unavailable' });
  }
  calls = [];
  globalThis.fetch = async url => { calls.push(new URL(url)); return good(); };
  assert.equal((await handler(request('Ventas'))).status, 200);
  assert.equal(calls[0].searchParams.get('tq'), "select A,B where A = 'TOTAL VENDIDO'");
  calls = [];
  assert.equal((await handler(request('private'))).status, 404);
  assert.equal((await handler(new Request(request('Catalogo'), { method: 'POST' }))).status, 405);
  assert.equal(calls.length, 0);
  console.log('PASS: catalog retry recovery, bounded failure, private errors, validation and sales aggregate.');
} finally { globalThis.fetch = originalFetch; console.warn = originalWarn; }
