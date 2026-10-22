// Web app uses technical identities; the owner grants no personal Sheets OAuth scope.
// Configure WAITLIST_SHEET_ID and WAITLIST_SECRET in Script Properties.
const WAITLIST_HEADERS = ['Fecha de inscripción', 'Nombre', 'Mail', 'Estado', 'Fecha de contacto', 'Consentimiento'];

function result_(body) {
  return ContentService.createTextOutput(JSON.stringify({ ...body, environment: INTAKE_ENVIRONMENT })).setMimeType(ContentService.MimeType.JSON);
}

function doGet() { return result_({ ok: false }); }

function doPost(event) {
  let lock;
  let acquired = false;
  try {
    const raw = event && event.postData && event.postData.contents;
    if (!raw || raw.length > 4 * 1024 * 1024) return result_({ ok: false });
    const input = JSON.parse(raw);
    if (!input || typeof input !== 'object' || Array.isArray(input)) return result_({ ok: false });
    const properties = intakeProperties_();
    if ((input.environment !== undefined && input.environment !== INTAKE_ENVIRONMENT) || (INTAKE_ENVIRONMENT === 'preview' && input.environment !== 'preview' && input.action !== 'catalog.read')) return result_({ ok: false });
    const secret = properties.getProperty('WAITLIST_SECRET');
    if (!secret || typeof input.secret !== 'string' || input.secret !== secret) return result_({ ok: false });
    if (input.action === 'product.submit') return result_(submitProduct_(input));
    if (raw.length > 4096) return result_({ ok: false });
    if (input.action === 'catalog.read') {
      if (Object.keys(input).some(key => !['secret', 'action', 'sheet'].includes(key))) return result_({ ok: false });
      return result_({ ok: true, table: readPublicCatalog_(input.sheet) });
    }
    if (input.action !== undefined) return result_({ ok: false });
    const spreadsheetId = properties.getProperty('WAITLIST_SHEET_ID');
    if (!secret || !spreadsheetId || typeof input.secret !== 'string' || input.secret !== secret ||
        input.consent !== true || input.policy !== 'waitlist-v1' || typeof input.name !== 'string' || typeof input.email !== 'string') return result_({ ok: false });
    const name = input.name.trim().normalize('NFC');
    const email = input.email.trim().toLowerCase();
    if (!name || name.length > 80 || /[\x00-\x1f\x7f]/.test(name) || email.length > 254 ||
        !/^[^\s@\x00-\x1f]+@[^\s@\x00-\x1f]+\.[^\s@\x00-\x1f]+$/.test(email)) return result_({ ok: false });
    lock = LockService.getScriptLock();
    acquired = lock.tryLock(5000);
    if (!acquired) return result_({ ok: false });
    const headers = readSheetValues_('waitlist', "'Lista de espera'!A1:F1");
    if (JSON.stringify(headers[0]) !== JSON.stringify(WAITLIST_HEADERS)) return result_({ ok: false });
    const existing = readSheetValues_('waitlist', "'Lista de espera'!C2:C");
    const receipt = { ok: true, productsReady: !!properties.getProperty('PRODUCTS_SHEET_ID') && !!properties.getProperty('PRODUCTS_FOLDER_ID') };
    if (existing.some(row => String(row[0] || '').trim().toLowerCase() === email)) return result_(receipt);
    appendWaitlist_(name, email);
    return result_(receipt);
  } catch (_) {
    return result_({ ok: false });
  } finally {
    if (acquired) lock.releaseLock();
  }
}

// Fixed source and explicit projection: no caller-supplied IDs, ranges or queries.
function readPublicCatalog_(name) {
  const fields = {
    Catalogo: ['id', 'titulo', 'descripcion', 'precio', 'disponible', 'imagenes', 'categoria', 'vendido', 'badge', 'reservado'],
    Config: ['clave', 'valor'],
    Ventas: ['concepto', 'importe']
  };
  if (!Object.prototype.hasOwnProperty.call(fields, name)) throw new Error('Invalid public resource');
  if (INTAKE_ENVIRONMENT === 'preview' && name !== 'Config') throw new Error('Preview has no production catalog');
  const values = readSheetValues_(INTAKE_ENVIRONMENT === 'preview' ? 'waitlist' : 'catalog', name + (name === 'Catalogo' ? '!A1:K' : '!A1:B'));
  if (!values.length) throw new Error('Missing public resource');
  const keys = ['titulo', 'intro', 'nota_reserva', 'whatsapp', 'actualizado', 'meta_total', 'mp_comision_inmediata', 'mp_comision_3_cuotas', 'mp_iva', 'mostrar_boton_vender'];
  let rows;
  if (name === 'Catalogo') {
    const headers = values[0];
    const indices = fields.Catalogo.map(field => {
      const matches = headers.map((value, index) => String(value).trim() === field ? index : -1).filter(index => index >= 0);
      if (matches.length !== 1) throw new Error('Invalid catalog columns');
      return matches[0];
    });
    rows = values.slice(1).filter(row => String(row[indices[1]] || '').trim())
      .map(row => indices.map(index => row[index] === undefined ? '' : row[index]));
  } else {
    rows = values.slice(1).map(row => [row[0], row[1] === undefined ? '' : row[1]]);
    rows = rows.filter(row => name === 'Config' ? keys.indexOf(String(row[0]).trim()) !== -1 : row[0] === 'TOTAL VENDIDO');
    if (name === 'Ventas' && (rows.length !== 1 || typeof rows[0][1] !== 'number' || !isFinite(rows[0][1]))) throw new Error('Invalid sales total');
  }
  return {
    cols: fields[name].map(label => ({ label })),
    rows: rows.map(row => ({ c: row.map(value => ({ v: value instanceof Date ? value.toISOString() : value })) }))
  };
}
