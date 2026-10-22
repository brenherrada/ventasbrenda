(() => {
  'use strict';
  const required = {
    waitlistName: 'Escribí tu nombre.', waitlistEmail: 'Escribí tu mail.',
    productTitle: 'Contame qué producto querés vender.', productCategory: 'Elegí una categoría.',
    productCondition: 'Elegí el estado del producto.', productCity: 'Escribí la ciudad y el país donde está el producto.',
    productConsent: 'Necesito tu permiso para guardar y revisar esta propuesta.'
  };
  const controls = form => Array.from(form.querySelectorAll('input[required], input[type="email"], input[type="number"], select, textarea[maxlength]'));
  function message(field) {
    if (field.matches(':disabled')) return '';
    const value = field.value.trim(), validity = field.validity;
    if (field.required && (field.type === 'checkbox' ? !field.checked : !value)) return required[field.id] || 'Completá este campo.';
    if (field.type === 'email' && value && (validity.typeMismatch || !/^[^\s@\x00-\x1f]+@[^\s@\x00-\x1f]+\.[^\s@\x00-\x1f]+$/.test(value))) return 'Revisá el mail. Por ejemplo: nombre@correo.com.';
    if (validity.badInput || validity.rangeUnderflow || validity.rangeOverflow) return field.type === 'number' ? 'Escribí un precio mayor que cero y de hasta 1.000.000.000.' : 'Revisá este dato.';
    if (validity.stepMismatch) return 'Usá hasta dos decimales para el precio.';
    if (validity.tooLong) return 'Usá hasta ' + field.maxLength + ' caracteres.';
    return validity.valid ? '' : 'Revisá este campo para continuar.';
  }
  function display(field) {
    const error = document.getElementById(field.id + 'Error'), text = message(field);
    error.textContent = text; error.hidden = !text;
    const described = new Set((field.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
    if (text) { field.setAttribute('aria-invalid', 'true'); described.add(error.id); }
    else { field.removeAttribute('aria-invalid'); described.delete(error.id); }
    if (described.size) field.setAttribute('aria-describedby', [...described].join(' ')); else field.removeAttribute('aria-describedby');
    return !text;
  }
  function reset(form) {
    for (const field of controls(form)) {
      field.removeAttribute('aria-invalid');
      const error = document.getElementById(field.id + 'Error'); if (error) { error.hidden = true; error.textContent = ''; }
      const described = (field.getAttribute('aria-describedby') || '').split(/\s+/).filter(value => value && value !== field.id + 'Error');
      if (described.length) field.setAttribute('aria-describedby', described.join(' ')); else field.removeAttribute('aria-describedby');
    }
    const summary = form.querySelector('.form-error-summary'); if (summary) summary.hidden = true;
  }
  function validate(form) {
    let first;
    for (const field of controls(form)) if (!display(field) && !first) first = field;
    const summary = form.querySelector('.form-error-summary'); summary.hidden = !first;
    if (first) { first.focus({ preventScroll: true }); first.scrollIntoView({ block: 'center', behavior: 'instant' }); }
    return !first;
  }
  for (const form of document.querySelectorAll('[data-validate]')) {
    form.noValidate = true;
    const summary = document.createElement('p'); summary.className = 'form-error-summary'; summary.setAttribute('role', 'alert'); summary.hidden = true;
    summary.textContent = 'Revisá los campos marcados para continuar.'; form.prepend(summary);
    for (const field of controls(form)) {
      const label = field.closest('label'), group = document.createElement('div'); group.className = 'form-field';
      label.before(group); group.append(label);
      const error = document.createElement('p'); error.id = field.id + 'Error'; error.className = 'field-error'; error.hidden = true; group.append(error);
      for (const event of ['input', 'change']) field.addEventListener(event, () => {
        if (field.getAttribute('aria-invalid') === 'true') display(field);
        if (!form.querySelector('[aria-invalid="true"]')) summary.hidden = true;
      });
    }
    form.addEventListener('reset', () => reset(form));
  }
  globalThis.PlotTwistForms = { validate, reset };
})();
