// Technical identities, never the owner's personal Sheets OAuth token.
// Store each downloaded service-account JSON only in Script Properties.
function googleIdentity_(purpose) {
  const identities = {
    catalog: { property: 'CATALOG_SERVICE_ACCOUNT', email: 'catalog-reader@plot-twist-catalog.iam.gserviceaccount.com', scope: 'https://www.googleapis.com/auth/spreadsheets.readonly', book: '18tOI0_8yoLwXR4za7XVvsOUjVrktexYldoMAlRJ1BMA' },
    waitlist: { property: 'WAITLIST_SERVICE_ACCOUNT', email: 'waitlist-writer@plot-twist-catalog.iam.gserviceaccount.com', scope: 'https://www.googleapis.com/auth/spreadsheets', book: PropertiesService.getScriptProperties().getProperty('WAITLIST_SHEET_ID') }
  };
  if (!Object.prototype.hasOwnProperty.call(identities, purpose)) throw new Error('Invalid technical identity');
  const identity = identities[purpose];
  const account = JSON.parse(PropertiesService.getScriptProperties().getProperty(identity.property) || '{}');
  if (!identity.book || account.type !== 'service_account' || account.client_email !== identity.email ||
      typeof account.private_key !== 'string' || !account.private_key.startsWith('-----BEGIN PRIVATE KEY-----') ||
      typeof account.private_key_id !== 'string' || !/^[a-f0-9]{40}$/.test(account.private_key_id)) throw new Error('Missing technical identity');
  return { account: account, scope: identity.scope, book: identity.book };
}

function googleToken_(purpose, identity) {
  const cache = CacheService.getScriptCache();
  const key = 'sheets.token.' + purpose + '.' + identity.account.private_key_id;
  const cached = cache.get(key);
  if (cached) return cached;
  const now = Math.floor(Date.now() / 1000);
  const encode = value => Utilities.base64EncodeWebSafe(JSON.stringify(value)).replace(/=+$/, '');
  const header = encode({ alg: 'RS256', typ: 'JWT', kid: identity.account.private_key_id });
  const claims = encode({ iss: identity.account.client_email, scope: identity.scope, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
  const signed = header + '.' + claims;
  const signature = Utilities.base64EncodeWebSafe(Utilities.computeRsaSha256Signature(signed, identity.account.private_key)).replace(/=+$/, '');
  const response = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post', payload: { grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: signed + '.' + signature },
    muteHttpExceptions: true, followRedirects: false
  });
  if (response.getResponseCode() !== 200) throw new Error('Technical authentication unavailable');
  const token = JSON.parse(response.getContentText());
  if (typeof token.access_token !== 'string' || token.token_type !== 'Bearer' || typeof token.expires_in !== 'number' || token.expires_in <= 120) throw new Error('Invalid technical authentication');
  cache.put(key, token.access_token, Math.min(3000, token.expires_in - 60));
  return token.access_token;
}

function googleApi_(purpose, path, method, body) {
  if (purpose === 'catalog' && method !== 'get') throw new Error('Catalog identity is read-only');
  const identity = googleIdentity_(purpose);
  const response = UrlFetchApp.fetch('https://sheets.googleapis.com/v4/spreadsheets/' + encodeURIComponent(identity.book) + path, {
    method: method, headers: { Authorization: 'Bearer ' + googleToken_(purpose, identity) },
    ...(body === undefined ? {} : { contentType: 'application/json', payload: JSON.stringify(body) }),
    muteHttpExceptions: true, followRedirects: false
  });
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) throw new Error('Private spreadsheet unavailable');
  return JSON.parse(response.getContentText());
}

function readSheetValues_(purpose, range) {
  const ranges = { catalog: ['Catalogo!A1:K', 'Config!A1:B', 'Ventas!A1:B'], waitlist: ["'Lista de espera'!A1:F1", "'Lista de espera'!C2:C"] };
  if (!Object.prototype.hasOwnProperty.call(ranges, purpose) || ranges[purpose].indexOf(range) === -1) throw new Error('Invalid private range');
  const data = googleApi_(purpose, '/values/' + encodeURIComponent(range) + '?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER', 'get');
  if (data.values !== undefined && !Array.isArray(data.values)) throw new Error('Invalid private values');
  return data.values || [];
}

function appendWaitlist_(name, email) {
  const literal = value => /^[=+\-@]/.test(value) ? "'" + value : value;
  // Native Sheets date serial in the workbook's Buenos Aires time zone.
  const localTime = Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', "yyyy-MM-dd'T'HH:mm:ss");
  const serial = Date.parse(localTime + 'Z') / 86400000 + 25569;
  const values = [
    { userEnteredValue: { numberValue: serial }, userEnteredFormat: { numberFormat: { type: 'DATE_TIME', pattern: 'dd/mm/yyyy hh:mm' } } },
    ...[literal(name), literal(email), 'En espera', '', 'waitlist-v1 · contacto por mail'].map(value => ({ userEnteredValue: { stringValue: value } }))
  ];
  googleApi_('waitlist', ':batchUpdate', 'post', { requests: [{ appendCells: { sheetId: 906247871, rows: [{ values: values }], fields: 'userEnteredValue,userEnteredFormat.numberFormat' } }] });
}
