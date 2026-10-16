(() => {
  "use strict";

  const root = document.documentElement;
  const waitLimit = 2000;
  const sample = "Catálogo ÁÉÍÓÚ áéíóú Ññ ¿¡ $ 0123456789 …";
  const criticalFonts = [
    '600 16px "Playpen Sans"',
    '700 16px "Playpen Sans"',
    '800 16px "Playpen Sans"',
    '500 16px "Nunito"',
    '700 16px "Nunito"',
    '800 16px "Nunito"',
    '400 16px "Space Mono"',
    '700 16px "Space Mono"',
  ];

  // Track fonts without blocking content, scrolling or catalog requests.
  root.dataset.fonts = "loading";
  let settled = false;
  let timeout;

  function reveal(state) {
    if (settled) return;
    settled = true;
    window.clearTimeout(timeout);
    // Fallback tokens stay selected even if a timed-out font arrives later.
    root.dataset.fonts = state;
  }

  timeout = window.setTimeout(() => reveal("fallback"), waitLimit);

  if (!document.fonts?.load) {
    reveal("fallback");
    return;
  }

  try {
    Promise.all(criticalFonts.map(font => document.fonts.load(font, sample)))
      .then(families => {
        const loaded = families.every(faces => faces.length && faces.every(face => face.status === "loaded"));
        reveal(loaded ? "ready" : "fallback");
      })
      .catch(() => reveal("fallback"));
  } catch {
    reveal("fallback");
  }
})();
