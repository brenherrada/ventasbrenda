import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { generateKeyPairSync, sign, verify } from 'node:crypto';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const account = email => ({ type:'service_account', client_email:email, private_key_id:'a'.repeat(40), private_key:privateKey.export({type:'pkcs8',format:'pem'}) });
const properties = { WAITLIST_SHEET_ID:'private-waitlist', CATALOG_SERVICE_ACCOUNT:JSON.stringify(account('catalog-reader@plot-twist-catalog.iam.gserviceaccount.com')), WAITLIST_SERVICE_ACCOUNT:JSON.stringify(account('waitlist-writer@plot-twist-catalog.iam.gserviceaccount.com')) };
const cache = new Map();let calls=[], fail=false;
const context = vm.createContext({
 PropertiesService:{getScriptProperties:()=>({getProperty:key=>properties[key]})},
 CacheService:{getScriptCache:()=>({get:key=>cache.get(key),put:(key,value)=>cache.set(key,value)})},
 Utilities:{base64EncodeWebSafe:value=>Buffer.from(typeof value==='string'?value:Uint8Array.from(value)).toString('base64url'),computeRsaSha256Signature:(value,key)=>[...sign('RSA-SHA256',Buffer.from(value),key)],formatDate:()=> '2026-10-15T21:00:00'},
 UrlFetchApp:{fetch:(url, options)=>{
   calls.push({url,options});assert.equal(options.followRedirects,false);assert.equal(options.muteHttpExceptions,true);
   if(url==='https://oauth2.googleapis.com/token'){
     const [header,claims,signature]=options.payload.assertion.split('.');const c=JSON.parse(Buffer.from(claims,'base64url'));
     assert.equal(verify('RSA-SHA256',Buffer.from(header+'.'+claims),publicKey,Buffer.from(signature,'base64url')),true);
     assert.equal(c.aud,url);assert.equal(c.exp-c.iat,3600);assert.equal(c.sub,undefined);
     const reader=c.iss.startsWith('catalog-reader@');assert.equal(c.scope,'https://www.googleapis.com/auth/spreadsheets'+(reader?'.readonly':''));
     return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({access_token:reader?'reader-token':'writer-token',token_type:'Bearer',expires_in:3600})};
   }
   assert.ok(url.startsWith('https://sheets.googleapis.com/v4/spreadsheets/'));
   if(options.method==='post'){
     assert.equal(options.headers.Authorization,'Bearer writer-token');assert.ok(url.includes('/private-waitlist:batchUpdate'));
     const data=JSON.parse(options.payload);const append=data.requests[0].appendCells;assert.equal(append.sheetId,906247871);
     assert.ok(Number.isFinite(append.rows[0].values[0].userEnteredValue.numberValue));
     assert.equal(append.rows[0].values[1].userEnteredValue.stringValue,"'=FORMULA()");
   }
   return {getResponseCode:()=>fail?403:200,getContentText:()=>fail?'PRIVATE_SERVER_ERROR':JSON.stringify({values:[['safe']]})};
 }}
});
const source=await readFile(new URL('../integrations/waitlist/GoogleSheets.gs',import.meta.url),'utf8');vm.runInContext(await readFile(new URL('../integrations/waitlist/Environment.gs',import.meta.url),'utf8')+'\n'+source,context);
assert.equal(context.readSheetValues_('catalog','Config!A1:B')[0][0],'safe');
context.readSheetValues_('catalog','Ventas!A1:B');assert.equal(calls.filter(x=>x.url.includes('oauth2')).length,1,'Token cache not reused');
context.appendWaitlist_('=FORMULA()','qa@example.test');assert.equal(calls.filter(x=>x.url.includes('oauth2')).length,2,'Reader/writer tokens were mixed');
let before=calls.length;
assert.throws(()=>context.googleApi_('catalog',':batchUpdate','post',{}),/read-only/);
assert.throws(()=>context.readSheetValues_('catalog',"'Lista de espera'!A1:F1"),/Invalid private range/);
assert.throws(()=>context.googleIdentity_('owner'),/Invalid technical identity/);assert.equal(calls.length,before);
fail=true;assert.throws(()=>context.readSheetValues_('catalog','Config!A1:B'),/Private spreadsheet unavailable/);
properties.CATALOG_SERVICE_ACCOUNT=JSON.stringify(account('other@plot-twist-catalog.iam.gserviceaccount.com'));
assert.throws(()=>context.readSheetValues_('catalog','Config!A1:B'),/Missing technical identity/);
const manifest=JSON.parse(await readFile(new URL('../integrations/waitlist/appsscript.json',import.meta.url),'utf8'));
assert.deepEqual(manifest.oauthScopes,['https://www.googleapis.com/auth/script.external_request','https://www.googleapis.com/auth/drive.file']);
assert.ok(!source.includes('ScriptApp.getOAuthToken'));
console.log('PASS: signed JWTs, separate reader/writer scopes and tokens, cache, fixed files/ranges, read-only enforcement, safe failures, no owner Sheets OAuth scope.');
