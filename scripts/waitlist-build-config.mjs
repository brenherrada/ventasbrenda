import { intakeGetter } from '../netlify/lib/intake-environment.mjs';

export function verifyWaitlistBuildConfig(env = process.env) {
  const preview = env.CONTEXT === 'deploy-preview' && env.WAITLIST_PREVIEW_ENABLED === 'true';
  if (env.NETLIFY !== 'true' || (env.CONTEXT !== 'production' && !preview)) return false;
  const get = intakeGetter(key => env[key], preview ? 'preview' : 'production');
  const missing = ['WAITLIST_SCRIPT_URL', 'WAITLIST_SCRIPT_SECRET'].filter(key => !get(key)?.trim());
  if (missing.length) {
    throw new Error(`Publicación bloqueada: faltan ${missing.join(', ')} en producción. Configurá los valores en Netlify para Builds y Functions.`);
  }
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(get('WAITLIST_SCRIPT_URL'))) {
    throw new Error('Publicación bloqueada: WAITLIST_SCRIPT_URL no es un endpoint /exec de Google Apps Script.');
  }
  if (get('WAITLIST_SCRIPT_SECRET').trim().length < 32 || /^\*+$/.test(get('WAITLIST_SCRIPT_SECRET').trim())) {
    throw new Error('Publicación bloqueada: WAITLIST_SCRIPT_SECRET debe contener una clave privada válida de al menos 32 caracteres.');
  }
  if (preview && ['WAITLIST_SCRIPT_URL', 'WAITLIST_SCRIPT_SECRET'].some(key => get(key) === env[key])) {
    throw new Error('Publicación bloqueada: preview y producción deben usar conexiones diferentes.');
  }
  return true;
}
