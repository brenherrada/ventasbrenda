(() => {
  "use strict";
  const form = document.getElementById("waitlistForm");
  if (!form) return;
  const trigger = document.getElementById("webPromoTrigger");
  const fields = document.getElementById("waitlistFields");
  const availability = document.getElementById("waitlistAvailability");
  const retry = document.getElementById("waitlistRetry");
  const inline = form.dataset.waitlist === "inline";
  const submit = form.querySelector('[type="submit"]');
  const submitLabel = submit.textContent;
  const status = document.getElementById("waitlistStatus");
  let pending = false;
  let checking = false;
  let enabled = false;
  const normalize = value => String(value ?? "").normalize("NFKD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();

  async function checkAvailability() {
    if (checking || pending) return;
    checking = true;
    enabled = false;
    fields.disabled = true;
    availability.hidden = false;
    availability.textContent = "Comprobando la inscripción…";
    retry.hidden = true;
    try {
      const response = await fetch("/api/catalog?sheet=Config", { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error("Availability not confirmed");
      const data = await response.json();
      const rows = data.table?.rows;
      if (!Array.isArray(rows)) throw new Error("Invalid availability");
      const flag = rows.find(row => normalize(row.c?.[0]?.v) === "mostrar_boton_vender");
      enabled = !flag || ["si", "true", "1", "yes"].includes(normalize(flag.c?.[1]?.v));
      fields.disabled = !enabled;
      availability.hidden = enabled;
      if (!enabled) availability.textContent = "La inscripción está pausada. Podés volver a consultar más adelante.";
      if (enabled && document.activeElement === retry) document.getElementById("waitlistName").focus();
    } catch (_) {
      availability.textContent = "No pudimos abrir la inscripción. Revisá tu conexión e intentá de nuevo.";
    } finally {
      checking = false;
      retry.hidden = enabled;
    }
  }

  function offerProducts(token) {
    const invitation = document.getElementById("productInvite");
    if (!invitation || typeof token !== "string" || !token) return;
    const button = document.getElementById("openProducts");
    const loadStatus = document.getElementById("productLoadStatus");
    if (!button || !loadStatus) return;
    invitation.hidden = false;
    button.addEventListener("click", async () => {
      if (button.disabled) return;
      button.disabled = true;
      loadStatus.hidden = false;
      loadStatus.textContent = "Abriendo la carga de productos…";
      try {
        const { startProducts } = await import("./products.mjs?v=20261022");
        startProducts(token);
        button.setAttribute("aria-expanded", "true");
        button.hidden = loadStatus.hidden = true;
      } catch (_) {
        loadStatus.textContent = "Tu inscripción ya está confirmada. No pudimos abrir los productos; podés intentar de nuevo.";
        button.disabled = false;
      }
    });
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const available = inline ? enabled : trigger && !trigger.hidden && !trigger.disabled;
    if (pending || !available || !globalThis.PlotTwistForms.validate(form)) return;
    pending = true;
    submit.disabled = true;
    submit.textContent = "Guardando…";
    form.setAttribute("aria-busy", "true");
    status.hidden = true;
    const values = new FormData(form);
    try {
      const response = await fetch(form.action, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(values.get("name") || "").trim(),
          email: String(values.get("email") || "").trim(),
          website: String(values.get("website") || ""),
          consent: true
        }),
        signal: AbortSignal.timeout(45000)
      });
      const result = await response.json();
      if (!response.ok || result.ok !== true) {
        if (response.status === 403 && inline) {
          enabled = false;
          fields.disabled = true;
          availability.hidden = false;
          availability.textContent = "La inscripción no está disponible en este momento. Podés volver a consultar más adelante.";
          retry.hidden = false;
        }
        throw new Error("Registration not confirmed");
      }
      form.reset();
      form.hidden = true;
      status.dataset.state = "success";
      status.textContent = "¡Ya estás en la lista! Te voy a avisar por mail cuando Plot Twist Collective esté disponible.";
      status.hidden = false;
      status.focus({ preventScroll: true });
      offerProducts(result.intakeToken);
    } catch (_) {
      status.dataset.state = "error";
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
  if (inline) {
    retry.addEventListener("click", checkAvailability);
    checkAvailability();
  }
})();
