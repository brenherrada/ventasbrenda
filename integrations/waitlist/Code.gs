// Runs as the owner. Only the private waitlist Sheet is addressed by this code.
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
    const properties = PropertiesService.getScriptProperties();
    const secret = properties.getProperty('WAITLIST_SECRET');
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
