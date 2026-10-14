(() => {
  "use strict";
  const form = document.getElementById("waitlistForm");
  if (!form) return;
  const trigger = document.getElementById("webPromoTrigger");
  const submit = form.querySelector('[type="submit"]');
  const submitLabel = submit.textContent;
  const status = document.getElementById("waitlistStatus");
  let pending = false;
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (pending || trigger.hidden || trigger.disabled || !form.reportValidity()) return;
    pending = true;
    submit.disabled = true;
    submit.textContent = "Guardando…";
    form.setAttribute("aria-busy", "true");
    status.hidden = true;
    const fields = new FormData(form);
    try {
      const response = await fetch(form.action, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(fields.get("name") || "").trim(),
          email: String(fields.get("email") || "").trim(),
          website: String(fields.get("website") || ""),
          consent: true
        }),
        signal: AbortSignal.timeout(30000)
      });
      const result = await response.json();
      if (!response.ok || result.ok !== true) throw new Error("Registration not confirmed");
      form.reset();
      form.hidden = true;
      status.textContent = "Gracias por tu interés. Te avisaré por mail cuando la web esté disponible.";
      status.hidden = false;
      status.focus({ preventScroll: true });
    } catch (_) {
      status.textContent = "No pudimos confirmar tu inscripción. Tus datos siguen acá; podés intentar de nuevo en un momento.";
      status.hidden = false;
      status.scrollIntoView({ block: "nearest", behavior: "instant" });
    } finally {
      pending = false;
      submit.disabled = false;
      submit.textContent = submitLabel;
      form.removeAttribute("aria-busy");
    }
  });
})();
