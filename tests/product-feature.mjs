import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
// Production CSP requires HTTPS for WebKit. See tests/serve-https.mjs.
const base = process.env.QA_URL || 'https://localhost:8766';
const output = 'output/qa/legxercise';
await mkdir(output, { recursive: true });
const table = (labels, rows) => ({ table: { cols: labels.map(label => ({ label })), rows: rows.map(row => ({ c: row.map(v => ({ v })) })) } });
const catalog = table(['id', 'titulo', 'descripcion', 'precio', 'disponible', 'imagenes', 'categoria', 'vendido'], [['fixture', 'Otro artículo', 'Artículo del catálogo principal', 1000, 'Sí', '', 'Libros', 'No']]);
const config = table(['clave', 'valor'], [['whatsapp', '5492235550101']]);
for (const engine of ['chromium', 'firefox', 'webkit']) {
  const browser = await pw[engine].launch();
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: true, hasTouch: engine !== 'firefox', viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    await context.route('**/api/catalog?*', route => route.fulfill({ json: new URL(route.request().url()).searchParams.get('sheet') === 'Catalogo' ? catalog : config }));
    await context.route('https://wa.me/**', route => route.fulfill({ contentType: 'text/html', body: '<p>Destino de WhatsApp interceptado para QA; no se envió un mensaje.</p>' }));
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.locator('.card[data-id="fixture"]').waitFor();
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator('#headerWhatsApp').getAttribute('href'), 'https://wa.me/5492235550101');
    assert.match(await page.title(), /Venta/);
    const feature = page.locator('.product-feature');
    assert.match(await feature.locator('#legxerciseContact').textContent(), /Contactar por WhatsApp/);
    const descriptionLink = page.locator('#legxerciseDescription');
    await descriptionLink.click();
    await page.locator('#descriptionPopup').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#descriptionPopupHeading').innerText(), 'LegXercise Pro');
    assert.equal(await page.locator('#descriptionPopupCopy').textContent(), (await page.locator('#legxerciseDescriptionText').textContent()).trim());
    await page.keyboard.press('Escape');
    await page.locator('#descriptionPopup').waitFor({ state: 'hidden' });
    assert.equal(await descriptionLink.evaluate(el => el === document.activeElement), true);
    assert.match(await feature.locator('h2').textContent(), /¡Piernas en movimiento!/);
    assert.equal(await feature.locator('img[alt*="LegXercise"]').count(), 1);
    assert.equal(await feature.locator('img[alt*="Plot Twist"]').count(), 0);
    assert.ok(await feature.evaluate(el => Boolean(el.previousElementSibling?.id === 'catalogPagination')));
    for (const width of [320, 390, 599, 600, 601, 639, 640, 641, 800, 1024, 1440]) {
      await page.setViewportSize({ width, height: width === 800 ? 390 : 1000 });
      await feature.scrollIntoViewIfNeeded();
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await page.waitForFunction(() => { const image = document.querySelector('.product-feature__product'); return image.complete && image.naturalWidth > 0; });
      if (width === 390 || width === 1440) {
        await descriptionLink.click();
        await page.locator('#descriptionPopup').waitFor({ state: 'visible' });
        await page.screenshot({ path: `${output}/${engine}-description-${width}.png` });
        await page.locator('.description-close').click();
      }
      const measurements = await feature.evaluate(el => {
        const outer = el.getBoundingClientRect();
        const actionable = el.querySelector('a').getBoundingClientRect();
        return { overflow: document.documentElement.scrollWidth > innerWidth, buttonWidth: actionable.width, buttonHeight: actionable.height, outside: actionable.left < outer.left || actionable.right > outer.right, columns: getComputedStyle(el).gridTemplateColumns.split(' ').length, source: el.querySelector('.product-feature__product').currentSrc, ratio: outer.width / outer.height };
      });
      assert.equal(measurements.overflow, false, `${engine}/${width}: overflow`);
      assert.equal(measurements.outside, false, `${engine}/${width}: CTA cut`);
      assert.ok(measurements.buttonHeight >= 44);
      assert.equal(measurements.columns, width <= 600 ? 1 : 2);
      if (width === 1440) assert.ok(measurements.ratio >= 2.4, `${engine}: banner is too tall (${measurements.ratio.toFixed(2)}:1)`);
      if ([320, 390, 599, 600, 601, 1440].includes(width)) {
        // Isolate the component for visual review without changing site CSS/CSP.
        const chrome = page.locator('.site-nav,.catalog-tools,#webPromoTrigger,.mobile-nav');
        const previous = await chrome.evaluateAll(elements => elements.map(el => { const wasHidden = el.hidden; el.hidden = true; return wasHidden; }));
        await page.setViewportSize({ width, height: 1400 });
        await feature.screenshot({ path: `${output}/${engine}-${width}.png` });
        await chrome.evaluateAll((elements, previous) => elements.forEach((el, i) => { el.hidden = previous[i]; }), previous);
      }
    }
    const contact = page.locator('#legxerciseContact');
    await contact.focus();
    assert.equal(await contact.evaluate(el => el === document.activeElement), true);
    const dialog = page.locator('#lauraContactDialog');
    await page.keyboard.press('Enter');
    await dialog.waitFor({ state: 'visible' });
    assert.equal(await dialog.evaluate(el => el.matches(':modal')), true);
    assert.equal(context.pages().length, 1, 'WhatsApp opened before consent');
    assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true);
    }
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Shift+Tab');
      assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true);
    }
    await page.evaluate(() => {
      document.querySelector('#cancelLauraContact').click();
      document.querySelector('#legxerciseContact').click();
    });
    await dialog.waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
    await page.locator('#cancelLauraContact').click();
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await contact.evaluate(el => el === document.activeElement), true);
    await page.waitForFunction(() => document.body.style.overflow !== 'hidden');
    await contact.click();
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    await contact.click();
    await page.mouse.click(1, 1);
    await dialog.waitFor({ state: 'hidden' });
    for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 800, height: 390 }, { width: 1440, height: 1000 }]) {
      await page.setViewportSize(viewport);
      await descriptionLink.click();
      await page.locator('#descriptionPopup').waitFor({ state: 'visible' });
      const descriptionEnd = await page.locator('#descriptionPopupCopy').evaluate(el => {
        el.scrollTop = el.scrollHeight;
        return el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
      });
      assert.equal(descriptionEnd, true, 'Description end is unreachable');
      const descriptionClose = page.locator('.description-close');
      const closeBox = await descriptionClose.boundingBox();
      assert.ok(closeBox.y >= 0 && closeBox.y + closeBox.height <= viewport.height, 'Description close is outside viewport');
      if (viewport.width === 320 || viewport.width === 800) {
        await page.screenshot({ path: `${output}/${engine}-description-${viewport.width}-short.png` });
      }
      await descriptionClose.click();
      await page.locator('#descriptionPopup').waitFor({ state: 'hidden' });
      assert.equal(await descriptionLink.evaluate(el => el === document.activeElement), true);
      await contact.click();
      await dialog.waitFor({ state: 'visible' });
      const last = page.locator('#cancelLauraContact');
      await last.scrollIntoViewIfNeeded();
      const button = await last.boundingBox();
      const body = await page.locator('.contact-confirmation__copy').boundingBox();
      assert.ok(button.y >= body.y - 1 && button.y + button.height <= body.y + body.height + 1, 'Last action is clipped');
      assert.ok(button.y >= 0 && button.y + button.height <= viewport.height, 'Last action is outside viewport');
      await page.screenshot({ path: `output/qa/legxercise/${engine}-confirmation-${viewport.width}.png` });
      await last.click();
      await dialog.waitFor({ state: 'hidden' });
    }
    await contact.click();
    const popupPromise = context.waitForEvent('page');
    await page.locator('#confirmLauraContact').focus();
    await page.keyboard.press('Enter');
    const popup = await popupPromise;
    await popup.waitForLoadState();
    const url = new URL(popup.url());
    assert.equal(url.pathname, '/5492235364892');
    assert.match(url.searchParams.get('text'), /LegXercise Pro/);
    assert.match(url.searchParams.get('text'), /^Hola Laura/);
    assert.equal(await page.locator('#bagCount').innerText(), '0');
    assert.equal(errors.length, 0, errors.join('\n'));
    await popup.close();
    if (engine !== 'firefox') {
      await page.setViewportSize({ width: 390, height: 844 });
      const tapped = context.waitForEvent('page');
      await contact.tap();
      await dialog.waitFor({ state: 'visible' });
      assert.equal(context.pages().length, 1);
      await page.locator('#confirmLauraContact').tap();
      const touchPopup = await tapped;
      await touchPopup.waitForLoadState();
      assert.equal(new URL(touchPopup.url()).pathname, '/5492235364892');
      await touchPopup.close();
    }
    await context.close();
    const offline = await browser.newContext({ ignoreHTTPSErrors: true, javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
    const noScript = await offline.newPage();
    await noScript.goto(base);
    await noScript.locator('#legxerciseDescription').click();
    assert.equal(await noScript.locator('#legxerciseDescriptionText').isVisible(), true);
    assert.equal(await noScript.locator('#legxerciseContact').getAttribute('href'), '#lauraContactDialog');
    assert.equal(await noScript.locator('#lauraContactDialog').isVisible(), true);
    assert.equal(new URL(await noScript.locator('#confirmLauraContact').getAttribute('href')).pathname, '/5492235364892');
    assert.equal(await noScript.locator('.product-feature').isVisible(), true);
    await offline.close();
    const failure = await browser.newContext({ ignoreHTTPSErrors: true });
    await failure.route('**/api/catalog?*', route => route.fulfill({ status: 503, json: { error: 'QA failure' } }));
    await failure.route('https://docs.google.com/**', route => route.abort());
    const failedPage = await failure.newPage();
    await failedPage.goto(base);
    await failedPage.locator('.catalog-retry').waitFor();
    await failedPage.locator('#legxerciseContact').click();
    assert.equal(await failedPage.locator('#lauraContactDialog').isVisible(), true);
    assert.equal(new URL(await failedPage.locator('#confirmLauraContact').getAttribute('href')).pathname, '/5492235364892');
    assert.equal(await failedPage.locator('.product-feature').isVisible(), true);
    await failure.close();
    console.log(`PASS ${engine}: 11 widths, consent/cancel/Escape/backdrop, focus/scroll, 4 dialog sizes, keyboard/touch contact, no JS, catalog failure`);
  } finally { await browser.close(); }
}
