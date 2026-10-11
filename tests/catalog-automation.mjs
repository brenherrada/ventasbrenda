import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../scripts/catalog-updated.gs', import.meta.url), 'utf8');
const qa = await readFile(new URL('../scripts/catalog-automation-qa.gs', import.meta.url), 'utf8');
class Range {
  constructor(sheet, r, c, h = 1, w = 1) { Object.assign(this, { sheet, r, c, h, w }); }
  getSheet() { return this.sheet; }
  getRow() { return this.r; }
  getLastRow() { return this.r + this.h - 1; }
  getValue() { return this.getValues()[0][0]; }
  getValues() { return Array.from({length:this.h}, (_,i)=>Array.from({length:this.w},(_,j)=>this.sheet.rows[this.r+i-1]?.[this.c+j-1] ?? '')); }
  setValue(value) { return this.setValues(Array.from({length:this.h},()=>Array(this.w).fill(value))); }
  setValues(rows) { rows.forEach((row,i)=>row.forEach((value,j)=>{ this.sheet.rows[this.r+i-1] ||= []; this.sheet.rows[this.r+i-1][this.c+j-1] = value; })); return this; }
  clearContent() { return this.setValue(''); }
  getA1Notation() { return String.fromCharCode(64 + this.c) + this.r; }
  setNumberFormat() { return this; }
  setNote() { return this; }
  copyTo() { return this; }
}
class Sheet {
  constructor(name, rows = []) { this.name=name; this.rows=rows; }
  getName() { return this.name; }
  getLastColumn() { return Math.max(1,...this.rows.map(r=>r.length)); }
  getLastRow() { return Math.max(1,this.rows.length); }
  getMaxRows() { return 1000; }
  getMaxColumns() { return 26; }
  setColumnWidth() {}
  getRange(...args) { return new Range(this,...args); }
  getRangeList(addresses) {
    const ranges=addresses.map(a=>{const [,c,r]=a.match(/^([A-Z])(\d+)$/);return this.getRange(Number(r),c.charCodeAt(0)-64);});
    return {setValue(v){ranges.forEach(r=>r.setValue(v));},clearContent(){ranges.forEach(r=>r.clearContent());}};
  }
}
const props = {};
let failure = false;
const store = {
  getProperty:k=>props[k] || null,
  getProperties:()=>({...props}),
  setProperty:(k,v)=>{props[k]=v;},
  setProperties:v=>{ if(failure && Object.values(v).some(s=>/^\d+$/.test(s))) throw Error('Injected completion failure'); Object.assign(props,v); }
};
const headers=['id','titulo','descripcion','precio','disponible','imagenes','categoria','vendido','badge','fecha_alta'];
const product=(id,extras={})=>Object.assign([id,'QA '+id,'',25000,'si','','Otros',false,'',''],extras);
const catalog=new Sheet('Catalogo',[headers,product('old')]);
const config=new Sheet('Config',[['clave','valor'],['meta_total','=FORMULA'],['actualizado','original']]);
const sheets={Catalogo:catalog,Config:config};
const triggers=[];
let released=0;
const book={getSheetByName:n=>sheets[n],getSpreadsheetTimeZone:()=> 'America/Buenos_Aires',insertSheet:n=>(sheets[n]=new Sheet(n)),deleteSheet:s=>{delete sheets[s.name];}};
const context=vm.createContext({Date,console,PropertiesService:{getDocumentProperties:()=>store},
  SpreadsheetApp:{getActiveSpreadsheet:()=>book,flush(){},CopyPasteType:{PASTE_FORMAT:'format'}},
  Utilities:{formatDate:()=> '2026-10-10 12:00:00'},
  LockService:{getDocumentLock:()=>({tryLock:()=>true,releaseLock:()=>{released++;}})},
  ScriptApp:{getProjectTriggers:()=>triggers,deleteTrigger:t=>triggers.splice(triggers.indexOf(t),1),newTrigger:handler=>({timeBased(){return this;},everyDays(){return this;},atHour(){return this;},inTimezone(){return this;},create(){triggers.push({getHandlerFunction:()=>handler});}})}
});
vm.runInContext(source+'\n'+qa,context);
context.verifyCatalogAutomation();
assert.equal(Object.keys(sheets).length,2,'Temporary QA tab must be removed');
context.installCatalogAutomation();
context.installCatalogAutomation();
assert.equal(triggers.length,1,'Installing twice must retain one daily trigger');
assert.equal(props['plotTwist.item.old'],'legacy');
assert.equal(catalog.rows[1][9],'','Install must not invent old creation dates');
const now=new Date('2026-10-10T12:00:00Z');
catalog.rows.push(product('new'));
context.installCatalogAutomation();
assert.equal(props['plotTwist.item.new'],undefined,'Reinstall must not classify a new, unprocessed item as legacy');
assert.equal(triggers.length,1,'Reinstall after a new row must still retain one trigger');
failure=true;
assert.throws(()=>context.processCatalogRows_(catalog,3,1,store,now),/Injected/);
const originalDate=catalog.rows[2][9].getTime();
assert.match(props['plotTwist.item.new'],/^pending:/);
failure=false;
context.processCatalogRows_(catalog,3,1,store,new Date(now.getTime()+86400000));
assert.equal(catalog.rows[2][9].getTime(),originalDate,'Partial failure retry must preserve creation date');
assert.equal(props['plotTwist.item.new'],String(originalDate));
catalog.rows.push(product('duplicate'),product('duplicate'),product('invalid',{3:'25000'}),product('hidden',{4:'no'}));
context.processCatalogRows_(catalog,4,4,store,now);
for(const row of catalog.rows.slice(3)) assert.equal(row[8],'','Duplicates, text prices and unavailable items must not be marked new');
catalog.rows[2][8]='';
context.processCatalogRows_(catalog,3,1,store,now);
assert.equal(catalog.rows[2][8],'','Manual badge removal must be respected');
catalog.rows[1][7]=true;
context.onEdit({source:book,range:catalog.getRange(2,8)});
assert.equal(catalog.rows[1][4],'no');
assert.equal(config.rows[2][1],'2026-10-10 12:00:00','Edited rows update the keyed timestamp');
assert.equal(config.rows[1][1],'=FORMULA','Config formulas must remain untouched');
const previous=JSON.stringify(config.rows);
context.onEdit({source:book,range:new Sheet('Other').getRange(2,1)});
context.onEdit();
assert.equal(JSON.stringify(config.rows),previous,'Unrelated tabs and missing events are no-ops');
const empty=new Sheet('Catalogo',[headers]);
assert.equal(context.expireCatalogBadges_(empty,store,now),0);
assert.throws(()=>context.processCatalogRows_(new Sheet('Catalogo',[['id']]),2,1,store,now),/Missing/);
context.LockService.getDocumentLock=()=>({tryLock:()=>false});
assert.throws(()=>context.onEdit({source:book,range:catalog.getRange(2,8)}),/busy/);
assert.ok(released>=3);
console.log('PASS: idempotent install, dispatch, legacy, duplicates, invalid input, unavailable items, partial failure recovery, timestamps, empty sheet and lock contention.');
