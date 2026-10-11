/** @OnlyCurrentDoc */
// Native Sheets integration check. Only an isolated, temporary tab is touched.
function verifyCatalogAutomation() {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = book.insertSheet('__qa_automation_' + Date.now());
  var values = {};
  var store = {
    getProperty: function (key) { return values[key] || null; },
    getProperties: function () { return Object.assign({}, values); },
    setProperty: function (key, value) { values[key] = value; },
    setProperties: function (updates) { Object.keys(updates).forEach(function (key) { values[key] = updates[key]; }); }
  };
  function check(condition, message) { if (!condition) throw new Error('QA: ' + message); }
  var now = new Date('2026-10-10T12:00:00Z');
  try {
    sheet.getRange(1, 1, 1, 10).setValues([['id', 'titulo', 'descripcion', 'precio', 'disponible', 'imagenes', 'categoria', 'vendido', 'badge', 'fecha_alta']]);
    sheet.getRange(2, 1, 5, 10).setValues([
      ['new', 'QA nuevo', '', 25000, 'si', '', 'Otros', false, '', ''],
      ['old', 'QA existente', '', 10000, 'si', '', 'Otros', false, 'Recién agregado', ''],
      ['partial', '', '', 0, 'si', '', 'Otros', false, '', ''],
      ['batch-1', 'QA lote 1', '', 5000, 'si', '', 'Otros', false, '', ''],
      ['batch-2', 'QA lote 2', '', 6000, 'si', '', 'Otros', false, '', '']
    ]);
    store.setProperty(CATALOG_AUTOMATION.itemPrefix + 'old', 'legacy');
    processCatalogRows_(sheet, 2, 5, store, now);
    var rows = sheet.getRange(2, 1, 5, 10).getValues();
    check(rows[0][8] === CATALOG_AUTOMATION.badge && rows[0][9].getTime() === now.getTime(), 'new badge and native date');
    check(rows[1][8] === CATALOG_AUTOMATION.badge && rows[1][9] === '', 'legacy preservation');
    check(rows[2][8] === '' && rows[2][9] === '', 'incomplete item');
    check(rows[3][8] === CATALOG_AUTOMATION.badge && rows[4][8] === CATALOG_AUTOMATION.badge, 'multirow paste');
    var tomorrow = new Date(now.getTime() + 86400000);
    sheet.getRange(2, 2).setValue('QA editado');
    processCatalogRows_(sheet, 2, 1, store, tomorrow);
    check(sheet.getRange(2, 10).getValue().getTime() === now.getTime(), 'editing never resets creation');
    sheet.getRange(2, 8).setValue(true);
    processCatalogRows_(sheet, 2, 1, store, tomorrow);
    check(sheet.getRange(2, 5).getValue() === 'no', 'sold becomes unavailable');
    sheet.getRange(2, 8).setValue(false);
    processCatalogRows_(sheet, 2, 1, store, tomorrow);
    check(sheet.getRange(2, 5).getValue() === 'no', 'unchecking sold never republishes');
    check(expireCatalogBadges_(sheet, store, new Date(now.getTime() + 7 * 86400000 - 1)) === 0, 'no early expiration');
    check(expireCatalogBadges_(sheet, store, new Date(now.getTime() + 7 * 86400000)) === 3, 'expiration at seven days');
    check(sheet.getRange(3, 9).getValue() === CATALOG_AUTOMATION.badge, 'manual legacy badge survives');
    check(expireCatalogBadges_(sheet, store, new Date(now.getTime() + 8 * 86400000)) === 0, 'repeat cleanup is idempotent');
    processCatalogRows_(sheet, 5, 1, store, new Date(now.getTime() + 8 * 86400000));
    check(sheet.getRange(5, 9).getValue() === '', 'expired badge never returns on edit');
    console.log('PASS: native Sheets dates, badges, legacy, paste, sold, undo, expiry and repeated runs. Production Catalogo/Config untouched.');
  } finally {
    book.deleteSheet(sheet);
  }
}
