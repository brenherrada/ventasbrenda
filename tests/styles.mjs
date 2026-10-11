import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixture = await mkdtemp(path.join(tmpdir(), 'plot-twist-sass-'));
const outputs = ['styles.css', 'tokens.css', 'promo.css', 'fonts/fonts.css', 'no-script.css'];
let watcher;
async function waitFor(condition, message) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (await condition()) return;
    await delay(40);
  }
  throw new Error(message);
}
function run(option) {
  return spawnSync(process.execPath, [path.join(fixture, 'scripts/styles.mjs'), ...(option ? [option] : [])], { encoding: 'utf8' });
}
async function readOutputs() {
  return Promise.all(outputs.map(file => readFile(path.join(fixture, file), 'utf8')));
}

try {
  for (const entry of ['scss', 'scripts/styles.mjs', ...outputs]) {
    await cp(path.join(root, entry), path.join(fixture, entry), { recursive: true });
  }
  await symlink(path.join(root, 'node_modules'), path.join(fixture, 'node_modules'), 'dir');
  assert.equal(run().status, 0, 'Sass must compile all entries');
  assert.equal(run('--check').status, 0, 'Generated CSS must be synchronized');
  const stable = await readOutputs();

  await writeFile(path.join(fixture, 'styles.css'), '/* stale output */');
  assert.notEqual(run('--check').status, 0, 'Check must detect stale generated CSS');
  assert.equal(run().status, 0, 'Build must repair stale output');
  assert.deepEqual(await readOutputs(), stable);

  const sourcePath = path.join(fixture, 'scss/styles.scss');
  const source = await readFile(sourcePath, 'utf8');
  await writeFile(sourcePath, `${source}\n.invalid {`);
  assert.notEqual(run().status, 0, 'Invalid Sass must fail the build');
  assert.deepEqual(await readOutputs(), stable, 'Failed compilation must preserve every CSS output');

  let log = '';
  watcher = spawn(process.execPath, [path.join(fixture, 'scripts/styles.mjs'), '--watch']);
  watcher.stdout.on('data', data => { log += data; });
  watcher.stderr.on('data', data => { log += data; });
  await waitFor(() => log.includes('Watching scss/'), 'Watcher must remain available after a Sass error');
  await writeFile(sourcePath, `${source}\n:root { --sass-workflow-test: ready; }\n`);
  await waitFor(async () => (await readFile(path.join(fixture, 'styles.css'), 'utf8')).includes('--sass-workflow-test: ready'), 'Saving corrected Sass must automatically rebuild CSS');
  assert.equal(run('--check').status, 0);
  console.log('PASS: build, stale-output detection, failure preservation and automatic watcher recovery.');
} finally {
  if (watcher && watcher.exitCode === null) {
    const closed = new Promise(resolve => watcher.once('close', resolve));
    watcher.kill('SIGTERM');
    await closed;
  }
  await rm(fixture, { recursive: true, force: true });
}
