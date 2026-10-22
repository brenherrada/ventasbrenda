import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// Exercise the shipped controller with deterministic DOM/HTTP adapters.
// This proves client state and request contracts, not browser rendering or Sheets persistence.
const source = await readFile(new URL('../waitlist.js', import.meta.url), 'utf8');
const turn = () => new Promise(resolve => setImmediate(resolve));
const config = flag => new Response(JSON.stringify({ table: { rows: flag === undefined ? [] : [{ c: [{ v: 'mostrar_boton_vender' }, { v: flag }] }] } }));
function fixture(options = {}) {
  const { inline = true, configFailure = false } = options;
  const flag = Object.hasOwn(options, 'flag') ? options.flag : 'si';
  const elements = new Map();
  const document = { activeElement: null, getElementById: id => elements.get(id) || null };
  function element(id) {
    const el = { hidden: false, disabled: false, dataset: {}, textContent: '', attrs: {}, events: {},
      addEventListener(type, fn) { this.events[type] = fn; },
      setAttribute(key, value) { this.attrs[key] = value; },
      removeAttribute(key) { delete this.attrs[key]; },
      focus() { document.activeElement = this; }, scrollIntoView() {} };
    elements.set(id, el);
    return el;
  }
  const submit = element('webPromoContact'); submit.textContent = 'Quiero participar';
  const status = element('waitlistStatus'); status.hidden = true;
  const form = element('waitlistForm');
  form.action = 'https://fixture.test/api/waitlist';
  form.dataset.waitlist = inline ? 'inline' : undefined;
  form.valid = true;
  form.values = { name: ' Persona QA ', email: ' qa@example.test ', website: '' };
  form.querySelector = () => submit;
  form.reportValidity = () => form.valid;
  form.reset = () => { form.values = { name: '', email: '', website: '' }; };
  element('waitlistFields').disabled = true;
  element('waitlistAvailability'); element('waitlistRetry'); element('waitlistName');
  element('productInvite').hidden = true; element('openProducts'); element('productLoadStatus');
  if (!inline) element('webPromoTrigger');
  const state = { flag, configFailure, send: async () => new Response(JSON.stringify({ ok: true })), calls: [] };
  vm.runInNewContext(source, {
    document, AbortSignal, PlotTwistForms: { validate: form => form.reportValidity() },
    FormData: class { constructor(form) { this.values = { ...form.values }; } get(key) { return this.values[key]; } },
    fetch: async (url, options) => {
      if (!options?.method) {
        assert.equal(url, '/api/catalog?sheet=Config', 'Only Config may be read');
        if (state.configFailure) throw new Error('Synthetic connection failure');
        return config(state.flag);
      }
      state.calls.push({ url, ...options });
      return state.send();
    }
  });
  return { state, form, submit, status, get activeElement() { return document.activeElement; }, get: id => elements.get(id), submitForm: () => form.events.submit({ preventDefault() {} }) };
}

for (const flag of ['si', 'Sí', true, 1, 'yes', undefined]) {
  const f = fixture({ flag }); await turn();
  assert.equal(f.get('waitlistFields').disabled, false);
  assert.equal(f.get('waitlistAvailability').hidden, true);
}
for (const flag of ['no', false, '', 'invalid']) {
  const f = fixture({ flag }); await turn();
  assert.equal(f.get('waitlistFields').disabled, true);
  await f.submitForm(); assert.equal(f.state.calls.length, 0);
  assert.match(f.get('waitlistAvailability').textContent, /pausada/);
  f.state.flag = 'si'; f.get('waitlistRetry').focus();
  await f.get('waitlistRetry').events.click();
  assert.equal(f.get('waitlistFields').disabled, false);
  assert.equal(f.activeElement, f.get('waitlistName'), 'Retry must restore focus to the form');
}
{
  const f = fixture({ configFailure: true }); await turn();
  assert.equal(f.get('waitlistFields').disabled, true);
  assert.equal(f.get('waitlistRetry').hidden, false);
  await f.submitForm(); assert.equal(f.state.calls.length, 0);
  f.state.configFailure = false; await f.get('waitlistRetry').events.click();
  assert.equal(f.get('waitlistFields').disabled, false);
}
{
  const f = fixture(); await turn();
  f.form.valid = false; await f.submitForm(); assert.equal(f.state.calls.length, 0);
  f.form.valid = true;
  let release;
  f.state.send = () => new Promise(resolve => { release = resolve; });
  const first = f.submitForm();
  assert.equal(f.submit.disabled, true);
  assert.equal(f.form.attrs['aria-busy'], 'true');
  await f.submitForm(); assert.equal(f.state.calls.length, 1, 'Double submission must be ignored');
  release(new Response(JSON.stringify({ error: 'unavailable' }), { status: 503 }));
  await first;
  assert.equal(f.form.values.email, ' qa@example.test ', 'Failure must preserve entered data');
  assert.equal(f.form.hidden, false);
  assert.match(f.status.textContent, /No pudimos confirmar/);
  assert.equal(f.submit.disabled, false);
  f.state.send = async () => new Response(JSON.stringify({ ok: true }));
  await f.submitForm();
  assert.equal(f.form.hidden, true);
  assert.equal(f.form.values.email, '');
  assert.equal(f.status.dataset.state, 'success');
  assert.equal(f.activeElement, f.status, 'Confirmed success must receive focus');
  assert.match(f.status.textContent, /Ya estás en la lista/);
  assert.deepEqual(JSON.parse(f.state.calls[1].body), { name: 'Persona QA', email: 'qa@example.test', website: '', consent: true });
}
for (const response of [new Response('{'), new Response(JSON.stringify({ status: 'success' }))]) {
  const f = fixture(); await turn(); f.state.send = async () => response;
  await f.submitForm(); assert.equal(f.form.hidden, false);
  assert.match(f.status.textContent, /No pudimos confirmar/);
}
{
  const f = fixture(); await turn();
  f.state.send = async () => new Response(JSON.stringify({ error: 'registration_disabled' }), { status: 403 });
  await f.submitForm();
  assert.equal(f.get('waitlistFields').disabled, true);
  assert.equal(f.get('waitlistRetry').hidden, false);
  assert.equal(f.form.values.email, ' qa@example.test ');
}
{
  const f = fixture({ inline: false });
  f.get('webPromoTrigger').hidden = true;
  await f.submitForm(); assert.equal(f.state.calls.length, 0);
  f.get('webPromoTrigger').hidden = false;
  await f.submitForm(); assert.equal(f.status.dataset.state, 'success');
}
{
  const f = fixture(); await turn();
  assert.equal(f.get('productInvite').hidden, true);
  f.state.send = async () => new Response(JSON.stringify({ ok: true, intakeToken: 'opaque-test-session' }));
  await f.submitForm(); assert.equal(f.get('productInvite').hidden, false);
  // This VM has no browser module loader: opening optional intake must fail
  // independently and keep the contact's confirmed state intact.
  await f.get('openProducts').events.click();
  assert.equal(f.status.dataset.state, 'success');
  assert.equal(f.form.hidden, true);
  assert.equal(f.get('openProducts').disabled, false);
  assert.match(f.get('productLoadStatus').textContent, /inscripción ya está confirmada/);
}
console.log('PASS: availability, paused/failed configuration, retry, required fields, duplicate submit, failure preservation, confirmed success, malformed replies, 403 and legacy invitation. Storage is simulated.');
