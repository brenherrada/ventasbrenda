import { catalogSource } from '../lib/catalog-config.mjs';
import { isPublicSheet } from '../lib/catalog-contract.mjs';
import { readBridge } from '../lib/catalog-bridge.mjs';
import { readDirect } from '../lib/catalog-direct.mjs';

export default async (request: Request) => {
  const params = new URL(request.url).searchParams;
  const sheet = params.get('sheet') || 'Catalogo';
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  if (!isPublicSheet(sheet)) return new Response('Not found', { status: 404 });
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
  if ([...params.keys()].some(key => key !== 'sheet') || params.getAll('sheet').length > 1) return new Response(JSON.stringify({ error: 'Invalid catalog request' }), { status: 400, headers });
  try {
    const get = (key: string) => Netlify.env.get(key);
    const table = catalogSource(get) === 'direct' ? await readDirect(sheet, get, request.signal) : await readBridge(sheet, get);
    const payload = JSON.stringify({ table });
    if (Buffer.byteLength(payload) > 4 * 1024 * 1024) throw new Error('Catalog response too large');
    return new Response(payload, { headers });
  } catch (_) {
    return new Response(JSON.stringify({ error: 'Catalog temporarily unavailable' }), { status: 503, headers });
  }
};
export const config = {
  path: '/api/catalog',
  rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
