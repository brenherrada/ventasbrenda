/** @OnlyCurrentDoc */
// Bound to the catalog Sheet; website visits never execute these automations.
var CATALOG_AUTOMATION = {
  days: 7,
  badge: 'Recién agregado',
  dateHeader: 'fecha_alta',
  itemPrefix: 'plotTwist.item.',
  initializedKey: 'plotTwist.automation.v1',
  dailyHandler: 'expireCatalogBadges'
};

function onEdit(e) {
  if (!e || !e.source || !e.range) return;
  var tab = e.range.getSheet().getName();
  if (['Catalogo', 'Config', 'Ventas'].indexOf(tab) === -1) return;
  withCatalogLock_(function () {
    var now = new Date();
    if (tab === 'Catalogo' && e.range.getLastRow() > 1) {
      var store = PropertiesService.getDocumentProperties();
      if (store.getProperty(CATALOG_AUTOMATION.initializedKey)) {
        var start = Math.max(2, e.range.getRow());
        processCatalogRows_(e.range.getSheet(), start, e.range.getLastRow() - start + 1, store, now);
      }
    }
    updateCatalogTimestamp_(e.source, now);
  });
}

// Run once. Repeating installation preserves dates, badges and availability.
function installCatalogAutomation() {
  withCatalogLock_(function () {
    var book = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = book.getSheetByName('Catalogo');
    if (!sheet) throw new Error('Missing Catalogo sheet');
    var columns = catalogColumns_(sheet, true);
    var store = PropertiesService.getDocumentProperties();
    var known = store.getProperties();
    var count = Math.max(0, sheet.getLastRow() - 1);
    var rows = count ? sheet.getRange(2, 1, count, sheet.getLastColumn()).getValues() : [];
    var baseline = {};
    rows.forEach(function (row) {
      var id = String(row[columns.id - 1] || '').trim();
      if (!id) return;
      var key = CATALOG_AUTOMATION.itemPrefix + id;
      // Existing items have an unknown creation date; never invent one.
      if (!Object.prototype.hasOwnProperty.call(known, key)) baseline[key] = 'legacy';
    });
    if (!store.getProperty(CATALOG_AUTOMATION.initializedKey) && Object.keys(baseline).length) store.setProperties(baseline);
    store.setProperty(CATALOG_AUTOMATION.initializedKey, 'ready');
    var triggers = ScriptApp.getProjectTriggers().filter(function (trigger) {
      return trigger.getHandlerFunction() === CATALOG_AUTOMATION.dailyHandler;
    });
    if (!triggers.length) {
      ScriptApp.newTrigger(CATALOG_AUTOMATION.dailyHandler).timeBased()
        .everyDays(1).atHour(3).inTimezone(book.getSpreadsheetTimeZone()).create();
    }
    triggers.slice(1).forEach(function (trigger) { ScriptApp.deleteTrigger(trigger); });
    console.log('Catalog automation ready. Existing states preserved; one daily cleanup installed.');
  });
}

function expireCatalogBadges() {
  withCatalogLock_(function () {
    var book = SpreadsheetApp.getActiveSpreadsheet();
    var store = PropertiesService.getDocumentProperties();
    if (!store.getProperty(CATALOG_AUTOMATION.initializedKey)) return;
    var sheet = book.getSheetByName('Catalogo');
    if (!sheet) throw new Error('Missing Catalogo sheet');
    var changed = expireCatalogBadges_(sheet, store, new Date());
    if (changed) updateCatalogTimestamp_(book, new Date());
    console.log('Expired automatic badges: ' + changed);
  });
}

function withCatalogLock_(work) {
  var lock = LockService.getDocumentLock();
  if (!lock || !lock.tryLock(5000)) throw new Error('Catalog busy; retry this edit or function.');
  try { work(); SpreadsheetApp.flush(); }
  finally { lock.releaseLock(); }
}

function catalogColumns_(sheet, createDate) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var columns = {};
  ['id', 'titulo', 'precio', 'disponible', 'vendido', 'badge'].forEach(function (name) {
    var matches = headers.reduce(function (result, value, i) {
      if (String(value).trim() === name) result.push(i + 1);
      return result;
    }, []);
    if (matches.length !== 1) throw new Error('Missing or duplicate Catalogo header: ' + name);
    columns[name] = matches[0];
  });
  var dates = headers.reduce(function (result, value, i) {
    if (String(value).trim() === CATALOG_AUTOMATION.dateHeader) result.push(i + 1);
    return result;
  }, []);
  if (dates.length > 1) throw new Error('Duplicate fecha_alta header');
  columns.date = dates[0];
  if (!columns.date && createDate) {
    columns.date = headers.length + 1;
    if (columns.date > sheet.getMaxColumns()) sheet.insertColumnAfter(sheet.getMaxColumns());
    sheet.getRange(1, columns.date).setValue(CATALOG_AUTOMATION.dateHeader)
      .setNote('Fecha de alta automática. Los artículos anteriores quedan sin fecha. No editar ni copiar al crear otro producto.');
    sheet.getRange(1, 1).copyTo(sheet.getRange(1, columns.date), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    sheet.getRange(2, columns.date, sheet.getMaxRows() - 1, 1).setNumberFormat('yyyy-mm-dd hh:mm');
    sheet.setColumnWidth(columns.date, 165);
  }
  if (!columns.date) throw new Error('Run installCatalogAutomation first: missing fecha_alta');
  return columns;
}

