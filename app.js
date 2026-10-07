(() => {
  "use strict";

  const CFG = window.CATALOG_CONFIG || {};
  const STORAGE_SELECTION = "ventaMudanza.selection.v1";
  const STORAGE_BUYER = "ventaMudanza.buyer.v1";
  const CATEGORY_PARAM = "categoria";

  let products = [];
  let settings = {
    titulo: "Venta por mudanza",
    intro: "Estoy vendiendo algunos artículos por mudanza. Seleccioná lo que te interese y enviame tu consulta por WhatsApp para coordinar disponibilidad, pago y entrega.",
    nota_reserva: "Elegir un artículo no lo reserva automáticamente.",
    whatsapp: "",
    actualizado: ""
  };
  let selection = readJSON(STORAGE_SELECTION, []);
  if (!Array.isArray(selection)) selection = [];
  let activeCategory = "Todos";
  let searchTerm = "";
  let activeGallery = { product: null, index: 0 };
  let lastFocusedElement = null;
  let categorySheetLastFocus = null;
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
  const mobileCategoryOptions = $("#mobileCategoryOptions");
  const categorySheet = $("#categorySheet");
  const categorySheetOverlay = $("#categorySheetOverlay");
  const drawer = $("#drawer");
  const overlay = $("#overlay");
  const bagCountEl = $("#bagCount");
  const bagContentEl = $("#bagContent");
  const buyerForm = $("#buyerForm");
  const buyerName = $("#buyerName");
  const buyerNote = $("#buyerNote");
  const toast = $("#toast");
  const lightbox = $("#lightbox");
  const lightboxImage = $("#lightboxImage");
  const lightboxMeta = $("#lightboxMeta");
  const lightboxPrev = $("#lightboxPrev");
  const lightboxNext = $("#lightboxNext");
  const lightboxImageWrap = $("#lightboxImageWrap");
  const zoomOut = $("#zoomOut");
  const zoomReset = $("#zoomReset");
  const zoomIn = $("#zoomIn");
  const openBagBtn = $("#openBag");
  const webPromo = $("#webPromo");
  const webPromoTrigger = $("#webPromoTrigger");
  // A non-modal native popover: outside click and Escape dismiss it.
  webPromo.addEventListener("toggle", event => {
    webPromoTrigger.setAttribute("aria-expanded", String(event.newState === "open"));
  });
  webPromo.querySelector(".web-promo-close").addEventListener("click", () => webPromoTrigger.focus());
  $("#webPromoContact").addEventListener("click", () => {
    const seller = String(settings.whatsapp || "").replace(/\D/g, "");
    if (seller.length < 10 || /x/i.test(settings.whatsapp || "")) {
      showToast("El contacto todavía no está disponible. Intentá nuevamente en un momento.");
      return;
    }
    const message = "Hola Brenda, vi tu catálogo de venta por mudanza y me gustaría consultar por una web así para vender mis cosas.";
    window.open(`https://wa.me/${seller}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  });
  if (!("popover" in HTMLElement.prototype)) {
    // Keep legacy browsers usable without showing an uncloseable panel.
    webPromo.hidden = true;
    webPromoTrigger.addEventListener("click", () => $("#webPromoContact").click());
  }

  const descriptionPopup = $("#descriptionPopup");
  let descriptionLastFocus = null;
  let descriptionScroll = "";
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
    $("#descriptionPopupTitle").textContent = product.title;
    $("#descriptionPopupCopy").textContent = product.description;
    descriptionLastFocus = trigger;
    descriptionScroll = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    descriptionPopup.showModal();
    descriptionPopup.querySelector(".description-close").focus();
  }
  descriptionPopup?.querySelector(".description-close")?.addEventListener("click", () => descriptionPopup.close());
  descriptionPopup?.addEventListener("click", event => {
    if (event.target !== descriptionPopup) return;
    const rect = descriptionPopup.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) descriptionPopup.close();
  });
  descriptionPopup?.addEventListener("close", () => {
    document.body.style.overflow = descriptionScroll;
    if (descriptionLastFocus?.isConnected) descriptionLastFocus.focus();
  });

  hydrateBuyer();
  bindUI();
  renderSkeletons();
  if (catalogSearch) {
    catalogSearch.addEventListener("input", () => {
      searchTerm = catalogSearch.value || "";
      if (clearSearch) clearSearch.hidden = !searchTerm;
      renderCatalog();
    });
  }
  if (clearSearch) {
    clearSearch.addEventListener("click", () => {
      searchTerm = "";
      if (catalogSearch) { catalogSearch.value = ""; catalogSearch.focus(); }
      clearSearch.hidden = true;
      renderCatalog();
    });
  }
  loadSettings();
  loadCatalog();

  async function readTable(sheet, callbackName) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(`/api/catalog?sheet=${encodeURIComponent(sheet)}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("No se pudo consultar el catálogo.");
        const data = await response.json();
        if (!data.table) throw new Error("Respuesta de catálogo inválida.");
        return data.table;
      } finally { clearTimeout(timeout); }
    } catch (_) {
      return jsonp(sheet, callbackName);
    }
  }

  function gvizUrl(sheet, callbackName) {
    const id = encodeURIComponent(CFG.SHEET_ID || "");
    const name = encodeURIComponent(sheet);
    const cb = encodeURIComponent(callbackName);
    return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?sheet=${name}&headers=1&tqx=responseHandler:${cb}&_=${Date.now()}`;
  }

  function jsonp(sheet, callbackName) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Tiempo de espera agotado al leer Google Sheets."));
      }, 12000);

      const script = document.createElement("script");
      const cleanup = () => {
        clearTimeout(timeout);
        script.remove();
        try { delete window[callbackName]; } catch (_) { window[callbackName] = undefined; }
      };

      window[callbackName] = (response) => {
        cleanup();
        if (!response || response.status === "error" || !response.table) {
          reject(new Error(response?.errors?.[0]?.detailed_message || "No se pudo leer la planilla."));
          return;
        }
        resolve(response.table);
      };

      script.onerror = () => {
        cleanup();
        reject(new Error("No se pudo conectar con Google Sheets."));
      };
      script.src = gvizUrl(sheet, callbackName);
      document.head.appendChild(script);
    });
  }

  async function loadSettings() {
    if (!CFG.SHEET_ID) {
      showCatalogError("Falta configurar la Google Sheet.");
      return;
    }

    try {
      const table = await readTable(CFG.SETTINGS_SHEET || "Config", `settingsCallback_${Date.now()}`);
      settings = { ...settings, ...parseSettings(table) };
      applySettings();
    } catch (err) {
      console.warn("No se pudo cargar Config; se usan textos por defecto.", err);
    }

  }

  async function loadCatalog() {
    try {
      const table = await readTable(CFG.CATALOG_SHEET || "Catalogo", `catalogCallback_${Date.now()}`);
      const parsed = parseCatalog(table);
      products = parsed.filter((p) => !p.vendido && isAvailable(p.disponible));

      const validIds = new Set(products.filter((p) => !isReserved(p)).map((p) => p.id));
      selection = selection.filter((id) => validIds.has(id));
      saveSelection();

      syncCategoryFromUrl({ cleanInvalid: true });
      renderFilters();
      renderCatalog();
      renderBag();
      if (heroCountEl) heroCountEl.textContent = `${products.length} ${products.length === 1 ? "artículo disponible" : "artículos disponibles"}`;
      productsEl.setAttribute("aria-busy", "false");
      catalogStatusEl.hidden = true;
    } catch (err) {
      console.error(err);
      showCatalogError("No pudimos cargar los productos. Volvé a intentar en unos segundos.");
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
      return { id, title, description, price, disponible, vendido, images, category };
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

  function imageCandidates(value, variant = "card") {
    const raw = String(value || "").trim();
    if (!raw) return [];

    const driveId = extractDriveFileId(raw);
    if (driveId) {
      // Nunca solicitamos el archivo original de Drive. El listado y la galería
      // usan derivados redimensionados servidos por Google.
      const size = variant === "gallery" ? 1600 : 900;
      const encoded = encodeURIComponent(driveId);
      return [
        `https://drive.google.com/thumbnail?id=${encoded}&sz=w${size}`,
        `https://lh3.googleusercontent.com/d/${encoded}=w${size}`
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

  function setImageWithFallback(img, value, onFinalError, variant = "card") {
    const candidates = imageCandidates(value, variant);
    let index = 0;

    const tryNext = () => {
      if (index >= candidates.length) {
        img.onerror = null;
        if (typeof onFinalError === "function") onFinalError();
        return;
      }
      img.onerror = () => { index += 1; tryNext(); };
      img.src = candidates[index];
    };

    tryNext();
  }

  function extractDriveFileId(value) {
    const text = String(value || "").trim();

    // Formato habitual: https://drive.google.com/file/d/FILE_ID/view?usp=sharing
    const pathMatch = text.match(/\/file\/d\/([^/?#]+)/i);
    if (pathMatch?.[1]) return pathMatch[1];

    // Formatos alternativos: open?id=FILE_ID, uc?id=FILE_ID, etc.
    try {
      const url = new URL(text);
      if (/drive\.google\.com$/i.test(url.hostname)) {
        const id = url.searchParams.get("id");
        if (id) return id;
      }
    } catch (_) {
      // No es una URL absoluta. Puede ser una ruta local, y eso está permitido.
    }

    return "";
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
    return normalizeHeader(product?.title || "").includes("reservad");
  }

  function applySettings() {
    const title = settings.titulo || "Venta por mudanza";
    document.title = "Venta por mudanza en Mar del Plata · Muebles, libros y más";
    const h1 = document.querySelector(".hero-title");
    const intro = document.querySelector(".hero p");
    const note = document.querySelector(".hero-note");
    if (h1) {
      const words = title.trim().split(/\s+/);
      const accent = words.length > 1 ? words.pop() : "";
      const primary = words.join(" ") || title;
      h1.replaceChildren();
      const primarySpan = document.createElement("span");
      primarySpan.className = "hero-title-primary";
      primarySpan.textContent = primary;
      h1.appendChild(primarySpan);
      if (accent) {
        const accentSpan = document.createElement("span");
        accentSpan.className = "hero-title-accent";
        accentSpan.textContent = accent;
        h1.appendChild(accentSpan);
      }
      h1.setAttribute("aria-label", title);
    }
    if (intro && settings.intro) intro.textContent = settings.intro;
    if (note && settings.nota_reserva) note.textContent = settings.nota_reserva;
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
      const matchesCategory = activeCategory === "Todos" || product.category === activeCategory;
      if (!matchesCategory) return false;
      if (!term) return true;
      const haystack = normalizeHeader(`${product.title} ${product.description} ${product.category}`);
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

  function updateCategoryUrl(category, { replace = false } = {}) {
    const url = new URL(window.location.href);
    if (category === "Todos") url.searchParams.delete(CATEGORY_PARAM);
    else url.searchParams.set(CATEGORY_PARAM, categorySlug(category));

    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl === currentUrl) return;

    const method = replace ? "replaceState" : "pushState";
    window.history[method]({ ...(window.history.state || {}), category }, "", nextUrl);
  }

  function selectCategory(category, { updateUrl = true } = {}) {
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

    if (activeCategory !== "Todos" && !counts.has(activeCategory)) activeCategory = "Todos";
    return [{ label: "Todos", count: products.length }, ...categories.map((label) => ({ label, count: counts.get(label) }))];
  }

  function renderFilters() {
    if (!categoryFiltersEl) return;
    const items = getCategoryItems();
    categoryFiltersEl.replaceChildren();
    for (const item of items) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `filter-chip${activeCategory === item.label ? " active" : ""}`;
      button.setAttribute("aria-pressed", activeCategory === item.label ? "true" : "false");
      const label = document.createElement("span");
      label.textContent = item.label;
      const count = document.createElement("span");
      count.className = "filter-count";
      count.textContent = String(item.count);
      button.append(label, count);
      button.addEventListener("click", () => {
        selectCategory(item.label);
      });
      categoryFiltersEl.appendChild(button);
    }

    if (mobileCategoryOptions) {
      mobileCategoryOptions.replaceChildren();
      for (const item of items) {
        const option = document.createElement("button");
        const selected = activeCategory === item.label;
        option.type = "button";
        option.className = `category-sheet-option${selected ? " active" : ""}`;
        option.setAttribute("role", "radio");
        option.setAttribute("aria-checked", selected ? "true" : "false");

        const label = document.createElement("span");
        label.className = "category-sheet-option-label";
        label.textContent = item.label;
        const meta = document.createElement("span");
        meta.className = "category-sheet-option-meta";
        const count = document.createElement("span");
        count.className = "category-sheet-option-count";
        count.textContent = String(item.count);
        const check = document.createElement("span");
        check.className = "category-sheet-option-check";
        check.setAttribute("aria-hidden", "true");
        check.textContent = "✓";
        meta.append(count, check);
        option.append(label, meta);
        option.addEventListener("click", () => {
          selectCategory(item.label);
          closeCategoryPicker();
        });
        mobileCategoryOptions.appendChild(option);
      }
    }

    const activeItem = items.find((item) => item.label === activeCategory) || items[0];
    if (mobileCategoryValue) mobileCategoryValue.textContent = activeItem?.label || "Todos";
    if (mobileCategoryCount) mobileCategoryCount.textContent = String(activeItem?.count || 0);
  }

  function renderCatalog() {
    descriptionObserver.disconnect();
    productsEl.replaceChildren();
    const visibleProducts = getVisibleProducts();
    const isFiltered = visibleProducts.length !== products.length || activeCategory !== "Todos" || searchTerm.trim();
    catalogCountEl.textContent = isFiltered
      ? `${visibleProducts.length} de ${products.length} artículos`
      : `${products.length} ${products.length === 1 ? "artículo" : "artículos"}`;

    if (!products.length) {
      catalogStatusEl.hidden = false;
      catalogStatusEl.textContent = "No hay artículos disponibles en este momento.";
      return;
    }

    if (!visibleProducts.length) {
      catalogStatusEl.hidden = false;
      catalogStatusEl.textContent = "No encontré artículos con ese filtro.";
      return;
    }

    catalogStatusEl.hidden = true;
    for (const product of visibleProducts) {
      const reserved = isReserved(product);
      const selected = !reserved && selection.includes(product.id);
      const card = document.createElement("article");
      card.className = `card${selected ? " selected" : ""}${reserved ? " reserved" : ""}`;
      card.dataset.id = product.id;
      card.dataset.category = categorySlug(product.category);

      const media = document.createElement("div");
      media.className = "media";

      if (product.images.length) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "media-button";
        btn.setAttribute("aria-label", `Abrir galería de ${product.title}`);
        const img = document.createElement("img");
        img.alt = product.title;
        img.loading = "lazy";
        img.decoding = "async";
        img.fetchPriority = "low";
        setImageWithFallback(img, product.images[0], () => showImagePlaceholder(media, product.title), "card");
        btn.appendChild(img);
        btn.addEventListener("click", () => openGallery(product, 0));
        media.appendChild(btn);

        const hint = document.createElement("span");
        hint.className = "gallery-hint";
        hint.textContent = product.images.length > 1 ? `Ver ${product.images.length} fotos` : "Ver foto";
        media.appendChild(hint);
      } else {
        showImagePlaceholder(media, product.title);
      }

      if (reserved) {
        const status = document.createElement("span");
        status.className = "product-status";
        status.textContent = "Reservado";
        media.appendChild(status);
      }

      const body = document.createElement("div");
      body.className = "card-body";
      const title = document.createElement("h3");
      title.className = "title";
      title.textContent = product.title;
      const desc = document.createElement("p");
      desc.className = "desc";
      desc.textContent = product.description || "";
      body.append(title);
      if (product.description) {
        const more = document.createElement("button");
        more.type = "button";
        more.className = "description-more";
        more.textContent = "Ver descripción";
        more.hidden = true;
        more.setAttribute("aria-haspopup", "dialog");
        more.setAttribute("aria-controls", "descriptionPopup");
        more.setAttribute("aria-label", `Ver descripción completa de ${product.title}`);
        more.addEventListener("click", () => openDescription(product, more));
        body.append(desc, more);
        descriptionObserver.observe(desc);
      }

      const action = document.createElement("div");
      action.className = "card-action";
      const price = document.createElement("div");
      price.className = "price";
      price.textContent = formatPrice(product.price);
      const selectBtn = document.createElement("button");
      selectBtn.type = "button";
      selectBtn.className = "select-btn";
      selectBtn.disabled = reserved;
      selectBtn.setAttribute("aria-pressed", selected ? "true" : "false");
      selectBtn.setAttribute("aria-label", reserved
        ? `${product.title} está reservado`
        : `${selected ? "Quitar" : "Agregar"} ${product.title} ${selected ? "de" : "a"} mi selección`);
      selectBtn.textContent = reserved ? "Reservado" : selected ? "Elegido" : "Elegir";
      selectBtn.dataset.selected = selected ? "true" : "false";
      if (!reserved) selectBtn.addEventListener("click", () => toggleSelection(product.id));
      action.append(price, selectBtn);

      card.append(media, body, action);
      productsEl.appendChild(card);
    }
  }

  function showImagePlaceholder(media, title) {
    media.replaceChildren();
    const p = document.createElement("div");
    p.className = "placeholder";
    p.textContent = `Sin foto · ${title}`;
    media.appendChild(p);
  }

  function toggleSelection(id) {
    const product = products.find((item) => item.id === id);
    if (product && isReserved(product)) {
      showToast("Este artículo está reservado");
      return;
    }
    selection = selection.includes(id)
      ? selection.filter((x) => x !== id)
      : [...selection, id];
    saveSelection();
    renderCatalog();
    renderBag();
    showToast(selection.includes(id) ? "Agregado a tu selección" : "Quitado de tu selección", selection.includes(id) ? "🛍️" : "−");
  }

  function saveSelection() {
    try { localStorage.setItem(STORAGE_SELECTION, JSON.stringify(selection)); } catch (_) { /* La selección sigue funcionando sin almacenamiento. */ }
    bagCountEl.textContent = selection.length;
    if (openBagBtn) openBagBtn.classList.toggle("is-empty", selection.length === 0);
  }

  function openCategoryPicker() {
    if (!categorySheet || !categorySheetOverlay || !mobileCategoryTrigger) return;
    categorySheetLastFocus = document.activeElement;
    categorySheet.classList.add("open");
    categorySheetOverlay.classList.add("open");
    categorySheet.setAttribute("aria-hidden", "false");
    mobileCategoryTrigger.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => {
      const activeOption = mobileCategoryOptions?.querySelector(".category-sheet-option.active");
      activeOption?.focus();
    });
  }

  function closeCategoryPicker() {
    if (!categorySheet || !categorySheetOverlay || !mobileCategoryTrigger) return;
    categorySheet.classList.remove("open");
    categorySheetOverlay.classList.remove("open");
    categorySheet.setAttribute("aria-hidden", "true");
    mobileCategoryTrigger.setAttribute("aria-expanded", "false");
    if (!drawer.classList.contains("open") && !lightbox.classList.contains("open")) document.body.style.overflow = "";
    if (categorySheetLastFocus && typeof categorySheetLastFocus.focus === "function") categorySheetLastFocus.focus();
  }

  function selectedProducts() {
    const ids = new Set(selection);
    return products.filter((p) => ids.has(p.id));
  }

  function renderBag() {
    saveSelection();
    const items = selectedProducts();
    bagContentEl.replaceChildren();
    buyerForm.hidden = !items.length;

    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "Todavía no seleccionaste ningún artículo.";
      bagContentEl.appendChild(empty);
      return;
    }

    const list = document.createElement("div");
    list.className = "bag-list";
    for (const product of items) {
      const item = document.createElement("div");
      item.className = "bag-item";
      const name = document.createElement("strong");
      name.textContent = product.title;
      const value = document.createElement("strong");
      value.textContent = formatPrice(product.price);
      const remove = document.createElement("button");
      remove.className = "remove";
      remove.type = "button";
      remove.textContent = "Quitar";
      remove.addEventListener("click", () => {
        const index = Array.from(list.children).indexOf(item);
        toggleSelection(product.id);
        const remaining = bagContentEl.querySelectorAll(".remove");
        (remaining[Math.min(index, remaining.length - 1)] || $("#closeBag")).focus();
      });
      remove.setAttribute("aria-label", `Quitar ${product.title} de mi selección`);
      const thumbnail = document.createElement("img");
      thumbnail.className = "bag-thumb";
      thumbnail.alt = "";
      thumbnail.width = 64;
      thumbnail.height = 76;
      thumbnail.loading = "lazy";
      if (product.images.length) {
        setImageWithFallback(thumbnail, product.images[0], () => { thumbnail.hidden = true; }, "card");
      } else { thumbnail.hidden = true; }
      const copy = document.createElement("div");
      copy.className = "bag-item-copy";
      copy.append(name, value);
      const actions = document.createElement("div");
      actions.className = "bag-item-actions";
      actions.append(remove);
      item.append(thumbnail, copy, actions);
      list.appendChild(item);
    }

    const total = document.createElement("div");
    total.className = "total";
    const totalLabel = document.createElement("span");
    totalLabel.textContent = "Total estimado";
    const totalValue = document.createElement("span");
    totalValue.textContent = formatPrice(items.reduce((sum, p) => sum + (p.price || 0), 0));
    total.append(totalLabel, totalValue);

    bagContentEl.append(list, total);
  }

  const drawerBackgroundState = new Map();
  function openDrawer() {
    lastFocusedElement = document.activeElement;
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
    requestAnimationFrame(() => $("#closeBag").focus());
  }

  function closeDrawer() {
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
    const maxX = Math.max(0, (rect.width * (scale - 1)) / 2);
    const maxY = Math.max(0, (rect.height * (scale - 1)) / 2);
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

  function openGallery(product, index) {
    if (!product.images.length) return;
    lastFocusedElement = document.activeElement;
    activeGallery = { product, index };
    lightbox.classList.add("open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    resetGalleryZoom({ animate: false });
    updateGallery({ animate: false });
    requestAnimationFrame(() => $("#lightboxClose").focus());
  }

  function updateGallery({ animate = true, direction = 1 } = {}) {
    const { product, index } = activeGallery;
    if (!product) return;

    resetGalleryZoom({ animate: false });
    const sourceValue = product.images[index];
    const candidates = imageCandidates(sourceValue, "gallery");
    lightboxMeta.textContent = `${product.title} · ${index + 1}/${product.images.length}`;
    const multi = product.images.length > 1;
    lightboxPrev.hidden = !multi;
    lightboxNext.hidden = !multi;

    if (!candidates.length) {
      lightboxImage.removeAttribute("src");
      lightboxMeta.textContent = `${product.title} · imagen no disponible`;
      return;
    }

    const wrap = lightboxImage.parentElement;
    if (animate) {
      wrap.classList.remove("slide-next", "slide-prev");
      wrap.classList.add(direction > 0 ? "slide-next" : "slide-prev", "is-loading");
    } else {
      wrap.classList.add("is-loading");
    }

    loadOptimizedImage(candidates).then((src) => {
      lightboxImage.alt = `${product.title} · foto ${index + 1}`;
      lightboxImage.src = src;
      requestAnimationFrame(() => {
        wrap.classList.remove("is-loading");
        wrap.classList.add("is-ready");
        window.setTimeout(() => wrap.classList.remove("is-ready", "slide-next", "slide-prev"), 320);
      });
      preloadAdjacentOptimized(product, index);
    }).catch(() => {
      wrap.classList.remove("is-loading", "is-ready", "slide-next", "slide-prev");
      lightboxImage.removeAttribute("src");
      lightboxMeta.textContent = `${product.title} · imagen no disponible`;
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
    updateGallery({ animate: true, direction });
  }

  function closeGallery() {
    lightbox.classList.add("closing");
    window.setTimeout(() => {
      lightbox.classList.remove("open", "closing");
      lightbox.setAttribute("aria-hidden", "true");
      lightboxImage.src = "";
      resetGalleryZoom({ animate: false });
      lightboxImage.parentElement.classList.remove("is-loading", "is-ready", "slide-next", "slide-prev");
      activeGallery = { product: null, index: 0 };
      if (!drawer.classList.contains("open")) document.body.style.overflow = "";
      if (lastFocusedElement && typeof lastFocusedElement.focus === "function") lastFocusedElement.focus();
    }, 220);
  }

  function bindUI() {
    window.addEventListener("popstate", () => {
      if (!products.length) return;
      syncCategoryFromUrl({ cleanInvalid: true });
      selectCategory(activeCategory, { updateUrl: false });
    });

    openBagBtn.addEventListener("click", openDrawer);
    mobileCategoryTrigger?.addEventListener("click", openCategoryPicker);
    $("#closeCategorySheet")?.addEventListener("click", closeCategoryPicker);
    categorySheetOverlay?.addEventListener("click", closeCategoryPicker);
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
      if (drawer.classList.contains("open") && e.key === "Tab") {
        const controls = Array.from(drawer.querySelectorAll('button, input, textarea, [tabindex="0"]')).filter(el => !el.disabled && el.getClientRects().length);
        const first = controls[0], last = controls[controls.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
      if (lightbox.classList.contains("open")) {
        if (e.key === "Escape") closeGallery();
        if (e.key === "ArrowLeft" && galleryZoom.scale <= 1.001) stepGallery(-1);
        if (e.key === "ArrowRight" && galleryZoom.scale <= 1.001) stepGallery(1);
        if (e.key === "+" || e.key === "=") setGalleryZoom(galleryZoom.scale + .5);
        if (e.key === "-") setGalleryZoom(galleryZoom.scale - .5);
        if (e.key === "0") resetGalleryZoom({ animate: true });
      } else if (categorySheet?.classList.contains("open") && e.key === "Escape") {
        closeCategoryPicker();
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

    const seller = String(settings.whatsapp || "").replace(/\D/g, "");
    if (seller.length < 10 || /x/i.test(settings.whatsapp || "")) {
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
      buyerNote.value.trim() ? `\nComentario: ${buyerNote.value.trim()}` : "",
      "",
      "¿Me confirmás disponibilidad y coordinamos pago/entrega?"
    ].filter(Boolean);

    saveBuyer();
    window.open(`https://wa.me/${seller}?text=${encodeURIComponent(lines.join("\n"))}`, "_blank", "noopener,noreferrer");
  }

  function saveBuyer() {
    try { localStorage.setItem(STORAGE_BUYER, JSON.stringify({
      name: buyerName.value,
      note: buyerNote.value
    })); } catch (_) { /* No bloquear consultas en navegadores con almacenamiento restringido. */ }
  }

  function hydrateBuyer() {
    const data = readJSON(STORAGE_BUYER, {});
    buyerName.value = data.name || "";
    buyerNote.value = data.note || "";
  }

  function readJSON(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key));
      return parsed ?? fallback;
    } catch (_) {
      return fallback;
    }
  }

  function formatPrice(value) {
    return new Intl.NumberFormat(CFG.LOCALE || "es-AR", {
      style: "currency",
      currency: CFG.CURRENCY || "ARS",
      maximumFractionDigits: 0
    }).format(Number(value || 0));
  }

  function slug(value) {
    return normalizeHeader(value)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `producto-${Date.now()}`;
  }

  let toastTimer;
  function showToast(message, symbol = "i") {
    const icon = document.createElement("span");
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = symbol;
    toast.replaceChildren(icon, document.createTextNode(message));
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
  }

  function showCatalogError(message) {
    descriptionObserver.disconnect();
    productsEl.replaceChildren();
    productsEl.setAttribute("aria-busy", "false");
    catalogStatusEl.hidden = false;
    catalogStatusEl.textContent = message;
    const retry = document.createElement("button");
    retry.type = "button";
    retry.textContent = "Volver a intentar";
    retry.addEventListener("click", () => { renderSkeletons(); loadCatalog(); });
    catalogStatusEl.append(" ", retry);
    catalogCountEl.textContent = "";
  }

  function renderSkeletons() {
    descriptionObserver.disconnect();
    productsEl.replaceChildren();
    catalogStatusEl.hidden = true;
    for (let index = 0; index < 4; index += 1) {
      const skeleton = document.createElement("article");
      skeleton.className = "card skeleton-card";
      skeleton.setAttribute("aria-hidden", "true");
      skeleton.innerHTML = `
        <div class="skeleton-media skeleton-shimmer"></div>
        <div class="skeleton-body">
          <span class="skeleton-line skeleton-title skeleton-shimmer"></span>
          <span class="skeleton-line skeleton-copy skeleton-shimmer"></span>
          <span class="skeleton-line skeleton-copy short skeleton-shimmer"></span>
        </div>
        <div class="skeleton-action">
          <span class="skeleton-price skeleton-shimmer"></span>
          <span class="skeleton-button skeleton-shimmer"></span>
        </div>`;
      productsEl.appendChild(skeleton);
    }
  }
})();
