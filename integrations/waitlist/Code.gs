// Runs as the owner. Private Sheets are never shared with website visitors.
// Configure WAITLIST_SHEET_ID and WAITLIST_SECRET in Script Properties.
const WAITLIST_HEADERS = ['Fecha de inscripción', 'Nombre', 'Mail', 'Estado', 'Fecha de contacto', 'Consentimiento'];

function result_(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() { return result_({ ok: false }); }

function doPost(event) {
  let lock;
  let acquired = false;
  try {
    const raw = event && event.postData && event.postData.contents;
    if (!raw || raw.length > 4096) return result_({ ok: false });
    const input = JSON.parse(raw);
    if (!input || typeof input !== 'object' || Array.isArray(input)) return result_({ ok: false });
    const properties = PropertiesService.getScriptProperties();
    const secret = properties.getProperty('WAITLIST_SECRET');
    if (!secret || typeof input.secret !== 'string' || input.secret !== secret) return result_({ ok: false });
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
    const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName('Lista de espera');
    if (!sheet || JSON.stringify(sheet.getRange(1, 1, 1, 6).getValues()[0]) !== JSON.stringify(WAITLIST_HEADERS)) return result_({ ok: false });
    const lastRow = sheet.getLastRow();
    if (lastRow > 1 && sheet.getRange(2, 3, lastRow - 1, 1).createTextFinder(email).matchEntireCell(true).matchCase(false).findNext()) return result_({ ok: true });
    // Prefix spreadsheet formula characters so user-entered names remain literal text.
    const text = value => /^[=+\-@]/.test(value) ? "'" + value : value;
    const row = lastRow + 1;
    sheet.getRange(row, 1, 1, 6).setValues([[new Date(), text(name), text(email), 'En espera', '', 'waitlist-v1 · contacto por mail']]);
    sheet.getRange(row, 1).setNumberFormat('dd/mm/yyyy hh:mm');
    SpreadsheetApp.flush();
    return result_({ ok: true });
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
  const book = SpreadsheetApp.openById('18tOI0_8yoLwXR4za7XVvsOUjVrktexYldoMAlRJ1BMA');
  const sheet = book.getSheetByName(name);
  if (!sheet) throw new Error('Missing public resource');
  const keys = ['titulo', 'intro', 'nota_reserva', 'whatsapp', 'actualizado', 'meta_total', 'mp_comision_inmediata', 'mp_comision_3_cuotas', 'mp_iva', 'mostrar_boton_vender'];
  let rows;
  if (name === 'Catalogo') {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const indices = fields.Catalogo.map(field => {
      const matches = headers.map((value, index) => String(value).trim() === field ? index : -1).filter(index => index >= 0);
      if (matches.length !== 1) throw new Error('Invalid catalog columns');
      return matches[0];
    });
    const count = Math.max(0, sheet.getLastRow() - 1);
    rows = count ? sheet.getRange(2, 1, count, Math.max.apply(null, indices) + 1).getValues()
      .filter(row => String(row[indices[1]] || '').trim())
      .map(row => indices.map(index => row[index])) : [];
  } else {
    const count = Math.max(0, sheet.getLastRow() - 1);
    rows = count ? sheet.getRange(2, 1, count, 2).getValues() : [];
    rows = rows.filter(row => name === 'Config' ? keys.indexOf(String(row[0]).trim()) !== -1 : row[0] === 'TOTAL VENDIDO');
    if (name === 'Ventas' && (rows.length !== 1 || typeof rows[0][1] !== 'number' || !isFinite(rows[0][1]))) throw new Error('Invalid sales total');
  }
  return {
    cols: fields[name].map(label => ({ label })),
    rows: rows.map(row => ({ c: row.map(value => ({ v: value instanceof Date ? value.toISOString() : value })) }))
  };
}
