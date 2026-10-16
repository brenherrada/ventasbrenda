(() => {
  "use strict";

  const CFG = window.CATALOG_CONFIG || {};
  const STORAGE_SELECTION = "ventaMudanza.selection.v1";
  const STORAGE_BUYER = "ventaMudanza.buyer.v1";
  const CATALOG_BATCH_SIZE = 12;
  let catalogLimit = CATALOG_BATCH_SIZE;
  let catalogLoaded = false;
  let restoringCatalog = false;
  let restorationVersion = 0;
  let catalogScrollTimer;
  let catalogLoadingTimer;
  const CATEGORY_PARAM = "categoria";
  const BADGE_PARAM = "badge";
  const NEW_BADGE = "Recién agregado";
  const NEW_BADGE_SLUG = "recien-agregado";

  let products = [];
  const goal = { target: null, collected: null, status: "loading" };
  const goalRoots = [];
  let settings = {
    titulo: "Venta por mudanza",
    intro: "Estoy vendiendo algunos artículos por mudanza. Seleccioná lo que te interese y enviame tu consulta por WhatsApp para coordinar disponibilidad, pago y entrega.",
    nota_reserva: "Elegir un artículo no lo reserva automáticamente.",
    whatsapp: "",
    actualizado: "",
    mostrar_boton_vender: "si"
  };
  let selection = readJSON(STORAGE_SELECTION, []);
  if (!Array.isArray(selection)) selection = [];
  let activeCategory = "Todos";
  let searchTerm = "";
  let activeGallery = { product: null, index: 0 };
  let galleryRequest = 0;
  let cancelGalleryTransition = null;
  let lastFocusedElement = null;
  const galleryZoom = {
    scale: 1, x: 0, y: 0,
    startScale: 1, startDistance: 0,
    pinchContentX: 0, pinchContentY: 0,
    panStartX: 0, panStartY: 0,
    panOriginX: 0, panOriginY: 0,
    touchStartX: 0, touchStartY: 0,
    pinching: false, panning: false, moved: false, lastTap: 0
  };

  const $ = (sel) => document.querySelector(sel);
  const productsEl = $("#products");
  const catalogStatusEl = $("#catalogStatus");
  const catalogPagination = $("#catalogPagination");
  const catalogProgress = $("#catalogProgress");
  const loadMoreProducts = $("#loadMoreProducts");
  const catalogCountEl = $("#catalogCount");
  const heroCountEl = $("#heroCount");
  const updatedBadge = $("#updatedBadge");
  const updatedDate = $("#updatedDate");
  const categoryFiltersEl = $("#categoryFilters");
  const catalogSearch = $("#catalogSearch");
  const clearSearch = $("#clearSearch");
  const mobileCategoryTrigger = $("#mobileCategoryTrigger");
  const mobileCategoryValue = $("#mobileCategoryValue");
  const mobileCategoryCount = $("#mobileCategoryCount");
  const catalogMenu = $("#catalogMenu");
  const catalogMenuOptions = $("#catalogMenuOptions");
  const drawer = $("#drawer");
  const overlay = $("#overlay");
  const bagCountEl = $("#bagCount");
  const bagContentEl = $("#bagContent");
  const buyerForm = $("#buyerForm");
  const buyerName = $("#buyerName");
  const toast = $("#toast");
  const lightbox = $("#lightbox");
  const lightboxImage = $("#lightboxImage");
  const lightboxMeta = $("#lightboxMeta");
  const lightboxPrev = $("#lightboxPrev");
  const lightboxNext = $("#lightboxNext");
  const lightboxImageWrap = $("#lightboxImageWrap");
  const galleryLoader = $("#galleryLoader");
  const zoomOut = $("#zoomOut");
  const zoomReset = $("#zoomReset");
  const zoomIn = $("#zoomIn");
  const openBagBtn = $("#openBag");
  const headerWhatsApp = $("#headerWhatsApp");
  const webPromo = $("#webPromo");
  const webPromoTrigger = $("#webPromoTrigger");
  // A non-modal native popover: outside click and Escape dismiss it.
  webPromo.addEventListener("toggle", event => {
    webPromoTrigger.setAttribute("aria-expanded", String(event.newState === "open"));
  });
  webPromo.querySelector(".web-promo-close").addEventListener("click", () => webPromoTrigger.focus());
  if ("popover" in HTMLElement.prototype) {
    webPromo.addEventListener("keydown", event => {
      if (event.key !== "Escape" || !webPromo.matches(":popover-open")) return;
      event.preventDefault();
      webPromo.hidePopover();
      webPromoTrigger.focus({ preventScroll: true });
    });
  }
  if (!("popover" in HTMLElement.prototype)) {
    // Use the same non-modal panel when native popovers are unavailable.
    webPromo.hidden = true;
    const closePromo = () => {
      webPromo.hidden = true;
      webPromo.classList.remove("is-open");
      webPromoTrigger.setAttribute("aria-expanded", "false");
      webPromoTrigger.focus();
    };
    webPromoTrigger.addEventListener("click", () => {
      if (webPromoTrigger.hidden || webPromoTrigger.disabled) return;
      const opening = !webPromo.classList.contains("is-open");
      webPromo.hidden = !opening;
      webPromo.classList.toggle("is-open", opening);
      webPromoTrigger.setAttribute("aria-expanded", String(opening));
    });
    webPromo.querySelector(".web-promo-close").addEventListener("click", closePromo);
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && webPromo.classList.contains("is-open")) closePromo();
    });
  }

  // Start product photos near the viewport, rather than the browser's multi-screen
  // lazy-load margin, so they do not compete with the initial hero and fonts.
  const pendingPhotos = new WeakMap();
  const photoObserver = typeof IntersectionObserver === "function" ? new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      photoObserver.unobserve(entry.target);
      const load = pendingPhotos.get(entry.target);
      pendingPhotos.delete(entry.target);
      load?.();
    }
  }, { rootMargin: "200px" }) : null;
  function loadPhotoNearViewport(image, load) {
    if (!photoObserver) { load(); return; }
    pendingPhotos.set(image, load);
    photoObserver.observe(image);
  }

  const descriptionPopup = $("#descriptionPopup");
  // Native dialogs share focus return, scroll lock and backdrop dismissal.
  const nativeDialogState = new WeakMap();
  function openNativeDialog(dialog, trigger) {
    if (dialog.open) return;
    const state = { trigger, overflow: document.body.style.overflow };
    nativeDialogState.set(dialog, state);
    document.body.style.overflow = "hidden";
    try { dialog.showModal(); }
    catch (error) {
      document.body.style.overflow = state.overflow;
      nativeDialogState.delete(dialog);
      throw error;
    }
    const copy = dialog.querySelector(".description-popup-copy");
    if (copy) copy.scrollTop = 0;
    dialog.querySelector(".dismiss-button")?.focus();
  }
  function restoreNativeDialog(dialog) {
    // A queued close event must not release a dialog reopened in the meantime.
    if (dialog.open) return;
    const state = nativeDialogState.get(dialog);
    if (!state) return;
    nativeDialogState.delete(dialog);
    document.body.style.overflow = state.overflow;
    if (state.trigger?.isConnected) state.trigger.focus({ preventScroll: true });
  }
  function closeNativeDialog(dialog, returnValue = "") {
    dialog.close(returnValue);
    restoreNativeDialog(dialog);
  }
  function bindNativeDialog(dialog) {
    dialog.addEventListener("click", event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeNativeDialog(dialog);
    });
    dialog.addEventListener("close", () => restoreNativeDialog(dialog));
    dialog.addEventListener("cancel", event => {
      event.preventDefault();
      closeNativeDialog(dialog);
    });
  }
  bindNativeDialog(descriptionPopup);
  const lauraContactDialog = $("#lauraContactDialog");
  const lauraContactTrigger = $("#legxerciseContact");
  if (lauraContactDialog && lauraContactTrigger) {
    bindNativeDialog(lauraContactDialog);
    lauraContactTrigger.addEventListener("click", event => {
      event.preventDefault();
      openNativeDialog(lauraContactDialog, lauraContactTrigger);
    });
    $("#closeLauraContact").addEventListener("click", () => closeNativeDialog(lauraContactDialog));
    $("#cancelLauraContact").addEventListener("click", event => {
      event.preventDefault();
      closeNativeDialog(lauraContactDialog);
    });
    // A native link opens WhatsApp in the user's gesture; no message is sent here.
    $("#confirmLauraContact").addEventListener("click", () => closeNativeDialog(lauraContactDialog, "confirmed"));
    // Without JS this same confirmation stays inline; there is no direct-contact bypass.
    lauraContactDialog.removeAttribute("open");
    if (window.location.hash === "#lauraContactDialog") openNativeDialog(lauraContactDialog, lauraContactTrigger);
  }
  const descriptionObserver = typeof ResizeObserver === "function" ? new ResizeObserver(entries => {
    for (const {target} of entries) {
      const button = target.parentElement.querySelector(".description-more");
      if (button) button.hidden = target.scrollHeight <= target.clientHeight + 1;
    }
  }) : {
    disconnect() {},
    observe(target) {
      requestAnimationFrame(() => {
        const button = target.parentElement?.querySelector(".description-more");
        if (button) button.hidden = target.scrollHeight <= target.clientHeight + 1;
      });
    }
  };
  function openDescription(product, trigger) {
    $("#descriptionPopupHeading").textContent = product.title;
    $("#descriptionPopupCopy").textContent = product.description;
    openNativeDialog(descriptionPopup, trigger);
  }
  const legxerciseDescription = $("#legxerciseDescription");
  if (legxerciseDescription) {
    legxerciseDescription.setAttribute("aria-haspopup", "dialog");
    legxerciseDescription.setAttribute("aria-controls", "descriptionPopup");
    legxerciseDescription.addEventListener("click", event => {
      event.preventDefault();
      openDescription({ title: "LegXercise Pro", description: $("#legxerciseDescriptionText").textContent.trim() }, legxerciseDescription);
    });
  }
  descriptionPopup.querySelector(".description-close").addEventListener("click", () => closeNativeDialog(descriptionPopup));

  initializeGoals();
  hydrateBuyer();
  bindUI();
  history.scrollRestoration = "manual";
  loadMoreProducts.addEventListener("click", () => {
    cancelCatalogRestoration();
    const firstNewIndex = productsEl.children.length;
    catalogLimit += CATALOG_BATCH_SIZE;
    renderCatalog({ append: true });
    const firstNewCard = productsEl.children[firstNewIndex];
    if (firstNewCard) {
      firstNewCard.tabIndex = -1;
      const firstAction = [...firstNewCard.querySelectorAll("button")].find(button => !button.hidden);
      (firstAction || firstNewCard).focus({ preventScroll: true });
      firstNewCard.scrollIntoView({ block: "start", behavior: "instant" });
    }
    saveCatalogView();
  });
  window.addEventListener("scroll", () => {
    clearTimeout(catalogScrollTimer);
    catalogScrollTimer = setTimeout(saveCatalogView, 180);
  }, { passive: true });
  window.addEventListener("pagehide", saveCatalogView);
  for (const eventName of ["pointerdown", "wheel", "keydown"]) {
    window.addEventListener(eventName, () => {
      if (restoringCatalog) cancelCatalogRestoration();
    }, { passive: true });
  }
  renderSkeletons();
  if (catalogSearch) {
    catalogSearch.addEventListener("input", () => {
      cancelCatalogRestoration();
      catalogLimit = CATALOG_BATCH_SIZE;
      searchTerm = catalogSearch.value || "";
      if (clearSearch) clearSearch.hidden = !searchTerm;
      if (catalogLoaded) renderCatalog();
      saveCatalogView();
    });
  }
  if (clearSearch) {
    clearSearch.addEventListener("click", () => {
      cancelCatalogRestoration();
      catalogLimit = CATALOG_BATCH_SIZE;
      searchTerm = "";
      if (catalogSearch) { catalogSearch.value = ""; catalogSearch.focus(); }
      clearSearch.hidden = true;
      if (catalogLoaded) renderCatalog();
      saveCatalogView();
    });
  }
  loadSettings();
  loadCatalog();

  async function readTable(sheet) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(`/api/catalog?sheet=${encodeURIComponent(sheet)}`, { signal: controller.signal, cache: "no-store" });
      if (!response.ok) throw new Error("No se pudo consultar el catálogo.");
      const data = await response.json();
      if (!Array.isArray(data.table?.cols) || !Array.isArray(data.table?.rows)) throw new Error("Respuesta de catálogo inválida.");
      return data.table;
    } finally { clearTimeout(timeout); }
  }

  async function loadSettings() {
    try {
      const table = await readTable(CFG.SETTINGS_SHEET || "Config");
      settings = { ...settings, ...parseSettings(table) };
      applySettings();
    } catch (err) {
      console.warn("No se pudo cargar Config; se usan textos por defecto.", err);
    }

    renderCardEstimate();
    await loadGoal();
  }

  // One template and one state feed both compact placements.
  function initializeGoals() {
    for (const id of ["catalogGoal", "bagGoal"]) {
      const placement = document.getElementById(id);
      const root = $("#goalTemplate").content.firstElementChild.cloneNode(true);
      const heading = root.querySelector("h2");
      heading.id = `${id}Heading`;
      root.setAttribute("aria-labelledby", heading.id);
      placement.append(root);
      goalRoots.push(root);
    }
  }

  async function loadGoal() {
    // Config contains a formula returning unformatted digits, not a fixed target.
    const rawTarget = String(settings.meta_total ?? "").trim();
    goal.target = /^\d+(?:\.\d+)?$/.test(rawTarget) ? Number(rawTarget) : null;
    if (!Number.isFinite(goal.target) || goal.target <= 0) {
      goal.status = "unconfigured";
      renderGoals();
      return;
    }
    goal.status = "loading";
    renderGoals();
    try {
      const table = await readTable(CFG.SALES_SHEET || "Ventas");
      const row = (table.rows || []).find(row => normalizeHeader(cellValue(row, 0)) === "total vendido");
      const collected = row?.c?.[1]?.v;
      if (typeof collected !== "number" || !Number.isFinite(collected) || collected < 0) {
        throw new Error("TOTAL VENDIDO no contiene un monto válido.");
      }
      goal.collected = collected;
      goal.status = "ready";
    } catch (error) {
      goal.collected = null;
      goal.status = "unavailable";
      console.warn("No se pudo actualizar la recaudación.", error);
    }
    renderGoals();
  }

  function renderGoals() {
    const configured = Number.isFinite(goal.target) && goal.target > 0;
    const ready = goal.status === "ready";
    const complete = ready && goal.collected >= goal.target;
    const cart = selectedProducts().reduce((sum, product) => sum + product.price, 0);
    const contribution = document.getElementById("bagContribution");
    contribution.hidden = !configured || cart <= 0;
    if (!contribution.hidden) {
      const percent = cart / goal.target * 100;
      const label = new Intl.NumberFormat("es-AR", { maximumFractionDigits: percent < 0.1 ? 2 : 1 }).format(percent);
      document.getElementById("bagContributionValue").textContent = `+${label}% a la meta`;
    }
    const projected = ready && !complete && cart > 0;
    const currentPercent = ready ? Math.min(100, goal.collected / goal.target * 100) : 0;
    const percentLabel = `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(Math.floor(currentPercent * 10) / 10)}%`;
    const possiblePercent = projected ? Math.min(100 - currentPercent, cart / goal.target * 100) : 0;
    for (const root of goalRoots) {
      root.parentElement.hidden = !configured;
      if (!configured) continue;
      root.dataset.goalState = ready ? (complete ? "complete" : projected ? "projected" : "current") : "unavailable";
      root.setAttribute("aria-busy", String(goal.status === "loading"));
      root.style.setProperty("--mts-goal-current", `${currentPercent}%`);
      root.style.setProperty("--mts-goal-possible", `${possiblePercent}%`);
      root.querySelector("[data-goal-collected]").textContent = ready ? percentLabel : "—";
      root.querySelector("[data-goal-cart]").hidden = !projected;
      root.querySelector("[data-goal-cart-amount]").textContent = formatPrice(cart);
      const thanks = root.querySelector("[data-goal-thanks]");
      thanks.hidden = projected;
      thanks.textContent = ready
        ? (complete ? "¡Gracias por hacerlo posible!" : "Gracias por ayudarme a cumplir esta meta ❤️")
        : goal.status === "loading" ? "Cargando lo recaudado…" : "No pudimos actualizar lo recaudado. Recargá para reintentar.";
      root.querySelector("[data-goal-track]").setAttribute("aria-label", ready
        ? `Recaudado: ${percentLabel}. ${projected ? `Tu selección sumaría ${formatPrice(cart)}.` : ""}`
        : `El progreso ${goal.status === "loading" ? "está cargando" : "no está disponible"}.`);
    }
  }

  async function loadCatalog() {
    try {
      const table = await readTable(CFG.CATALOG_SHEET || "Catalogo");
      const parsed = parseCatalog(table);
      products = parsed.filter((p) => !p.vendido && isAvailable(p.disponible));

      const validIds = new Set(products.filter((p) => !isReserved(p)).map((p) => p.id));
      selection = selection.filter((id) => validIds.has(id));
      saveSelection();

      syncCategoryFromUrl({ cleanInvalid: true });
      catalogLoaded = true;
      const savedView = restoreCatalogView({ initial: true });
      renderFilters();
      renderCatalog();
      renderBag();
      if (savedView) restoreCatalogScroll(savedView);
      else saveCatalogView();
      if (heroCountEl) heroCountEl.textContent = `${products.length} ${products.length === 1 ? "artículo disponible" : "artículos disponibles"}`;
      productsEl.setAttribute("aria-busy", "false");
    } catch (err) {
      console.error(err);
      showCatalogError("No pudimos cargar los productos. Volvé a intentar en unos segundos.");
    } finally {
      clearTimeout(catalogLoadingTimer);
    }
  }

  function parseSettings(table) {
    const rows = table.rows || [];
    const result = {};
    for (const row of rows) {
      const key = cellValue(row, 0).trim();
      const value = cellValue(row, 1).trim();
      if (key) result[key] = value;
    }
    return result;
  }

  function parseCatalog(table) {
    const labels = (table.cols || []).map((c) => normalizeHeader(c.label || c.id || ""));
    const idx = (name, fallback) => {
      const found = labels.indexOf(normalizeHeader(name));
      return found >= 0 ? found : fallback;
    };

    const iId = idx("id", 0);
    const iTitle = idx("titulo", 1);
    const iDesc = idx("descripcion", 2);
    const iPrice = idx("precio", 3);
    const iAvailable = idx("disponible", 4);
    const iImages = idx("imagenes", 5);
    const iCategory = idx("categoria", 6);
    const iSold = idx("vendido", 7);
    const iBadge = idx("badge", -1);
    const iReserved = idx("reservado", -1);

    return (table.rows || []).map((row, rowIndex) => {
      const id = slug(cellValue(row, iId) || `producto-${rowIndex + 1}`);
      const title = cellValue(row, iTitle).trim();
      const description = cellValue(row, iDesc).trim();
      const rawPrice = rawCellValue(row, iPrice);
      const price = toNumber(rawPrice);
      const disponible = cellValue(row, iAvailable).trim();
      const vendido = isSold(rawCellValue(row, iSold));
      const images = parseImages(cellValue(row, iImages));
      const category = cellValue(row, iCategory).trim() || "Otros";
      const badge = categorySlug(cellValue(row, iBadge)) === NEW_BADGE_SLUG ? NEW_BADGE : "";
      const rawReserved = rawCellValue(row, iReserved);
      const reservado = rawReserved === "" ? null : isSold(rawReserved);
      return { id, title, description, price, disponible, vendido, reservado, images, category, badge };
    }).filter((p) => p.title);
  }

  function normalizeHeader(value) {
    return String(value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function rawCellValue(row, index) {
    const cell = row?.c?.[index];
    if (!cell) return "";
    return cell.v ?? cell.f ?? "";
  }

  function cellValue(row, index) {
    const value = rawCellValue(row, index);
    return value == null ? "" : String(value);
  }

  function toNumber(value) {
    if (typeof value === "number") return value;
    const cleaned = String(value || "")
      .replace(/\s/g, "")
      .replace(/\$/g, "")
      .replace(/\./g, "")
      .replace(/,/g, ".")
      .replace(/[^0-9.-]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }

  function parseImages(value) {
    return String(value || "")
      .split("|")
      .map((x) => x.trim())
      .filter(Boolean);
  }

  function imageCandidates(value, variant = "card", width = variant === "gallery" ? 1600 : variant === "bag" ? 128 : 900) {
    const raw = String(value || "").trim();
    if (!raw) return [];

    const driveId = extractDriveFileId(raw);
    if (driveId) {
      // Request only the source resolution needed for this responsive candidate.
      // Never download the original Drive file to generate a small thumbnail.
      // Replacing a photo means a new file/link in the Sheet, so the cache key changes.
      const source = `https://lh3.googleusercontent.com/d/${encodeURIComponent(driveId)}=w${width}`;
      const params = new URLSearchParams({ url: source, w: String(width), fit: "contain", fm: "webp", q: variant === "gallery" ? "80" : "85" });
      return [
        `/.netlify/images?${params}`,
        source,
        `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveId)}&sz=w${width}`
      ];
    }

    // Rutas locales del propio sitio siguen permitidas para demos/recursos propios.
    if (raw.startsWith("images/") || raw.startsWith("./") || raw.startsWith("/")) {
      return [raw];
    }

    // Cualquier URL HTTPS directa también es válida. Drive mantiene su ruta
    // optimizada arriba; para otros hosts usamos la URL tal cual porque no existe
    // un optimizador universal sin agregar un servicio externo.
    try {
      const url = new URL(raw);
      if (url.protocol === "https:") return [url.href];
    } catch (_) {
      // No es una URL HTTPS válida.
    }

    return [];
  }

  function setImageWithFallback(img, value, onFinalError, variant = "card", onReady) {
    const candidates = imageCandidates(value, variant);
    let index = 0;
    let requestedWidth = variant === "bag" ? 128 : 900;
    img.onload = async () => {
      const source = img.currentSrc;
      try { await img.decode(); } catch (_) {}
      if (source === img.currentSrc && img.naturalWidth && typeof onReady === "function") onReady();
    };

    const tryNext = () => {
      if (index >= candidates.length) {
        img.onerror = null;
        if (typeof onFinalError === "function") onFinalError();
        return;
      }
      img.onerror = () => {
        // Keep the browser-selected size when recovering; do not offer another
        // responsive candidate from a provider that has already failed.
        if (index === 0 && extractDriveFileId(value)) {
          const width = Number(new URL(img.currentSrc || img.src, location.href).searchParams.get("w"));
          if (width > 0) requestedWidth = width;
        }
        index += 1;
        tryNext();
      };
      if (index > 0 && extractDriveFileId(value)) {
        img.src = imageCandidates(value, variant, requestedWidth)[index];
        img.removeAttribute("srcset");
        img.removeAttribute("sizes");
        return;
      }
      if ((variant === "card" || variant === "bag") && extractDriveFileId(value)) {
        img.sizes = variant === "bag" ? "64px" :
          "auto, (max-width: 373px) 142px, (max-width: 579px) 38vw, (max-width: 767px) 220px, (max-width: 1440px) 30vw, 410px";
        const widths = variant === "bag" ? [64, 128, 192] : [300, 450, 600, 900, 1200];
        img.srcset = widths.map(width => `${imageCandidates(value, variant, width)[index]} ${width}w`).join(", ");
      } else {
        img.removeAttribute("srcset");
        img.removeAttribute("sizes");
      }
      img.src = candidates[index];
    };

    tryNext();
  }

  function extractDriveFileId(value) {
    try {
      const url = new URL(String(value || "").trim());
      if (url.protocol !== "https:" || url.hostname !== "drive.google.com") return "";
      const id = url.pathname.match(/^\/file\/d\/([A-Za-z0-9_-]+)(?:\/|$)/)?.[1] || url.searchParams.get("id") || "";
      return /^[A-Za-z0-9_-]+$/.test(id) ? id : "";
    } catch (_) {
      return "";
    }
  }

  function isAvailable(value) {
    const v = normalizeHeader(value);
    if (!v) return true;
    if (["no", "0", "false", "agotado", "vendido", "inactivo"].includes(v)) return false;
    return true;
  }

  function isSold(value) {
    return value === true || value === 1 || ["true", "1", "si", "vendido"].includes(normalizeHeader(value));
  }

  function isReserved(product) {
    // A checked/unchecked box is authoritative. Older feeds without the field
    // retain title-based reservations until they receive the updated contract.
    return product?.reservado ?? normalizeHeader(product?.title || "").includes("reservad");
  }

  function sellerPhone() {
    const raw = String(settings.whatsapp || "");
    const phone = raw.replace(/\D/g, "");
    return phone.length >= 10 && !/x/i.test(raw) ? phone : "";
  }

  function applySettings() {
    const showWebPromo = ["si", "true", "1", "yes"].includes(normalizeHeader(settings.mostrar_boton_vender));
    const supportsPopover = "popover" in HTMLElement.prototype;
    if (!showWebPromo && supportsPopover && webPromo.matches(":popover-open")) webPromo.hidePopover();
    if (!showWebPromo) webPromo.classList.remove("is-open");
    webPromoTrigger.hidden = !showWebPromo;
    webPromoTrigger.disabled = !showWebPromo;
    webPromo.hidden = !showWebPromo || !supportsPopover;

    const seller = sellerPhone();
    if (seller) {
      headerWhatsApp.href = `https://wa.me/${seller}`;
      headerWhatsApp.removeAttribute("aria-disabled");
      headerWhatsApp.removeAttribute("tabindex");
    } else {
      headerWhatsApp.removeAttribute("href");
      headerWhatsApp.setAttribute("aria-disabled", "true");
      headerWhatsApp.setAttribute("tabindex", "-1");
    }

    const title = settings.titulo || "Venta por mudanza";
    document.title = title;
    const intro = document.querySelector(".hero-description");
    const notes = document.querySelectorAll(".marquee-reservation");
    if (intro && settings.intro) intro.textContent = settings.intro;
    if (settings.nota_reserva) notes.forEach(note => { note.textContent = settings.nota_reserva; });
    if (updatedBadge && updatedDate) {
      const rawUpdated = String(settings.actualizado || "").trim();
      const formattedUpdated = formatUpdatedAt(rawUpdated);
      updatedDate.textContent = formattedUpdated;
      updatedBadge.hidden = !formattedUpdated;
      if (formattedUpdated) updatedBadge.setAttribute("aria-label", `Catálogo actualizado por última vez: ${formattedUpdated}`);
    }
  }


  function formatUpdatedAt(value) {
    if (!value) return "";
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::\d{2})?$/);
    if (!match) return value;
    const [, year, month, day, hour, minute] = match;
    const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    return `${Number(day)} ${months[Number(month) - 1]} ${year} · ${hour}:${minute}`;
  }

  function getVisibleProducts() {
    const term = normalizeHeader(searchTerm);
    return products.filter((product) => {
      const matchesCategory = activeCategory === "Todos" || (activeCategory === NEW_BADGE ? product.badge === NEW_BADGE : product.category === activeCategory);
      if (!matchesCategory) return false;
      if (!term) return true;
      const haystack = normalizeHeader(`${product.title} ${product.description} ${product.category} ${product.badge}`);
      return haystack.includes(term);
    });
  }

  function categorySlug(value) {
    return normalizeHeader(value)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function availableCategories() {
    return [...new Set(products.map((product) => product.category).filter(Boolean))];
  }

  function syncCategoryFromUrl({ cleanInvalid = false } = {}) {
    const url = new URL(window.location.href);
    const rawBadge = url.searchParams.get(BADGE_PARAM);
    if (categorySlug(rawBadge || "") === NEW_BADGE_SLUG) {
      activeCategory = NEW_BADGE;
      if (cleanInvalid) {
        url.searchParams.set(BADGE_PARAM, NEW_BADGE_SLUG);
        url.searchParams.delete(CATEGORY_PARAM);
        window.history.replaceState({ ...(window.history.state || {}), category: activeCategory }, "", `${url.pathname}${url.search}${url.hash}`);
      }
      return;
    }
    if (cleanInvalid && rawBadge !== null) {
      url.searchParams.delete(BADGE_PARAM);
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
    const rawCategory = url.searchParams.get(CATEGORY_PARAM);
    const requestedSlug = categorySlug(rawCategory || "");
    const categories = availableCategories();
    const matchedCategory = requestedSlug
      ? categories.find((category) => categorySlug(category) === requestedSlug)
      : "Todos";

    activeCategory = matchedCategory || "Todos";

    if (cleanInvalid && rawCategory !== null) {
      if (!requestedSlug || !matchedCategory) url.searchParams.delete(CATEGORY_PARAM);
      else url.searchParams.set(CATEGORY_PARAM, categorySlug(matchedCategory));
      window.history.replaceState(
        { ...(window.history.state || {}), category: activeCategory },
        "",
        `${url.pathname}${url.search}${url.hash}`
      );
    }
  }

  function categoryUrl(category) {
    const url = new URL(window.location.href);
    url.searchParams.delete(BADGE_PARAM);
    if (category === NEW_BADGE) {
      url.searchParams.set(BADGE_PARAM, NEW_BADGE_SLUG);
      url.searchParams.delete(CATEGORY_PARAM);
    } else if (category === "Todos") url.searchParams.delete(CATEGORY_PARAM);
    else url.searchParams.set(CATEGORY_PARAM, categorySlug(category));

    return url;
  }

  function updateCategoryUrl(category, { replace = false } = {}) {
    const url = categoryUrl(category);
    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl === currentUrl) return;

    const method = replace ? "replaceState" : "pushState";
    window.history[method]({ ...(window.history.state || {}), category, catalogView: {
      category, limit: catalogLimit, search: searchTerm, scrollY: window.scrollY
    } }, "", nextUrl);
  }

  function selectCategory(category, { updateUrl = true } = {}) {
    if (category !== activeCategory) {
      saveCatalogView();
      cancelCatalogRestoration();
      catalogLimit = CATALOG_BATCH_SIZE;
    }
    activeCategory = category;
    if (updateUrl) updateCategoryUrl(category);
    renderFilters();
    renderCatalog();
  }

  function getCategoryItems() {
    const counts = new Map();
    for (const product of products) counts.set(product.category, (counts.get(product.category) || 0) + 1);
    const preferred = ["Cocina", "Deco & textiles", "Muebles & organización", "Hogar & exterior", "Cuidado personal", "Tarot & oráculos", "Libros", "Otros"];
    const categories = [...counts.keys()].sort((a, b) => {
      const ai = preferred.indexOf(a);
      const bi = preferred.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b, "es");
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });

    if (activeCategory !== "Todos" && activeCategory !== NEW_BADGE && !counts.has(activeCategory)) activeCategory = "Todos";
    const newCount = products.filter((product) => product.badge === NEW_BADGE).length;
    const badges = newCount || activeCategory === NEW_BADGE ? [{ label: NEW_BADGE, count: newCount }] : [];
    return [{ label: "Todos", count: products.length }, ...badges, ...categories.map((label) => ({ label, count: counts.get(label) }))];
  }

  function renderFilters() {
    if (!categoryFiltersEl) return;
    const items = getCategoryItems();
    const focusedCategory = categoryFiltersEl.contains(document.activeElement) ? document.activeElement.dataset.categoryLabel : null;
    const scrollLeft = categoryFiltersEl.scrollLeft;
    categoryFiltersEl.replaceChildren();
    for (const item of items) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `filter-chip${activeCategory === item.label ? " active" : ""}`;
      button.dataset.categoryLabel = item.label;
      button.setAttribute("aria-pressed", activeCategory === item.label ? "true" : "false");
      const label = document.createElement("span");
      label.textContent = item.label;
      const count = document.createElement("span");
      count.className = "filter-count";
      count.textContent = String(item.count);
      button.append(label, count);
      button.addEventListener("click", () => {
        selectCategory(item.label);
        (catalogStatusEl.hidden ? productsEl : catalogStatusEl).scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
      });
      categoryFiltersEl.appendChild(button);
      if (focusedCategory && item.label === activeCategory) button.focus({ preventScroll: true });
    }
    categoryFiltersEl.scrollLeft = scrollLeft;
    $("#desktopCategoryRail").hidden = false;

    if (catalogMenuOptions) {
      const icons = { "Todos": "category-all", "Cocina": "category-kitchen", "Deco & textiles": "category-decor", "Muebles & organización": "category-furniture", "Hogar & exterior": "category-outdoor", "Cuidado personal": "category-care", "Tarot & oráculos": "category-tarot", "Libros": "category-books", "Ropa & Calzado": "category-clothing" };
      catalogMenuOptions.replaceChildren();
      for (const item of items) {
        const all = item.label === "Todos";
        const link = document.createElement("a");
        link.className = `mts-catalog-menu__item${all ? " mts-catalog-menu__item--all" : ""}`;
        const url = categoryUrl(item.label);
        url.hash = "catalogo";
        link.href = url.href;
        if (activeCategory === item.label) link.setAttribute("aria-current", "page");
        const icon = document.createElement("span");
        icon.className = "mts-catalog-menu__icon";
        icon.setAttribute("aria-hidden", "true");
        if (item.label === NEW_BADGE) {
          const badge = document.createElement("img");
          badge.src = "images/badge-recien-agregado.webp";
          badge.alt = "";
          badge.width = 256;
          badge.height = 248;
          icon.appendChild(badge);
        } else {
          const image = document.createElement("img");
          image.src = `icons/${icons[item.label] || "catalog"}.svg?v=6`;
          image.alt = "";
          image.width = 40;
          image.height = 40;
          icon.appendChild(image);
        }
        const copy = document.createElement("span");
        copy.className = "mts-catalog-menu__copy";
        const label = document.createElement("strong");
        label.textContent = all ? "Ver todo" : item.label;
        const count = document.createElement("small");
        count.textContent = `${item.count} ${item.count === 1 ? "artículo" : "artículos"}`;
        copy.append(label, count);
        link.append(icon, copy);
        link.addEventListener("click", event => {
          if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          selectCategory(item.label);
          if (catalogMenu.open) catalogMenu.close();
          else catalogMenu.hidePopover();
          productsEl.closest("main").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
          productsEl.closest("main").focus({ preventScroll: true });
        });
        catalogMenuOptions.appendChild(link);
      }
    }

    const activeItem = items.find((item) => item.label === activeCategory) || items[0];
    if (mobileCategoryValue) mobileCategoryValue.textContent = activeItem?.label || "Todos";
    if (mobileCategoryCount) mobileCategoryCount.textContent = String(activeItem?.count || 0);
  }

  // Keep browsing state on the current history entry, without adding page URLs.
  function saveCatalogView() {
    if (!catalogLoaded || restoringCatalog) return;
    try {
      history.replaceState({ ...(history.state || {}), catalogView: {
        category: activeCategory, limit: catalogLimit, search: searchTerm, scrollY: window.scrollY
      } }, "");
    } catch (_) { /* The catalog remains usable if history storage is unavailable. */ }
  }

  function restoreCatalogView({ initial = false } = {}) {
    const view = history.state?.catalogView;
    const matches = view?.category === activeCategory;
    catalogLimit = matches && Number.isSafeInteger(view.limit) && view.limit >= CATALOG_BATCH_SIZE
      ? Math.min(view.limit, Math.max(CATALOG_BATCH_SIZE, products.length)) : CATALOG_BATCH_SIZE;
    searchTerm = matches && typeof view.search === "string" ? view.search : initial ? searchTerm : "";
    catalogSearch.value = searchTerm;
    clearSearch.hidden = !searchTerm;
    return matches ? view : null;
  }

  function cancelCatalogRestoration() {
    restorationVersion += 1;
    restoringCatalog = false;
    clearTimeout(catalogScrollTimer);
  }

  function restoreCatalogScroll(view) {
    cancelCatalogRestoration();
    const version = restorationVersion;
    restoringCatalog = true;
    const restore = () => requestAnimationFrame(() => requestAnimationFrame(() => {
      if (version !== restorationVersion) return;
      window.scrollTo({ top: Number.isFinite(view?.scrollY) ? Math.max(0, view.scrollY) : 0, behavior: "instant" });
      restoringCatalog = false;
    }));
    if (document.documentElement.dataset.fonts === "loading") {
      const observer = new MutationObserver(() => {
        if (document.documentElement.dataset.fonts === "loading") return;
        observer.disconnect();
        restore();
      });
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-fonts"] });
    } else restore();
  }

  function renderCatalog({ append = false } = {}) {
    if (!append) {
      descriptionObserver.disconnect();
      photoObserver?.disconnect();
      productsEl.replaceChildren();
    }
    const visibleProducts = getVisibleProducts();
    const isFiltered = visibleProducts.length !== products.length || activeCategory !== "Todos" || searchTerm.trim();
    catalogCountEl.textContent = isFiltered
      ? `${visibleProducts.length} de ${products.length} artículos`
      : `${products.length} ${products.length === 1 ? "artículo" : "artículos"}`;

    catalogStatusEl.classList.remove("is-error");
    catalogPagination.hidden = !visibleProducts.length;
    if (!products.length) {
      catalogStatusEl.hidden = false;
      catalogStatusEl.textContent = "No hay artículos disponibles en este momento.";
      return;
    }

    if (!visibleProducts.length) {
      catalogStatusEl.hidden = false;
      catalogStatusEl.textContent = "No hay coincidencias. Probá con otra búsqueda o categoría.";
      return;
    }

    catalogStatusEl.hidden = true;
    const shown = Math.min(catalogLimit, visibleProducts.length);
    catalogProgress.textContent = `Mostrando 1–${shown} de ${visibleProducts.length} ${visibleProducts.length === 1 ? "artículo" : "artículos"}`;
    const remaining = visibleProducts.length - shown;
    loadMoreProducts.hidden = remaining === 0;
    const nextCount = Math.min(CATALOG_BATCH_SIZE, remaining);
    if (remaining) loadMoreProducts.textContent = `Ver ${nextCount} más`;
    for (const product of visibleProducts.slice(append ? productsEl.children.length : 0, shown)) {
      const reserved = isReserved(product);
      const selected = !reserved && selection.includes(product.id);
      const card = document.createElement("article");
      card.className = `card${selected ? " selected" : ""}${reserved ? " reserved" : ""}`;
      card.dataset.id = product.id;
      card.dataset.category = categorySlug(product.category);

      const media = document.createElement("div");
      media.className = "media";
      if (product.badge) {
        const badge = document.createElement("img");
        badge.className = "product-badge";
        badge.src = "images/badge-recien-agregado.webp";
        badge.alt = product.badge;
        badge.width = 256;
        badge.height = 248;
        badge.decoding = "async";
        media.appendChild(badge);
      }

      if (product.images.length) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "media-button";
        btn.setAttribute("aria-label", `Abrir galería de ${product.title} · ${product.images.length} ${product.images.length === 1 ? "foto" : "fotos"}`);
        const img = document.createElement("img");
        img.alt = product.title;
        img.loading = "lazy";
        img.decoding = "async";
        img.fetchPriority = "low";
        media.classList.add("is-loading");
        const placeholder = createImagePlaceholder("loading", product.title);
        media.appendChild(placeholder);
        loadPhotoNearViewport(img, () => setImageWithFallback(img, product.images[0], () => showImagePlaceholder(media, product.title), "card", () => {
          media.classList.remove("is-loading");
          placeholder.remove();
        }));
        btn.appendChild(img);
        btn.addEventListener("click", () => openGallery(product, 0, btn));
        media.appendChild(btn);

        const hint = document.createElement("span");
        hint.className = "gallery-hint";
        hint.setAttribute("aria-hidden", "true");
        const galleryIcon = document.createElement("img");
        galleryIcon.className = "custom-icon";
        galleryIcon.src = "icons/photo-gallery.svg";
        galleryIcon.alt = "";
        galleryIcon.width = 40;
        galleryIcon.height = 40;
        hint.appendChild(galleryIcon);
        if (product.images.length > 1) {
          const photoCount = document.createElement("span");
          photoCount.className = "bag-count";
          photoCount.textContent = product.images.length;
          hint.appendChild(photoCount);
        }
        media.appendChild(hint);
      } else {
        showImagePlaceholder(media, product.title);
      }

      const body = document.createElement("div");
      body.className = "card-body";
      const title = document.createElement("h3");
      title.className = "title";
      title.textContent = product.title;
      const desc = document.createElement("p");
      desc.className = "desc";
      desc.textContent = product.description || "";
      const summary = document.createElement("div");
      summary.className = "card-summary";
      body.append(title, summary);
      if (product.description) {
        const more = document.createElement("button");
        more.type = "button";
        more.className = "description-more";
        const infoIcon = document.createElement("img");
        infoIcon.className = "custom-icon";
        infoIcon.src = "icons/product-info.svg";
        infoIcon.width = 24;
        infoIcon.height = 24;
        infoIcon.alt = "";
        infoIcon.setAttribute("aria-hidden", "true");
        const moreLabel = document.createElement("span");
        moreLabel.textContent = "Ver descripción";
        more.append(infoIcon, moreLabel);
        more.hidden = true;
        more.setAttribute("aria-haspopup", "dialog");
        more.setAttribute("aria-controls", "descriptionPopup");
        more.setAttribute("aria-label", `Ver descripción completa de ${product.title}`);
        more.addEventListener("click", () => openDescription(product, more));
        summary.append(desc, more);
        descriptionObserver.observe(desc);
      }

      const action = document.createElement("div");
      action.className = "card-action";
      const price = document.createElement("div");
      price.className = "price mts-badge mts-badge--tape";
      price.textContent = formatPrice(product.price);
      action.appendChild(price);
      if (reserved) {
        const status = document.createElement("span");
        status.className = "product-status";
        status.textContent = "Reservado";
        action.appendChild(status);
      } else {
        const selectBtn = document.createElement("button");
        selectBtn.type = "button";
        selectBtn.className = "select-btn";
        updateSelectionButton(selectBtn, product);
        selectBtn.addEventListener("click", event => toggleSelection(product.id, event));
        action.appendChild(selectBtn);
      }

      card.append(media, body, action);
      productsEl.appendChild(card);
    }
  }

  function createImagePlaceholder(state, title, compact = false) {
    const placeholder = document.createElement("div");
    placeholder.className = `image-placeholder image-placeholder--${state}`;
    placeholder.classList.toggle("image-placeholder--compact", compact);
    if (state === "loading") placeholder.setAttribute("aria-hidden", "true");
    const sticker = document.createElement("span");
    sticker.className = compact ? "bag-photo-icon" : "image-placeholder__sticker";
    const icon = document.createElement("img");
    icon.className = "custom-icon";
    icon.src = compact || state === "loading" ? "icons/photo-gallery.svg" : "icons/product-info.svg";
    icon.width = 40; icon.height = 40; icon.alt = "";
    sticker.appendChild(icon);
    const text = document.createElement("span");
    text.className = "image-placeholder__label";
    text.textContent = state === "loading" ? "Ya viene la foto" : "Foto no disponible";
    const dots = document.createElement("span");
    dots.className = "image-placeholder__dots";
    dots.textContent = state === "loading" ? "● ● ●" : "✳";
    placeholder.append(sticker, text, dots);
    if (state !== "loading") placeholder.setAttribute("aria-label", `Sin foto · ${title}`);
    return placeholder;
  }

  function showImagePlaceholder(media, title) {
    media.classList.remove("is-loading");
    const badge = media.querySelector(".product-badge");
    media.replaceChildren(createImagePlaceholder("unavailable", title));
    if (badge) media.appendChild(badge);
  }

  function updateSelectionButton(button, product) {
    const selected = selection.includes(product.id);
    button.setAttribute("aria-pressed", String(selected));
    button.setAttribute("aria-label", `${selected ? "Elegido · Quitar" : "¡LO QUIERO! · Agregar"} ${product.title} ${selected ? "de" : "a"} mi selección`);
    button.textContent = selected ? "❌ Ya no lo quiero ❌" : "¡LO QUIERO!";
    button.dataset.selected = String(selected);
  }

  function toggleSelection(id, event) {
    const product = products.find((item) => item.id === id);
    if (product && isReserved(product)) {
      showToast("Este artículo está reservado");
      return;
    }
    selection = selection.includes(id)
      ? selection.filter((x) => x !== id)
      : [...selection, id];
    saveSelection();
    // Update existing buttons; keep loaded photos, pagination and keyboard focus.
    for (const card of productsEl.children) {
      const button = card.querySelector(".select-btn");
      if (!button) continue;
      const item = products.find(product => product.id === card.dataset.id);
      if (!item) continue;
      const selected = selection.includes(item.id);
      card.classList.toggle("selected", selected);
      updateSelectionButton(button, item);
    }
    renderBag();
    if (selection.includes(id) && event) showSelectionThanks(event);
    else showToast(selection.includes(id) ? "Agregado a tu selección" : "Quitado de tu selección", selection.includes(id) ? "🛍️" : "−");
  }

  function saveSelection() {
    try { localStorage.setItem(STORAGE_SELECTION, JSON.stringify(selection)); } catch (_) { /* La selección funciona sin almacenamiento. */ }
    bagCountEl.textContent = selection.length;
    $("#bagCountMobile").textContent = selection.length;
    if (openBagBtn) openBagBtn.classList.toggle("is-empty", selection.length === 0);
  }

  function selectedProducts() {
    const ids = new Set(selection);
    return products.filter((p) => ids.has(p.id));
  }

  function cardPaymentEstimate(total) {
    const rates = ["mp_comision_inmediata", "mp_comision_3_cuotas", "mp_iva"].map(key => {
      const raw = String(settings[key] ?? "").trim().replace(",", ".");
      return /^\d+(?:\.\d+)?$/.test(raw) ? Number(raw) : NaN;
    });
    if (!Number.isFinite(total) || total <= 0 || rates.some(rate => !Number.isFinite(rate) || rate < 0 || rate >= 100)) return null;
    const [collection, financing, vat] = rates;
    const taxMultiplier = 1 + vat / 100;
    // The account simulator rounds the VAT-inclusive collection rate to two
    // decimals, then adds financing + VAT. This remains an estimate, not a charge.
    const collectionWithVat = Math.round(collection * taxMultiplier * 100) / 100;
    const deduction = (collectionWithVat + financing * taxMultiplier) / 100;
    if (deduction >= 1) return null;
    const cents = Math.ceil(total / (1 - deduction) * 100);
    if (!Number.isSafeInteger(cents)) return null;
    return { total: cents / 100, installment: cents / 300 };
  }

  function renderCardEstimate(total = selectedProducts().reduce((sum, product) => sum + product.price, 0)) {
    const estimate = cardPaymentEstimate(total);
    const panel = $("#bagCardEstimate");
    panel.hidden = !estimate;
    $("#bagCardTotal").textContent = estimate ? formatPrice(estimate.total, 2) : "";
    $("#bagCardInstallment").textContent = estimate ? `3 cuotas de ≈ ${formatPrice(estimate.installment, 2)} · Estimado` : "";
  }

  function renderBag() {
    saveSelection();
    renderGoals();
    const items = selectedProducts();
    const total = items.reduce((sum, product) => sum + (product.price || 0), 0);
    renderCardEstimate(total);
    bagContentEl.replaceChildren();
    buyerForm.hidden = !items.length;
    $("#bagFooter").hidden = !items.length;

    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "bag-empty";
      const illustration = document.createElement("span");
      illustration.className = "image-placeholder__sticker";
      illustration.setAttribute("aria-hidden", "true");
      const icon = document.createElement("img");
      icon.className = "custom-icon";
      icon.src = "icons/photo-gallery.svg";
      icon.width = 64; icon.height = 64; icon.alt = "";
      illustration.append(icon);
      const message = document.createElement("p");
      message.textContent = "Todavía no seleccionaste ningún artículo.";
      const browse = document.createElement("button");
      browse.className = "bag-browse";
      browse.type = "button";
      browse.textContent = "Ver catálogo";
      browse.addEventListener("click", () => {
        closeDrawer();
        $("#catalogo").scrollIntoView({behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth"});
        $("#catalogo").focus({preventScroll: true});
      });
      empty.append(illustration, message, browse);
      bagContentEl.appendChild(empty);
      return;
    }

    const list = document.createElement("div");
    list.className = "bag-list";
    for (const product of items) {
      const item = document.createElement("div");
      item.className = "bag-item";
      const name = document.createElement("strong");
      name.className = "bag-item-name";
      name.textContent = product.title;
      const value = document.createElement("span");
      value.className = "price price--compact mts-badge mts-badge--tape";
      value.textContent = formatPrice(product.price);
      const remove = document.createElement("button");
      remove.className = "remove";
      remove.type = "button";
      const removeIcon = document.createElement("img");
      removeIcon.className = "custom-icon"; removeIcon.src = "icons/remove-product.svg";
      removeIcon.alt = ""; removeIcon.setAttribute("aria-hidden", "true");
      removeIcon.width = 25; removeIcon.height = 25;
      remove.append(removeIcon);
      remove.addEventListener("click", () => {
        const index = Array.from(list.children).indexOf(item);
        toggleSelection(product.id);
        const remaining = bagContentEl.querySelectorAll(".remove");
        (remaining[Math.min(index, remaining.length - 1)] || bagContentEl.querySelector(".bag-browse") || $("#closeBag")).focus({preventScroll: true});
      });
      remove.setAttribute("aria-label", `Quitar ${product.title} de mi selección`);
      const thumbnail = document.createElement("img");
      thumbnail.className = "bag-thumb";
      thumbnail.alt = "";
      thumbnail.width = 64;
      thumbnail.height = 64;
      thumbnail.loading = "lazy";
      const media = document.createElement("div");
      media.className = "bag-media";
      const placeholder = createImagePlaceholder(product.images.length ? "loading" : "unavailable", product.title, true);
      media.append(placeholder);
      if (product.images.length) {
        media.append(thumbnail);
        setImageWithFallback(thumbnail, product.images[0], () => {
          thumbnail.remove();
          media.replaceChildren(createImagePlaceholder("unavailable", product.title, true));
        }, "bag", () => {
          thumbnail.classList.add("is-ready");
          placeholder.remove();
        });
      }
      const copy = document.createElement("div");
      copy.className = "bag-item-copy";
      const actions = document.createElement("div");
      actions.className = "bag-item-actions";
      actions.append(value, remove);
      copy.append(name, actions);
      item.append(media, copy);
      list.appendChild(item);
    }

    $("#bagTotal").textContent = formatPrice(total);
    bagContentEl.append(list);
  }

  const drawerBackgroundState = new Map();
  function openDrawer(event) {
    hideToast();
    $("#bagFeedback").append(toast);
    document.querySelectorAll("[popover]:popover-open").forEach(panel => panel.hidePopover());
    lastFocusedElement = event?.currentTarget || document.activeElement;
    if ("popover" in HTMLElement.prototype && webPromo.matches(":popover-open")) webPromo.hidePopover();
    for (const element of document.body.children) {
      if (!(element instanceof HTMLElement) || [drawer, overlay, toast].includes(element) || element.tagName === "SCRIPT") continue;
      drawerBackgroundState.set(element, element.inert);
      element.inert = true;
    }
    drawer.inert = false;
    drawer.classList.add("open");
    overlay.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (drawer.classList.contains("open")) $("#closeBag").focus({ preventScroll: true });
    }));
  }

  function closeDrawer() {
    hideToast();
    document.body.append(toast);
    drawer.inert = true;
    for (const [element, wasInert] of drawerBackgroundState) element.inert = wasInert;
    drawerBackgroundState.clear();
    drawer.classList.remove("open");
    overlay.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
    if (!lightbox.classList.contains("open")) document.body.style.overflow = "";
    if (lastFocusedElement && typeof lastFocusedElement.focus === "function") lastFocusedElement.focus();
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function clampGalleryPan(x = galleryZoom.x, y = galleryZoom.y, scale = galleryZoom.scale) {
    if (scale <= 1) return { x: 0, y: 0 };
    const rect = lightboxImageWrap.getBoundingClientRect();
    const naturalWidth = lightboxImage.naturalWidth || rect.width;
    const naturalHeight = lightboxImage.naturalHeight || rect.height;
    const fit = Math.min(rect.width / naturalWidth, rect.height / naturalHeight);
    const maxX = Math.max(0, (naturalWidth * fit * scale - rect.width) / 2);
    const maxY = Math.max(0, (naturalHeight * fit * scale - rect.height) / 2);
    return { x: clamp(x, -maxX, maxX), y: clamp(y, -maxY, maxY) };
  }

  function renderGalleryZoom({ animate = true } = {}) {
    const bounded = clampGalleryPan();
    galleryZoom.x = bounded.x;
    galleryZoom.y = bounded.y;
    lightboxImage.style.transition = animate ? "opacity .24s ease, transform .22s cubic-bezier(.22,.8,.2,1)" : "none";
    lightboxImage.style.transform = `translate3d(${galleryZoom.x}px, ${galleryZoom.y}px, 0) scale(${galleryZoom.scale})`;
    lightboxImageWrap.classList.toggle("is-zoomed", galleryZoom.scale > 1.001);
    zoomReset.textContent = `${Math.round(galleryZoom.scale * 100)}%`;
    zoomOut.disabled = galleryZoom.scale <= 1.001;
    zoomIn.disabled = galleryZoom.scale >= 3.999;
  }

  function setGalleryZoom(nextScale, focalClientX = null, focalClientY = null, { animate = true } = {}) {
    const oldScale = galleryZoom.scale;
    const newScale = clamp(nextScale, 1, 4);

    if (focalClientX != null && focalClientY != null && oldScale > 0) {
      const rect = lightboxImageWrap.getBoundingClientRect();
      const focalX = focalClientX - (rect.left + rect.width / 2);
      const focalY = focalClientY - (rect.top + rect.height / 2);
      const contentX = (focalX - galleryZoom.x) / oldScale;
      const contentY = (focalY - galleryZoom.y) / oldScale;
      galleryZoom.x = focalX - contentX * newScale;
      galleryZoom.y = focalY - contentY * newScale;
    }

    galleryZoom.scale = newScale;
    if (newScale <= 1.001) {
      galleryZoom.scale = 1;
      galleryZoom.x = 0;
      galleryZoom.y = 0;
    }
    renderGalleryZoom({ animate });
  }

  function resetGalleryZoom({ animate = false } = {}) {
    galleryZoom.scale = 1;
    galleryZoom.x = 0;
    galleryZoom.y = 0;
    galleryZoom.pinching = false;
    galleryZoom.panning = false;
    galleryZoom.moved = false;
    lightboxImageWrap.classList.remove("is-panning", "is-pinching", "is-zoomed");
    renderGalleryZoom({ animate });
  }

  function touchDistance(a, b) {
    return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
  }

  function touchMidpoint(a, b) {
    return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
  }

  function openGallery(product, index, trigger) {
    if (!product.images.length) return;
    lastFocusedElement = trigger || document.activeElement;
    activeGallery = { product, index };
    lightbox.showModal();
    lightbox.classList.add("open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    resetGalleryZoom({ animate: false });
    updateGallery({ animate: false });
    requestAnimationFrame(() => $("#lightboxClose").focus());
  }

  function setGalleryPlaceholder(state, title) {
    galleryLoader.replaceChildren(createImagePlaceholder(state, title));
    galleryLoader.setAttribute("aria-label", state === "loading" ? "Cargando foto" : "Foto no disponible");
    galleryLoader.setAttribute("aria-hidden", "false");
  }

  function updateGallery({ animate = true } = {}) {
    const { product, index } = activeGallery;
    if (!product) return;
    cancelGalleryTransition?.();
    const request = ++galleryRequest;
    const candidates = imageCandidates(product.images[index], "gallery");
    const wrap = lightboxImage.parentElement;
    const hasPhoto = lightboxImage.hasAttribute("src") && lightboxImage.naturalWidth > 0 && !wrap.classList.contains("is-loading") && !wrap.classList.contains("is-unavailable");
    $("#lightboxTitle").textContent = product.title;
    lightboxMeta.textContent = `${index + 1}/${product.images.length}`;
    lightboxMeta.setAttribute("aria-label", `Foto ${index + 1} de ${product.images.length}`);
    lightboxPrev.disabled = lightboxNext.disabled = product.images.length < 2;
    wrap.classList.remove("is-unavailable");
    // Keep the current photo visible while the next one downloads and decodes.
    if (!hasPhoto) {
      setGalleryPlaceholder("loading", product.title);
      wrap.classList.add("is-loading");
    }
    const isCurrent = () => request === galleryRequest && lightbox.classList.contains("open");
    loadOptimizedImage(candidates).then(async src => {
      if (!isCurrent()) return;
      const fade = animate && hasPhoto && !matchMedia("(prefers-reduced-motion: reduce)").matches && typeof lightboxImage.animate === "function";
      let outgoing = null;
      if (fade) {
        outgoing = lightboxImage.cloneNode(false);
        outgoing.removeAttribute("id");
        outgoing.className = "gallery-outgoing";
        outgoing.alt = "";
        outgoing.setAttribute("aria-hidden", "true");
        wrap.appendChild(outgoing);
      }
      const animations = [];
      const cleanup = () => {
        animations.forEach(animation => animation.cancel());
        outgoing?.remove();
        if (cancelGalleryTransition === cleanup) cancelGalleryTransition = null;
      };
      cancelGalleryTransition = cleanup;
      resetGalleryZoom({ animate: false });
      lightboxImage.alt = `${product.title} · foto ${index + 1}`;
      lightboxImage.src = src;
      try { await lightboxImage.decode(); } catch (_) {}
      if (!isCurrent()) { cleanup(); return; }
      wrap.classList.remove("is-loading");
      galleryLoader.setAttribute("aria-hidden", "true");
      if (fade) {
        const timing = { duration: 240, easing: "ease-out" };
        animations.push(lightboxImage.animate([{ opacity: 0 }, { opacity: 1 }], timing));
        animations.push(outgoing.animate([{ opacity: 1 }, { opacity: 0 }], timing));
        Promise.all(animations.map(animation => animation.finished)).then(cleanup, cleanup);
      } else cleanup();
      preloadAdjacentOptimized(product, index);
    }).catch(() => {
      if (!isCurrent()) return;
      cancelGalleryTransition?.();
      resetGalleryZoom({ animate: false });
      wrap.classList.remove("is-loading");
      setGalleryPlaceholder("unavailable", product.title);
      wrap.classList.add("is-unavailable");
      lightboxImage.removeAttribute("src");
      lightboxMeta.setAttribute("aria-label", `Foto ${index + 1} de ${product.images.length}, imagen no disponible`);
    });
  }

  function loadOptimizedImage(candidates) {
    return new Promise((resolve, reject) => {
      let i = 0;
      const tryCandidate = () => {
        if (i >= candidates.length) return reject(new Error("No optimized image available"));
        const test = new Image();
        test.decoding = "async";
        test.onload = async () => {
          try { if (typeof test.decode === "function") await test.decode(); } catch (_) {}
          resolve(candidates[i]);
        };
        test.onerror = () => { i += 1; tryCandidate(); };
        test.src = candidates[i];
      };
      tryCandidate();
    });
  }

  function preloadAdjacentOptimized(product, index) {
    if (!product || product.images.length < 2) return;
    const indices = [
      (index + 1) % product.images.length,
      (index - 1 + product.images.length) % product.images.length
    ];
    for (const i of [...new Set(indices)]) {
      const candidate = imageCandidates(product.images[i], "gallery")[0];
      if (!candidate) continue;
      const img = new Image();
      img.decoding = "async";
      img.src = candidate;
    }
  }

  function stepGallery(direction) {
    const product = activeGallery.product;
    if (!product || product.images.length < 2) return;
    activeGallery.index = (activeGallery.index + direction + product.images.length) % product.images.length;
    updateGallery({ animate: true });
  }

  lightbox.addEventListener("cancel", event => { event.preventDefault(); closeGallery(); });

  function closeGallery() {
    if (!lightbox.open || lightbox.classList.contains("closing")) return;
    ++galleryRequest;
    cancelGalleryTransition?.();
    lightbox.classList.add("closing");
    window.setTimeout(() => {
      lightbox.close();
      lightbox.classList.remove("open", "closing");
      lightbox.setAttribute("aria-hidden", "true");
      lightboxImage.src = "";
      resetGalleryZoom({ animate: false });
      lightboxImage.parentElement.classList.remove("is-loading", "is-unavailable");
      galleryLoader.setAttribute("aria-hidden", "true");
      activeGallery = { product: null, index: 0 };
      if (!drawer.classList.contains("open")) document.body.style.overflow = "";
      if (lastFocusedElement && typeof lastFocusedElement.focus === "function") lastFocusedElement.focus();
    }, 220);
  }

  function bindUI() {
    document.querySelectorAll(".site-logo, .footer-logo").forEach((logo) => {
      logo.addEventListener("click", (event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        saveCatalogView();
        cancelCatalogRestoration();
        const hadFilters = activeCategory !== "Todos" || Boolean(searchTerm) || catalogLimit !== CATALOG_BATCH_SIZE;
        activeCategory = "Todos";
        searchTerm = "";
        catalogLimit = CATALOG_BATCH_SIZE;
        catalogSearch.value = "";
        clearSearch.hidden = true;
        const url = categoryUrl("Todos");
        url.hash = "";
        const nextUrl = `${url.pathname}${url.search}`;
        const method = hadFilters || window.location.hash ? "pushState" : "replaceState";
        window.history[method]({ ...(window.history.state || {}), category: activeCategory,
          catalogView: { category: activeCategory, limit: catalogLimit, search: "", scrollY: 0 }
        }, "", nextUrl);
        renderFilters();
        if (catalogLoaded) renderCatalog();
        window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
      });
    });
    window.addEventListener("popstate", () => {
      if (!products.length) return;
      syncCategoryFromUrl({ cleanInvalid: true });
      const view = restoreCatalogView();
      renderFilters();
      renderCatalog();
      restoreCatalogScroll(view);
    });

    openBagBtn.addEventListener("click", openDrawer);
    $("#openBagMobile")?.addEventListener("click", openDrawer);
    $("#closeBag").addEventListener("click", closeDrawer);
    overlay.addEventListener("click", closeDrawer);
    $("#lightboxClose").addEventListener("click", closeGallery);
    lightboxPrev.addEventListener("click", () => stepGallery(-1));
    lightboxNext.addEventListener("click", () => stepGallery(1));
    lightbox.addEventListener("click", (e) => {
      if (e.target === lightbox || e.target.classList.contains("lightbox-stage")) closeGallery();
    });

    zoomOut.addEventListener("click", () => setGalleryZoom(galleryZoom.scale - .5));
    zoomIn.addEventListener("click", () => setGalleryZoom(galleryZoom.scale + .5));
    zoomReset.addEventListener("click", () => resetGalleryZoom({ animate: true }));

    lightboxImageWrap.addEventListener("dblclick", (e) => {
      if (galleryZoom.scale > 1.001) resetGalleryZoom({ animate: true });
      else setGalleryZoom(2.25, e.clientX, e.clientY, { animate: true });
    });

    // Desktop: click + drag para mover una imagen ampliada.
    lightboxImageWrap.addEventListener("mousedown", (e) => {
      if (e.button !== 0 || galleryZoom.scale <= 1.001) return;
      e.preventDefault();
      galleryZoom.panning = true;
      galleryZoom.moved = false;
      galleryZoom.panStartX = e.clientX;
      galleryZoom.panStartY = e.clientY;
      galleryZoom.panOriginX = galleryZoom.x;
      galleryZoom.panOriginY = galleryZoom.y;
      lightboxImageWrap.classList.add("is-panning");
    });

    document.addEventListener("mousemove", (e) => {
      if (!galleryZoom.panning || galleryZoom.pinching || galleryZoom.scale <= 1.001) return;
      galleryZoom.moved = true;
      galleryZoom.x = galleryZoom.panOriginX + (e.clientX - galleryZoom.panStartX);
      galleryZoom.y = galleryZoom.panOriginY + (e.clientY - galleryZoom.panStartY);
      renderGalleryZoom({ animate: false });
    });

    document.addEventListener("mouseup", () => {
      if (!galleryZoom.panning || galleryZoom.pinching) return;
      galleryZoom.panning = false;
      lightboxImageWrap.classList.remove("is-panning");
      renderGalleryZoom({ animate: true });
    });

    lightboxImageWrap.addEventListener("touchstart", (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const [a, b] = e.touches;
        const mid = touchMidpoint(a, b);
        const rect = lightboxImageWrap.getBoundingClientRect();
        const focalX = mid.x - (rect.left + rect.width / 2);
        const focalY = mid.y - (rect.top + rect.height / 2);
        galleryZoom.pinching = true;
        galleryZoom.panning = false;
        galleryZoom.moved = true;
        galleryZoom.startDistance = touchDistance(a, b);
        galleryZoom.startScale = galleryZoom.scale;
        galleryZoom.pinchContentX = (focalX - galleryZoom.x) / galleryZoom.scale;
        galleryZoom.pinchContentY = (focalY - galleryZoom.y) / galleryZoom.scale;
        lightboxImageWrap.classList.add("is-pinching");
        lightboxImageWrap.classList.remove("is-panning");
        return;
      }

      if (e.touches.length === 1) {
        const t = e.touches[0];
        galleryZoom.touchStartX = t.clientX;
        galleryZoom.touchStartY = t.clientY;
        galleryZoom.moved = false;
        if (galleryZoom.scale > 1.001) {
          galleryZoom.panning = true;
          galleryZoom.panStartX = t.clientX;
          galleryZoom.panStartY = t.clientY;
          galleryZoom.panOriginX = galleryZoom.x;
          galleryZoom.panOriginY = galleryZoom.y;
          lightboxImageWrap.classList.add("is-panning");
        }
      }
    }, { passive: false });

    lightboxImageWrap.addEventListener("touchmove", (e) => {
      if (e.touches.length === 2 && galleryZoom.pinching) {
        e.preventDefault();
        const [a, b] = e.touches;
        const mid = touchMidpoint(a, b);
        const rect = lightboxImageWrap.getBoundingClientRect();
        const focalX = mid.x - (rect.left + rect.width / 2);
        const focalY = mid.y - (rect.top + rect.height / 2);
        const ratio = touchDistance(a, b) / Math.max(1, galleryZoom.startDistance);
        galleryZoom.scale = clamp(galleryZoom.startScale * ratio, 1, 4);
        galleryZoom.x = focalX - galleryZoom.pinchContentX * galleryZoom.scale;
        galleryZoom.y = focalY - galleryZoom.pinchContentY * galleryZoom.scale;
        renderGalleryZoom({ animate: false });
        return;
      }

      if (e.touches.length === 1) {
        const t = e.touches[0];
        const dx = t.clientX - galleryZoom.touchStartX;
        const dy = t.clientY - galleryZoom.touchStartY;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) galleryZoom.moved = true;
        if (galleryZoom.panning && galleryZoom.scale > 1.001) {
          e.preventDefault();
          galleryZoom.x = galleryZoom.panOriginX + (t.clientX - galleryZoom.panStartX);
          galleryZoom.y = galleryZoom.panOriginY + (t.clientY - galleryZoom.panStartY);
          renderGalleryZoom({ animate: false });
        }
      }
    }, { passive: false });

    lightboxImageWrap.addEventListener("touchend", (e) => {
      if (galleryZoom.pinching && e.touches.length < 2) {
        galleryZoom.pinching = false;
        lightboxImageWrap.classList.remove("is-pinching");
        if (galleryZoom.scale <= 1.02) resetGalleryZoom({ animate: true });
        else renderGalleryZoom({ animate: true });
      }

      if (galleryZoom.panning && e.touches.length === 0) {
        galleryZoom.panning = false;
        lightboxImageWrap.classList.remove("is-panning");
        renderGalleryZoom({ animate: true });
      }

      if (e.touches.length !== 0 || galleryZoom.pinching) return;
      const t = e.changedTouches?.[0];
      if (!t) return;
      const dx = t.clientX - galleryZoom.touchStartX;
      const dy = t.clientY - galleryZoom.touchStartY;

      if (!galleryZoom.moved && Math.abs(dx) < 12 && Math.abs(dy) < 12) {
        const now = Date.now();
        if (now - galleryZoom.lastTap < 320) {
          if (galleryZoom.scale > 1.001) resetGalleryZoom({ animate: true });
          else setGalleryZoom(2.25, t.clientX, t.clientY, { animate: true });
          galleryZoom.lastTap = 0;
          return;
        }
        galleryZoom.lastTap = now;
      }

      if (galleryZoom.scale > 1.001) return;
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.15) {
        stepGallery(dx > 0 ? -1 : 1);
      }
    }, { passive: false });

    document.addEventListener("keydown", (e) => {
      const modal = lauraContactDialog?.open ? lauraContactDialog : descriptionPopup.open ? descriptionPopup : lightbox.open ? lightbox : drawer.classList.contains("open") ? drawer : null;
      if (modal && e.key === "Tab") {
        const controls = [...modal.querySelectorAll('button, input, textarea, a[href], [tabindex="0"]')]
          .filter(el => !el.disabled && !el.closest('[inert]') && el.getClientRects().length);
        if (controls.length) {
          e.preventDefault();
          const index = controls.indexOf(document.activeElement);
          const next = (index + (e.shiftKey ? -1 : 1) + controls.length) % controls.length;
          controls[next].focus();
        }
      }
      if (lightbox.classList.contains("open")) {
        if (e.key === "Escape") closeGallery();
        if (e.key === "ArrowLeft" && galleryZoom.scale <= 1.001) stepGallery(-1);
        if (e.key === "ArrowRight" && galleryZoom.scale <= 1.001) stepGallery(1);
        if (e.key === "+" || e.key === "=") setGalleryZoom(galleryZoom.scale + .5);
        if (e.key === "-") setGalleryZoom(galleryZoom.scale - .5);
        if (e.key === "0") resetGalleryZoom({ animate: true });

      } else if (drawer.classList.contains("open") && e.key === "Escape") {
        closeDrawer();
      }
    });

    buyerForm.addEventListener("input", saveBuyer);
    buyerName.addEventListener("input", () => {
      if (buyerName.value.trim()) {
        buyerName.removeAttribute("aria-invalid");
        $("#buyerNameError").hidden = true;
      }
    });
    buyerForm.addEventListener("submit", sendWhatsApp);
  }

  function sendWhatsApp(e) {
    e.preventDefault();
    const items = selectedProducts();
    if (!items.length) {
      showToast("Elegí al menos un artículo");
      return;
    }

    const name = buyerName.value.trim();
    if (!name) {
      buyerName.setAttribute("aria-invalid", "true");
      $("#buyerNameError").hidden = false;
      buyerName.focus();
      return;
    }

    const seller = sellerPhone();
    if (!seller) {
      showToast("Falta completar el WhatsApp en la pestaña Config");
      return;
    }

    const total = items.reduce((sum, p) => sum + (p.price || 0), 0);
    const lines = [
      "Hola! Vi tu listado de venta por mudanza.",
      "",
      `Soy ${name}.`,
      "",
      "Me interesan:",
      ...items.map((p, i) => `${i + 1}. ${p.title} — ${formatPrice(p.price)}`),
      "",
      `Total estimado: ${formatPrice(total)}`,
      "",
      "¿Me confirmás disponibilidad y coordinamos pago/entrega?"
    ].filter(Boolean);

    saveBuyer();
    window.open(`https://wa.me/${seller}?text=${encodeURIComponent(lines.join("\n"))}`, "_blank", "noopener,noreferrer");
  }

  function saveBuyer() {
    try { sessionStorage.setItem(STORAGE_BUYER, JSON.stringify({ name: buyerName.value })); }
    catch (_) { /* No bloquear consultas con almacenamiento restringido. */ }
  }

  function hydrateBuyer() {
    // Remove the old persistent value without importing it into this session.
    try { localStorage.removeItem(STORAGE_BUYER); } catch (_) { /* Storage may be blocked. */ }
    try {
      const data = JSON.parse(sessionStorage.getItem(STORAGE_BUYER) || "{}");
      buyerName.value = typeof data?.name === "string" ? data.name : "";
    } catch (_) { buyerName.value = ""; }
  }

  function readJSON(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key));
      return parsed ?? fallback;
    } catch (_) {
      return fallback;
    }
  }

  function formatPrice(value, fractionDigits = 0) {
    return new Intl.NumberFormat(CFG.LOCALE || "es-AR", {
      style: "currency",
      currency: CFG.CURRENCY || "ARS",
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits
    }).format(Number(value || 0));
  }

  function slug(value) {
    return normalizeHeader(value)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `producto-${Date.now()}`;
  }

  let toastTimer;
  let toastReturnFocus;
  function hideToast() {
    clearTimeout(toastTimer);
    if (toast.contains(document.activeElement)) {
      const fallback = drawer.classList.contains("open") ? $("#closeBag") : matchMedia("(max-width:767px)").matches ? $("#openBagMobile") : $("#openBag");
      (toastReturnFocus?.isConnected && toastReturnFocus !== document.body ? toastReturnFocus : fallback).focus({ preventScroll: true });
    }
    toast.classList.remove("show");
    toast.inert = true;
  }
  function scheduleToastDismissal() {
    clearTimeout(toastTimer);
    if (!toast.matches(":hover, :focus-within")) toastTimer = setTimeout(hideToast, 2200);
  }
  $("#closeToast").addEventListener("click", hideToast);
  toast.addEventListener("pointerenter", () => clearTimeout(toastTimer));
  toast.addEventListener("focusin", () => clearTimeout(toastTimer));
  toast.addEventListener("pointerleave", scheduleToastDismissal);
  toast.addEventListener("focusout", () => queueMicrotask(scheduleToastDismissal));
  toast.addEventListener("keydown", event => {
    if (event.key === "Escape") { event.stopPropagation(); hideToast(); }
  });
  // An independent acknowledgement: normal toasts retain their original DOM,
  // coordinates, focus handling, transitions and dismissal timer.
  const thanksBubble = document.createElement("div");
  thanksBubble.className = "toast toast--thanks";
  thanksBubble.setAttribute("role", "status");
  thanksBubble.setAttribute("aria-live", "polite");
  thanksBubble.setAttribute("aria-atomic", "true");
  document.body.appendChild(thanksBubble);
  let thanksTimer;
  function hideSelectionThanks() {
    clearTimeout(thanksTimer);
    thanksBubble.classList.remove("show");
    thanksBubble.textContent = "";
  }
  thanksBubble.addEventListener("animationend", hideSelectionThanks);
  function showSelectionThanks(event) {
    hideSelectionThanks();
    thanksBubble.textContent = "Gracias ❤️";
    const anchor = event.currentTarget.getBoundingClientRect();
    const x = event.detail > 0 ? event.clientX : anchor.left + anchor.width / 2;
    const y = event.detail > 0 ? event.clientY : anchor.top + anchor.height / 2;
    // Measurement restarts only this animation on consecutive additions.
    const bubble = thanksBubble.getBoundingClientRect();
    const viewport = window.visualViewport;
    const left = viewport?.offsetLeft || 0;
    const top = viewport?.offsetTop || 0;
    const width = viewport?.width || document.documentElement.clientWidth;
    const height = viewport?.height || window.innerHeight;
    thanksBubble.style.setProperty("--toast-x", `${Math.min(left + width - bubble.width / 2 - 12, Math.max(left + bubble.width / 2 + 12, x))}px`);
    thanksBubble.style.setProperty("--toast-y", `${Math.min(top + height - 12, Math.max(top + bubble.height + 26, y))}px`);
    thanksBubble.classList.add("show");
    // Also dismiss when the global reduced-motion rule disables animation.
    const duration = parseFloat(getComputedStyle(thanksBubble).getPropertyValue("--thanks-duration"));
    thanksTimer = setTimeout(hideSelectionThanks, duration);
  }
  function showToast(message, symbol = "i") {
    hideSelectionThanks();
    const icon = document.createElement("span");
    icon.setAttribute("aria-hidden", "true");
    icon.className = "toast-icon";
    const pictogram = document.createElement("img");
    pictogram.className = "custom-icon";
    pictogram.src = symbol === "🛍️" ? "icons/cart-bag.svg" : symbol === "−" ? "icons/remove-product.svg" : "icons/product-info.svg";
    pictogram.alt = "";
    icon.appendChild(pictogram);
    const copy = document.createElement("span");
    copy.textContent = message;
    $("#toastMessage").replaceChildren(icon, copy);
    if (!toast.contains(document.activeElement)) toastReturnFocus = document.activeElement;
    toast.inert = false;
    toast.classList.add("show");
    scheduleToastDismissal();
  }

  function showCatalogError(message) {
    catalogLoaded = false;
    catalogPagination.hidden = true;
    descriptionObserver.disconnect();
    photoObserver?.disconnect();
    productsEl.replaceChildren();
    productsEl.setAttribute("aria-busy", "false");
    catalogStatusEl.hidden = false;
    catalogStatusEl.classList.add("is-error");
    const messageText = document.createElement("span");
    messageText.textContent = message;
    catalogStatusEl.replaceChildren(messageText);
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "bag-browse catalog-retry";
    retry.textContent = "Volver a intentar";
    retry.addEventListener("click", () => { renderSkeletons(); loadCatalog(); });
    catalogStatusEl.append(retry);
    catalogCountEl.textContent = "";
  }

  function renderSkeletons() {
    catalogLoaded = false;
    catalogPagination.hidden = true;
    descriptionObserver.disconnect();
    photoObserver?.disconnect();
    productsEl.replaceChildren();
    productsEl.setAttribute("aria-busy", "true");
    catalogCountEl.textContent = "Catálogo";
    if (mobileCategoryCount) mobileCategoryCount.textContent = "…";
    catalogStatusEl.classList.remove("is-error");
    catalogStatusEl.textContent = "Cargando catálogo…";
    catalogStatusEl.hidden = false;
    clearTimeout(catalogLoadingTimer);
    catalogLoadingTimer = setTimeout(() => {
      catalogStatusEl.textContent = "La carga está tardando más de lo habitual. Seguimos intentando…";
    }, 6000);
    for (let index = 0; index < 6; index += 1) {
      const skeleton = document.createElement("article");
      skeleton.className = "card skeleton-card";
      skeleton.setAttribute("aria-hidden", "true");
      skeleton.innerHTML = `
        <div class="skeleton-media"><img class="skeleton-shimmer" src="icons/photo-gallery.svg" width="64" height="64" alt=""></div>
        <div class="skeleton-body">
          <span class="skeleton-line skeleton-title skeleton-shimmer"></span>
          <div class="skeleton-summary">
            <span class="skeleton-line skeleton-copy skeleton-shimmer"></span>
            <span class="skeleton-line skeleton-copy short skeleton-shimmer"></span>
          </div>
        </div>
        <div class="skeleton-action">
          <span class="skeleton-price skeleton-shimmer"></span>
          <span class="skeleton-button skeleton-shimmer"></span>
        </div>`;
      productsEl.appendChild(skeleton);
    }
  }
})();
