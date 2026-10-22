import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import vm from 'node:vm';
import handler from '../netlify/functions/product-intake.mts';
import waitlist from '../netlify/functions/waitlist.mts';
import { issueIntakeToken, readIntakeToken, validateProduct, validatePhotos, productFingerprint } from '../netlify/lib/product-intake.mjs';
import { categories, conditions, currencies, limits } from '../product-options.mjs';

const secret = 'unit-test-only-secret-with-at-least-32-characters';
const token = issueIntakeToken('Persona QA', 'qa@example.test', secret, 1000);
assert.equal(readIntakeToken(token, secret, 1001).email, 'qa@example.test');
assert.ok(!token.includes('qa@example.test'));
assert.throws(() => readIntakeToken(token, secret, 1000 + 6 * 3600000));
assert.throws(() => readIntakeToken(token + 'tampered', secret, 1001));
assert.throws(() => readIntakeToken(token, 'different-secret-of-at-least-32-characters', 1001));
const product = { id: randomUUID(), title: '=Literal, sin ejecutar', category: categories[0], condition: conditions[1], city: 'Mar del Plata, Argentina', description: '', price: null, currency: 'ARS', consent: true };
assert.equal(validateProduct(product).price, null);
for (const change of [{ category: 'inventada' }, { consent: false }, { price: -1 }, { price: Infinity }, { id: '../other' }, { city: '' }, { title: 'x'.repeat(121) }, { admin: true }]) assert.throws(() => validateProduct({ ...product, ...change }));
// Bounded synthetic JPEG with an EXIF segment, SOF and scan; parser contract only.
const jpeg = Buffer.from([255,216,255,225,0,6,69,88,73,70,255,192,0,11,8,0,10,0,10,1,1,17,0,255,218,0,2,11,255,217]);
const photos = await validatePhotos([new File([jpeg], 'photo.jpg', { type: 'image/jpeg' })]);
assert.equal(Buffer.from(photos[0].data, 'base64').includes(Buffer.from('EXIF')), false);
for (const file of [new File(['bad'], 'bad.jpg', { type: 'image/jpeg' }), new File([jpeg], 'bad.png', { type: 'image/png' }), new File([Buffer.alloc(limits.photoBytes + 1)], 'large.jpg', { type: 'image/jpeg' })]) await assert.rejects(() => validatePhotos([file]));
await assert.rejects(() => validatePhotos(Array(4).fill(new File([jpeg], 'photo.jpg', { type: 'image/jpeg' }))));

