import {createRequire} from 'node:module';import {mkdir,writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');const base=process.env.QA_URL||'https://localhost:8766';const out='output/qa/release-2026-10-08';await mkdir(out,{recursive:true});
const browser=await pw.chromium.launch();const results=[];const table=(labels,rows)=>({table:{cols:labels.map(label=>({label})),rows:rows.map(r=>({c:r.map(v=>({v}))}))}});
const item=['a','Artículo seguro','Texto largo para comprobar descripción. '.repeat(20),25000,'Sí','/images/mts-hero-mobile-horizontal-540.webp | /images/mts-hero-desktop.webp','Cocina','No','Recién agregado'];
const cols=['id','titulo','descripcion','precio','disponible','imagenes','categoria','vendido','badge'];
const paymentRates=[['mp_comision_inmediata','6.60'],['mp_comision_3_cuotas','10.49'],['mp_iva','21']];
async function test(name,fn){let ctx;try{ctx=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:390,height:844},reducedMotion:'reduce'});const state={catalog:table(cols,[item]),settings:table(['key','value'],[['whatsapp','5492235550101'],['meta_total','100000'],...paymentRates]),sales:table(['Concepto','Monto'],[['TOTAL VENDIDO',29500]]),fail:false,failedSheet:'Catalogo'};await ctx.route('**/api/catalog?*',r=>{const sheet=new URL(r.request().url()).searchParams.get('sheet');if(state.fail&&sheet===state.failedSheet)return r.fulfill({status:503,json:{error:'QA simulated failure'}});return r.fulfill({json:sheet==='Catalogo'?state.catalog:sheet==='Config'?state.settings:state.sales});});await ctx.route('https://docs.google.com/**',r=>r.abort());const p=await ctx.newPage();p.setDefaultTimeout(8000);await fn(p,state,ctx);results.push({name,status:'pass'});console.log('PASS',name);}catch(e){results.push({name,status:'fail',error:e.message});console.log('FAIL',name,e.message.split('\n')[0]);}finally{await ctx?.close();}}
async function ready(p){await p.waitForFunction(()=>document.querySelector('#products').getAttribute('aria-busy')==='false'&&document.querySelector('.card[data-id]'));}
async function cart(p){await p.locator('.select-btn').first().click();await p.locator('#openBagMobile').click();}
await test('Catalog network failure, visible retry, recovery',async(p,s)=>{s.fail=true;await p.goto(base);await p.locator('.catalog-retry').waitFor();assert.match(await p.locator('#catalogStatus').innerText(),/No pudimos cargar/);s.fail=false;await p.locator('.catalog-retry').click();await ready(p);assert.equal(await p.locator('.card[data-id]').count(),1);});
await test('Empty catalog, safe status without pagination',async(p,s)=>{s.catalog=table(cols,[]);await p.goto(base);await p.waitForFunction(()=>document.querySelector('#catalogStatus').textContent.includes('No hay artículos disponibles'));assert.equal(await p.locator('#catalogPagination').isVisible(),false);});
await test('Invalid category and badge are normalized',async p=>{await p.goto(base+'/?categoria=invalid&badge=invalid');await ready(p);assert.equal(new URL(p.url()).search,'');});
await test('Corrupt selection and buyer storage recover',async(p,s,ctx)=>{await ctx.addInitScript(()=>{localStorage.setItem('ventaMudanza.selection.v1','{"bad":true}');localStorage.setItem('ventaMudanza.buyer.v1','null');});await p.goto(base);await ready(p);await cart(p);assert.equal(await p.locator('.bag-item').count(),1);assert.equal(await p.locator('#buyerName').inputValue(),'');});
await test('Storage denied still permits a selection',async(p,s,ctx)=>{await ctx.addInitScript(()=>{Storage.prototype.getItem=()=>{throw Error('QA storage denied')};Storage.prototype.setItem=()=>{throw Error('QA storage denied')};});await p.goto(base);await ready(p);await cart(p);assert.equal(await p.locator('.bag-item').count(),1);});
await test('Sold item removed from persisted selection after reload',async(p,s)=>{await p.goto(base);await ready(p);await cart(p);s.catalog=table(cols,[[...item.slice(0,7),'Sí',item[8]],['b','Otro artículo','Descripción',1000,'Sí','','Libros','No','']]);await p.reload();await ready(p);await p.locator('#openBagMobile').click();assert.equal(await p.locator('.bag-item').count(),0);assert.equal(await p.locator('#bagFooter').isVisible(),false);});
await test('Payment requires consultation and exposes no transfer alias',async(p)=>{await p.goto(base);await ready(p);await cart(p);assert.equal(await p.locator('#copyPaymentAlias, #paymentAliasManual').count(),0);assert.ok(!(await p.locator('body').innerText()).includes('bren.herrada.mp'));assert.match(await p.locator('#bagFooter .payment-note:not(.payment-estimate)').innerText(),/Transferencia o tarjeta por link de pago, luego de confirmar la compra/);});
await test('Broken images show gallery placeholder and retain close',async(p,s)=>{s.catalog=table(cols,[[...item.slice(0,5),'/images/mts-hero-mobile-horizontal-540.webp | /images/qa-intentionally-missing.webp',...item.slice(6)]]);await p.goto(base);await ready(p);await p.locator('.media-button').click();await p.locator('#lightboxNext').click();await p.waitForFunction(()=>document.querySelector('#lightboxImageWrap').classList.contains('is-unavailable'));await p.locator('#lightboxClose').click();await p.locator('#lightbox').waitFor({state:'hidden'});});
await test('Goal failure does not block catalog',async(p,s)=>{s.fail=true;s.failedSheet='Ventas';await p.goto(base);await ready(p);await p.waitForFunction(()=>document.querySelector('#catalogGoal [data-goal-thanks]')?.textContent.includes('No pudimos'));assert.equal(await p.locator('#catalogGoal [data-goal-collected]').innerText(),'—');});
await test('Goal completed: 100 percent and no extra projected bar',async(p,s)=>{s.sales=table(['Concepto','Monto'],[['TOTAL VENDIDO',120000]]);await p.goto(base);await ready(p);await p.waitForFunction(()=>document.querySelector('#catalogGoal [data-goal-collected]')?.textContent==='100%');await cart(p);assert.equal(await p.locator('#bagGoal [data-goal-cart]').isVisible(),false);});
await test('Invalid zero target hides goal placements',async(p,s)=>{s.settings=table(['key','value'],[['whatsapp','5492235550101'],['meta_total','0']]);await p.goto(base);await ready(p);await cart(p);assert.equal(await p.locator('#bagGoal').isVisible(),false);assert.equal(await p.locator('#bagContribution').isVisible(),false);});
await test('HTML in Sheet data stays text, never executes',async(p,s)=>{s.catalog=table(cols,[[item[0],'<img src=x onerror="window.__xss=true">',...item.slice(2)]]);await p.goto(base);await ready(p);assert.equal(await p.locator('.title img').count(),0);assert.equal(await p.evaluate(()=>window.__xss),undefined);});
await test('Failed fonts reveal usable stable fallback',async(p,s,ctx)=>{await ctx.route('**/*.woff2',r=>r.abort());await p.goto(base);await ready(p);await p.waitForFunction(()=>document.documentElement.dataset.fonts==='fallback');assert.equal(await p.locator('.font-splash').isVisible(),false);await cart(p);assert.equal(await p.locator('#drawer.open').count(),1);});
await test('Short landscape cart keeps CTA and form reachable',async(p)=>{await p.setViewportSize({width:844,height:390});await p.goto(base);await ready(p);await p.locator('.select-btn').first().click();await p.locator('#openBag').click();await p.locator('#buyerName').fill('QA');await p.locator('#buyerName').scrollIntoViewIfNeeded();const name=await p.locator('#buyerName').boundingBox();const body=await p.locator('.drawer-body').boundingBox();assert.ok(name.y>=body.y&&name.y+name.height<=body.y+body.height,'Name clipped by footer');const m=await p.locator('.send').boundingBox();assert.ok(m.y>=0&&m.y+m.height<=390,'CTA clipped');await p.screenshot({path:`${out}/landscape-cart.png`});const note=p.locator('#bagFooter .payment-note:not(.payment-estimate)');await note.scrollIntoViewIfNeeded();const noteBounds=await note.boundingBox();const footer=await p.locator('#bagFooter').boundingBox();assert.ok(noteBounds.y>=footer.y-1&&noteBounds.y+noteBounds.height<=footer.y+footer.height+1,`Payment note unreachable: ${JSON.stringify({noteBounds,footer})}`);await p.screenshot({path:`${out}/landscape-cart-note.png`});});
await test('Mobile keyboard height: cart name remains reachable',async(p)=>{await p.goto(base);await ready(p);await cart(p);await p.setViewportSize({width:390,height:430});await p.locator('#buyerName').fill('QA');await p.locator('#buyerName').scrollIntoViewIfNeeded();const r=await p.locator('#buyerName').boundingBox();assert.ok(r.y>=0&&r.y+r.height<=430,'Name clipped');await p.screenshot({path:`${out}/keyboard-cart.png`});});
await test('Card estimate matches account simulator and updates from Config on reload',async(p,s)=>{
 s.catalog=table(cols,[[...item.slice(0,3),100000,...item.slice(4)]]);
 await p.goto(base);await ready(p);await cart(p);
 await p.waitForFunction(()=>document.querySelector('#bagCardTotal').textContent.includes('126.076,22'));
 assert.match(await p.locator('#bagCardInstallment').innerText(),/42.025,41/);
 assert.match(await p.locator('#bagTotal').innerText(),/100.000/);
 assert.match(await p.locator('#bagContributionValue').innerText(),/100%/);
 s.settings=table(['key','value'],[['whatsapp','5492235550101'],['meta_total','100000'],['mp_comision_inmediata','5'],['mp_comision_3_cuotas','8'],['mp_iva','21']]);
 await p.reload();await ready(p);await p.locator('#openBagMobile').click();
 await p.waitForFunction(()=>document.querySelector('#bagCardTotal').textContent.includes('118.666,20'));
 assert.match(await p.locator('#bagTotal').innerText(),/100.000/);
});
await test('Card estimate accepts comma decimals and zero fees',async(p,s)=>{
 s.settings=table(['key','value'],[['whatsapp','5492235550101'],['mp_comision_inmediata','6,60'],['mp_comision_3_cuotas','10,49'],['mp_iva','21']]);
 await p.goto(base);await ready(p);await cart(p);
 await p.waitForFunction(()=>document.querySelector('#bagCardTotal').textContent.includes('31.519,06'));
 s.settings=table(['key','value'],[['whatsapp','5492235550101'],['mp_comision_inmediata','0'],['mp_comision_3_cuotas','0'],['mp_iva','0']]);
 await p.reload();await ready(p);await p.locator('#openBagMobile').click();
 await p.waitForFunction(()=>document.querySelector('#bagCardTotal').textContent.includes('25.000,00'));
});
for(const [label,rates] of [
 ['missing',paymentRates.slice(0,2)],
 ['negative',[['mp_comision_inmediata','-1'],...paymentRates.slice(1)]],
 ['invalid',[paymentRates[0],['mp_comision_3_cuotas','abc'],paymentRates[2]]],
 ['excessive',[['mp_comision_inmediata','90'],['mp_comision_3_cuotas','90'],paymentRates[2]]]
])await test(`Card estimate hides ${label} rates without blocking selection`,async(p,s)=>{
 s.settings=table(['key','value'],[['whatsapp','5492235550101'],['meta_total','100000'],...rates]);
 await p.goto(base);await ready(p);await cart(p);
 await p.waitForFunction(()=>!document.querySelector('#bagContribution').hidden);
 assert.equal(await p.locator('#bagCardEstimate').isVisible(),false);
 assert.equal(await p.locator('#bagCardTotal').textContent(),'');
 assert.match(await p.locator('#bagTotal').innerText(),/25.000/);
 assert.equal(await p.locator('.send').isEnabled(),true);
});
await test('Late Config updates a cart opened before rates arrived',async(p,s,ctx)=>{
 let release;const blocked=new Promise(resolve=>{release=resolve});
 await ctx.route('**/api/catalog?sheet=Config',async r=>{await blocked;await r.fulfill({json:s.settings});});
 await p.goto(base);await ready(p);await cart(p);
 assert.equal(await p.locator('#bagCardEstimate').isVisible(),false);
 release();await p.waitForFunction(()=>document.querySelector('#bagCardTotal').textContent.includes('31.519,06'));
 assert.equal(await p.locator('#bagCardEstimate').isVisible(),true);
});
await test('Card estimate fits narrow screens and the drawer width boundary',async(p,s)=>{
 s.catalog=table(cols,[[...item.slice(0,3),100000,...item.slice(4)]]);
 await p.goto(base);await ready(p);await cart(p);
 for(const width of [320,390,479,480,481]){
   await p.setViewportSize({width,height:844});
   await p.waitForFunction(()=>document.querySelector('#bagCardTotal').textContent.includes('126.076,22'));
   const bounds=await p.locator('#bagCardEstimate').boundingBox();
   const total=await p.locator('#bagCardTotal').boundingBox();
   assert.ok(total.x>=bounds.x&&total.x+total.width<=bounds.x+bounds.width,`Price overflow at ${width}`);
   assert.equal(await p.locator('#bagCardEstimate').evaluate(e=>e.scrollWidth>e.clientWidth),false);
   const noteLines=await p.locator('#bagFooter .payment-note:not(.payment-estimate) p').evaluate(e=>e.getBoundingClientRect().height/parseFloat(getComputedStyle(e).lineHeight));
   assert.ok(noteLines<=2.01,`Payment note exceeds two lines at ${width}`);
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   if(width===320)await p.screenshot({path:`${out}/narrow-card-estimate.png`});
 }
});
await browser.close();await writeFile(`${out}/resilience-results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify({passed:results.filter(r=>r.status==='pass').length,failed:results.filter(r=>r.status==='fail').length}));if(results.some(r=>r.status==='fail'))process.exitCode=1;
