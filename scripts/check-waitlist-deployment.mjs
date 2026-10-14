import { execFileSync } from 'node:child_process';

// Read the actual project configuration. A successful env:set exit is not proof.
const siteId = process.env.NETLIFY_SITE_ID;
if (!siteId) {
  console.error('Definí NETLIFY_SITE_ID para comprobar el proyecto de producción.');
  process.exit(1);
}
const api = (method, data) => {
  try {
    return JSON.parse(execFileSync(process.env.NETLIFY_CLI || 'netlify',
      ['api', method, '--data', JSON.stringify(data)],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  } catch {
    throw new Error('No se pudo leer la configuración real de Netlify.');
  }
};
try {
  const site = api('getSite', { site_id: siteId });
  if (site.id !== siteId || !site.account_id) throw new Error('El proyecto no coincide con el destino solicitado.');
  const variables = api('getEnvVars', { account_id: site.account_id, site_id: siteId });
  for (const key of ['WAITLIST_SCRIPT_URL', 'WAITLIST_SCRIPT_SECRET']) {
    const variable = variables.find(item => item.key === key);
    const production = variable?.values?.find(value => value.context === 'production');
    if (!variable?.scopes?.includes('functions') || !variable.scopes.includes('builds') || !production?.value) {
      throw new Error(`${key} no está configurada para Builds y Functions en producción.`);
    }
    if (key === 'WAITLIST_SCRIPT_SECRET' && !variable.is_secret) {
      throw new Error('La clave de conexión debe estar marcada como secreta.');
    }
  }
  console.log(`PASS: conexión de producción configurada en ${site.name}; clave protegida. Falta comprobar el envío real después del deploy.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
