// Actual built storefront -> actual function handler -> simulated Google only.
// No production credentials, Sheet reads, writes or WhatsApp messages.
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { createServer } from 'node:https';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import catalog from '../netlify/functions/catalog.mts';
import waitlist from '../netlify/functions/waitlist.mts';

const output = 'output/qa/catalog-migration';
await mkdir(output, { recursive: true });
execFileSync('openssl', ['req','-x509','-newkey','rsa:2048','-nodes','-keyout',`${output}/key.pem`,'-out',`${output}/cert.pem`,'-days','2','-subj','/CN=localhost'], { stdio:'ignore' });
const { privateKey } = generateKeyPairSync('rsa', { modulusLength:2048 });
const env = {
  CATALOG_SOURCE:'direct', CATALOG_SPREADSHEET_ID:'synthetic-browser-workbook-123456',
  CATALOG_GOOGLE_CREDENTIALS:JSON.stringify({ type:'service_account', client_email:'browser-reader@fixture-project.iam.gserviceaccount.com', private_key_id:'c'.repeat(40), private_key:privateKey.export({ type:'pkcs8',format:'pem' }) }),
};
const fields = ['id','titulo','descripcion','precio','disponible','imagenes','categoria','vendido','badge','private','reservado'];
const rows = [
  ['qa-one','Artículo de prueba','Descripción de prueba',2000,'Sí','','Libros','No','','PRIVATE_NOTE',false],
  ['qa-reserved','Artículo reservado','Descripción',3000,'Sí','','Deco','No','','PRIVATE_NOTE',true],
  ['qa-sold','Artículo vendido','Descripción',4000,'No','','Libros','Sí','','PRIVATE_NOTE',false],
];
let fail = false, empty = false, googleReads = 0, tokenRequests = 0;
const realFetch = globalThis.fetch, realNetlify = globalThis.Netlify, realInfo = console.info;
const logs = [];
console.info = line => logs.push(JSON.parse(line));
globalThis.Netlify = { env:{get:key=>env[key]} };
globalThis.fetch = async (url, options) => {
  const target = new URL(url);
  if (target.href === 'https://oauth2.googleapis.com/token') {
    tokenRequests++;
    return Response.json({ access_token:'SYNTHETIC_TOKEN',token_type:'Bearer',expires_in:3600 });
  }
  assert.equal(target.hostname, 'sheets.googleapis.com', 'Unexpected upstream request');
  assert.equal(options.method ?? 'GET','GET');
  googleReads++;
  const sheet = decodeURIComponent(target.pathname.split('/values/')[1]).split('!')[0];
  if (sheet === 'Catalogo' && fail) return new Response('',{status:503});
  const values = sheet === 'Catalogo' ? [fields,...(empty?[]:rows)] : sheet === 'Config' ? [['clave','valor'],['whatsapp','5492235550101'],['meta_total',9000],['mostrar_boton_vender','si'],['private','PRIVATE_CONFIG']] : [['concepto','importe'],['PRIVATE_CUSTOMER',25],['TOTAL VENDIDO',4000]];
  return Response.json({majorDimension:'ROWS',values});
};
const root = path.resolve('dist');
const headers = Object.fromEntries((await readFile(path.join(root,'_headers'),'utf8')).split('\n').flatMap(line=>{const match=line.match(/^  ([^:]+): (.+)$/);return match?[[match[1],match[2]]]:[]}));
const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.avif':'image/avif','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'};
const server = createServer({key:await readFile(`${output}/key.pem`),cert:await readFile(`${output}/cert.pem`)},async(req,res)=>{
  try {
    const url = new URL(req.url,`https://${req.headers.host}`);
    if (url.pathname.startsWith('/api/')) {
      const chunks=[];for await(const chunk of req)chunks.push(chunk);
      const request = new Request(url,{method:req.method,headers:req.headers,...(req.method==='POST'?{body:Buffer.concat(chunks)}:{})});
      const result = url.pathname==='/api/catalog'?await catalog(request):await waitlist(request,{deploy:{context:'deploy-preview'}});
      res.writeHead(result.status,Object.fromEntries(result.headers));return res.end(Buffer.from(await result.arrayBuffer()));
    }
    const file = path.resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));
    if (!file.startsWith(root+path.sep)) {res.writeHead(403);return res.end();}
    const body=await readFile(file);
    res.writeHead(200,{...headers,'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(body);
  } catch {res.writeHead(500);res.end('Local QA failed');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`https://127.0.0.1:${server.address().port}`;
const pw=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const results=[];
try {
  for(const engine of ['chromium','firefox','webkit']) {
    const browser=await pw[engine].launch();
    try {
      for(const width of [390,1440]) {
        fail=false;empty=false;
        const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height:900},reducedMotion:'reduce'});
        try {
          const page=await context.newPage();page.setDefaultTimeout(8000);
          const errors=[];page.on('pageerror',error=>errors.push(error.message));
          await page.goto(base);
          await page.waitForFunction(()=>document.querySelector('#products').getAttribute('aria-busy')==='false');
          assert.equal(await page.locator('#products .card[data-id]').count(),2);
          assert.equal(await page.locator('.card.reserved .select-btn').count(),0);
          assert.equal(await page.locator('.card[data-id="qa-sold"]').count(),0);
          assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
          await page.evaluate(()=>document.fonts.ready);
          await page.locator('#catalogo').scrollIntoViewIfNeeded();
          await page.screenshot({path:`${output}/${engine}-${width}.png`});
          await page.locator('.card[data-id="qa-one"] .select-btn').click();
          await page.locator(width<768?'#openBagMobile':'#openBag').click();
          await page.locator('#drawer').waitFor({state:'visible'});
          assert.match(await page.locator('#drawer').innerText(),/Artículo de prueba/);
          await page.keyboard.press('Escape');
          await page.goto(`${base}/?categoria=libros`);
          await page.waitForFunction(()=>document.querySelector('#products').getAttribute('aria-busy')==='false');
          assert.equal(await page.locator('#products .card[data-id]').count(),1);
          const before=googleReads;
          const signup=await page.request.post(`${base}/api/waitlist`,{headers:{origin:base,'x-nf-deploy-context':'production'},data:{name:'QA',email:'qa@example.test',consent:true}});
          assert.equal(signup.status(),403);assert.equal(googleReads,before);
          fail=true;
          await page.reload();await page.locator('.catalog-retry').waitFor();
          assert.equal(await page.locator('#products .card[data-id]').count(),0);
          fail=false;
          await page.locator('.catalog-retry').click();await page.locator('.card[data-id="qa-one"]').waitFor();
          empty=true;await page.reload();
          await page.waitForFunction(()=>document.querySelector('#products').getAttribute('aria-busy')==='false');
          assert.equal(await page.locator('#products .card[data-id]').count(),0);
          assert.equal(await page.locator('.catalog-retry').count(),0);
          assert.deepEqual(errors,[]);
          results.push({engine,width,passed:true});
          realInfo(`PASS: ${engine}/${width}: built UI + direct handler, products, selection, reserved/sold, filter, failure/retry, empty and preview POST blocked.`);
        } finally {await context.close();}
      }
    } finally {await browser.close();}
  }
  assert.equal(tokenRequests,1,'Browser reloads must reuse OAuth tokens but read fresh products');
  assert.ok(!JSON.stringify(logs).includes('PRIVATE'));
  await writeFile(`${output}/browser-results.json`,JSON.stringify({upstream:'synthetic Google; actual handler and dist',results,googleReads,tokenRequests},null,2)+'\n');
} finally {
  server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  globalThis.fetch=realFetch;globalThis.Netlify=realNetlify;console.info=realInfo;
}
