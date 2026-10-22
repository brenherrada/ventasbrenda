// Optional proposals: existing technical Sheets writer + owner's app-created Drive files.
// Never expose this private tab through catalog.read. Run setupProductIntake as owner.
const PRODUCT_HEADERS = ['Fecha de propuesta', 'Nombre', 'Mail', 'Ciudad y país', 'Producto', 'Categoría', 'Estado del producto', 'Precio estimado', 'Moneda', 'Descripción', 'Foto 1', 'Foto 2', 'Foto 3', 'Revisión', 'ID de propuesta', 'ID de sesión', 'Huella de envío', 'Consentimiento'];
const PRODUCT_APP = 'plot-twist-intake-v1';
const PRODUCT_RANGE = "'Productos propuestos'!";
const PRODUCT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function driveRequest_(path, method, body, contentType, allowMissing) {
  const response = UrlFetchApp.fetch('https://www.googleapis.com/' + path, {
    method: method, headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    ...(body === undefined ? {} : { contentType: contentType || 'application/json', payload: contentType ? body : JSON.stringify(body) }),
    muteHttpExceptions: true, followRedirects: false
  });
  if (allowMissing && response.getResponseCode() === 404) return null;
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    let reason = '';
    try {
      const candidate = JSON.parse(response.getContentText()).error?.errors?.[0]?.reason;
      if (['accessNotConfigured', 'insufficientPermissions', 'storageQuotaExceeded', 'rateLimitExceeded', 'forbidden', 'notFound'].indexOf(candidate) !== -1) reason = ' · ' + candidate;
    } catch (_) {}
    // Only status + a fixed safe reason: never an upstream body or OAuth token.
    throw new Error('Private photo storage unavailable · HTTP ' + response.getResponseCode() + reason);
  }
  return JSON.parse(response.getContentText());
}

function privateProductFolder_() {
  const id = intakeProperties_().getProperty('PRODUCTS_FOLDER_ID');
  if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) throw new Error('Intake setup required');
  const folder = driveRequest_('drive/v3/files/' + id + '?fields=id,mimeType,trashed,appProperties,permissions(type,role)', 'get');
  if (folder.trashed || folder.mimeType !== 'application/vnd.google-apps.folder' || folder.appProperties?.app !== PRODUCT_APP ||
      !Array.isArray(folder.permissions) || folder.permissions.length !== 1 || folder.permissions[0].type !== 'user' || folder.permissions[0].role !== 'owner') throw new Error('Private intake folder required');
  return id;
}

function productValues_(range) {
  // No input from the public request can select a tab or a range.
  if ([PRODUCT_RANGE + 'A1:R1', PRODUCT_RANGE + 'K2:R10001'].indexOf(range) === -1) throw new Error('Invalid product range');
  return googleApi_('waitlist', '/values/' + encodeURIComponent(range) + '?valueRenderOption=UNFORMATTED_VALUE', 'get').values || [];
}

function setupProductIntake() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Setup busy; retry');
  try {
    const properties = intakeProperties_();
    const book = googleApi_('waitlist', '?fields=sheets.properties', 'get');
    let tab = book.sheets.find(sheet => sheet.properties.title === 'Productos propuestos');
    if (!tab) {
      const created = googleApi_('waitlist', ':batchUpdate', 'post', { requests: [{ addSheet: { properties: { title: 'Productos propuestos', gridProperties: { frozenRowCount: 1, rowCount: 10001, columnCount: 18 } } } }] });
      tab = created.replies[0].addSheet;
    }
    const grid = tab.properties.gridProperties;
    if (grid.rowCount < 10001 || grid.columnCount < 18) {
      googleApi_('waitlist', ':batchUpdate', 'post', { requests: [{ updateSheetProperties: { properties: { sheetId: tab.properties.sheetId, gridProperties: { rowCount: Math.max(10001, grid.rowCount), columnCount: Math.max(18, grid.columnCount) } }, fields: 'gridProperties.rowCount,gridProperties.columnCount' } }] });
    }
    const headers = productValues_(PRODUCT_RANGE + 'A1:R1');
    if (headers.length && JSON.stringify(headers[0]) !== JSON.stringify(PRODUCT_HEADERS)) throw new Error('Existing product columns differ; no data changed');
    if (!headers.length) googleApi_('waitlist', '/values/' + encodeURIComponent(PRODUCT_RANGE + 'A1:R1') + '?valueInputOption=RAW', 'put', { values: [PRODUCT_HEADERS] });
    properties.setProperty('PRODUCTS_SHEET_ID', String(tab.properties.sheetId));
    if (!properties.getProperty('PRODUCTS_FOLDER_ID')) {
      // Root My Drive folder: no public sharing or inherited shared-folder access.
      const folder = driveRequest_('drive/v3/files?fields=id', 'post', { name: 'Plot Twist Collective · Productos propuestos' + (INTAKE_ENVIRONMENT === 'preview' ? ' · PREVIEW' : ''), mimeType: 'application/vnd.google-apps.folder', appProperties: { app: PRODUCT_APP } });
      properties.setProperty('PRODUCTS_FOLDER_ID', folder.id);
    }
    privateProductFolder_();
    return { ok: true }; // No contacts, credentials or tokens in execution logs.
  } finally { lock.releaseLock(); }
}

