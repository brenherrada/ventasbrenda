import assert from 'node:assert/strict';
import { readFile, stat, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Netlify treats this TypeScript source as ESM. Give Node the same module type
// without changing the project's package type or modifying the source.
const temporary = await mkdtemp(path.join(tmpdir(), 'collective-edge-'));
let previewCategory;
try {
  const module = path.join(temporary, 'category-preview.mts');
  await writeFile(module, await readFile(new URL('../netlify/edge-functions/category-preview.ts', import.meta.url)));
  ({ default: previewCategory } = await import(pathToFileURL(module)));
} finally {
  await rm(temporary, { recursive: true, force: true });
}

const root = new URL('../dist/', import.meta.url);
const html = await readFile(new URL('index.html', root), 'utf8');
const css = await readFile(new URL('site.css', root), 'utf8');
const client = await readFile(new URL('waitlist.js', root), 'utf8');
assert.equal([...html.matchAll(/<h1\b/g)].length, 1);
assert.match(html, /<html lang="es" data-page="collective">/);
assert.match(html, /<link rel="canonical" href="https:\/\/plottwistcolectivo.ar\/"/);
assert.match(html, /La propuesta está en desarrollo/);
assert.match(html, /<form[^>]+action="\/api\/waitlist"/);
assert.doesNotMatch(html, /(?:app|navigation|config)\.js|purchaseCountdown|id="products"|id="openBag"/);
assert.doesNotMatch(css, /\.drawer\{|\.product-feature\{|\.purchase-countdown/);
for (const name of ['app.js', 'navigation.js', 'config.js', 'styles.css', 'promo.css']) {
  await assert.rejects(stat(new URL(name, root)), { code: 'ENOENT' });
}
assert.doesNotMatch(client, /sheet=(?:Catalogo|Ventas)|localStorage|docs\.google\.com/);
const references = [...html.matchAll(/(?:src|href)="([^"?#]+)(?:\?[^"#]*)?"/g)].map(m => m[1]);
for (const match of html.matchAll(/srcset="([^"]+)"/g)) references.push(...match[1].split(',').map(item => item.trim().split(/\s+/)[0]));
for (const match of css.matchAll(/url\(([^)]+)\)/g)) references.push(match[1].replace(/["']/g, ''));
for (const reference of new Set(references)) {
  if (/^(?:https?:|data:)/.test(reference)) continue;
  await stat(new URL(reference.replace(/^\//, ''), root));
}
// Old shared filters must keep the announcement's current metadata and canonical.
for (const params of ['categoria=cocina', 'badge=recien-agregado', 'categoria=libros']) {
  const response = await previewCategory(new Request('https://plottwistcolectivo.ar/?' + params), {
    next: async () => new Response(html, { headers: { 'Content-Type': 'text/html', 'Content-Length': '12' } })
  });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), html);
  assert.equal(response.headers.has('content-length'), false);
}
console.log('PASS: landing metadata/content, existing signup contract, historical query links, complete assets and exclusion of retired catalog UI/scripts.');