const realFetch = globalThis.fetch, realNetlify = globalThis.Netlify;
let enabled = 'true', writes = [], upstream = { ok: true };
globalThis.Netlify = { env: { get: key => ({ WAITLIST_SCRIPT_URL: 'https://script.google.com/macros/s/fixture/exec', WAITLIST_SCRIPT_SECRET: secret, PRODUCT_INTAKE_ENABLED: enabled })[key] } };
globalThis.fetch = async (url, options) => {
  const body = JSON.parse(options.body);
  if (body.action === 'catalog.read') return new Response(JSON.stringify({ ok: true, table: { cols: [{ label: 'clave' }, { label: 'valor' }], rows: [] } }));
  writes.push(body); return new Response(JSON.stringify(upstream));
};
const sessionToken = issueIntakeToken('Persona QA', 'qa@example.test', secret);
function send({ value = product, files = [], context = 'production', origin = 'https://fixture.test', authorization = sessionToken, extra = false } = {}) {
  const form = new FormData(); form.append('product', JSON.stringify(value));
  files.forEach(file => form.append('photo', file)); if (extra) form.append('sheet', 'private');
  return handler(new Request('https://fixture.test/api/product-intake', { method: 'POST', headers: { origin, Authorization: 'Bearer ' + authorization }, body: form }), { deploy: { context } });
}
try {
  for (const context of ['dev', 'deploy-preview', 'branch-deploy', '']) assert.equal((await send({ context })).status, 403);
  enabled = 'false'; assert.equal((await send()).status, 403); enabled = 'true';
  assert.equal((await send({ origin: 'https://other.test' })).status, 403);
  assert.equal((await send({ authorization: 'invalid' })).status, 401);
  assert.equal(writes.length, 0);
  assert.equal((await send({ value: { ...product, consent: false } })).status, 400);
  assert.equal((await send({ extra: true })).status, 400);
  assert.equal((await send({ files: [new File(['bad'], 'bad.jpg', { type: 'image/jpeg' })] })).status, 400);
  assert.equal(writes.length, 0);
  assert.deepEqual(await (await send({ files: [new File([jpeg], 'photo.jpg', { type: 'image/jpeg' })] })).json(), { ok: true, productId: product.id });
  assert.equal(writes[0].session.email, 'qa@example.test');
  assert.equal(writes[0].fingerprint, productFingerprint(writes[0].product, writes[0].photos));
  upstream = { ok: false, error: 'limit' }; assert.equal((await send()).status, 409);
  upstream = { ok: false }; assert.equal((await send()).status, 503);
  let cancelled = false;
  const oversized = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(limits.requestBytes + 1)); }, cancel() { cancelled = true; } });
  assert.equal((await handler(new Request('https://fixture.test/api/product-intake', { method: 'POST', headers: { origin: 'https://fixture.test', Authorization: 'Bearer ' + sessionToken, 'Content-Type': 'multipart/form-data; boundary=fixture' }, body: oversized, duplex: 'half' }), { deploy: { context: 'production' } })).status, 413);
  assert.equal(cancelled, true, 'Oversized streams without Content-Length must be cancelled');
  upstream = { ok: true, productsReady: true };
  const contact = await waitlist(new Request('https://fixture.test/api/waitlist', { method: 'POST', headers: { origin: 'https://fixture.test', 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Persona QA', email: 'qa@example.test', consent: true }) }), { deploy: { context: 'production' } });
  assert.equal(readIntakeToken((await contact.json()).intakeToken, secret).name, 'Persona QA');
} finally { globalThis.fetch = realFetch; globalThis.Netlify = realNetlify; }

// Apps Script real source, deterministic private Google adapters. No real writes.
const sources = await Promise.all(['Environment.gs', 'ProductContract.gs', 'Products.gs', 'Code.gs'].map(file => readFile(new URL('../integrations/waitlist/' + file, import.meta.url), 'utf8')));
let folderPrivate = true;
let rows = [], files = new Map(), appendLost = false, uploadLost = false, locked = false, fileCounter = 0;
const properties = { WAITLIST_SECRET: secret, PRODUCTS_FOLDER_ID: 'private-folder', PRODUCTS_SHEET_ID: '1' };
const context = vm.createContext({
  PropertiesService: { getScriptProperties: () => ({ getProperty: key => properties[key], setProperty: (key, value) => { properties[key] = value; } }) },
  LockService: { getScriptLock: () => ({ tryLock: () => !locked, releaseLock() {} }) },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: body => ({ body, setMimeType() { return this; } }) },
  Utilities: { DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' }, computeDigest: (type, input) => [...createHash('sha256').update(input).digest()], base64Decode: value => [...Buffer.from(value, 'base64')], getUuid: randomUUID, newBlob: value => ({ getBytes: () => [...Buffer.from(value)] }), formatDate: () => '2026-10-22 12:00:00' },
  googleApi_: (purpose, path, method, body) => {
    assert.equal(purpose, 'waitlist');
    if (path === '?fields=sheets.properties') return { sheets: [{ properties: { title: 'Productos propuestos', sheetId: 1, gridProperties: { rowCount: 10001, columnCount: 18 } } }] };
    if (method === 'get') return { values: decodeURIComponent(path).includes('A1:R1') ? [vm.runInContext('PRODUCT_HEADERS', context)] : rows.map(row => row.slice(10)) };
    assert.ok(path.includes('valueInputOption=RAW'), 'User text must remain literal, not formulas');
    if (path.includes(':append')) {
      rows.push([...body.values[0]]); if (appendLost) { appendLost = false; throw new Error('Lost append response'); }
      return { updates: { updatedRange: "'Productos propuestos'!A" + (rows.length + 1) + ':R' + (rows.length + 1) } };
    }
    const range = decodeURIComponent(path).match(/!([KN])(\d+)/);
    assert.ok(range); const offset = range[1] === 'K' ? 10 : 13;
    body.values[0].forEach((value, i) => { rows[Number(range[2]) - 2][offset + i] = value; });
    return {};
  },
  __drive: (path, method, body, contentType, allowMissing) => {
    if (path.startsWith('drive/v3/files/private-folder')) return { mimeType: 'application/vnd.google-apps.folder', appProperties: { app: 'plot-twist-intake-v1' }, permissions: folderPrivate ? [{ type: 'user', role: 'owner' }] : [{ type: 'anyone', role: 'reader' }] };
    if (path.startsWith('drive/v3/files/generateIds')) return { ids: ['reserved-' + (++fileCounter)] };
    if (path.startsWith('drive/v3/files/')) { const id = path.split('/')[3].split('?')[0]; assert.equal(allowMissing, true); return files.get(id) || null; }
    assert.ok(path.startsWith('upload/drive/')); const text = Buffer.from(body).toString();
    const metadata = JSON.parse(text.split('\r\n\r\n')[1].split('\r\n--')[0]);
    assert.equal(rows.length > 0, true, 'Proposal must be recorded before file upload');
    assert.ok(rows.some(row => row[10]?.includes(metadata.id) || row[11]?.includes(metadata.id)), 'Drive ID must be reserved before upload');
    assert.equal(files.has(metadata.id), false, 'No duplicate file creation');
    files.set(metadata.id, { id: metadata.id, appProperties: metadata.appProperties });
    if (uploadLost) { uploadLost = false; throw new Error('Lost upload response'); }
    return { id: metadata.id };
  }
});
vm.runInContext(sources.join('\n'), context); vm.runInContext('driveRequest_ = __drive', context);
assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(PRODUCT_CONTRACT)', context)), { categories, conditions, currencies, limits });
assert.equal(context.setupProductIntake().ok, true);
folderPrivate = false; assert.throws(() => context.privateProductFolder_(), /Private intake folder required/); folderPrivate = true;
const session = { id: randomUUID(), name: 'Persona QA', email: 'qa@example.test' };
const payload = (p = product, images = []) => ({ action: 'product.submit', secret, policy: 'products-v1', session, product: p, photos: images, fingerprint: productFingerprint(p, images) });
const post = input => JSON.parse(context.doPost({ postData: { contents: JSON.stringify(input) } }).body);
assert.equal(post({ ...payload(), secret: 'bad' }).ok, false);
assert.equal(post(payload({ ...product, consent: false })).ok, false); assert.equal(rows.length, 0);
locked = true; assert.equal(post(payload()).ok, false); locked = false;
appendLost = true; assert.equal(post(payload()).ok, false); assert.equal(rows.length, 1);
assert.equal(post(payload()).ok, true); assert.equal(rows.length, 1);
assert.equal(rows[0][4], '=Literal, sin ejecutar'); assert.equal(rows[0][13], 'Por revisar');
rows[0][13] = 'Seleccionado por Bren';
assert.equal(post(payload()).ok, true); assert.equal(rows[0][13], 'Seleccionado por Bren');
assert.equal(post(payload({ ...product, title: 'Otro contenido' })).error, 'conflict');
const withPhotos = { ...product, id: randomUUID() };
uploadLost = true; assert.equal(post(payload(withPhotos, photos)).ok, false); assert.equal(files.size, 1);
assert.equal(post(payload(withPhotos, photos)).ok, true); assert.equal(files.size, 1); assert.equal(fileCounter, 1);
assert.equal(rows[1][13], 'Por revisar');
assert.equal(post(payload(withPhotos, photos)).ok, true); assert.equal(files.size, 1);
for (let i = rows.length; i < limits.products; i++) assert.equal(post(payload({ ...product, id: randomUUID() })).ok, true);
assert.equal(post(payload({ ...product, id: randomUUID() })).error, 'limit');
assert.equal(post(payload()).ok, true, 'Retry of accepted product still succeeds at session limit');
assert.equal(post({ secret, action: 'catalog.read', sheet: 'Productos propuestos' }).ok, false, 'Private proposals must never be projected through catalog');
console.log('PASS: opaque expiring sessions, closed inputs, consent, JPEG bounds/metadata removal, production/origin guards, optional signup token, Apps Script validation/locking, RAW private rows, reserved Drive IDs, lost append/upload recovery, duplicate/conflict/limit and public-read isolation. Google storage is simulated.');
