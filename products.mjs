import { categories, conditions, currencies, limits } from './product-options.mjs';

const readDataURL = blob => new Promise((resolve, reject) => {
  const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob);
});
async function preparePhoto(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || !file.size || file.size > limits.sourceBytes) throw new Error('Elegí fotos JPG, PNG o WebP de hasta 12 MB cada una.');
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 40000000) throw new Error('Esta foto es demasiado grande. Elegí una versión más chica.');
    const scale = Math.min(1, limits.photoSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let blob;
    for (const quality of [0.84, 0.7, 0.55, 0.4]) {
      blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (blob && blob.size <= limits.photoBytes) break;
    }
    if (!blob || blob.size > limits.photoBytes) throw new Error('No pudimos reducir esta foto. Probá con una versión más chica.');
    return { blob, preview: await readDataURL(blob) };
  } finally { bitmap.close(); }
}

export function startProducts(token) {
  const get = id => document.getElementById(id);
  const section = get('productSection'), form = get('productForm'), fields = get('productFields');
  const submit = get('saveProduct'), status = get('productStatus'), next = get('productNext');
  const photosInput = get('productPhotos'), photoStatus = get('photoStatus'), previews = get('photoPreviews');
  const entries = [], photos = [];
  let pending = false, processing = false, snapshot = null, dirty = false, expired = false;
  function message(text, state = 'error') {
    status.textContent = text; status.dataset.state = state; status.hidden = false;
  }
  function focusStatus() { status.focus({ preventScroll: true }); status.scrollIntoView({ block: 'nearest', behavior: 'instant' }); }
  for (const [id, values] of [['productCategory', categories], ['productCondition', conditions], ['productCurrency', currencies]]) {
    const select = get(id);
    for (const value of values) { const option = document.createElement('option'); option.value = option.textContent = value; select.append(option); }
  }
  function renderPhotos() {
    previews.replaceChildren();
    photos.forEach((photo, index) => {
      const item = document.createElement('li'), image = document.createElement('img'), remove = document.createElement('button');
      image.src = photo.preview; image.alt = 'Foto ' + (index + 1) + ' del producto'; image.width = image.height = 180;
      remove.type = 'button'; remove.setAttribute('aria-label', 'Quitar foto ' + (index + 1)); remove.title = 'Quitar foto ' + (index + 1);
      const trash = document.createElement('img'); trash.src = 'icons/remove-product.svg'; trash.alt = ''; trash.width = trash.height = 24; remove.append(trash);
      remove.addEventListener('click', () => { photos.splice(index, 1); dirty = true; renderPhotos(); photoStatus.textContent = photos.length ? photos.length + (photos.length === 1 ? ' foto lista para enviar.' : ' fotos listas para enviar.') : 'Todavía no elegiste fotos. Podés enviar el producto sin ellas.'; get('addPhotos').focus(); });
      item.append(image, remove); previews.append(item);
    });
  }
  form.addEventListener('input', () => { dirty = true; });
  window.addEventListener('beforeunload', event => { if (dirty || pending) { event.preventDefault(); event.returnValue = ''; } });
  get('addPhotos').addEventListener('click', () => photosInput.click());
  photosInput.addEventListener('change', async () => {
    if (pending || processing || snapshot) return;
    const selected = Array.from(photosInput.files); photosInput.value = '';
    photoStatus.hidden = false;
    if (photos.length + selected.length > limits.photos) { photoStatus.textContent = 'Podés agregar hasta 3 fotos por producto. Quitá alguna para elegir otra.'; return; }
    processing = true; submit.disabled = get('addPhotos').disabled = true; photoStatus.textContent = 'Preparando las fotos…';
    try {
      for (const file of selected) { photos.push(await preparePhoto(file)); dirty = true; renderPhotos(); }
      photoStatus.textContent = photos.length + (photos.length === 1 ? ' foto lista para enviar.' : ' fotos listas para enviar.');
    } catch (error) { photoStatus.textContent = error.message?.startsWith('Elegí') || error.message?.startsWith('Esta foto') || error.message?.startsWith('No pudimos reducir') ? error.message : 'No pudimos leer esa foto. Probá con otra imagen JPG, PNG o WebP.'; }
    finally { processing = false; submit.disabled = get('addPhotos').disabled = false; }
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (pending || processing || expired || (!snapshot && !globalThis.PlotTwistForms.validate(form))) return;
    if (!snapshot) {
      const values = new FormData(form), price = values.get('price');
      snapshot = { id: crypto.randomUUID(), title: String(values.get('title')).trim(), category: values.get('category'), condition: values.get('condition'), city: String(values.get('city')).trim(), description: String(values.get('description')).trim(), price: price === '' ? null : Number(price), currency: values.get('currency'), consent: values.get('consent') === 'on' };
    }
    pending = true; fields.disabled = submit.disabled = true; form.setAttribute('aria-busy', 'true');
    submit.textContent = 'Enviando…'; message('Enviando tu propuesta. Esperá la confirmación.', 'pending');
    const data = new FormData(); data.append('product', JSON.stringify(snapshot));
    photos.forEach((photo, index) => data.append('photo', photo.blob, snapshot.id + '-' + (index + 1) + '.jpg'));
    try {
      const response = await fetch('/api/product-intake', { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: data, signal: AbortSignal.timeout(55000) });
      const result = await response.json();
      if (!response.ok || result.ok !== true || result.productId !== snapshot.id) {
        if (response.status === 401) { expired = true; throw new Error('expired'); }
        if (response.status === 400 || response.status === 413 || response.status === 415) { snapshot = null; fields.disabled = false; throw new Error('invalid'); }
        if (response.status === 409 && result.error === 'product_limit') { expired = true; throw new Error('limit'); }
        throw new Error('unconfirmed');
      }
      entries.push(snapshot); dirty = false; photos.length = 0; previews.replaceChildren();
      const item = document.createElement('li'); item.textContent = snapshot.title + ' · ' + snapshot.category;
      get('productReceivedList').append(item); get('productReceived').hidden = false;
      form.hidden = true; message('¡Propuesta recibida! Voy a revisarla para preparar las cápsulas. Todavía no está publicada.', 'success');
      next.hidden = false; get('anotherProduct').hidden = entries.length >= limits.products;
      focusStatus();
    } catch (error) {
      const messages = {
        expired: 'Esta sesión venció. Tu inscripción sigue confirmada. Para cargar más productos, recargá la página y anotate con el mismo mail; tu contacto no se duplica.',
        limit: 'Ya alcanzaste las 10 propuestas de esta sesión. Tu inscripción sigue confirmada.',
        invalid: 'No pudimos aceptar este envío. Revisá los datos y las fotos antes de intentar de nuevo.',
        unconfirmed: 'No pudimos confirmar el envío. Tus datos y fotos siguen acá. Reintentá el mismo envío para comprobarlo sin duplicar la propuesta.'
      };
      message(messages[error.message] || messages.unconfirmed); focusStatus();
      submit.textContent = snapshot ? 'Reintentar el mismo envío' : 'Enviar propuesta';
    } finally {
      pending = false; submit.disabled = expired; form.removeAttribute('aria-busy');
    }
  });
  get('anotherProduct').addEventListener('click', () => {
    const city = get('productCity').value, currency = get('productCurrency').value;
    snapshot = null; form.reset(); get('productCity').value = city; get('productCurrency').value = currency;
    fields.disabled = false; submit.textContent = 'Enviar propuesta'; status.hidden = photoStatus.hidden = next.hidden = true; form.hidden = false;
    get('productProgress').textContent = 'Propuesta ' + (entries.length + 1) + ' de hasta ' + limits.products;
    get('productTitle').focus();
  });
  get('finishProducts').addEventListener('click', () => {
    next.hidden = true;
    message('¡Gracias! Tu inscripción y tus propuestas quedaron recibidas. Te voy a contactar por mail cuando tenga los detalles de Collective.', 'success'); focusStatus();
  });
  section.hidden = false;
  get('productsTitle').focus({ preventScroll: true }); section.scrollIntoView({ block: 'start', behavior: 'instant' });
}
