import { createPrivateKey } from 'node:crypto';

export const catalogRanges = Object.freeze({ Catalogo: 'Catalogo!A1:K', Config: 'Config!A1:B', Ventas: 'Ventas!A1:B' });
export const catalogScope = 'https://www.googleapis.com/auth/spreadsheets.readonly';
export function catalogSource(get) {
  const source = get('CATALOG_SOURCE') ?? 'bridge';
  if (source !== 'bridge' && source !== 'direct') throw new Error('Invalid CATALOG_SOURCE');
  return source;
}
export function bridgeConfig(get) {
  const url = get('WAITLIST_SCRIPT_URL'), secret = get('WAITLIST_SCRIPT_SECRET');
  if (!url || !secret || !/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url)) throw new Error('Missing private catalog connection');
  return { url, secret };
}
export function directConfig(get) {
  // No ADC, user OAuth, file/URL credential loading or impersonation.
  try {
    const spreadsheetId = get('CATALOG_SPREADSHEET_ID'), raw = get('CATALOG_GOOGLE_CREDENTIALS');
    if (typeof spreadsheetId !== 'string' || !/^[A-Za-z0-9_-]{20,100}$/.test(spreadsheetId) || typeof raw !== 'string' || raw.length > 16384) throw new Error();
    const account = JSON.parse(raw);
    if (account?.type !== 'service_account' || typeof account.client_email !== 'string' ||
        !/^[a-z0-9-]+@[a-z0-9-]+\.iam\.gserviceaccount\.com$/.test(account.client_email) ||
        typeof account.private_key_id !== 'string' || !/^[a-f0-9]{40}$/.test(account.private_key_id) ||
        typeof account.private_key !== 'string' || !account.private_key.startsWith('-----BEGIN PRIVATE KEY-----') ||
        (account.token_uri !== undefined && account.token_uri !== 'https://oauth2.googleapis.com/token') ||
        (account.universe_domain !== undefined && account.universe_domain !== 'googleapis.com') || account.subject !== undefined) throw new Error();
    const key = createPrivateKey(account.private_key);
    if (key.asymmetricKeyType !== 'rsa' || key.asymmetricKeyDetails?.modulusLength < 2048) throw new Error();
    return { spreadsheetId, email: account.client_email, keyId: account.private_key_id, key: account.private_key };
  } catch { throw new Error('Invalid private catalog credentials'); }
}
