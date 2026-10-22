import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { intakeEnvironment, intakeGetter } from '../netlify/lib/intake-environment.mjs';
import { verifyWaitlistBuildConfig } from '../scripts/waitlist-build-config.mjs';
const values = { WAITLIST_PREVIEW_ENABLED: 'true', WAITLIST_SCRIPT_URL: 'https://script.google.com/macros/s/prod/exec', WAITLIST_SCRIPT_SECRET: 'production-fixture-secret-with-32-characters', PREVIEW_WAITLIST_SCRIPT_URL: 'https://script.google.com/macros/s/preview/exec', PREVIEW_WAITLIST_SCRIPT_SECRET: 'preview-fixture-secret-with-32-characters', CATALOG_SOURCE: 'direct', CATALOG_SPREADSHEET_ID: 'production-book', CATALOG_GOOGLE_CREDENTIALS: 'production-credentials' };
const get = key => values[key];
assert.equal(intakeEnvironment({ deploy: { context: 'production' } }, get), 'production');
assert.equal(intakeEnvironment({ deploy: { context: 'deploy-preview' } }, get), 'preview');
for (const context of ['dev', 'branch-deploy', undefined]) assert.equal(intakeEnvironment({ deploy: { context } }, get), null);
assert.equal(intakeEnvironment({ deploy: { context: 'deploy-preview' } }, () => undefined), null);
const preview = intakeGetter(get, 'preview');
assert.equal(preview('WAITLIST_SCRIPT_URL'), values.PREVIEW_WAITLIST_SCRIPT_URL);
assert.equal(preview('WAITLIST_SCRIPT_SECRET'), values.PREVIEW_WAITLIST_SCRIPT_SECRET);
assert.equal(preview('CATALOG_SOURCE'), 'bridge');
for (const key of ['CATALOG_SPREADSHEET_ID', 'CATALOG_GOOGLE_CREDENTIALS']) assert.equal(preview(key), undefined);
assert.equal(intakeGetter(key => key.startsWith('PREVIEW_') ? undefined : get(key), 'preview')('WAITLIST_SCRIPT_SECRET'), undefined, 'Never fall back to production credentials');
const build = { ...values, NETLIFY: 'true', CONTEXT: 'deploy-preview' };
assert.equal(verifyWaitlistBuildConfig(build), true);
for (const key of ['WAITLIST_SCRIPT_URL', 'WAITLIST_SCRIPT_SECRET']) {
  assert.throws(() => verifyWaitlistBuildConfig({ ...build, ['PREVIEW_' + key]: undefined }), /Publicación bloqueada/);
  assert.throws(() => verifyWaitlistBuildConfig({ ...build, ['PREVIEW_' + key]: build[key] }), /conexiones diferentes/);
}
const source = await readFile(new URL('../integrations/waitlist/Environment.gs', import.meta.url), 'utf8');
const props = { WAITLIST_SECRET: 'prod-secret', WAITLIST_SHEET_ID: 'prod-book', PRODUCTS_FOLDER_ID: 'prod-folder', PREVIEW_WAITLIST_SECRET: 'preview-secret', PREVIEW_WAITLIST_SHEET_ID: 'preview-book', PREVIEW_PRODUCTS_FOLDER_ID: 'preview-folder' };
const context = vm.createContext({ PropertiesService: { getScriptProperties: () => ({ getProperty: key => props[key], setProperty: (key, value) => props[key] = value, deleteProperty: key => delete props[key] }) } });
vm.runInContext(source.replace("const INTAKE_ENVIRONMENT = 'production';", "const INTAKE_ENVIRONMENT = 'preview';"), context);
const scoped = context.intakeProperties_();
assert.equal(scoped.getProperty('WAITLIST_SHEET_ID'), 'preview-book');
scoped.setProperty('PRODUCTS_QA_ID', 'own-fixture'); assert.equal(props.PREVIEW_PRODUCTS_QA_ID, 'own-fixture'); assert.equal(props.PRODUCTS_QA_ID, undefined);
scoped.deleteProperty('PRODUCTS_QA_ID'); assert.equal(props.PREVIEW_PRODUCTS_QA_ID, undefined);
assert.throws(() => scoped.getProperty('WAITLIST_GOOGLE_CREDENTIALS'), /Unknown/);
for (const key of ['WAITLIST_SECRET', 'WAITLIST_SHEET_ID', 'PRODUCTS_FOLDER_ID']) { const saved = props['PREVIEW_' + key]; props['PREVIEW_' + key] = props[key]; assert.throws(() => scoped.getProperty(key), /cannot share/); props['PREVIEW_' + key] = saved; }
let writes = 0, reads = 0;
Object.assign(context, { ContentService: { MimeType: { JSON: 'json' }, createTextOutput: body => ({ body, setMimeType() { return this; } }) }, submitProduct_: () => { writes++; return { ok: true }; }, readSheetValues_: (purpose, range) => { reads++; assert.equal(purpose, 'waitlist'); assert.equal(range, 'Config!A1:B'); return [['clave', 'valor'], ['mostrar_boton_vender', 'si']]; } });
vm.runInContext(await readFile(new URL('../integrations/waitlist/Code.gs', import.meta.url), 'utf8'), context);
const post = payload => JSON.parse(context.doPost({ postData: { contents: JSON.stringify(payload) } }).body);
for (const environment of [undefined, 'production']) assert.equal(post({ action: 'product.submit', environment, secret: 'preview-secret' }).ok, false);
assert.equal(writes, 0);
assert.equal(post({ action: 'product.submit', environment: 'preview', secret: 'prod-secret' }).ok, false);
assert.equal(post({ action: 'product.submit', environment: 'preview', secret: 'preview-secret' }).ok, true); assert.equal(writes, 1);
for (const sheet of ['Catalogo', 'Ventas']) assert.equal(post({ action: 'catalog.read', sheet, secret: 'preview-secret' }).ok, false);
assert.equal(reads, 0);
assert.equal(post({ action: 'catalog.read', sheet: 'Config', secret: 'preview-secret' }).environment, 'preview'); assert.equal(reads, 1);
console.log('PASS: trusted preview context, separate connection/build configuration, no credential fallback, scoped Google destinations and production catalog rejection.');