function productText_(value, max, required) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim()) || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)) throw new Error('Invalid proposal');
  return value.trim().normalize('NFC');
}
function productKeys_(object, keys) {
  if (!object || typeof object !== 'object' || Array.isArray(object) || Object.keys(object).some(key => keys.indexOf(key) === -1)) throw new Error('Invalid proposal');
}
function validateProposal_(input) {
  productKeys_(input, ['secret', 'action', 'environment', 'policy', 'session', 'product', 'photos', 'fingerprint']);
  if (input.policy !== 'products-v1') throw new Error('Invalid consent');
  const session = input.session, p = input.product;
  productKeys_(session, ['id', 'name', 'email']);
  if (!PRODUCT_UUID.test(session.id)) throw new Error('Invalid session');
  productText_(session.name, 80, true);
  if (typeof session.email !== 'string' || session.email.length > 254 || !/^[^\s@\x00-\x1f]+@[^\s@\x00-\x1f]+\.[^\s@\x00-\x1f]+$/.test(session.email)) throw new Error('Invalid session');
  productKeys_(p, ['id', 'title', 'category', 'condition', 'city', 'description', 'price', 'currency', 'consent']);
  if (!PRODUCT_UUID.test(p.id) || p.consent !== true || PRODUCT_CONTRACT.categories.indexOf(p.category) === -1 || PRODUCT_CONTRACT.conditions.indexOf(p.condition) === -1 || PRODUCT_CONTRACT.currencies.indexOf(p.currency) === -1 ||
      (p.price !== null && (typeof p.price !== 'number' || !isFinite(p.price) || p.price <= 0 || p.price > 1e9))) throw new Error('Invalid product');
  productText_(p.title, 120, true); productText_(p.city, 120, true); productText_(p.description, 1500, false);
  if (!Array.isArray(input.photos) || input.photos.length > PRODUCT_CONTRACT.limits.photos) throw new Error('Invalid photos');
  input.photos.forEach(photo => {
    productKeys_(photo, ['mime', 'data']);
    if (photo.mime !== 'image/jpeg' || typeof photo.data !== 'string' || photo.data.length > Math.ceil(PRODUCT_CONTRACT.limits.photoBytes / 3) * 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(photo.data)) throw new Error('Invalid photo');
    const bytes = Utilities.base64Decode(photo.data);
    if (bytes.length < 4 || bytes.length > PRODUCT_CONTRACT.limits.photoBytes || (bytes[0] & 255) !== 255 || (bytes[1] & 255) !== 216 || (bytes[bytes.length - 1] & 255) !== 217) throw new Error('Invalid photo');
  });
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify({ product: p, photos: input.photos }), Utilities.Charset.UTF_8).map(value => ('0' + ((value + 256) % 256).toString(16)).slice(-2)).join('');
  if (digest !== input.fingerprint) throw new Error('Invalid proposal fingerprint');
}

