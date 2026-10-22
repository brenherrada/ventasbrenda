import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile(new URL('../integrations/waitlist/Code.gs', import.meta.url), 'utf8');
const fields = ['id', 'titulo', 'descripcion', 'precio', 'disponible', 'imagenes', 'categoria', 'vendido', 'badge', 'reservado'];
let reads = 0;
const data = {
  Catalogo: [[...fields.slice(0, 9), 'private', 'reservado', 'future_private'], ['one', 'Public title', 'Public description', 123, 'si', '', 'Libros', false, '', 'PRIVATE_NOTE', true, 'PRIVATE_OTHER']],
  Config: [['clave', 'valor'], ['titulo', 'Public title'], ['secret_future_key', 'PRIVATE_CONFIG']],
  Ventas: [['concepto', 'importe'], ['PRIVATE_CUSTOMER', 12], ['TOTAL VENDIDO', 123]],
  Pendientes: [['PRIVATE_CUSTOMER']]
};
const context = vm.createContext({
  PropertiesService: { getScriptProperties: () => ({ getProperty: key => key === 'WAITLIST_SECRET' ? 'fixture-secret' : 'private-waitlist' }) },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: body => ({ body, setMimeType() { return this; } }) },
  readSheetValues_: (purpose, range) => { reads++; assert.equal(purpose, 'catalog'); return data[range.split('!')[0]]; }
});
vm.runInContext(await readFile(new URL('../integrations/waitlist/Environment.gs', import.meta.url), 'utf8') + '\n' + source, context);
const post = input => JSON.parse(context.doPost({ postData: { contents: JSON.stringify(input) } }).body);
const read = sheet => post({ action: 'catalog.read', sheet, secret: 'fixture-secret' });
for (const input of [null, [], {}, {action:'catalog.read',sheet:'Ventas'}, {action:'catalog.read',sheet:'Ventas',secret:'wrong'}]) {
  assert.equal(post(input).ok, false);
}
assert.equal(reads, 0, 'Unauthorized request accessed Sheets');
for (const sheet of ['Pendientes', 'Lista de espera', '__proto__', 'constructor']) assert.equal(read(sheet).ok, false);
assert.equal(reads, 0, 'Private tab accessed Sheets');
assert.equal(post({ action:'catalog.read', sheet:'Ventas', secret:'fixture-secret', range:'A:Z' }).ok, false);
assert.equal(reads, 0);
for (const sheet of ['Catalogo','Config','Ventas']) {
  const response = read(sheet);
  assert.equal(response.ok, true);
  assert.ok(!JSON.stringify(response).includes('PRIVATE'), 'Private value leaked');
  if (sheet === 'Catalogo') assert.deepEqual(response.table.cols.map(c=>c.label), fields);
  if (sheet === 'Ventas') assert.deepEqual(response.table.rows, [{ c: [{v:'TOTAL VENDIDO'}, {v:123}] }]);
}
assert.equal(JSON.parse(context.doGet().body).ok, false);
data.Catalogo[0][10] = 'renamed_reserved'; assert.equal(read('Catalogo').ok, false, 'Schema drift must fail closed');
for (const file of ['app.js','config.js','_headers','netlify/edge-functions/category-preview.ts']) {
  const content = await readFile(new URL('../'+file, import.meta.url),'utf8');
  assert.ok(!content.includes('gviz/tq') && !content.includes('SHEET_ID') && !content.includes('https://docs.google.com'), `${file} still enables direct Sheet access`);
}
// Filtered pages are edge responses: both paths must enforce the same narrow policy.
const headerSource = await readFile(new URL('../_headers', import.meta.url), 'utf8');
const edgeSource = await readFile(new URL('../netlify/edge-functions/category-preview.ts', import.meta.url), 'utf8');
const staticPolicy = headerSource.match(/Content-Security-Policy: (.+)/)?.[1];
const edgePolicy = edgeSource.match(/headers\.set\("Content-Security-Policy", "([^"]+)"\)/)?.[1];
assert.ok(staticPolicy, 'Static CSP is required');
assert.equal(edgePolicy, staticPolicy, 'Filtered and unfiltered pages must share the security policy');
const directives = new Map(staticPolicy.split(';').map(part => part.trim().split(/\s+/)).filter(part => part[0]).map(([name, ...sources]) => [name, sources]));
assert.deepEqual(directives.get('connect-src'), ["'self'", 'https://ingesteer.services-prod.nsvcs.net/rum_collection'], 'Connections must allow only the site and the exact Netlify metrics endpoint');
for (const name of ['default-src', 'script-src', 'style-src', 'font-src', 'base-uri', 'form-action']) assert.deepEqual(directives.get(name), ["'self'"], `${name} must remain restricted`);
for (const name of ['object-src', 'frame-ancestors']) assert.deepEqual(directives.get(name), ["'none'"], `${name} must remain blocked`);
assert.ok(!/unsafe-inline|unsafe-eval|\*/.test(staticPolicy), 'CSP must not introduce broad exceptions');
console.log('PASS: private bridge rejects missing/wrong credentials, private tabs, extra ranges and schema drift; public projections exclude sales detail, notes and future settings; browser has no direct Sheet fallback.');
console.log('PASS: static and category CSP stay aligned; only the exact Netlify metrics endpoint is allowed, with script, style, form and frame protections retained.');
