(() => {
  "use strict";
  const search = document.getElementById("siteSearch");
  const trigger = document.getElementById("openSiteSearch");
  const field = document.getElementById("catalogSearch");
  const panels = [...document.querySelectorAll(".anchored-popover")];
  const openers = new Map();
  const compact = matchMedia("(max-width: 767px)");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const categoryRail = document.getElementById("desktopCategoryRail");
  const categories = document.getElementById("categoryFilters");
  const catalogTools = document.querySelector(".catalog-tools");
  const previousCategories = document.getElementById("previousCategories");
  const nextCategories = document.getElementById("nextCategories");
  function syncCategoryScroll() {
    const maximum = Math.max(0, categories.scrollWidth - categories.clientWidth);
    categoryRail.dataset.overflow = String(maximum > 1);
    previousCategories.setAttribute("aria-disabled", String(categories.scrollLeft <= 1));
    nextCategories.setAttribute("aria-disabled", String(categories.scrollLeft >= maximum - 1));
  }
  function revealCategory(button) {
    if (compact.matches || !button) return;
    const rail = categories.getBoundingClientRect();
    const target = button.getBoundingClientRect();
    const padding = parseFloat(getComputedStyle(categories).paddingInlineStart);
    const delta = target.left < rail.left + padding ? target.left - rail.left - padding :
      target.right > rail.right - padding ? target.right - rail.right + padding : 0;
    if (delta) categories.scrollBy({ left: delta, behavior: "instant" });
  }
  function refreshCategoryRail() {
    document.documentElement.style.setProperty("--catalog-tools-height", `${catalogTools.offsetHeight}px`);
    revealCategory(categories.querySelector('[aria-pressed="true"]'));
    syncCategoryScroll();
  }
  for (const [button, direction] of [[previousCategories, -1], [nextCategories, 1]]) {
    button.addEventListener("click", () => {
      if (button.getAttribute("aria-disabled") === "true") return;
      categories.scrollBy({ left: direction * categories.clientWidth * .75, behavior: reduce.matches ? "instant" : "smooth" });
    });
  }
  categories.addEventListener("scroll", syncCategoryScroll, { passive: true });
  categories.addEventListener("focusin", event => revealCategory(event.target.closest(".filter-chip")));
  new MutationObserver(refreshCategoryRail).observe(categories, { childList: true });
  if (typeof ResizeObserver === "function") {
    const categoryResize = new ResizeObserver(refreshCategoryRail);
    categoryResize.observe(categories);
    categoryResize.observe(catalogTools);
  } else window.addEventListener("resize", refreshCategoryRail);
  refreshCategoryRail();
  function closeSearch({restore = false} = {}) {
    search.classList.remove("is-open");
    trigger.setAttribute("aria-expanded", "false");
    if (restore) trigger.focus({preventScroll: true});
  }
  function closePanels() {
    panels.forEach(panel => {
      if (panel.open) panel.close();
      else if (panel.matches(":popover-open")) panel.hidePopover();
    });
  }
  trigger.addEventListener("click", () => {
    const opening = !search.classList.contains("is-open");
    if (opening) closePanels();
    search.classList.toggle("is-open", opening);
    trigger.setAttribute("aria-expanded", String(opening));
    if (opening) field.focus();
  });
  document.getElementById("closeSiteSearch").addEventListener("click", () => closeSearch({restore: true}));
  function showResults() {
    closeSearch();
    const catalog = document.getElementById("catalogo");
    catalog.scrollIntoView({behavior: reduce.matches ? "instant" : "smooth"});
    catalog.focus({preventScroll: true});
  }
  document.getElementById("submitSiteSearch").addEventListener("click", showResults);
  field.addEventListener("keydown", event => {
    if (event.key === "Enter") { event.preventDefault(); showResults(); }
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && search.classList.contains("is-open")) closeSearch({restore: true});
  });
  document.addEventListener("click", event => {
    if (!search.contains(event.target) && !trigger.contains(event.target)) closeSearch();
  });

  // MTS anchoring: catalog aligns with its trigger; delivery is centered on the scooter.
  // Both share viewport collision handling, an outer pointer and an inner scroll region.
  function positionPanel(panel) {
    const opener = openers.get(panel);
    if (!opener || panel.open || !panel.matches(":popover-open")) return;
    const rect = opener.getBoundingClientRect();
    if (!opener.getClientRects().length || rect.bottom < 0 || rect.top > innerHeight) {
      panel.hidePopover();
      return;
    }
    const inset = compact.matches ? 15 : 20;
    const width = panel.offsetWidth;
    const catalog = panel.id === "catalogMenu";
    const preferredLeft = catalog && !compact.matches ? rect.left - inset : rect.left + rect.width / 2 - width / 2;
    const left = Math.max(inset, Math.min(preferredLeft, innerWidth - width - inset));
    const below = Math.max(0, innerHeight - rect.bottom - 12 - inset);
    const aboveRoom = Math.max(0, rect.top - 12 - inset);
    const above = !!opener.closest(".mobile-nav") || (panel.offsetHeight > below && aboveRoom > below);
    const available = Math.max(90, above ? aboveRoom : below);
    panel.style.setProperty("--popover-available", `${available}px`);
    const height = panel.offsetHeight;
    const top = Math.max(inset, Math.min(above ? rect.top - height - 12 : rect.bottom + 12, innerHeight - height - inset));
    panel.style.setProperty("--popover-top", `${top}px`);
    panel.style.setProperty("--popover-left", `${left}px`);
    panel.style.setProperty("--anchor-offset", `${Math.max(17, Math.min(rect.left + rect.width / 2 - left - 9, width - 35))}px`);
    panel.classList.toggle("is-above", above);
  }
  document.addEventListener("click", event => {
    const opener = event.target.closest("[popovertarget]");
    if (!opener) return;
    const panel = document.getElementById(opener.getAttribute("popovertarget"));
    if (!panels.includes(panel)) return;
    const closing = opener.getAttribute("popovertargetaction") === "hide";
    if (panel.id === "catalogMenu" && (compact.matches || panel.open)) {
      event.preventDefault();
      if (closing || panel.open) panel.close();
      else {
        openers.set(panel, opener);
        closePanels();
        closeSearch();
        panel.showModal();
        syncCatalogExpanded();
        focusCategory(panel);
      }
      return;
    }
    if (!closing) openers.set(panel, opener);
  }, {capture: true});
  function focusCategory(panel) {
    const selected = panel.querySelector("[aria-current=page]") || panel.querySelector("a");
    selected?.focus({preventScroll: true});
    selected?.scrollIntoView({block: "nearest", behavior: "instant"});
  }
  const catalogPanel = document.getElementById("catalogMenu");
  const outside = event => {
    const rect = catalogPanel.getBoundingClientRect();
    return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
  };
  catalogPanel.addEventListener("keydown", event => {
    if (!catalogPanel.open || event.key !== "Tab") return;
    const targets = [...catalogPanel.querySelectorAll("button,a[href]")];
    const first = targets[0], last = targets.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  });
  let backdropPress = false;
  catalogPanel.addEventListener("pointerdown", event => { backdropPress = catalogPanel.open && outside(event); });
  catalogPanel.addEventListener("pointerup", event => {
    if (backdropPress && outside(event)) catalogPanel.close();
    backdropPress = false;
  });
  const syncCatalogExpanded = () => {
    const open = catalogPanel.open || catalogPanel.matches(":popover-open");
    document.querySelectorAll('[aria-controls="catalogMenu"]').forEach(button => button.setAttribute("aria-expanded", String(open)));
  };
  catalogPanel.addEventListener("close", syncCatalogExpanded);
  panels.forEach(panel => {
    panel.addEventListener("beforetoggle", event => {
      if (event.newState === "open") closeSearch();
    });
    panel.addEventListener("toggle", () => {
      const open = panel.open || panel.matches(":popover-open");
      document.querySelectorAll(`[aria-controls="${panel.id}"]`).forEach(button => button.setAttribute("aria-expanded", String(open)));
      if (!open) return;
      positionPanel(panel);
      if (panel.id === "catalogMenu") focusCategory(panel);
    });
  });
  document.addEventListener("focusin", event => {
    panels.forEach(panel => {
      if (panel.matches(":popover-open") && !panel.contains(event.target) && event.target.getAttribute("popovertarget") !== panel.id) panel.hidePopover();
    });
  });
  const reposition = () => panels.forEach(positionPanel);
  window.addEventListener("scroll", reposition, {passive: true});
  window.addEventListener("resize", reposition);
  window.visualViewport?.addEventListener("resize", reposition);
  compact.addEventListener("change", () => { closeSearch(); closePanels(); });

  const marquee = document.querySelector(".local-strip");
  const pause = marquee.querySelector(".marquee-pause");
  pause.addEventListener("click", () => {
    const paused = marquee.classList.toggle("is-paused");
    pause.setAttribute("aria-pressed", String(paused));
    pause.setAttribute("aria-label", paused ? "Reanudar avisos" : "Pausar avisos y leer todo");
    pause.firstElementChild.textContent = paused ? "▶" : "⏸";
  });
})();
