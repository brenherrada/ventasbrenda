import { readFile, writeFile } from 'node:fs/promises';
import { categories, conditions, currencies, limits } from '../product-options.mjs';
const file = new URL('../integrations/waitlist/ProductContract.gs', import.meta.url);
const source = '// Generated from product-options.mjs by scripts/product-contract.mjs. Do not edit.\nconst PRODUCT_CONTRACT = ' + JSON.stringify({ categories, conditions, currencies, limits }, null, 2) + ';\n';
if (process.argv.includes('--check')) {
  if (await readFile(file, 'utf8') !== source) throw new Error('Product Apps Script contract is stale');
} else await writeFile(file, source);
