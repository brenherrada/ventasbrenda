import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import https from 'node:https';
import path from 'node:path';
import assert from 'node:assert/strict';
const base = new URL(process.env.QA_URL || 'https://localhost:8768');
assert.equal(base.hostname, 'localhost', 'This test only accepts the local QA adapter');
const manifest = [];
function status(route) {
  return new Promise((resolve, reject) => {
    https.get(new URL(route, base), { rejectUnauthorized: false }, response => {
      response.resume();
      response.on('end', () => resolve(response.statusCode));
    }).on('error', reject);
  });
}
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { await walk(file); continue; }
    const buffer = await readFile(file);
    const route = '/' + path.relative('dist', file);
    assert.equal(await status(route), 200, route);
    manifest.push({ route, bytes: buffer.length, sha256: createHash('sha256').update(buffer).digest('hex') });
  }
}
await walk('dist');
for (const route of ['/README.txt', '/AGENTS.md', '/package.json', '/.env', '/output/qa/hero-proposal/index.html', '/tests/e2e.mjs', '/netlify/functions/catalog.mts']) {
  assert.equal(await status(route), 404, 'Private source exposed: ' + route);
}
await writeFile('output/qa/release-2026-10-08/artifact-manifest.json', JSON.stringify(manifest, null, 2));
console.log(`${manifest.length} public files served; 7 source/private paths excluded`);
