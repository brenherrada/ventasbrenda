// Runs against the local Netlify emulator through tests/serve-https.mjs.
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.QA_URL||'https://localhost:8768',out='output/qa/image-cdn';await mkdir(out,{recursive:true});
const imageId='1rGdpKEJABG0ejCqqMKXT-g7kFnBPbdEM';
const table=(labels,rows)=>({table:{cols:labels.map(label=>({label})),rows:rows.map(row=>({c:row.map(v=>({v}))}))}});
async function fixture(ctx,id=imageId){await ctx.route('**/api/catalog?*',r=>{const sheet=new URL(r.request().url()).searchParams.get('sheet');return r.fulfill({json:sheet==='Catalogo'?table(['id','titulo','descripcion','precio','disponible','imagenes','categoria','vendido','badge'],[['foto','Maceta hecha a mano','Maceta decorativa artesanal.',20000,'Sí',`https://drive.google.com/file/d/${id}/view`,'Deco','No','']]):sheet==='Config'?table(['clave','valor'],[['whatsapp','5492235550101'],['meta_total','100000']]):table(['Concepto','Monto'],[['TOTAL VENDIDO',29500]])});});}
const ready=async p=>{await p.goto(base);await p.locator('.card').first().scrollIntoViewIfNeeded();await p.waitForFunction(()=>document.querySelector('.media-button img')?.naturalWidth>0&&!document.querySelector('.media').classList.contains('is-loading'));};
const results=[];
for(const engine of (process.env.QA_SKIP_LIVE ? [] : ['chromium','firefox','webkit'])){
 const browser=await pw[engine].launch();
 for(const [width,dpr] of [[390,3],[1440,1]]){
  const ctx=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height:900},deviceScaleFactor:dpr,reducedMotion:'reduce'});await fixture(ctx);const p=await ctx.newPage();const requests=[];p.on('request',r=>{if(r.resourceType()==='image')requests.push(r.url())});await ready(p);
  const card=await p.locator('.media-button img').evaluate(e=>e.currentSrc);assert.match(card,/\.netlify\/images/);const cardWidth=Number(new URL(card).searchParams.get('w'));assert.ok(cardWidth>=300&&cardWidth<=1200);assert.ok(new URL(card).searchParams.get('url').endsWith(`=w${cardWidth}`));
  await p.locator('.select-btn').click();await p.locator(width<768?'#openBagMobile':'#openBag').click();await p.waitForFunction(()=>document.querySelector('.bag-thumb')?.classList.contains('is-ready'));
  const bag=await p.locator('.bag-thumb').evaluate(e=>e.currentSrc);assert.match(bag,/\.netlify\/images/);const bagWidth=Number(new URL(bag).searchParams.get('w'));assert.ok(bagWidth<=192);assert.ok(bagWidth<cardWidth);assert.ok(new URL(bag).searchParams.get('url').endsWith(`=w${bagWidth}`));
  await p.screenshot({path:`${out}/${engine}-${width}-bag.png`});await p.locator('#closeBag').click();await p.locator('.media-button').click();await p.waitForFunction(()=>document.querySelector('#lightboxImage').naturalWidth>0);
  assert.equal(new URL(await p.locator('#lightboxImage').getAttribute('src'),base).searchParams.get('w'),'1600');await p.locator('#zoomIn').click();assert.match(await p.locator('#zoomReset').innerText(),/150/);await p.screenshot({path:`${out}/${engine}-${width}-gallery.png`});
  assert.ok(!requests.some(url=>url.includes('drive.google.com/uc')||url.includes('export=download')));results.push({engine,width,dpr,cardWidth,bagWidth,galleryWidth:1600});await ctx.close();
 }
 await browser.close();
}
const browser=await pw.chromium.launch(),tiny=await readFile('images/mts-hero-mobile-horizontal-540.webp');
for(const failure of ['cdn','cdn-google','all']){
 const ctx=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:390,height:844}});await fixture(ctx);const hits=[];
 for(const pattern of ['**/.netlify/images?*','https://lh3.googleusercontent.com/**','https://drive.google.com/thumbnail?*'])await ctx.route(pattern,r=>{const u=r.request().url(),provider=u.includes('/.netlify/images')?'cdn':u.includes('lh3.')?'google':'thumbnail';hits.push(provider);const fail=provider==='cdn'||(provider==='google'&&failure!=='cdn')||failure==='all';return fail?r.fulfill({status:503,body:'QA unavailable'}):r.fulfill({contentType:'image/webp',body:tiny});});
 const p=await ctx.newPage();await p.goto(base);await p.locator('.card').scrollIntoViewIfNeeded();
 if(failure==='all')await p.waitForFunction(()=>!document.querySelector('.media').classList.contains('is-loading')&&document.querySelector('.image-placeholder'));
 else await p.waitForFunction(()=>document.querySelector('.media-button img')?.naturalWidth>0);
 await p.waitForTimeout(250);assert.deepEqual(hits,failure==='cdn'?['cdn','google']:['cdn','google','thumbnail']);results.push({failure,hits});await ctx.close();
}
// A changed Drive link must result in a distinct, deterministic CDN source URL.
const sources=[];for(const id of [imageId,'1H9IfpaHFulB1Ip3OKYi4ZGjJhAAl1xPV']){const c=await browser.newContext({ignoreHTTPSErrors:true});await fixture(c,id);await c.route('**/.netlify/images?*',r=>r.fulfill({contentType:'image/webp',body:tiny}));const p=await c.newPage();await ready(p);sources.push(new URL(await p.locator('.media-button img').evaluate(e=>e.currentSrc)).searchParams.get('url'));await c.close();}assert.notEqual(sources[0],sources[1]);await browser.close();
await writeFile(`${out}/browser-results.json`,JSON.stringify({results,sources},null,2));console.log(`PASS: ${results.filter(r=>r.engine).length} real CDN browser layouts; 3 bounded fallback paths; new Drive ID changes source URL`);
