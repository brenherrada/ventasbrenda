import assert from 'node:assert/strict';
import { generateKeyPairSync, verify } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import handler from '../netlify/functions/catalog.mts';
import waitlist from '../netlify/functions/waitlist.mts';
import { createDirectReader } from '../netlify/lib/catalog-direct.mjs';
import { catalogScope, directConfig } from '../netlify/lib/catalog-config.mjs';
import { verifyCatalogBuildConfig } from '../scripts/catalog-build-config.mjs';

// Ephemeral RSA credentials are never saved and never sent to Google.
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const account = { type: 'service_account', client_email: 'qa-reader@fixture-project.iam.gserviceaccount.com', private_key_id: 'a'.repeat(40), private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }), token_uri: 'https://oauth2.googleapis.com/token' };
const env = { CATALOG_SOURCE: 'direct', CATALOG_SPREADSHEET_ID: 'synthetic-workbook-123456789', CATALOG_GOOGLE_CREDENTIALS: JSON.stringify(account) };
const get = key => env[key];
const fields = ['id','titulo','descripcion','precio','disponible','imagenes','categoria','vendido','badge','private','reservado'];
const data = {
  Catalogo: [fields, ['qa','Artículo QA','Descripción',1000,'Sí','','Libros',false,'','PRIVATE_NOTE',true]],
  Config: [['clave','valor'], ['titulo','Título QA'], ['mostrar_boton_vender','si'], ['private','PRIVATE_CONFIG']],
  Ventas: [['concepto','importe'], ['PRIVATE_CUSTOMER',20], ['TOTAL VENDIDO',1000]],
};
let state;
const reset = () => { state = { auth: 0, sheets: 0, behavior: '', writes: 0 }; };
async function fixture(url, options = {}, scenario = state) {
  const target = new URL(url);
  assert.equal(options.redirect, 'error', 'Credentials must never follow redirects');
  if (target.href === 'https://oauth2.googleapis.com/token') {
    scenario.auth++;
    const assertion = new URLSearchParams(options.body).get('assertion');
    const [header, claims, signature] = assertion.split('.');
    assert.equal(JSON.parse(Buffer.from(header, 'base64url')).alg, 'RS256');
    assert.equal(verify('RSA-SHA256', Buffer.from(`${header}.${claims}`), publicKey, Buffer.from(signature, 'base64url')), true);
    const payload = JSON.parse(Buffer.from(claims, 'base64url'));
    assert.equal(payload.scope, catalogScope);
    assert.equal(payload.iss, account.client_email);
    assert.equal(payload.aud, target.href);
    assert.equal(payload.sub, undefined);
    if (scenario.behavior === 'auth403') return Response.json({ error: 'PRIVATE_AUTH' }, { status: 403 });
    if (scenario.behavior === 'auth503' && scenario.auth === 1) return Response.json({ error: 'PRIVATE_AUTH' }, { status: 503 });
    if (scenario.behavior === 'auth-invalid') return Response.json({ access_token: 'PRIVATE_TOKEN', expires_in: 1 });
    if (scenario.behavior === 'auth-slow') await delay(5000, undefined, { signal: options.signal });
    return Response.json({ access_token: `PRIVATE_TOKEN_${scenario.auth}`, token_type: 'Bearer', expires_in: scenario.lifetime ?? 3600 });
  }
  assert.equal(target.hostname, 'sheets.googleapis.com');
  assert.equal(options.method ?? 'GET', 'GET');
  assert.match(options.headers.Authorization, /^Bearer PRIVATE_TOKEN_/);
  assert.equal(target.searchParams.get('valueRenderOption'), 'UNFORMATTED_VALUE');
  assert.equal(target.searchParams.get('dateTimeRenderOption'), 'SERIAL_NUMBER');
  assert.equal(target.searchParams.get('majorDimension'), 'ROWS');
  const range = decodeURIComponent(target.pathname.split('/values/')[1]);
  assert.ok(['Catalogo!A1:K','Config!A1:B','Ventas!A1:B'].includes(range));
  assert.ok(target.pathname.includes(env.CATALOG_SPREADSHEET_ID));
  assert.ok(options.signal instanceof AbortSignal);
  scenario.sheets++;
  const sheet = range.split('!')[0];
  if (scenario.behavior === '403') return new Response('PRIVATE_PROVIDER', { status: 403 });
  if (scenario.behavior === '401' || (scenario.behavior === '401-once' && scenario.sheets === 1)) return new Response('PRIVATE_PROVIDER', { status: 401 });
  if (['429','503'].includes(scenario.behavior) && scenario.sheets === 1) return new Response('PRIVATE_PROVIDER', { status: Number(scenario.behavior) });
  if (scenario.behavior === 'network' && scenario.sheets === 1) throw new TypeError('PRIVATE_NETWORK');
  if (scenario.behavior === 'slow') await delay(5000, undefined, { signal: options.signal });
  if (scenario.behavior === 'malformed') return new Response('PRIVATE_MALFORMED');
  if (scenario.behavior === 'large') return new Response('x', { headers: { 'content-length': 5 * 1024 * 1024 } });
  if (scenario.behavior === 'large-stream') return new Response('x'.repeat(4 * 1024 * 1024 + 1));
  if (scenario.behavior === 'slow-body') return new Response(new ReadableStream({ start() {} }));
  if (sheet === 'Config' && scenario.behavior === 'config-no') return Response.json({ values: [['clave','valor'],['mostrar_boton_vender','no']] });
  return Response.json({ majorDimension: 'ROWS', values: data[sheet] });
}
const upstream = () => { const scenario=state; return (url,options) => fixture(url,options,scenario); };
const logs = [], realInfo = console.info, realFetch = globalThis.fetch, realNetlify = globalThis.Netlify;
console.info = line => logs.push(JSON.parse(line));
// Keep short AbortSignal deadlines observable even with no sockets in fixtures.
const keepAlive = setInterval(() => {}, 1000);
let checks = 0;
try {
  reset();
  const read = createDirectReader({ fetchImpl: upstream() });
  const script = vm.createContext({ readSheetValues_: (_, range) => data[range.split('!')[0]] });
  vm.runInContext(await readFile(new URL('../integrations/waitlist/Environment.gs', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../integrations/waitlist/Code.gs', import.meta.url), 'utf8'), script);
  const tables = await Promise.all(['Catalogo','Config','Ventas'].map(sheet => read(sheet, get)));
  for (const [index, sheet] of ['Catalogo','Config','Ventas'].entries()) assert.deepEqual(tables[index], JSON.parse(JSON.stringify(script.readPublicCatalog_(sheet))));
  assert.equal(state.auth, 1, 'Concurrent first reads must share authentication');
  assert.equal(state.sheets, 3); checks++;
  data.Catalogo[1][3] = 2000;
  assert.equal((await read('Catalogo', get)).rows[0].c[3].v, 2000);
  assert.equal(state.sheets, 4, 'Product data must not be cached'); assert.equal(state.auth, 1); checks++;

  for (const behavior of ['401-once','429','503','network','auth503']) {
    reset(); state.behavior = behavior;
    await createDirectReader({ fetchImpl: upstream() })('Catalogo', get);
    assert.equal(state.sheets, behavior === 'auth503' ? 1 : 2);
    assert.equal(state.auth, ['401-once','auth503'].includes(behavior) ? 2 : 1); checks++;
  }
  for (const behavior of ['403','401','malformed','large','large-stream','auth403','auth-invalid']) {
    reset(); state.behavior = behavior;
    await assert.rejects(createDirectReader({ fetchImpl: upstream() })('Catalogo', get));
    assert.equal(state.sheets, behavior.startsWith('auth') ? 0 : behavior === '401' ? 2 : 1); checks++;
  }
  for (const behavior of ['slow','auth-slow','slow-body']) {
    reset(); state.behavior = behavior;
    const start = performance.now();
    await assert.rejects(createDirectReader({ fetchImpl: upstream(), budgetMs: 80 })('Catalogo', get));
    assert.ok(performance.now() - start < 600, 'Total deadline must include auth, data and body'); checks++;
  }
  reset();
  const aborted = new AbortController(); aborted.abort();
  await assert.rejects(createDirectReader({ fetchImpl:upstream() })('Catalogo',get,aborted.signal));
  assert.equal(state.auth,0);assert.equal(state.sheets,0);checks++;
  reset();
  const cancelling = new AbortController();
  let ownAuth = 0;
  const sharedUpstream = upstream();
  const shared = createDirectReader({ fetchImpl:async (...args) => { if(String(args[0]).includes('oauth2.googleapis.com')) {ownAuth++;await delay(40);}return sharedUpstream(...args); } });
  const cancelled = assert.rejects(shared('Catalogo',get,cancelling.signal));
  const surviving = shared('Config',get);
  cancelling.abort();
  await cancelled; await surviving;
  assert.equal(ownAuth,1);assert.equal(state.auth,1);assert.equal(state.sheets,1);checks++;
  reset();
  let clock = Date.now();
  state.lifetime = 70;
  const expiring = createDirectReader({ fetchImpl: upstream(), now: () => clock });
  await expiring('Config', get);
  clock += 11000; state.lifetime = 3600;
  await expiring('Config', get); assert.equal(state.auth, 2); checks++;
  reset();
  const rotating = createDirectReader({ fetchImpl: upstream() });
  await rotating('Config', get);
  env.CATALOG_GOOGLE_CREDENTIALS = JSON.stringify({ ...account, private_key_id: 'b'.repeat(40) });
  await rotating('Config', get); assert.equal(state.auth, 2); checks++;
  env.CATALOG_GOOGLE_CREDENTIALS = JSON.stringify(account);

  for (const change of [{ type: 'authorized_user' }, { token_uri: 'https://example.test/token' }, { universe_domain: 'other.test' }, { subject: 'owner@example.test' }, { private_key: 'PRIVATE_BAD_KEY' }]) {
    assert.throws(() => directConfig(key => key === 'CATALOG_GOOGLE_CREDENTIALS' ? JSON.stringify({ ...account, ...change }) : get(key)), /Invalid private/); checks++;
  }
  assert.equal(verifyCatalogBuildConfig({}), false);
  assert.equal(verifyCatalogBuildConfig({ NETLIFY:'true', CONTEXT:'deploy-preview', ...env }), true);
  const functionsOnly = { NETLIFY:'true', CONTEXT:'deploy-preview', CATALOG_SOURCE:'direct', CATALOG_SPREADSHEET_ID:env.CATALOG_SPREADSHEET_ID };
  assert.equal(verifyCatalogBuildConfig(functionsOnly), true, 'Build must not demand a Functions-only secret');
  for (const invalid of [{ ...env, CATALOG_SOURCE:'unknown' }, { ...env, CATALOG_SPREADSHEET_ID:'bad' }, { ...env, CATALOG_GOOGLE_CREDENTIALS:'PRIVATE_MALFORMED' }]) assert.throws(() => verifyCatalogBuildConfig({ NETLIFY:'true', CONTEXT:'deploy-preview', ...invalid }));
  checks++;

  reset(); globalThis.fetch = fixture; globalThis.Netlify = { env: { get } };
  const response = await handler(new Request('https://fixture.test/api/catalog?sheet=Catalogo'));
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.ok(!(await response.text()).includes('PRIVATE')); checks++;
  for (const query of ['sheet=Pendientes','sheet=__proto__','sheet=Catalogo&range=A:Z','sheet=Catalogo&source=bridge','sheet=Config&sheet=Catalogo']) {
    const before = state.sheets;
    assert.ok((await handler(new Request(`https://fixture.test/api/catalog?${query}`))).status >= 400);
    assert.equal(state.sheets, before); checks++;
  }
  state.behavior = '403';
  const failed = await handler(new Request('https://fixture.test/api/catalog'));
  assert.equal(failed.status, 503); assert.deepEqual(await failed.json(), { error:'Catalog temporarily unavailable' }); checks++;
  // Even inherited writer credentials and spoofed headers cannot activate preview writes.
  const signup = () => new Request('https://fixture.test/api/waitlist', { method:'POST', headers:{ origin:'https://fixture.test', 'content-type':'application/json', 'x-nf-deploy-context':'production' }, body:JSON.stringify({ name:'QA', email:'qa@example.test', consent:true }) });
  for (const context of [undefined, { deploy:{ context:'deploy-preview' } }, { deploy:{ context:'branch-deploy' } }]) {
    const before = state.sheets;
    assert.equal((await waitlist(signup(), context)).status, 403); assert.equal(state.sheets, before); checks++;
  }
  // Production writer still depends on the direct Config read and fails closed.
  env.WAITLIST_SCRIPT_URL = 'https://script.google.com/macros/s/synthetic-writer/exec';
  env.WAITLIST_SCRIPT_SECRET = 'synthetic-writer-secret';
  globalThis.fetch = async (url, options) => {
    if (String(url) === env.WAITLIST_SCRIPT_URL) {
      state.writes++;
      assert.equal(JSON.parse(options.body).secret, env.WAITLIST_SCRIPT_SECRET);
      return Response.json({ ok:true });
    }
    return fixture(url, options);
  };
  for (const [behavior,status] of [['',200],['config-no',403],['403',503]]) {
    reset();state.behavior=behavior;
    assert.equal((await waitlist(signup(), {deploy:{context:'production'}})).status,status);
    assert.equal(state.writes,status===200?1:0);checks++;
  }
  for (const source of ['unknown','']) {
    env.CATALOG_SOURCE=source;
    const before=state.sheets;
    assert.equal((await handler(new Request('https://fixture.test/api/catalog'))).status,503);
    assert.equal(state.sheets,before);checks++;
  }
  env.CATALOG_SOURCE='direct';
  assert.ok(!JSON.stringify(logs).includes('PRIVATE'));
  assert.ok(!JSON.stringify(logs).includes(account.client_email));
  assert.ok(!JSON.stringify(logs).includes(env.CATALOG_SPREADSHEET_ID));
  checks++;
  realInfo(`PASS: ${checks} direct-reader checks; real RSA signatures, shared token renewal, fresh data, bridge parity, bounded failures, privacy and preview write blocking (synthetic upstream).`);
} finally {
  clearInterval(keepAlive); console.info = realInfo; globalThis.fetch = realFetch; globalThis.Netlify = realNetlify;
}
