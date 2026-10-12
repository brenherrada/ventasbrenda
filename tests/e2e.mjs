// Run against a local Netlify dev server. External WhatsApp navigation is intercepted.
// PLAYWRIGHT_MODULE may point to an existing Playwright installation; no app dependency is needed.
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.QA_URL || 'http://localhost:8765';
const output = process.env.QA_OUTPUT || 'output/qa/release-2026-10-08';
await mkdir(output, { recursive: true });
const results=[];
const labels=['id','titulo','descripcion','precio','disponible','imagenes','categoria','vendido','badge'];
const table=(labels,rows)=>({table:{cols:labels.map(label=>({label})),rows:rows.map(r=>({c:r.map(v=>({v}))}))}});
const rows=Array.from({length:27},(_,i)=>['qa-'+i,`Artículo ${i+1}${i===2?" - RESERVADO":""}`,i===0?'Descripción extensa del artículo para comprobar la lectura completa en un diálogo accesible. '.repeat(5):'Descripción breve.',1000*(i+1),i===2?'Reservado':'Sí',"/images/mts-hero-mobile-horizontal-540.webp | /images/mts-hero-desktop.webp",i%2?'Libros':'Cocina',i===26?'Sí':'No',i<4?'Recién agregado':'']);
const catalog=table(labels,rows);
const settings=table(['clave','valor'],[['whatsapp','5492235550101'],['meta_total','100000'],['actualizado','08/10/2026 08:00']]);
const sales=table(['Concepto','Monto'],[['TOTAL VENDIDO',29500]]);
async function fixture(context){await context.route('**/api/catalog?*',route=>{const sheet=new URL(route.request().url()).searchParams.get('sheet');return route.fulfill({json:sheet==='Catalogo'?catalog:sheet==='Config'?settings:sales});});}
const ready=async page=>{await page.waitForFunction(()=>document.querySelector('#products').getAttribute('aria-busy')==='false' && document.querySelectorAll('#products .card[data-id]').length>0);await page.evaluate(()=>document.fonts.ready);};
async function check(name,fn,page){try{await fn();results.push({name,status:'pass'});console.log('PASS',name);}catch(e){results.push({name,status:'fail',error:e.message});console.log('FAIL',name,e.message.split('\n')[0]);if(page)await page.screenshot({path:`${output}/failure-${results.length}.png`}).catch(()=>{});}}
const engines=(process.env.QA_BROWSERS||'chromium,firefox,webkit').split(',');
for(const engine of engines){
 let browser;try{browser=await pw[engine].launch();}catch(e){results.push({name:engine,status:'blocked',error:e.message});continue;}
 for(const mobile of [false,true]){
 const tag=`${engine}-${mobile?'mobile':'desktop'}`;
 const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:mobile?{width:390,height:844}:{width:1440,height:1000},hasTouch:mobile, reducedMotion:'reduce'});
 await fixture(context);
 await context.addInitScript(()=>{window.__opened=[];window.open=(...args)=>{window.__opened.push(args);return null;};});
 const page=await context.newPage();page.setDefaultTimeout(8000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await ready(page);
 const bag=()=>page.locator(mobile?'#openBagMobile':'#openBag');
 await check(`${tag}: initial 12, sold excluded, local fonts`,async()=>{
 assert.equal(await page.locator('#products .card').count(),12);assert.match(await page.locator('#catalogCount').innerText(),/26/);
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.fonts),'ready');
 await page.screenshot({path:`${output}/${tag}-home.png`});
 },page);
 await check(`${tag}: load more and reserved unavailable`,async()=>{
 await page.locator('#loadMoreProducts').click();assert.equal(await page.locator('#products .card').count(),24);
 await page.locator('#loadMoreProducts').click();assert.equal(await page.locator('#products .card').count(),26);
 assert.equal(await page.locator('.card.reserved .select-btn').count(),0);
 assert.equal(await page.locator('.card.reserved .product-status').innerText(),'RESERVADO');
 },page);
 await check(`${tag}: category, badge URLs, history`,async()=>{
 const open=async()=>{await page.locator(mobile?'.mobile-nav .catalog-trigger':'.header-links .catalog-trigger').click();await page.locator('#catalogMenu').waitFor({state:'visible'});};
 await open();await page.screenshot({path:`output/qa/release-2026-10-08/${tag}-menu.png`});
 await page.locator('#catalogMenuOptions a').filter({hasText:'Cocina'}).click();assert.match(page.url(),/categoria=cocina/);
 assert.equal(await page.locator('.card:not([data-category="cocina"])').count(),0);
 await open();await page.locator('#catalogMenuOptions a').filter({hasText:'Recién agregado'}).click();assert.match(page.url(),/badge=recien-agregado/);
 assert.equal(await page.locator('#products .card').count(),4);
 await page.goBack();await page.waitForFunction(()=>location.search.includes('categoria=cocina'));assert.equal(await page.locator('.card:not([data-category="cocina"])').count(),0);
 await page.reload();await ready(page);assert.match(page.url(),/categoria=cocina/);
 await page.goto(base);await ready(page);
 },page);
 await check(`${tag}: search empty/reset and fixed height`,async()=>{
 if(mobile)await page.locator('#openSiteSearch').click();
 const before=(await page.locator('#catalogSearch').boundingBox()).height;
 await page.locator('#catalogSearch').fill('sin-coincidencias-qa');assert.equal(await page.locator('#products .card').count(),0);
 assert.match(await page.locator('#catalogStatus').innerText(),/No hay coincidencias/);
 assert.equal((await page.locator('#catalogSearch').boundingBox()).height,before);
 await page.locator('#clearSearch').click();assert.equal(await page.locator('#products .card').count(),12);
 if(mobile)await page.locator('#closeSiteSearch').click();
 },page);
 await check(`${tag}: description full content, Escape`,async()=>{
 await page.locator('.description-more').first().click();await page.locator('#descriptionPopup').waitFor({state:'visible'});
 assert.match(await page.locator('#descriptionPopupCopy').innerText(),/Descripción extensa/);
 await page.screenshot({path:`${output}/${tag}-description.png`});
 await page.keyboard.press('Escape');await page.locator('#descriptionPopup').waitFor({state:'hidden'});
 },page);
 await check(`${tag}: gallery navigation, zoom, focus containment`,async()=>{
 await page.locator('.media-button').first().click();await page.locator('#lightbox.open').waitFor();
 await page.waitForFunction(()=>document.querySelector('#lightboxImage').complete&&document.querySelector('#lightboxImage').naturalWidth>0);
 const bounds = await page.locator('#lightboxImageWrap').boundingBox();
 const stage = await page.locator('.lightbox-stage').boundingBox();
 assert.ok(bounds.x >= stage.x && bounds.x + bounds.width <= stage.x + stage.width, 'Gallery exceeds the viewport');
 const footer = await page.locator('.lightbox-footer').boundingBox();
 assert.ok(bounds.y + bounds.height <= footer.y + 1, 'Photo overlaps the gallery controls');
 const meta=await page.locator('#lightboxMeta').innerText();await page.locator('#lightboxNext').click();assert.notEqual(await page.locator('#lightboxMeta').innerText(),meta);
 await page.waitForFunction(()=>document.querySelector('#lightboxImage').alt.endsWith('foto 2') && document.querySelector('#lightboxImage').complete);
 await page.locator('#zoomIn').click();assert.match(await page.locator('#zoomReset').innerText(),/150/);
 await page.locator('#zoomReset').click();assert.match(await page.locator('#zoomReset').innerText(),/100/);
 await page.screenshot({path:`${output}/${tag}-gallery.png`});
 for(let i=0;i<10;i++){await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.querySelector('#lightbox').contains(document.activeElement)),true,'Gallery focus escaped');}
 },page);
 if(await page.locator('#lightbox.open').count()){await page.keyboard.press('Escape');await page.locator('#lightbox.open').waitFor({state:'hidden'});}
 await check(`${tag}: cart totals, persistence, validation, WhatsApp payload`,async()=>{
 await page.locator('.card[data-id="qa-0"] .select-btn').click();await page.locator('.card[data-id="qa-1"] .select-btn').click();
 await bag().click();await page.locator('#drawer.open').waitFor();
 assert.equal(await page.locator('.bag-item').count(),2);assert.match(await page.locator('#bagTotal').innerText(),/3.000/);
 assert.match(await page.locator('.send').innerText(),/^Confirmar por WhatsApp$/i);
 assert.match(await page.locator('#bagFooter .payment-note').innerText(),/Consultame el valor según el medio de pago antes de transferir/);
 assert.match(await page.locator('#bagContributionValue').innerText(),/3%/);
 await page.locator('.send').click();assert.equal(await page.locator('#buyerName').getAttribute('aria-invalid'),'true');
 await page.locator('#buyerName').fill('QA Prueba');await page.locator('.send').click();
 const opened=await page.evaluate(()=>window.__opened);assert.equal(opened.length,1);const url=new URL(opened[0][0]);assert.equal(url.hostname,'wa.me');assert.match(url.searchParams.get('text'),/QA Prueba/);assert.match(url.searchParams.get('text'),/3.000/);
 await page.screenshot({path:`${output}/${tag}-cart.png`});
 await page.keyboard.press('Escape');assert.equal(await bag().evaluate(e=>document.activeElement===e),true);
 await page.reload();await ready(page);await bag().click();assert.equal(await page.locator('.bag-item').count(),2);assert.equal(await page.locator('#buyerName').inputValue(),'QA Prueba');
 for(let i=0;i<2;i++)await page.locator('.bag-item button').first().click();
 assert.equal(await page.locator('.bag-item').count(),0);assert.equal(await page.locator('#bagFooter').isVisible(),false);
 await page.keyboard.press('Escape');
 },page);
 await check(`${tag}: payment popover, delivery switch and focus return`,async()=>{
 const paymentSelector=mobile?'.mobile-nav [popovertarget="paymentPopup"]':'.header-payment';
 const payment=page.locator(paymentSelector);
 await payment.click();await page.locator('#paymentPopup').waitFor({state:'visible'});
 await page.waitForFunction(selector=>document.querySelector(selector).getAttribute('aria-expanded')==='true',paymentSelector);
 assert.equal(await payment.getAttribute('aria-expanded'),'true');
 assert.match(await page.locator('#paymentPopup').innerText(),/hasta 3 cuotas con Mercado Pago/);
 const bounds=await page.locator('#paymentPopup').boundingBox();const size=page.viewportSize();
 assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=size.width&&bounds.y+bounds.height<=size.height,'Payment popup exceeds viewport');
 await page.screenshot({path:`${output}/${tag}-payment.png`});
 await page.locator(mobile?'.mobile-nav [popovertarget="deliveryPopup"]':'.header-delivery').click();
 await page.locator('#paymentPopup').waitFor({state:'hidden'});
 await page.locator('#deliveryPopup .dismiss-button').click();
 await payment.press('Enter');await page.locator('#paymentPopup').waitFor({state:'visible'});
 await page.keyboard.press('Escape');await page.locator('#paymentPopup').waitFor({state:'hidden'});
 await page.waitForFunction(selector=>document.querySelector(selector).getAttribute('aria-expanded')==='false',paymentSelector);
 assert.equal(await payment.evaluate(e=>document.activeElement===e),true);
 assert.equal(await payment.getAttribute('aria-expanded'),'false');
 },page);
 await check(`${tag}: delivery/promo and consistent close`,async()=>{
 await page.locator(mobile?'.mobile-nav [popovertarget="deliveryPopup"]':'.header-delivery').click();await page.locator('#deliveryPopup').waitFor({state:'visible'});
 await page.screenshot({path:`${output}/${tag}-delivery.png`});await page.locator('#deliveryPopup .dismiss-button').click();
 await page.locator('#webPromoTrigger').click();await page.locator('#webPromo').waitFor({state:'visible'});await page.screenshot({path:`${output}/${tag}-promo.png`});await page.locator('#webPromo .dismiss-button').click();
 },page);
 await check(`${tag}: overflow / errors`,async()=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);},page);
 await context.close();
 }
 await browser.close();
}
await writeFile(`${output}/e2e-results.json`,JSON.stringify(results,null,2));
console.log(JSON.stringify({passed:results.filter(x=>x.status==='pass').length,failed:results.filter(x=>x.status==='fail').length,blocked:results.filter(x=>x.status==='blocked').length}));
if(results.some(x=>x.status!=='pass'))process.exitCode=1;
