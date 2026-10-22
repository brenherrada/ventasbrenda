import type { Context } from '@netlify/functions';
import { intakeEnvironment, intakeGetter } from '../lib/intake-environment.mjs';
import catalog from './catalog.mts';
import { bridgeConfig } from '../lib/catalog-config.mjs';
import { readIntakeToken, validateProduct, validatePhotos, productFingerprint } from '../lib/product-intake.mjs';
import { limits } from '../../product-options.mjs';
const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const reply = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers });
const normalize = (v: unknown) => String(v ?? '').normalize('NFKD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase();

export default async (request: Request, context?: Pick<Context, 'deploy'>) => {
  if (request.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
  const environment = intakeEnvironment(context, key => Netlify.env.get(key));
  if (!environment || Netlify.env.get('PRODUCT_INTAKE_ENABLED') !== 'true') return reply(403, { error: 'intake_disabled' });
  if (request.headers.get('origin') !== new URL(request.url).origin) return reply(403, { error: 'origin_not_allowed' });
  const connection = (() => { try { return bridgeConfig(intakeGetter(key => Netlify.env.get(key), environment)); } catch { return null; } })();
  if (!connection) return reply(503, { error: 'temporarily_unavailable' });
  let session;
  try { session = readIntakeToken(request.headers.get('authorization')?.replace(/^Bearer /, ''), connection.secret); }
  catch { return reply(401, { error: 'session_expired' }); }
  try {
    const response = await catalog(new Request(new URL('/api/catalog?sheet=Config', request.url)), context);
    if (!response.ok) return reply(503, { error: 'temporarily_unavailable' });
    const rows = (await response.json()).table?.rows;
    if (!Array.isArray(rows)) return reply(503, { error: 'temporarily_unavailable' });
    const flag = rows.find(row => normalize(row.c?.[0]?.v) === 'mostrar_boton_vender');
    if (flag && !['si', 'true', '1', 'yes'].includes(normalize(flag.c?.[1]?.v))) return reply(403, { error: 'intake_disabled' });
    if (!request.headers.get('content-type')?.startsWith('multipart/form-data;')) return reply(415, { error: 'multipart_required' });
    // Enforce size while reading, including requests with no Content-Length.
    const reader = request.body?.getReader();
    if (!reader) return reply(400, { error: 'invalid_product' });
    let size = 0; const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > limits.requestBytes) { await reader.cancel(); return reply(413, { error: 'too_large' }); }
      chunks.push(value);
    }
    let form: FormData;
    try {
      form = await new Request(request.url, { method: 'POST', headers: { 'Content-Type': request.headers.get('content-type')! }, body: Buffer.concat(chunks) }).formData();
    } catch { return reply(400, { error: 'invalid_product' }); }
    if ([...form.keys()].some(key => !['product', 'photo'].includes(key)) || form.getAll('product').length !== 1) return reply(400, { error: 'invalid_product' });
    let product, photos;
    try {
      product = validateProduct(JSON.parse(String(form.get('product'))));
      photos = await validatePhotos(form.getAll('photo'));
    } catch { return reply(400, { error: 'invalid_product' }); }
    const saved = await fetch(connection.url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: connection.secret, action: 'product.submit', environment, policy: 'products-v1', session: { id: session.id, name: session.name, email: session.email }, product, photos, fingerprint: productFingerprint(product, photos) }),
      signal: AbortSignal.timeout(40000)
    });
    if (!saved.ok) return reply(503, { error: 'temporarily_unavailable' });
    const result = await saved.json();
    if (result.ok !== true || (environment === 'preview' ? result.environment !== 'preview' : result.environment === 'preview')) return reply(result.error === 'limit' ? 409 : 503, { error: result.error === 'limit' ? 'product_limit' : 'temporarily_unavailable' });
    return reply(200, { ok: true, productId: product.id });
  } catch { return reply(503, { error: 'temporarily_unavailable' }); }
};
export const config = { path: '/api/product-intake', rateLimit: { windowLimit: 12, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
