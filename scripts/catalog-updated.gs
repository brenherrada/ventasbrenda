/** @OnlyCurrentDoc */
// Bound to the catalog spreadsheet. Reads/opening the website never update this value.
function onEdit(e) {
  if (!e || !e.source || !e.range) return;
  var tab = e.range.getSheet().getName();
  if (['Catalogo', 'Config', 'Ventas'].indexOf(tab) === -1) return;
  var sheet = e.source.getSheetByName('Config');
  if (!sheet) throw new Error('Missing Config sheet');
  var keys = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues();
  var row = keys.findIndex(function (value) { return value[0] === 'actualizado'; }) + 1;
  if (!row) throw new Error('Missing actualizado setting');
  // Writes from this script do not trigger onEdit again.
  sheet.getRange(row, 2).setNumberFormat('@').setValue(Utilities.formatDate(new Date(), e.source.getSpreadsheetTimeZone(), 'yyyy-MM-dd HH:mm:ss'));
}