// Exercise real HTTP handlers with synthetic upstreams: no Google calls.
const { default: waitlist } = await import('../netlify/functions/waitlist.mts');
const { default: productIntake } = await import('../netlify/functions/product-intake.mts');
const { readIntakeToken, issueIntakeToken } = await import('../netlify/lib/product-intake.mjs');
const { randomUUID } = await import('node:crypto');
const { categories, conditions } = await import('../product-options.mjs');
const originalFetch = globalThis.fetch, originalNetlify = globalThis.Netlify;
const requests = []; let receiptEnvironment = 'preview';
globalThis.Netlify = { env: { get: key => ({ ...values, PRODUCT_INTAKE_ENABLED: 'true' })[key] } };
globalThis.fetch = async (url, options) => {
  assert.equal(url, values.PREVIEW_WAITLIST_SCRIPT_URL);
  const body = JSON.parse(options.body); requests.push(body);
  assert.equal(body.secret, values.PREVIEW_WAITLIST_SCRIPT_SECRET);
  if (body.action === 'catalog.read') return Response.json({ ok: true, environment: 'preview', table: { cols: [{ label: 'clave' }, { label: 'valor' }], rows: [{ c: [{ v: 'mostrar_boton_vender' }, { v: 'si' }] }] } });
  assert.equal(body.environment, 'preview');
  return Response.json({ ok: true, productsReady: true, environment: receiptEnvironment });
};
const trustedPreview = { deploy: { context: 'deploy-preview' } };
const register = () => waitlist(new Request('https://preview.test/api/waitlist', { method: 'POST', headers: { origin: 'https://preview.test', 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Persona QA', email: 'qa@example.test', consent: true }) }), trustedPreview);
try {
  const contact = await register(); assert.equal(contact.status, 200);
  const sessionToken = (await contact.json()).intakeToken;
  assert.equal(readIntakeToken(sessionToken, values.PREVIEW_WAITLIST_SCRIPT_SECRET).email, 'qa@example.test');
  assert.throws(() => readIntakeToken(sessionToken, values.WAITLIST_SCRIPT_SECRET));
  const submit = token => {
    const form = new FormData(); form.append('product', JSON.stringify({ id: randomUUID(), title: 'Producto QA', category: categories[0], condition: conditions[0], city: 'Ciudad de prueba', description: '', price: null, currency: 'ARS', consent: true }));
    return productIntake(new Request('https://preview.test/api/product-intake', { method: 'POST', headers: { origin: 'https://preview.test', Authorization: 'Bearer ' + token }, body: form }), trustedPreview);
  };
  assert.equal((await submit(sessionToken)).status, 200);
  assert.equal(requests.filter(request => request.action === 'product.submit').length, 1);
  assert.equal((await submit(issueIntakeToken('Persona QA', 'qa@example.test', values.WAITLIST_SCRIPT_SECRET))).status, 401);
  receiptEnvironment = 'production';
  assert.equal((await register()).status, 503, 'Never confirm a production receipt in preview');
  assert.equal((await submit(sessionToken)).status, 503);
} finally { globalThis.fetch = originalFetch; globalThis.Netlify = originalNetlify; }
console.log('PASS: real preview handlers use only the preview connection, reject production tokens and reject upstream receipts from another environment. Google is simulated.');
