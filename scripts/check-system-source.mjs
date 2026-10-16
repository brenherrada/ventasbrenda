import { readFile, stat } from 'node:fs/promises';
import assert from 'node:assert/strict';

// Run after build. The local demonstration reuses the catalog document,
// but neither the presentation nor its synthetic data belongs in the public build.
const index = await readFile('index.html', 'utf8');
const runtime = await readFile('sistema-runtime.html', 'utf8');
const normalized = runtime
  .replace('  <script src="sistema-runtime.js"></script>\n', '')
  .replace('<meta name="robots" content="noindex, nofollow" />\n  ', '');
assert.equal(normalized, index, 'Presentation runtime diverges from the production document');
for (const file of ['sistema-runtime.html', 'sistema-runtime.js', 'sistema-visual.html', 'sistema-visual-calmo.html', 'sistema-visual.css', 'images/system-preview']) {
  await assert.rejects(stat(`dist/${file}`), { code: 'ENOENT' }, `${file} must stay out of the public build`);
}
for (const file of ['app.js','navigation.js','config.js']) {
  assert.equal(await readFile(`dist/${file}`, 'utf8'), await readFile(file,'utf8'), `${file} must be the original source`);
}
const page = await readFile('sistema-visual.html','utf8');
assert.doesNotMatch(page, /vs-live-dialog|vs-popup-surface|data-vs-zoom|[↗↘↖↙]/);
assert.doesNotMatch(page, /\sstyle=/, 'Local presentation must work with the existing CSP');
assert.match(page, /site\.css|styles\.css/);
console.log('PASS: local demonstration matches the catalog source, original app/navigation/config, no duplicated popup or motion implementation; presentation and sample data excluded from dist.');
