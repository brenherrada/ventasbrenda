import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.QA_URL || 'http://localhost:8765';
const out = 'output/qa/waitlist';
await mkdir(out, { recursive: true });
const table = (rows) => ({ table: { cols: [{ label: 'clave' }, { label: 'valor' }], rows: rows.map(row => ({ c: row.map(v => ({ v })) })) } });
let passed = 0;
for (const engine of (process.env.QA_BROWSERS || 'chromium,firefox,webkit').split(',')) {
  const browser = await pw[engine].launch();
  try {
    for (const [width, height] of [[320,844],[390,844],[767,844],[768,844],[769,844],[1024,900],[1440,900],[844,390],[390,430]]) {
      const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
      page.setDefaultTimeout(8000);
      console.log(`CHECK ${engine} ${width}x${height}`);
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      let calls = 0, resolve, payload;
      await page.route('**/api/catalog?*', route => route.fulfill({ json: table([['whatsapp','5492235550101'],['mostrar_boton_vender','si']]) }));
      await page.route('**/api/waitlist', async route => {
        calls++; payload = route.request().postDataJSON();
        await new Promise(done => { resolve = done; });
        await route.fulfill({ status: calls === 1 ? 503 : 200, json: calls === 1 ? { error: 'unavailable' } : { ok: true } });
      });
      await page.goto(base);
      await page.evaluate(() => document.fonts.ready);
      const trigger = page.locator('#webPromoTrigger');
      await trigger.waitFor({ state: 'visible' });
      await trigger.click();
      await page.locator('#webPromo').waitFor({ state: 'visible' });
      await page.locator('#webPromoContact').click();
      assert.equal(calls, 0, 'Empty form submitted');
      await page.locator('#waitlistName').fill('Persona QA');
      await page.locator('#waitlistEmail').fill('qa@example.test');
      await page.locator('#waitlistPrivacy').scrollIntoViewIfNeeded();
      const privacy = await page.locator('#waitlistPrivacy').boundingBox();
      assert.ok(privacy.y >= 0 && privacy.y + privacy.height <= height + 1, 'Privacy note unreachable');
      if ([390,1440].includes(width) && height > 500) {
        await page.locator('.web-promo-content').evaluate(e => { e.scrollTop = 0; });
        await page.screenshot({ path: `${out}/${engine}-${width}.png` });
      }
      await page.locator('#webPromoContact').click();
      await page.waitForFunction(() => document.querySelector('#waitlistForm').getAttribute('aria-busy') === 'true');
      assert.equal(await page.locator('#webPromoContact').isDisabled(), true);
      await page.locator('#waitlistForm').evaluate(e => e.dispatchEvent(new Event('submit', { bubbles:true, cancelable:true })));
      assert.equal(calls, 1, 'Double submit created two requests');
      resolve();
      await page.locator('#waitlistStatus').waitFor({ state: 'visible' });
      assert.match(await page.locator('#waitlistStatus').innerText(), /No pudimos confirmar/);
      assert.equal(await page.locator('#waitlistEmail').inputValue(), 'qa@example.test');
      await page.locator('#webPromoContact').click();
      await page.waitForFunction(() => document.querySelector('#waitlistForm').getAttribute('aria-busy') === 'true');
      resolve();
      await page.waitForFunction(() => document.querySelector('#waitlistForm').hidden);
      assert.match(await page.locator('#waitlistStatus').innerText(), /Gracias por tu interés/);
      assert.deepEqual(payload, { name:'Persona QA', email:'qa@example.test', website:'', consent:true });
      assert.equal(await page.locator('#waitlistEmail').inputValue(), '');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.keyboard.press('Escape');
      await page.locator('#webPromo').waitFor({ state:'hidden' });
      assert.equal(await trigger.evaluate(e => e === document.activeElement), true);
      assert.deepEqual(errors, []);
      await page.close(); passed++;
    }
    console.log(`PASS ${engine}: required fields, pending/double submit, error/retry, success, focus, privacy and 9 responsive sizes`);
  } finally { await browser.close(); }
}
console.log(`PASS: ${passed} waitlist browser flows (mock storage; live Google connection tested separately).`);
