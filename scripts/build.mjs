import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as sass from 'sass';
import { createHash } from 'node:crypto';
import { verifyWaitlistBuildConfig } from './waitlist-build-config.mjs';
import { verifyCatalogBuildConfig } from './catalog-build-config.mjs';

// Fail before replacing dist; do not publish an unconfigured waitlist.
if (verifyWaitlistBuildConfig()) console.log('PASS: waitlist production build configuration.');
if (verifyCatalogBuildConfig()) console.log('PASS: catalog build configuration; runtime credentials still require deployed verification.');

const root = process.cwd();
const out = path.join(root, 'dist');
const files = [
  'index.html', 'form-validation.js', 'waitlist.js', 'products.mjs', 'product-options.mjs', 'collective.css',
  'tokens.css', '_headers', 'robots.txt',
  'favicon-192.png', 'favicon-32.png', 'apple-touch-icon.png',
];
const images = [
  'venta-red-280.webp', 'venta-red-560.webp',
  'mts-hero-mobile-horizontal-540.avif', 'mts-hero-mobile-horizontal-720.avif',
  'mts-hero-mobile-horizontal.avif', 'mts-hero-tablet.avif',
  'plot-twist-desktop.webp', 'plot-twist-mobile.webp',
  'mts-hero-mobile-horizontal-540.webp', 'mts-hero-mobile-horizontal-720.webp', 'mts-hero-mobile-horizontal.webp',
  'mts-hero-tablet.webp',
];

// Only this generated directory is replaced. Source and QA evidence are preserved.
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const file of files) await cp(file, path.join(out, file));
for (const dir of ['fonts']) {
  await mkdir(path.join(out, dir), { recursive: true });
  for (const file of await readdir(dir)) {
    const publicAsset = /\.(woff2|css|js|svg|webp)$/.test(file);
    const fontLicense = dir === 'fonts' && file.endsWith('-OFL.txt');
    if (['latin-4.woff2', 'latin-5.woff2'].includes(file)) continue; // Original optimization inputs.
    if (publicAsset || fontLicense) await cp(path.join(dir, file), path.join(out, dir, file));
  }
}
await mkdir(path.join(out, 'images'), { recursive: true });
for (const file of images) {
  await mkdir(path.dirname(path.join(out, 'images', file)), { recursive: true });
  await cp(path.join('images', file), path.join(out, 'images', file));
}
await mkdir(path.join(out, 'icons'), { recursive: true });
for (const file of ['remove-product.svg', 'select-chevrons.svg']) await cp(path.join('icons', file), path.join(out, 'icons', file));
// Preserve source order and URLs while delivering one render-blocking stylesheet.
const stylesheets = ['fonts/fonts.css', 'tokens.css', 'collective.css'];
const styles = await Promise.all(stylesheets.map(async file => {
  const css = await readFile(path.join(root, file), 'utf8');
  return file.startsWith('fonts/') ? css.replace(/url\(([^)]+)\)/g, 'url(fonts/$1)') : css;
}));
const publicStyles = sass.compileString(styles.join('\n'), {
  syntax: 'css',
  style: 'compressed',
  charset: false,
}).css;
await writeFile(path.join(out, 'site.css'), publicStyles);
let page = await readFile(path.join(out, 'index.html'), 'utf8');
if (process.env.CONTEXT === 'deploy-preview') {
  page = page.replace('<body>', '<body>\n  <aside class="collective-ribbon" aria-label="Entorno de prueba">VERSIÓN DE PRUEBA · Usá datos de prueba, sin información personal real.</aside>');
}
page = page.replace(/  <link rel="stylesheet" href="(?:fonts\/fonts|tokens|collective)\.css[^"]*" \/>\n/g, '');
const styleVersion = createHash('sha256').update(publicStyles).digest('hex').slice(0, 12);
page = page.replace('  <script src="fonts/font-loading.js', `  <link rel="stylesheet" href="site.css?v=${styleVersion}" />\n  <script src="fonts/font-loading.js`);
await writeFile(path.join(out, 'index.html'), page);
for (const file of stylesheets) await rm(path.join(out, file));

let count = 0;
let bytes = 0;
async function auditDirectory(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await auditDirectory(file);
      continue;
    }
    count++;
    bytes += (await stat(file)).size;
    if (/\.(md|zip|pem|log)$/.test(file)) throw new Error('Unexpected public file: ' + file);
    if (/\.(js|html|css)$/.test(file)) {
      const content = await readFile(file, 'utf8');
      if (/SHEET_ID|gviz\/tq|docs\.google\.com\/spreadsheets\/d\//.test(content)) throw new Error('Public build contains a direct spreadsheet connection: ' + path.relative(out, file));
    }
  }
}
await auditDirectory(out);

const html = await readFile(path.join(out, 'index.html'), 'utf8');
const references = [...html.matchAll(/(?:src|href)="([^"?#]+)(?:\?[^"#]*)?"/g)].map(match => match[1]);
for (const match of html.matchAll(/srcset="([^"]+)"/g)) {
  references.push(...match[1].split(',').map(candidate => candidate.trim().split(/\s+/)[0]));
}
for (const reference of new Set(references)) {
  if (/^(?:https?:|data:)/.test(reference)) continue;
  await stat(path.join(out, reference.replace(/^\//, '')));
}
console.log(`dist: ${count} public files, ${(bytes / 1024 / 1024).toFixed(2)} MiB. No QA, prototypes or repository documentation.`);
