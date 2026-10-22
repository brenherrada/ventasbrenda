import { watch } from 'node:fs';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as sass from 'sass';

const root = fileURLToPath(new URL('../', import.meta.url));
const entries = [
  ['scss/fonts.scss', 'fonts/fonts.css'],
  ['scss/tokens.scss', 'tokens.css'],
  ['scss/styles.scss', 'styles.css'],
  ['scss/collective.scss', 'collective.css'],
  ['scss/promo.scss', 'promo.css'],
  ['scss/no-script.scss', 'no-script.css'],
];
const mode = process.argv[2];
if (mode && !['--check', '--watch'].includes(mode)) {
  throw new Error(`Unknown styles option: ${mode}`);
}

async function compile() {
  // Compile every entry before writing: a Sass error leaves usable CSS in place.
  const compiled = await Promise.all(entries.map(async ([source, output]) => {
    const result = await sass.compileAsync(path.join(root, source), {
      style: 'expanded',
      charset: false,
      sourceMap: false,
    });
    const css = `/* Generated from ${source}. Edit Sass, then run npm run styles:build. */\n${result.css}\n`;
    const current = await readFile(path.join(root, output), 'utf8').catch(error => {
      if (error.code === 'ENOENT') return '';
      throw error;
    });
    return { output, css, changed: current !== css };
  }));
  const changed = compiled.filter(entry => entry.changed);
  if (mode === '--check') {
    if (changed.length) throw new Error(`CSS needs rebuilding: ${changed.map(entry => entry.output).join(', ')}`);
    console.log(`PASS: all ${entries.length} CSS outputs match their Sass sources.`);
    return;
  }
  for (const { output, css } of changed) {
    const destination = path.join(root, output);
    const temporary = `${destination}.tmp`;
    await writeFile(temporary, css);
    await rename(temporary, destination);
  }
  console.log(`Sass: ${entries.length} stylesheets compiled; ${changed.length} updated.`);
}

if (mode === '--watch') {
  let timer;
  let running = false;
  let pending = false;
  async function rebuild() {
    if (running) { pending = true; return; }
    running = true;
    do {
      pending = false;
      try { await compile(); }
      catch (error) { console.error(error.message); }
    } while (pending);
    running = false;
  }
  const watcher = watch(path.join(root, 'scss'), { recursive: true }, (_event, filename) => {
    if (filename && !filename.endsWith('.scss')) return;
    clearTimeout(timer);
    timer = setTimeout(rebuild, 80);
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => { clearTimeout(timer); watcher.close(); });
  }
  await rebuild();
  console.log('Watching scss/. Sass errors preserve the previous CSS; save again to retry.');
} else {
  await compile();
}
