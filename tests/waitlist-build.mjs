import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { verifyWaitlistBuildConfig } from '../scripts/waitlist-build-config.mjs';

const production = {
  NETLIFY: 'true', CONTEXT: 'production',
  WAITLIST_SCRIPT_URL: 'https://script.google.com/macros/s/qa-fixture/exec',
  WAITLIST_SCRIPT_SECRET: 'synthetic-build-test-key-32-chars-long'
};
assert.equal(verifyWaitlistBuildConfig(production), true);
for (const key of ['WAITLIST_SCRIPT_URL', 'WAITLIST_SCRIPT_SECRET']) {
  const invalid = { ...production, [key]: '' };
  assert.throws(() => verifyWaitlistBuildConfig(invalid), /Publicación bloqueada/);
}
assert.throws(() => verifyWaitlistBuildConfig({ ...production, WAITLIST_SCRIPT_URL: 'https://example.test/exec' }), /endpoint/);
assert.throws(() => verifyWaitlistBuildConfig({ ...production, WAITLIST_SCRIPT_URL: production.WAITLIST_SCRIPT_URL + ' ' }), /endpoint/);
assert.throws(() => verifyWaitlistBuildConfig({ ...production, WAITLIST_SCRIPT_SECRET: 'short-key' }), /clave privada/);
assert.throws(() => verifyWaitlistBuildConfig({ ...production, WAITLIST_SCRIPT_SECRET: '*'.repeat(64) }), /clave privada/);
for (const env of [{}, { NETLIFY: 'true', CONTEXT: 'deploy-preview' }, { NETLIFY: 'true', CONTEXT: 'dev' }]) {
  assert.equal(verifyWaitlistBuildConfig(env), false);
}

// Reproduce the incident through the real build entry point, without writes.
const missing = { ...process.env, NETLIFY: 'true', CONTEXT: 'production' };
delete missing.WAITLIST_SCRIPT_URL;
delete missing.WAITLIST_SCRIPT_SECRET;
const build = spawnSync(process.execPath, ['scripts/build.mjs'], { env: missing, encoding: 'utf8' });
assert.notEqual(build.status, 0);
assert.match(build.stderr, /Publicación bloqueada: faltan WAITLIST_SCRIPT_URL, WAITLIST_SCRIPT_SECRET/);
assert.ok(!build.stdout.includes('dist:'), 'Unconfigured production build continued');
console.log('PASS: production build blocks missing, invalid and masked configuration; local/preview builds remain available.');
