// Validate a LOCAL demo upload against the same production contract; never save.
import { validateProduct, validatePhotos } from '../netlify/lib/product-intake.mjs';
const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
try {
  const form = await new Request('http://localhost/api/product-intake', { method: 'POST', headers: { 'Content-Type': process.argv[2] }, body: Buffer.concat(chunks) }).formData();
  const product = validateProduct(JSON.parse(String(form.get('product'))));
  const photos = await validatePhotos(form.getAll('photo'));
  process.stdout.write(JSON.stringify({ ok: true, productId: product.id, photoCount: photos.length }));
} catch { process.stdout.write(JSON.stringify({ error: 'invalid_product' })); process.exitCode = 1; }
