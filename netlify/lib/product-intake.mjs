import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { categories, conditions, currencies, limits } from '../../product-options.mjs';

const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const tokenKey = secret => {
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('Intake unavailable');
  return createHash('sha256').update('plot-twist-product-intake-v1\0').update(secret).digest();
};
export function issueIntakeToken(name, email, secret, now = Date.now()) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', tokenKey(secret), iv);
  const session = { id: randomUUID(), name, email, expires: now + 6 * 60 * 60 * 1000 };
  const data = Buffer.concat([cipher.update(JSON.stringify(session), 'utf8'), cipher.final()]);
  return [iv, data, cipher.getAuthTag()].map(value => value.toString('base64url')).join('.');
}
export function readIntakeToken(token, secret, now = Date.now()) {
  try {
    if (typeof token !== 'string' || token.length > 2000 || !/^[A-Za-z0-9_.-]+$/.test(token)) throw new Error();
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error();
    const [iv, data, tag] = parts.map(part => Buffer.from(part, 'base64url'));
    if (iv.length !== 12 || tag.length !== 16) throw new Error();
    const decipher = createDecipheriv('aes-256-gcm', tokenKey(secret), iv);
    decipher.setAuthTag(tag);
    const session = JSON.parse(Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8'));
    if (!idPattern.test(session.id) || !session.name || !session.email || !Number.isSafeInteger(session.expires) || session.expires <= now) throw new Error();
    return session;
  } catch { throw new Error('Invalid intake session'); }
}
const text = (value, max, required = true) => {
  if (typeof value !== 'string') throw new Error('Invalid product');
  const result = value.trim().normalize('NFC');
  if ((required && !result) || result.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(result)) throw new Error('Invalid product');
  return result;
};
export function validateProduct(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['id', 'title', 'category', 'condition', 'city', 'description', 'price', 'currency', 'consent'].includes(key))) throw new Error('Invalid product');
  if (!idPattern.test(value.id) || !categories.includes(value.category) || !conditions.includes(value.condition) || !currencies.includes(value.currency) || value.consent !== true) throw new Error('Invalid product');
  if (value.price !== null && (typeof value.price !== 'number' || !Number.isFinite(value.price) || value.price <= 0 || value.price > 1e9)) throw new Error('Invalid price');
  return { id: value.id, title: text(value.title, 120), category: value.category, condition: value.condition, city: text(value.city, 120), description: text(value.description, 1500, false), price: value.price, currency: value.currency, consent: true };
}
export async function validatePhotos(files) {
  if (files.length > limits.photos) throw new Error('Too many photos');
  const photos = [];
  for (const file of files) {
    if (!file || file.type !== 'image/jpeg' || file.size < 4 || file.size > limits.photoBytes) throw new Error('Invalid photo');
    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) throw new Error('Invalid photo');
    // Walk JPEG segments before scan data. Strip optional APP/EXIF/COM metadata;
    // only bounded JPEG dimensions are accepted, without decoding untrusted pixels.
    let cursor = 2, dimensions = false, scan = false;
    const chunks = [bytes.subarray(0, 2)];
    while (cursor + 4 <= bytes.length) {
      if (bytes[cursor] !== 0xff) throw new Error('Invalid photo');
      const marker = bytes[cursor + 1];
      const length = bytes.readUInt16BE(cursor + 2);
      if (length < 2 || cursor + 2 + length > bytes.length) throw new Error('Invalid photo');
      if (marker === 0xda) { chunks.push(bytes.subarray(cursor)); scan = true; break; }
      if ([0xc0, 0xc1, 0xc2].includes(marker)) {
        if (length < 8) throw new Error('Invalid photo');
        const height = bytes.readUInt16BE(cursor + 5), width = bytes.readUInt16BE(cursor + 7);
        if (!width || !height || width > limits.photoSide || height > limits.photoSide) throw new Error('Invalid dimensions');
        dimensions = true;
      }
      if (!(marker >= 0xe0 && marker <= 0xef) && marker !== 0xfe) chunks.push(bytes.subarray(cursor, cursor + 2 + length));
      cursor += 2 + length;
    }
    if (!dimensions || !scan) throw new Error('Invalid photo');
    photos.push({ mime: 'image/jpeg', data: Buffer.concat(chunks).toString('base64') });
  }
  return photos;
}
export function productFingerprint(product, photos) {
  return createHash('sha256').update(JSON.stringify({ product, photos })).digest('hex');
}
export { idPattern };