function catalogSold_(value) {
  return value === true || value === 1 || ['true', '1', 'si', 'sí', 'vendido'].indexOf(String(value).trim().toLowerCase()) !== -1;
}

function catalogAvailable_(value) {
  return ['no', '0', 'false', 'agotado', 'vendido', 'inactivo'].indexOf(String(value).trim().toLowerCase()) === -1;
}

function processCatalogRows_(sheet, start, count, store, now) {
  if (count < 1) return;
  var columns = catalogColumns_(sheet, false);
  var rows = sheet.getRange(start, 1, count, sheet.getLastColumn()).getValues();
  var ids = sheet.getRange(2, columns.id, Math.max(1, sheet.getLastRow() - 1), 1).getValues();
  var idCounts = Object.create(null);
  ids.forEach(function (row) {
    var id = String(row[0] || '').trim();
    if (id) idCounts[id] = (idCounts[id] || 0) + 1;
  });
  var known = store.getProperties();
  var pending = {};
  var complete = {};
  var sold = [];
  var badges = [];
  var expired = [];
  var dates = {};
  rows.forEach(function (row, i) {
    var rowNumber = start + i;
    if (catalogSold_(row[columns.vendido - 1])) {
      if (row[columns.disponible - 1] !== 'no') sold.push(sheet.getRange(rowNumber, columns.disponible).getA1Notation());
      return;
    }
    var id = String(row[columns.id - 1] || '').trim();
    var title = String(row[columns.titulo - 1] || '').trim();
    var price = row[columns.precio - 1];
    if (!id || !title || typeof price !== 'number' || !isFinite(price) || price <= 0 || idCounts[id] !== 1) return;
    var key = CATALOG_AUTOMATION.itemPrefix + id;
    var saved = known[key];
    if (saved === 'legacy') return;
    var registering = !saved || String(saved).indexOf('pending:') === 0;
    if (!saved && !catalogAvailable_(row[columns.disponible - 1])) return;
    var timestamp = saved ? Number(String(saved).replace(/^pending:/, '')) : now.getTime();
    if (!isFinite(timestamp) || timestamp <= 0) throw new Error('Invalid automatic creation date');
    var old = now.getTime() - timestamp >= CATALOG_AUTOMATION.days * 86400000;
    if (registering) {
      pending[key] = 'pending:' + timestamp;
      complete[key] = String(timestamp);
      if (!old && !row[columns.badge - 1]) badges.push(sheet.getRange(rowNumber, columns.badge).getA1Notation());
    }
    if (!(row[columns.date - 1] instanceof Date) || row[columns.date - 1].getTime() !== timestamp) {
      if (!dates[timestamp]) dates[timestamp] = [];
      dates[timestamp].push(sheet.getRange(rowNumber, columns.date).getA1Notation());
    }
    if (old && row[columns.badge - 1] === CATALOG_AUTOMATION.badge) expired.push(sheet.getRange(rowNumber, columns.badge).getA1Notation());
  });
  // Batch writes; a pending identity lets a retry repair partial writes without resetting time.
  if (Object.keys(pending).length) store.setProperties(pending);
  if (sold.length) sheet.getRangeList(sold).setValue('no');
  Object.keys(dates).forEach(function (timestamp) { sheet.getRangeList(dates[timestamp]).setValue(new Date(Number(timestamp))); });
  if (badges.length) sheet.getRangeList(badges).setValue(CATALOG_AUTOMATION.badge);
  if (expired.length) sheet.getRangeList(expired).clearContent();
  if (Object.keys(complete).length) store.setProperties(complete);
}

function expireCatalogBadges_(sheet, store, now) {
  var columns = catalogColumns_(sheet, false);
  var count = Math.max(0, sheet.getLastRow() - 1);
  if (!count) return 0;
  var rows = sheet.getRange(2, 1, count, sheet.getLastColumn()).getValues();
  var known = store.getProperties();
  var expired = [];
  rows.forEach(function (row, i) {
    var id = String(row[columns.id - 1] || '').trim();
    var saved = known[CATALOG_AUTOMATION.itemPrefix + id];
    if (!saved || saved === 'legacy') return;
    var timestamp = Number(String(saved).replace(/^pending:/, ''));
    if (!isFinite(timestamp) || timestamp <= 0) return;
    if (row[columns.badge - 1] === CATALOG_AUTOMATION.badge && now.getTime() - timestamp >= CATALOG_AUTOMATION.days * 86400000) {
      expired.push(sheet.getRange(i + 2, columns.badge).getA1Notation());
    }
  });
  if (expired.length) sheet.getRangeList(expired).clearContent();
  return expired.length;
}

function updateCatalogTimestamp_(book, now) {
  var sheet = book.getSheetByName('Config');
  if (!sheet) throw new Error('Missing Config sheet');
  var keys = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues();
  var row = keys.findIndex(function (value) { return value[0] === 'actualizado'; }) + 1;
  if (!row) throw new Error('Missing actualizado setting');
  sheet.getRange(row, 2).setNumberFormat('@').setValue(Utilities.formatDate(now, book.getSpreadsheetTimeZone(), 'yyyy-MM-dd HH:mm:ss'));
}
