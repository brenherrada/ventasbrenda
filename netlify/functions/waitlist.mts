import { intakeEnvironment, intakeGetter } from '../lib/intake-environment.mjs';
import catalog from './catalog.mts';
import type { Context } from '@netlify/functions';
import { issueIntakeToken } from '../lib/product-intake.mjs';

const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const reply = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers });
const normalize = (value: unknown) => String(value ?? '').normalize('NFKD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase();

export default async (request: Request, context?: Pick<Context, 'deploy'>) => {
  if (request.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
  // Trust platform metadata, never a request header or the visible form state.
  // Local, previews and missing/unknown contexts cannot reach the writer.
  const environment = intakeEnvironment(context, key => Netlify.env.get(key));
  if (!environment) return reply(403, { error: 'registration_disabled' });
  const get = intakeGetter(key => Netlify.env.get(key), environment);
  if (request.headers.get('origin') !== new URL(request.url).origin) return reply(403, { error: 'origin_not_allowed' });
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') return reply(415, { error: 'json_required' });
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 4096) return reply(413, { error: 'request_too_large' });
    let input;
    try { input = JSON.parse(raw); } catch (_) { return reply(400, { error: 'invalid_input' }); }
    if (!input || typeof input !== 'object' || Array.isArray(input) ||
        Object.keys(input).some(key => !['name', 'email', 'website', 'consent'].includes(key)) ||
        typeof input.name !== 'string' || typeof input.email !== 'string' || input.consent !== true ||
        (input.website !== undefined && input.website !== '')) return reply(400, { error: 'invalid_input' });
    const name = input.name.trim().normalize('NFC');
    const email = input.email.trim().toLowerCase();
    if (!name || name.length > 80 || /[\x00-\x1f\x7f]/.test(name) || email.length > 254 ||
        !/^[^\s@\x00-\x1f]+@[^\s@\x00-\x1f]+\.[^\s@\x00-\x1f]+$/.test(email)) return reply(400, { error: 'invalid_input' });

    // Honor the same Sheet flag as the invitation, including its existing default.
    const response = await catalog(new Request(new URL('/api/catalog?sheet=Config', request.url)), context);
    if (!response.ok) return reply(503, { error: 'temporarily_unavailable' });
    const data = await response.json();
    const rows = data.table?.rows;
    if (!Array.isArray(rows)) return reply(503, { error: 'temporarily_unavailable' });
    const flag = rows.find(row => normalize(row.c?.[0]?.v) === 'mostrar_boton_vender');
    if (flag && !['si', 'true', '1', 'yes'].includes(normalize(flag.c?.[1]?.v))) return reply(403, { error: 'registration_disabled' });

    const url = get('WAITLIST_SCRIPT_URL');
    const secret = get('WAITLIST_SCRIPT_SECRET');
    if (!url || !secret || !/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url)) return reply(503, { error: 'temporarily_unavailable' });
    const saved = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, environment, consent: true, policy: 'waitlist-v1', secret }),
      signal: AbortSignal.timeout(20000)
    });
    if (!saved.ok) return reply(503, { error: 'temporarily_unavailable' });
    const receipt = await saved.json();
    if (receipt.ok !== true || (environment === 'preview' ? receipt.environment !== 'preview' : receipt.environment === 'preview')) return reply(503, { error: 'temporarily_unavailable' });
    // Optional intake cannot undo a confirmed contact registration.
    let intakeToken;
    try {
      if (Netlify.env.get('PRODUCT_INTAKE_ENABLED') === 'true' && receipt.productsReady === true && secret.length >= 32) {
        intakeToken = issueIntakeToken(name, email, secret);
      }
    } catch { /* Contact remains confirmed if optional intake is unavailable. */ }
    return reply(200, { ok: true, ...(intakeToken ? { intakeToken } : {}) });
  } catch (_) {
    // Never log names, emails, credentials or upstream response bodies.
    return reply(503, { error: 'temporarily_unavailable' });
  }
};

export const config = {
  path: '/api/waitlist',
  rateLimit: { windowLimit: 5, windowSize: 60, aggregateBy: ['ip', 'domain'] }
};
