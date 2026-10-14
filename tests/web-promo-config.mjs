import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.QA_URL || 'https://localhost:8766';
const output = 'output/qa/web-promo-config';
await mkdir(output, { recursive: true });
const table = (labels, rows) => ({ table: { cols: labels.map(label => ({ label })), rows: rows.map(row => ({ c: row.map(v => ({ v })) })) } });
const catalog = table(['id', 'titulo', 'descripcion', 'precio', 'disponible', 'imagenes', 'categoria', 'vendido'], [['fixture', 'Artículo', 'Descripción', 1000, 'Sí', '', 'Libros', 'No']]);

for (const engine of ['chromium', 'firefox', 'webkit']) {
  const browser = await pw[engine].launch();
  try {
    for (const width of [390, 1440]) {
      const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
      const state = { flag: 'si', fail: false, fallback: false, hold: null };
      const config = () => table(['clave', 'valor'], [['whatsapp', '5492235550101'], ...(state.flag === undefined ? [] : [['mostrar_boton_vender', state.flag]])]);
      await context.route('**/api/catalog?*', async route => {
        const sheet = new URL(route.request().url()).searchParams.get('sheet');
        if (sheet !== 'Config') return route.fulfill({ json: catalog });
        if (state.hold) await state.hold;
        return state.fail || state.fallback ? route.fulfill({ status: 503, json: { error: 'QA failure' } }) : route.fulfill({ json: config() });
      });
      await context.route('https://docs.google.com/**', route => {
        if (!state.fallback) return route.abort();
        const callback = new URL(route.request().url()).searchParams.get('tqx').split('responseHandler:')[1];
        return route.fulfill({ contentType: 'application/javascript', body: `${callback}(${JSON.stringify(config())});` });
      });
      await context.route('https://wa.me/**', route => route.fulfill({ body: 'WhatsApp intercepted for QA.' }));
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      const trigger = page.locator('#webPromoTrigger');
      const promo = page.locator('#webPromo');
      const ready = async () => {
        await page.locator('.card[data-id="fixture"]').waitFor();
        await page.waitForFunction(() => document.querySelector('#headerWhatsApp').hasAttribute('href'));
      };
      await page.goto(base);
      await ready();
      await trigger.focus();
      await page.keyboard.press('Enter');
      await promo.waitFor({ state: 'visible' });
      await page.waitForFunction(() => {
        const image = document.querySelector('.web-promo-art');
        return image.complete && image.naturalWidth > 0;
      });
      await page.screenshot({ path: `${output}/${engine}-on-${width}.png` });
      await page.keyboard.press('Escape');
      await promo.waitFor({ state: 'hidden' });
      assert.equal(await trigger.evaluate(el => el === document.activeElement), true);
      const popupPromise = context.waitForEvent('page');
      await trigger.click();
      await page.locator('#webPromoContact').click();
      const popup = await popupPromise;
      await popup.waitForLoadState();
      assert.equal(new URL(popup.url()).pathname, '/5492235550101');
      await popup.close();
      for (const flag of ['no', false, '', 'invalid']) {
        state.flag = flag;
        await page.reload();
        await ready();
        assert.equal(await trigger.isVisible(), false);
        assert.equal(await trigger.isDisabled(), true);
        assert.equal(await promo.evaluate(el => el.hidden), true);
        await page.locator('#webPromoContact').evaluate(el => el.click());
        assert.equal(context.pages().length, 1, 'Disabled promotion opened WhatsApp');
      }
      await page.screenshot({ path: `${output}/${engine}-off-${width}.png` });
      for (const flag of [undefined, true, 'Sí']) {
        state.flag = flag;
        await page.reload();
        await ready();
        assert.equal(await trigger.isVisible(), true);
      }
      let release;
      state.flag = 'no';
      state.hold = new Promise(resolve => { release = resolve; });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.locator('.card[data-id="fixture"]').waitFor();
      assert.equal(await trigger.isVisible(), false, 'Promotion flashed before Config');
      release(); state.hold = null;
      await ready();
      assert.equal(await trigger.isVisible(), false);
      state.fallback = true;
      state.flag = 'si';
      await page.reload();
      await ready();
      assert.equal(await trigger.isVisible(), true, 'JSONP cannot enable promotion');
      state.flag = 'no';
      await page.reload();
      await ready();
      assert.equal(await trigger.isVisible(), false, 'JSONP cannot disable promotion');
      state.fallback = false; state.fail = true;
      await page.reload();
      await page.locator('.card[data-id="fixture"]').waitFor();
      await page.waitForFunction(() => !document.querySelector('script[src*="responseHandler"]'));
      assert.equal(await trigger.isVisible(), false, 'Config failure exposed promotion');
      assert.equal(errors.length, 0, errors.join('; '));
      await context.close();
    }
    const noJS = await browser.newContext({ ignoreHTTPSErrors: true, javaScriptEnabled: false });
    const noJSPage = await noJS.newPage();
    await noJSPage.goto(base);
    assert.equal(await noJSPage.locator('#webPromoTrigger').isVisible(), false);
    await noJS.close();
    console.log(`PASS ${engine}: on/off/reload, keyboard/contact, invalid/missing flags, delayed/failed Config, JSONP, no JS, desktop/mobile`);
  } finally { await browser.close(); }
}
