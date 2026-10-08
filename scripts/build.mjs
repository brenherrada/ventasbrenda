import { cp, mkdir, readFile, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const out = path.join(root, 'dist');
const files = [
  'index.html', 'app.js', 'navigation.js', 'config.js', 'styles.css',
  'tokens.css', 'promo.css', 'no-script.css', '_headers', 'robots.txt',
  'favicon.svg', 'favicon-32.png', 'apple-touch-icon.png',
];
const images = [
  'badge-recien-agregado.webp', 'ilustracion-catalogo.webp',
  'logo-desktop.webp', 'logo-mobile.webp', 'mts-hero-desktop.webp',
  'mts-hero-mobile-horizontal-540.webp', 'mts-hero-mobile-horizontal-720.webp', 'mts-hero-mobile-horizontal.webp',
  'mts-hero-tablet.webp', 'perrito-cabeza.webp', 'venta-por-mudanza-share.jpg',
];

// Only this generated directory is replaced. Source and QA evidence are preserved.
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const file of files) await cp(file, path.join(out, file));
for (const dir of ['fonts', 'icons']) {
  await mkdir(path.join(out, dir), { recursive: true });
  for (const file of await readdir(dir)) {
    const publicAsset = /\.(woff2|css|js|svg|webp)$/.test(file);
    const fontLicense = dir === 'fonts' && file.endsWith('-OFL.txt');
    if (['latin-4.woff2', 'latin-5.woff2'].includes(file)) continue; // Original optimization inputs.
    if (publicAsset || fontLicense) await cp(path.join(dir, file), path.join(out, dir, file));
  }
}
await mkdir(path.join(out, 'images'), { recursive: true });
for (const file of images) await cp(path.join('images', file), path.join(out, 'images', file));
await cp('images/social', path.join(out, 'images/social'), {
  recursive: true,
  filter: source => !source.endsWith('.DS_Store'),
});

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
