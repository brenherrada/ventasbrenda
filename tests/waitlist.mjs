import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import handler, { config } from '../netlify/functions/waitlist.mts';

const realFetch = globalThis.fetch;
const realNetlify = globalThis.Netlify;
let state;
const valid = { name: 'Persona QA', email: 'qa@example.test', consent: true, website: '' };
const reset = () => { state = { flag: 'si', configFail: false, saved: { ok: true }, secret: 'unit-test-secret', url: 'https://script.google.com/macros/s/fixture/exec', writes: [], failSave: false }; };
globalThis.Netlify = { env: { get: key => key === 'WAITLIST_SCRIPT_URL' ? state.url : state.secret } };
globalThis.fetch = async (url, options) => {
  if (String(url).includes('/gviz/tq')) {
    if (state.configFail) return new Response('', { status: 503 });
    const table = { cols: [{ label: 'clave' }, { label: 'valor' }], rows: state.flag === undefined ? [] : [{ c: [{ v: 'mostrar_boton_vender' }, { v: state.flag }] }] };
    return new Response(`google.visualization.Query.setResponse(${JSON.stringify({ table })});`);
  }
  state.writes.push(JSON.parse(options.body));
  if (state.failSave) throw new Error('Upstream error');
  return new Response(JSON.stringify(state.saved));
};
const send = (body = valid, options = {}) => handler(new Request('https://fixture.test/api/waitlist', {
  method: options.method || 'POST',
  headers: { origin: options.origin || 'https://fixture.test', 'content-type': options.type || 'application/json' },
  ...(options.method === 'GET' ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) })
}));
let checks = 0;
try {
  for (const [body, status] of [[{ ...valid, consent: false }, 400], [{ ...valid, email: 'invalid' }, 400], [{ ...valid, name: '' }, 400], [{ ...valid, name: 'a'.repeat(81) }, 400], [{ ...valid, name: 'a\nb' }, 400], [{ ...valid, website: 'bot' }, 400], [{ ...valid, admin: true }, 400], [[], 400], ['bad json', 400], ['x'.repeat(4097), 413]]) {
    reset(); assert.equal((await send(body)).status, status); assert.equal(state.writes.length, 0); checks++;
  }
  reset(); assert.equal((await send(valid, { method: 'GET' })).status, 405); checks++;
  reset(); assert.equal((await send(valid, { origin: 'https://other.test' })).status, 403); checks++;
  reset(); assert.equal((await send(valid, { type: 'text/plain' })).status, 415); checks++;
  for (const flag of ['no', false, '', 'invalid']) { reset(); state.flag = flag; assert.equal((await send()).status, 403); assert.equal(state.writes.length, 0); checks++; }
  for (const flag of ['Sí', true, undefined]) { reset(); state.flag = flag; const response = await send({ ...valid, email: ' QA@EXAMPLE.TEST ', name: ' Persona QA ' }); assert.deepEqual(await response.json(), { ok: true }); assert.equal(state.writes[0].email, 'qa@example.test'); assert.equal(state.writes[0].name, 'Persona QA'); checks++; }
  reset(); state.configFail = true; assert.equal((await send()).status, 503); assert.equal(state.writes.length, 0); checks++;
  reset(); state.secret = ''; assert.equal((await send()).status, 503); assert.equal(state.writes.length, 0); checks++;
  reset(); state.url = 'http://localhost/private'; assert.equal((await send()).status, 503); assert.equal(state.writes.length, 0); checks++;
  for (const saved of [{ ok: false }, { status: 'success' }]) { reset(); state.saved = saved; const response = await send(); assert.equal(response.status, 503); assert.ok(!(await response.text()).includes('qa@example.test')); checks++; }
  reset(); state.failSave = true; assert.equal((await send()).status, 503); checks++;
  assert.deepEqual(config.rateLimit, { windowLimit: 5, windowSize: 60, aggregateBy: ['ip', 'domain'] });
} finally { globalThis.fetch = realFetch; globalThis.Netlify = realNetlify; }

const source = await readFile(new URL('../integrations/waitlist/Code.gs', import.meta.url), 'utf8');
let rows, locked, failFlush;
const headers = ['Fecha de inscripción', 'Nombre', 'Mail', 'Estado', 'Fecha de contacto', 'Consentimiento'];
const script = vm.createContext({
  PropertiesService: { getScriptProperties: () => ({ getProperty: key => key === 'WAITLIST_SECRET' ? 'unit-test-secret' : 'private-fixture' }) },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: body => ({ body, setMimeType() { return this; } }) },
  LockService: { getScriptLock: () => ({ tryLock: () => !locked, releaseLock: () => {} }) },
  SpreadsheetApp: { openById: () => ({ getSheetByName: () => ({
    getLastRow: () => rows.length,
    getRange: (row, column) => ({
      getValues: () => [rows[row - 1]],
      setValues: values => { rows[row - 1] = values[0]; },
      setNumberFormat: () => {},
      createTextFinder: email => ({ matchEntireCell() { return this; }, matchCase() { return this; }, findNext: () => rows.slice(1).find(r => r[2] === email) || null })
    })
  }) }), flush: () => { if (failFlush) throw new Error('Write failure'); } }
});
vm.runInContext(source, script);
const post = body => JSON.parse(script.doPost({ postData: { contents: JSON.stringify(body) } }).body);
const payload = { ...valid, secret: 'unit-test-secret', policy: 'waitlist-v1' };
rows = [headers]; locked = false; failFlush = false;
assert.equal(post({ ...payload, secret: 'wrong' }).ok, false); assert.equal(rows.length, 1); checks++;
assert.equal(post({ ...payload, consent: false }).ok, false); assert.equal(rows.length, 1); checks++;
locked = true; assert.equal(post(payload).ok, false); assert.equal(rows.length, 1); locked = false; checks++;
assert.equal(post({ ...payload, name: '=FORMULA()' }).ok, true); assert.equal(rows[1][1], "'=FORMULA()"); checks++;
assert.equal(post(payload).ok, true); assert.equal(rows.length, 2); checks++;
failFlush = true; assert.equal(post({ ...payload, email: 'another@example.test' }).ok, false); checks++;
console.log(`PASS: ${checks} waitlist checks: validation, consent, flag, private configuration, failures, locking, duplicates and formula escaping.`);
