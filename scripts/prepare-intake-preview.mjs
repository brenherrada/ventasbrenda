import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const source = path.resolve('integrations/waitlist');
const destination = path.resolve('output/backups/collective-products-20261022/preview-bridge');
await mkdir(destination, { recursive: true, mode: 0o700 });
for (const name of await readdir(source)) {
  if (!/\.(gs|json)$/.test(name)) continue;
  let content = await readFile(path.join(source, name), 'utf8');
  if (name === 'Environment.gs') {
    if (!content.includes("const INTAKE_ENVIRONMENT = 'production';")) throw new Error('Expected production source template');
    content = content.replace("const INTAKE_ENVIRONMENT = 'production';", "const INTAKE_ENVIRONMENT = 'preview';");
  }
  await writeFile(path.join(destination, name), content, { mode: 0o600 });
}
console.log('Prepared private preview-only Apps Script source. No credentials copied.');
