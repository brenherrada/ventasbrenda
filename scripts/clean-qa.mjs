import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Explicit disposable paths only. Keep source, backups and deployment state.
const root = new URL('../', import.meta.url);
for (const relative of ['output/qa/', 'playwright-report/', 'test-results/']) {
  await rm(fileURLToPath(new URL(relative, root)), { recursive: true, force: true });
}
console.log('Generated QA artifacts removed. Tests and backups preserved.');
