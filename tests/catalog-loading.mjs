// Exercise the built storefront with slow/failed dependencies; no Sheets writes.
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.QA_URL || 'https://localhost:8766';
const output = 'output/qa/catalog-loading';
await mkdir(output, { recursive: true });
const table = (labels, rows) => ({ table: { cols: labels.map(label => ({ label })), rows: rows.map(row => ({ c: row.map(v => ({ v })) })) } });
const catalog = table(['id','titulo','descripcion','precio','disponible','imagenes','categoria','vendido','badge','reservado'], [
  ['loading-qa','Artículo de prueba','Descripción del artículo',1000,'Sí','','Libros','No','',false]
]);
const config = table(['clave','valor'], [['whatsapp','5492235550101']]);
for (const engine of ['chromium', 'firefox', 'webkit']) {
  const browser = await pw[engine].launch();
  const context = await browser.newContext({ignoreHTTPSErrors:true, viewport:{width:390,height:844}, hasTouch:engine !== 'firefox', reducedMotion:'reduce'});
  try {
    let releaseCatalog, releaseFonts;
    const catalogGate = new Promise(resolve => { releaseCatalog = resolve; });
    const fontGate = new Promise(resolve => { releaseFonts = resolve; });
    let fail = false;
    let empty = false;
    const catalogRequests = [];
    await context.route('**/*.woff2', async route => { await fontGate; await route.continue(); });
    await context.route('**/api/catalog?*', async route => {
      const sheet = new URL(route.request().url()).searchParams.get('sheet');
      if (sheet === 'Catalogo') {
        catalogRequests.push(route.request());
        await catalogGate;
        if (fail) return route.fulfill({status:503,json:{error:'Controlled QA failure'}});
        return route.fulfill({json:empty ? table(catalog.table.cols.map(c=>c.label),[]) : catalog});
      }
      return route.fulfill({json:config});
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror',error=>errors.push(error.message));
    await page.clock.install();
    await page.goto(base, {waitUntil:'domcontentloaded'});
    assert.equal(await page.locator('main').isVisible(),true,'Fonts must not hide the storefront');
    assert.equal(await page.locator('#catalogStatus').isVisible(),true);
    assert.match(await page.locator('#catalogStatus').innerText(),/Cargando catálogo/);
    assert.equal(await page.locator('.skeleton-card').count(),6);
    assert.equal(await page.locator('#mobileCategoryCount').innerText(),'…');
    assert.equal(await page.locator('#products .select-btn').count(),0,'No fabricated or stale products');
    releaseFonts();
    await page.evaluate(() => document.fonts.ready);
    for (const width of [320,390,766,767,768,1024,1440]) {
      await page.setViewportSize({width,height:844});
      await page.locator('#catalogo').scrollIntoViewIfNeeded();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${engine}/${width} overflow`);
      if ([390,768,1440].includes(width)) await page.screenshot({path:`${output}/${engine}-loading-${width}.png`});
    }
    await page.clock.runFor(6100);
    assert.match(await page.locator('#catalogStatus').innerText(),/tardando más de lo habitual/);
    assert.equal(await page.locator('main').isVisible(),true);
    releaseFonts();
    releaseCatalog();
    await page.waitForFunction(()=>document.querySelector('#products').getAttribute('aria-busy')==='false');
    assert.equal(await page.locator('.skeleton-card').count(),0);
    assert.equal(await page.locator('#products .card[data-id]').count(),1);
    assert.equal(await page.locator('#catalogStatus').isVisible(),false);
    await page.clock.runFor(6100);
    assert.equal(await page.locator('#catalogStatus').isVisible(),false,'Delayed message must not replace completed data');
    assert.equal(catalogRequests.length,1,'One fresh request per load');
    assert.equal(await page.evaluate(()=>Object.keys(localStorage).some(key=>/catalog|product|price/i.test(key))),false);
    fail = true;
    await page.reload({waitUntil:'domcontentloaded'});
    await page.locator('.catalog-retry').waitFor();
    assert.equal(await page.locator('.skeleton-card').count(),0);
    fail = false;
    await page.locator('.catalog-retry').click();
    await page.locator('.card[data-id]').waitFor();
    assert.equal(await page.locator('#catalogStatus').isVisible(),false);
    empty = true;
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.querySelector('#products').getAttribute('aria-busy')==='false');
    assert.match(await page.locator('#catalogStatus').innerText(),/No hay artículos disponibles/);
    assert.equal(await page.locator('.skeleton-card').count(),0);
    assert.deepEqual(errors,[]);
    console.log(`PASS ${engine}: visible before fonts/data, slow response, responsive, recovery, empty, no product cache`);
  } finally { await context.close(); await browser.close(); }
}
