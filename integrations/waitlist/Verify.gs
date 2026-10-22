// Owner-only verification helpers. Never routed through doPost or run on a schedule.
// Uses a public existing Plot Twist image and explicitly synthetic contact data.
function verifyProductIntake() {
  const properties = intakeProperties_();
  if (!properties.getProperty('PRODUCTS_QA_ID')) properties.setProperty('PRODUCTS_QA_ID', Utilities.getUuid());
  if (!properties.getProperty('PRODUCTS_QA_SESSION')) properties.setProperty('PRODUCTS_QA_SESSION', Utilities.getUuid());
  const id = properties.getProperty('PRODUCTS_QA_ID'), sessionId = properties.getProperty('PRODUCTS_QA_SESSION');
  const image = UrlFetchApp.fetch('https://plottwistcolectivo.ar/images/social/hogar-exterior-v1.jpg');
  if (image.getResponseCode() !== 200 || image.getBlob().getBytes().length > PRODUCT_CONTRACT.limits.photoBytes) throw new Error('QA image unavailable');
  const product = { id: id, title: 'QA · verificación privada', category: PRODUCT_CONTRACT.categories[0], condition: PRODUCT_CONTRACT.conditions[1], city: 'Ciudad de prueba, Argentina', description: 'PROPUESTA SINTÉTICA. No es una venta ni una vendedora real.', price: null, currency: 'ARS', consent: true };
  const photos = [{ mime: 'image/jpeg', data: Utilities.base64Encode(image.getBlob().getBytes()) }];
  const fingerprint = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify({ product: product, photos: photos }), Utilities.Charset.UTF_8).map(value => ('0' + ((value + 256) % 256).toString(16)).slice(-2)).join('');
  const input = { secret: properties.getProperty('WAITLIST_SECRET'), action: 'product.submit', environment: INTAKE_ENVIRONMENT, policy: 'products-v1', session: { id: sessionId, name: 'QA · verificación privada', email: 'qa+' + sessionId + '@example.test' }, product: product, photos: photos, fingerprint: fingerprint };
  const send = () => JSON.parse(doPost({ postData: { contents: JSON.stringify(input) } }).getContent());
  if (!send().ok || !send().ok) throw new Error('Real proposal save/retry not confirmed');
  const matches = productValues_(PRODUCT_RANGE + 'K2:R10001').filter(row => row[4] === id && row[5] === sessionId);
  if (matches.length !== 1 || matches[0][3] !== 'Por revisar') throw new Error('Real proposal deduplication not confirmed');
  const photoId = /^https:\/\/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)\/view$/.exec(matches[0][0])?.[1];
  if (!photoId) throw new Error('Real photo link missing');
  const file = driveRequest_('drive/v3/files/' + photoId + '?fields=id,size,parents,appProperties,permissions(type,role)', 'get');
  if (Number(file.size) <= 0 || file.parents?.[0] !== privateProductFolder_() || file.appProperties?.product !== id || file.permissions?.length !== 1 || file.permissions[0].role !== 'owner') throw new Error('Real photo privacy not confirmed');
  console.info(JSON.stringify({ event: 'product_intake_verified', proposalId: id, photoId: photoId, rows: 1, photos: 1, private: true }));
}

function cleanupProductIntakeVerification() {
  const properties = intakeProperties_();
  const id = properties.getProperty('PRODUCTS_QA_ID'), session = properties.getProperty('PRODUCTS_QA_SESSION');
  if (!PRODUCT_UUID.test(id || '') || !PRODUCT_UUID.test(session || '')) throw new Error('No owned QA fixture');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Cleanup busy');
  try {
    const rows = productValues_(PRODUCT_RANGE + 'K2:R10001');
    const indices = rows.map((row, index) => row[4] === id && row[5] === session ? index : -1).filter(index => index !== -1);
    if (indices.length > 1) throw new Error('Ambiguous QA rows; no deletion');
    for (const index of indices) {
      const range = PRODUCT_RANGE + 'A' + (index + 2) + ':R' + (index + 2);
      const row = googleApi_('waitlist', '/values/' + encodeURIComponent(range), 'get').values?.[0];
      if (!row || row[1] !== 'QA · verificación privada' || row[2] !== 'qa+' + session + '@example.test' || row[4] !== 'QA · verificación privada' || row[14] !== id || row[15] !== session) throw new Error('QA identity differs; no deletion');
      for (const link of row.slice(10, 13).filter(Boolean)) {
        const photoId = /^https:\/\/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)\/view$/.exec(link)?.[1];
        if (!photoId) throw new Error('QA photo differs; no deletion');
        const file = driveRequest_('drive/v3/files/' + photoId + '?fields=appProperties,parents,trashed', 'get', undefined, undefined, true);
        if (!file) continue;
        if (file.appProperties?.product !== id || file.appProperties?.session !== session || file.parents?.[0] !== privateProductFolder_()) throw new Error('QA photo identity differs; no deletion');
        if (!file.trashed) driveRequest_('drive/v3/files/' + photoId + '?fields=id', 'patch', { trashed: true });
      }
      googleApi_('waitlist', '/values/' + encodeURIComponent(range) + ':clear', 'post', {});
    }
    properties.deleteProperty('PRODUCTS_QA_ID'); properties.deleteProperty('PRODUCTS_QA_SESSION');
    console.info(JSON.stringify({ event: 'product_intake_qa_cleaned', rows: indices.length, ownFixtureOnly: true }));
  } finally { lock.releaseLock(); }
}
