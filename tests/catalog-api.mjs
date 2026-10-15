import assert from 'node:assert/strict';
import handler from '../netlify/functions/catalog.mts';
const originalFetch = globalThis.fetch, originalWarn = console.warn;
const fields = {
  Catalogo: ['id', 'titulo', 'descripcion', 'precio', 'disponible', 'imagenes', 'categoria', 'vendido', 'badge', 'reservado'],
  Config: ['clave', 'valor'], Ventas: ['concepto', 'importe']
};
let activeSheet = 'Catalogo';
const tableFor = sheet => ({ cols: fields[sheet].map(label => ({ label })), rows: sheet === 'Ventas' ? [{ c: [{ v: 'TOTAL VENDIDO' }, { v: 123 }] }] : [] });
let table = tableFor(activeSheet);
const originalNetlify = globalThis.Netlify;
globalThis.Netlify = { env: { get: key => key === 'WAITLIST_SCRIPT_URL' ? 'https://script.google.com/macros/s/fixture/exec' : 'unit-test-secret' } };
const good = () => new Response(JSON.stringify({ ok: true, table }));
let calls = [], logs = [];
console.warn = value => logs.push(JSON.parse(value));
const request = sheet => { activeSheet = sheet; table = fields[sheet] ? tableFor(sheet) : {}; return new Request(`https://fixture.test/api/catalog?sheet=${sheet}`); };
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
  assert.equal(calls[0].hostname, 'script.google.com');
  // Even a source regression must not publish sales detail, extra columns or cell metadata.
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: true, table: {
    cols: [{ label: 'concepto' }, { label: 'importe' }, { label: 'private' }],
    rows: [{ c: [{ v: 'private customer' }, { v: 50 }, { v: 'private' }] }, { c: [{ v: 'TOTAL VENDIDO', f: 'private' }, { v: 123 }, { v: 'private' }] }]
  }}));
  assert.deepEqual(await (await handler(request('Ventas'))).json(), { table: tableFor('Ventas') });
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: true, table: {
    cols: [{ label: 'clave' }, { label: 'valor' }], rows: [{ c: [{ v: 'private' }, { v: 'private' }] }, { c: [{ v: 'titulo' }, { v: 'public' }] }]
  }}));
  assert.deepEqual((await (await handler(request('Config'))).json()).table.rows, [{ c: [{ v: 'titulo' }, { v: 'public' }] }]);
  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    assert.deepEqual(Object.keys(body).sort(), ['action', 'secret', 'sheet']);
    assert.equal(body.action, 'catalog.read');
    assert.equal(body.secret, 'unit-test-secret');
    assert.equal(options.method, 'POST');
    assert.ok(!String(url).includes(body.secret));
    return good();
  };
  assert.equal((await handler(request('Catalogo'))).status, 200);
  calls = [];
  assert.equal((await handler(request('private'))).status, 404);
  assert.equal((await handler(new Request(request('Catalogo'), { method: 'POST' }))).status, 405);
  assert.equal(calls.length, 0);
  console.log('PASS: catalog retry recovery, bounded failure, private errors, validation and sales aggregate.');
} finally { globalThis.fetch = originalFetch; console.warn = originalWarn; globalThis.Netlify = originalNetlify; }
