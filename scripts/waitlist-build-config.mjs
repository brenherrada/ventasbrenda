export function verifyWaitlistBuildConfig(env = process.env) {
  if (env.NETLIFY !== 'true' || env.CONTEXT !== 'production') return false;
  const missing = ['WAITLIST_SCRIPT_URL', 'WAITLIST_SCRIPT_SECRET'].filter(key => !env[key]?.trim());
  if (missing.length) {
    throw new Error(`Publicación bloqueada: faltan ${missing.join(', ')} en producción. Configurá los valores en Netlify para Builds y Functions.`);
  }
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(env.WAITLIST_SCRIPT_URL)) {
    throw new Error('Publicación bloqueada: WAITLIST_SCRIPT_URL no es un endpoint /exec de Google Apps Script.');
  }
  if (env.WAITLIST_SCRIPT_SECRET.trim().length < 32 || /^\*+$/.test(env.WAITLIST_SCRIPT_SECRET.trim())) {
    throw new Error('Publicación bloqueada: WAITLIST_SCRIPT_SECRET debe contener una clave privada válida de al menos 32 caracteres.');
  }
  return true;
}
