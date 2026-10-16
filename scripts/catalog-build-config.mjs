import { catalogSource, bridgeConfig, directConfig } from '../netlify/lib/catalog-config.mjs';

export function verifyCatalogBuildConfig(env = process.env) {
  const get = key => env[key];
  const source = catalogSource(get);
  if (env.NETLIFY !== 'true' || env.CONTEXT === 'dev') return false;
  try {
    if (source === 'bridge') bridgeConfig(get);
    else {
      if (!/^[A-Za-z0-9_-]{20,100}$/.test(env.CATALOG_SPREADSHEET_ID || '')) throw new Error();
      // Functions-only secrets need not enter Builds. If one is supplied here,
      // validate it without printing it. Runtime/deployed preflight is required.
      if (env.CATALOG_GOOGLE_CREDENTIALS !== undefined) directConfig(get);
    }
  } catch { throw new Error('Publicación bloqueada: configuración privada del catálogo inválida.'); }
  return true;
}