function productPhoto_(folder, input, index, fileId) {
  const props = { app: PRODUCT_APP, product: input.product.id, session: input.session.id, fingerprint: input.fingerprint, index: String(index) };
  const existing = driveRequest_('drive/v3/files/' + fileId + '?fields=id,appProperties,trashed', 'get', undefined, undefined, true);
  if (existing) {
    if (existing.trashed || !Object.keys(props).every(key => existing.appProperties?.[key] === props[key])) throw new Error('Photo identity differs');
    return;
  }
  const metadata = { id: fileId, name: 'propuesta-' + input.product.id + '-' + (index + 1) + '.jpg', parents: [folder], mimeType: 'image/jpeg', appProperties: props };
  const boundary = 'plot_twist_' + Utilities.getUuid();
  const prefix = '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata) + '\r\n--' + boundary + '\r\nContent-Type: image/jpeg\r\n\r\n';
  const body = Utilities.newBlob(prefix).getBytes().concat(Utilities.base64Decode(input.photos[index].data), Utilities.newBlob('\r\n--' + boundary + '--\r\n').getBytes());
  driveRequest_('upload/drive/v3/files?uploadType=multipart&fields=id', 'post', body, 'multipart/related; boundary=' + boundary);
}

function submitProduct_(input) {
  let lock, acquired = false;
  try {
    validateProposal_(input);
    lock = LockService.getScriptLock(); acquired = lock.tryLock(5000);
    if (!acquired) return { ok: false };
    if (!intakeProperties_().getProperty('PRODUCTS_SHEET_ID') || JSON.stringify(productValues_(PRODUCT_RANGE + 'A1:R1')[0]) !== JSON.stringify(PRODUCT_HEADERS)) return { ok: false };
    const rows = productValues_(PRODUCT_RANGE + 'K2:R10001');
    const index = rows.findIndex(row => row[4] === input.product.id);
    let rowNumber, links = ['', '', ''];
    if (index !== -1) {
      const row = rows[index];
      if (row[5] !== input.session.id || row[6] !== input.fingerprint) return { ok: false, error: 'conflict' };
      // Bren may have already selected/rejected a received proposal. A retry
      // must preserve that review decision instead of resetting its status.
      if (row[3] && row[3] !== 'Recibiendo fotos') return { ok: true };
      rowNumber = index + 2; links = row.slice(0, 3);
    } else {
      if (rows.filter(row => row[5] === input.session.id).length >= PRODUCT_CONTRACT.limits.products) return { ok: false, error: 'limit' };
      if (rows.length >= 10000) return { ok: false, error: 'capacity' };
      const p = input.product;
      // RAW makes user text literal, including spreadsheet formula prefixes.
      const values = [Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd HH:mm:ss'), input.session.name, input.session.email, p.city, p.title, p.category, p.condition, p.price === null ? '' : p.price, p.currency, p.description, '', '', '', 'Recibiendo fotos', p.id, input.session.id, input.fingerprint, 'products-v1 · revisión privada de productos y fotos'];
      const appended = googleApi_('waitlist', '/values/' + encodeURIComponent(PRODUCT_RANGE + 'A:R') + ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', 'post', { values: [values] });
      const match = /!A(\d+):R\d+$/.exec(appended.updates?.updatedRange || '');
      if (!match) throw new Error('Proposal write not confirmed');
      rowNumber = Number(match[1]);
    }
    // A private Sheet row exists BEFORE uploading. If a later request fails, its
    // photos remain attached to this proposal and retries recover by ID + hash.
    const folder = input.photos.length ? privateProductFolder_() : null;
    for (let i = 0; i < input.photos.length; i++) {
      if (!links[i]) {
        const fileId = driveRequest_('drive/v3/files/generateIds?count=1&space=drive&type=files', 'get').ids[0];
        if (!/^[A-Za-z0-9_-]+$/.test(fileId)) throw new Error('Photo ID unavailable');
        links[i] = 'https://drive.google.com/file/d/' + fileId + '/view';
      }
      // Reserve the ID in Sheets before creating the file. Lost upload responses
      // retry the SAME Drive ID, without relying on search index consistency.
      googleApi_('waitlist', '/values/' + encodeURIComponent(PRODUCT_RANGE + 'K' + rowNumber + ':N' + rowNumber) + '?valueInputOption=RAW', 'put', { values: [[links[0] || '', links[1] || '', links[2] || '', 'Recibiendo fotos']] });
      const match = /^https:\/\/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)\/view$/.exec(links[i]);
      if (!match) throw new Error('Invalid reserved photo');
      productPhoto_(folder, input, i, match[1]);
    }
    googleApi_('waitlist', '/values/' + encodeURIComponent(PRODUCT_RANGE + 'N' + rowNumber) + '?valueInputOption=RAW', 'put', { values: [['Por revisar']] });
    return { ok: true };
  } catch (_) { return { ok: false }; }
  finally { if (acquired) lock.releaseLock(); }
}
