# Candidata local — rediseño standalone

8 de octubre de 2026 · rama `feat/redisenio-mts`

La revisión funcional y visual local está completada. El artefacto y las funciones compilan; no se hizo commit, push ni despliegue. La publicación sigue condicionada a los controles de rendimiento y dispositivos indicados abajo. Este informe no declara conformidad global ni sustituye una prueba en producción.

## Correcciones realizadas durante QA

- Galería con diálogo modal nativo, contención del foco, regreso al disparador y cierre consistente. La grilla interna mantiene ambos márgenes incluso con scrollbar; conserva zoom, navegación y paneo.
- Ajustes de foco del minicart en WebKit, nombre accesible de «Mi selección» y contraste del badge magenta. Cards y fotos permanecen fijas; los botones conservan su feedback.
- Unificación del cambio de navegación desktop/mobile en 767/768 px. El hero mantiene su cambio de composición independiente en 680/681 px.
- Asset horizontal aprobado integrado solo en el hero mobile, con fuentes de 540/720/1080 px. A 390 px, el hero completo mide aproximadamente 399 px y la ilustración 120 px. Desktop conserva su asset y composición.
- Fotos del catálogo cargadas al acercarse a la pantalla, sin competir innecesariamente con hero y fuentes. Google entrega primero el derivado directo, manteniendo el respaldo existente.
- Consulta de Catalogo reducida de 191.634 a 34.004 bytes. Se contrastaron las nueve columnas consumidas de los 82 artículos: valores idénticos. Config solicita sus dos columnas; Ventas devuelve únicamente el agregado `TOTAL VENDIDO`. La Sheet no se modificó.
- Playpen Sans optimizada conservando todos sus glifos y funciones tipográficas: el archivo latino baja de 196.412 a 139.812 bytes. Los anchos son idénticos en 600/650/700/750/800 y la diferencia máxima de contorno es 0,5 unidades de fuente. Se conservaron los originales como entradas de reproducción y las licencias OFL.
- Eliminado el `@import` serial de tokens, corregido el máximo tipográfico inválido del popup de promoción y agregado `robots.txt`.
- Build explícito de archivos públicos: `dist` contiene 68 archivos, aproximadamente 2,86 MiB. Incluye fuentes, licencias, iconos e imágenes sociales. Excluye QA, propuestas, documentación, tests, originales sin uso y archivos del repositorio. Netlify configura `npm run build` y publica `dist`.

## Pruebas y resultados

| Validación | Resultado y alcance |
| --- | --- |
| E2E | 54/54 grupos aprobados: Chromium 153.0.8010.12, Firefox 155.0 y WebKit 26.6, en 1440×1000 y 390×844. |
| Recuperación y casos adversos | 15/15: API/JSONP caídos y reintento, catálogo vacío, URL inválida, storage corrupto o bloqueado, vendido persistido, clipboard permitido/denegado, foto rota, meta sin datos/cero/completa, texto HTML inerte, fuentes fallidas, paisaje y altura de teclado. |
| Interacciones | 5/5 grupos: categorías/sticky en 14 anchos, hover de cards/fotos/CTA, pop y movimiento reducido, tap/swipe/doble click de galería, reflow de texto al 200 %. |
| API e integración | 7 controles aprobados: tres hojas permitidas, agregado sin detalle de ventas, hoja inexistente 404, POST 405, metadata social de categoría y badge mediante Netlify dev. |
| Artefacto público | 68 archivos responden 200; siete rutas de código/documentación/QA no están expuestas por el servidor de `dist`. Manifiesto con SHA-256 guardado. |
| Compilación Netlify | `netlify build --offline` completado, incluyendo función `catalog.mts` y Edge Function `category-preview`. |
| Accesibilidad automatizada | Axe WCAG 2 A/AA y 2.1 AA: cero hallazgos en catálogo desktop y carrito mobile. Lighthouse: 100. Esto no prueba accesibilidad universal. |
| Código y dependencias | Sintaxis JS y `git diff --check` correctos. `npm audit`, incluidas dependencias de desarrollo: cero vulnerabilidades informadas en esta ejecución. |

Los E2E usan una fixture controlada para vendidos, reservados, totales y errores. El QA visual y las consultas de integración también usaron el catálogo real de lectura. Se validó el enlace y mensaje de WhatsApp interceptando la apertura; no se envió ninguna consulta, pago ni modificación a Sheets.

Se revisaron filtros por `categoria`, `badge=recien-agregado`, búsqueda, atrás/recarga, carga incremental de 12, selección persistida, nombre obligatorio, quitar artículos, copia del alias, descripción completa, entrega, promoción, galería y proyección porcentual de la meta.

## QA visual real

Capturas y mediciones en 320, 360, 390, 430, 539, 540, 541, 679, 680, 681, 766, 767, 768, 799, 800, 801, 1024, 1440 y 1920 px. Sin desborde horizontal registrado. También se inspeccionaron 844×390 y 390×430.

Se revisaron bordes, sombras, alineaciones, tipografía, imágenes, recortes, controles, cierres, sticky, capas y scroll interior. Se corrigieron los defectos observados. La auditoría de propiedades fluidas detecta únicamente el cambio estructural de dos columnas a una por debajo de 300 px; no es una sobrescritura de escala tipográfica o espaciado.

Evidencia seleccionada:

- [Hero mobile](output/qa/release-2026-10-08/live-390-home.png) y [desktop](output/qa/release-2026-10-08/live-1440-home.png). Estas capturas usan movimiento reducido; por eso la marquee muestra todos sus mensajes estáticos.
- [Catálogo mobile real](output/qa/release-2026-10-08/review-390-catalog.png).
- [Menú desktop real](output/qa/release-2026-10-08/review-1440-menu.png) y [bottom sheet mobile](output/qa/release-2026-10-08/review-390-menu.png).
- [Galería mobile centrada](output/qa/release-2026-10-08/review-390-gallery.png).
- [Minicart y formulario](output/qa/release-2026-10-08/review-390-cart-form.png).
- [Popup de promoción](output/qa/release-2026-10-08/review-390-promo.png).

Los JSON de resultados, logs, manifiesto y capturas adicionales están en `output/qa/release-2026-10-08/`. Son evidencia local excluida de publicación y Git. No hay una Component Library standalone separada; se verificaron los componentes reales y sus consumidores.

## Rendimiento y pendientes de salida

Lighthouse mobile final sobre HTTPS local, red/CPU simuladas y compresión gzip de estáticos: **rendimiento 88, accesibilidad 100, buenas prácticas 100, SEO 100**. FCP **1,4 s**, LCP **3,8 s**, TBT **0 ms**, CLS **0,011**. [Informe completo](output/qa/release-2026-10-08/lighthouse-mobile-compressed.report.html).

La primera medición registró LCP 7,2 s y la última sin compresión 5,2 s. No son un A/B estricto de código: la medición final añade compresión del servidor local para aproximar la entrega comprimida de Netlify. No se atribuye toda esa diferencia a las modificaciones. El adaptador local no reproduce su CDN, latencia pública ni caché.

1. **Rendimiento:** el LCP de laboratorio sigue por encima del objetivo de 2,5 s. Antes de dar aprobación definitiva, verificar en un entorno Netlify autorizado la compresión, prioridad de recursos y LCP; optimizar lo que confirme esa medición. No se midió INP de campo ni percentil 75 de usuarios reales.
2. **Dispositivos físicos:** pendiente Safari en iPhone y Chrome en Android, teclado real, safe areas, orientación y gestos. WebKit automatizado no equivale a Safari físico. El swipe probado fue sintético; la prueba de texto al 200 % no sustituye todos los modos de zoom del navegador.
3. **Publicación:** después de autorizarla, comprobar URL pública, API, assets, headers, enlaces compartidos y WhatsApp en dispositivo. La compilación local no verifica configuración remota ni publicación. No hay un pago integrado: Mercado Pago solo copia el alias.
4. **Alcance de privacidad:** el banner omite el monto recaudado, pero la fuente sigue siendo una Sheet pública y la API conserva su agregado numérico. Esto evita mostrarlo en la interfaz; no lo vuelve confidencial. Si se requiere confidencialidad de origen, hace falta una decisión de arquitectura separada (fuente privada y lectura de servidor), además de considerar qué puede inferirse del porcentaje y los precios públicos.
5. **Contrato de datos:** las consultas optimizadas dependen de las nueve columnas actuales de Catalogo y las dos de Config. Otro backend o cambio de esquema requiere adaptar y volver a probar ese contrato. Las imágenes externas siguen dependiendo de permisos públicos y disponibilidad del proveedor; el fallback fue probado.

## Reproducción

- `npm run build` prepara `dist`; no instala herramientas ni publica.
- `netlify build --offline` verifica empaquetado local de funciones y Edge Functions.
- `netlify dev --offline --dir . --port 8765 --no-open` sirve fuente y funciones para desarrollo.
- `QA_ARTIFACT=dist QA_PORT=8768 node tests/serve-https.mjs` sirve el artefacto con HTTPS local y proxy de API a 8765. Requiere OpenSSL para su certificado local. `QA_COMPRESS=1` activa gzip únicamente en este adaptador de QA.
- Con Playwright y navegadores instalados, usar `QA_URL=https://localhost:8768 npm run test:e2e`, `test:resilience`, `test:interactions` y `test:visual`. `PLAYWRIGHT_MODULE` permite señalar una instalación existente sin agregar dependencias al sitio; `AXE_MODULE` señala `axe.min.js` para el auditor visual.
- `node tests/live-states.mjs` captura productos reales; `node tests/artifact.mjs` comprueba el contenido público servido.
- La optimización opcional de fuentes se reproduce con `python scripts/optimize-fonts.py` en un entorno con `fonttools[woff]==4.66.1`. No forma parte del build ni del runtime. No se cambiaron dependencias de la aplicación.

Referencias verificadas: [configuración de build de Netlify](https://docs.netlify.com/build/configure-builds/overview/), [compresión de su CDN](https://www.netlify.com/blog/2020/05/20/gain-instant-performance-boosts-as-brotli-comes-to-netlify-edge/) e [instanciación parcial de fuentes](https://fonttools.readthedocs.io/en/latest/varLib/instancer.html).

## Actualización: UI de galería MTS

- Cabecera con título real del artículo e icono de galería; cierre compartido sin variaciones. Foto completa sobre canvas neutro, controles agrupados fuera de la imagen y contador tape amarillo. Flechas originales MTS; avanzar en lavanda.
- Nuevos SVG zoom-in/zoom-out derivados de la lupa existente (misma grilla, trazo y paleta). Targets de 44–48 px, foco, hover, pressed y disabled. Controles en dos filas hasta 380 px.
- Se conserva el fundido de 240 ms y su alternativa de movimiento reducido. Límites de paneo ajustados al tamaño visible real de la foto, para que una imagen vertical no se pierda fuera del canvas horizontal.
- E2E: 54/54, Chromium 153, Firefox 155 y WebKit 26.6, desktop 1440×1000 y mobile 390×844. Navegación, zoom, foco, cierre y regresiones del catálogo/carrito aprobados.
- Layout real: 320×568, 360×800, 380×844, 381×844, 390×844, 768×1024, 1440×1000 y 844×390; controles dentro del viewport. Inspección visual de capturas desktop/mobile. Axe WCAG A/AA: 0 infracciones detectadas en el diálogo.
- Evidencia: `output/qa/gallery-ui/`, `output/qa/gallery-ui-e2e.log`. Build: 70 archivos públicos, 2,87 MiB. No publicación. Dispositivos físicos pendientes.

### Ajuste de controles según captura de Bren (8/10, 12:41)

Zoom y navegación en cápsulas blancas con borde/sombra exterior; contador sin tape ni amarillo. Botones internos sin borde, sombra o transform en reposo/hover/active; feedback peach y foco visible por teclado. Una fila en 320, 390 y 1440 px. Chromium: 15 verificaciones de hover/active, estabilidad de posición, navegación, zoom, Escape y foco. Capturas inspeccionadas mobile/desktop en `output/qa/gallery-capsules/`. Build y diff check aprobados. Sin cambios al pipeline de imágenes ni publicación; dispositivos físicos pendientes.

### Cierre del popover Entregas (grabación 8/10, 13:12)

La dirección flex en columna estaba limitada a `:popover-open`; al cerrar, la transición discreta conservaba `display:flex` pero el contenido volvía a fila. Se movió `flex-direction:column` a la fuente base de Entregas y del menú compartido. Chromium/WebKit, 390/1440 px: 24 recorridos de cierre (X, disparador, Escape, clic fuera), verificando altura del panel y posición/tamaño de cabecera durante los frames de salida. Todos aprobados. Evidencia en `output/qa/close-bug/`. Sin publicación; validación en dispositivo físico pendiente.

## Optimización automática de Drive — candidata local

Integrada en imageCandidates/setImageWithFallback, sin pipeline duplicado ni cambios en Sheet/Drive. WebP q85; miniaturas 64/128/192, cards 300–1200, galería hasta 1600. Allowlist restringida al derivado lh3 de Drive. URLs externas preservadas. La actualización por archivo/enlace nuevo fue confirmada por Bren.

- Comparación real: 3 fotos × 4 anchos × origen/Netlify local. Ahorro 14–94% aproximado a dimensiones equivalentes. Revisión visual de textura del acolchado y textos del escritorio a 900 px, además del render de maceta en minicart y galería. Sin pérdida visible relevante en estas muestras; no es una garantía universal.
- Chromium, Firefox, WebKit: 390 px DPR3 y 1440 px DPR1. Fuente real Netlify emulada verificada; carrito elige 192/64 px, cards 450 px, galería 1600. Zoom 150% operativo. 6 escenarios aprobados.
- Fallas inyectadas: CDN falla → Google; CDN/Google fallan → thumbnail; los tres fallan → placeholder. Cadena acotada comprobada. Otro ID de Drive cambia la URL fuente. Host/ruta fuera de allowlist: 403 local.
- E2E 54/54; recuperación 15/15. Se actualizó la expectativa antigua de márgenes internos de galería al diseño aprobado sin padding, verificando que la foto queda dentro del viewport y no invade controles. Build de 70 archivos públicos, 2,87 MiB; fotos remotas no incluidas en dist.
- Evidencias: output/qa/image-cdn/comparison.json, browser-results.json, e2e.log, resilience.log y capturas por navegador. Datos de compra de estas capturas son fixtures de QA.
- Pendiente: CDN de producción, tiempos cold/warm reales, headers/caché de borde, saldo/consumo vigente de créditos y dispositivos físicos. Sin deploy, commit, push ni cambios de plan. La medición local no demuestra reducción de latencia de producción.

### Revalidación del alta de artículos — 8/10/2026

Por pedido de Bren se repitieron las pruebas sobre dist: E2E 54/54, recuperación 15/15, seis combinaciones CDN reales locales Chromium/Firefox/WebKit × desktop/mobile DPR3, tres fallas acotadas y cambio de ID. Caso adicional: una fila nueva inyectada solo en la respuesta de prueba aparece después de recargar; dos enlaces reales públicos de Drive (file/d y open?id), transformación local CDN, segunda foto de galería y minicart aprobados. Hash de dist/app.js idéntico antes/después: no requiere rebuild por alta. Sheet/Drive no modificados. Captura revisada: output/qa/image-cdn/new-item-gallery.png; resultados en new-item-result.json y recheck-*.log. Artefacto: 70 archivos públicos, 7 rutas privadas excluidas. Sin publicación; prueba del edge CDN y dispositivos físicos sigue pendiente.

## Mobile performance — 2026-10-08

- Hero: AVIF sources for mobile/tablet/desktop, retaining WebP fallback and the approved composition. Mobile 720 px: 51,842 → 29,747 bytes; desktop: 244,570 → 109,599 bytes.
- Promo dog: 67/134/201 px responsive sources; 134 px is 8,470 bytes versus the former 41,146-byte image. Logos and WebP fallback assets recompressed.
- Build combines the four CSS sources, in their original cascade order, into `dist/site.css`; font URLs are rebased. Source CSS stays independently editable. No new runtime/build dependencies. The browser downloads one selected hero format, not both; the fallback does increase artifact size.
- Local fonts, preload hints and stable timeout fallback remain intact. Additional font reduction was investigated but not retained because savings did not justify changes to glyphs/weights. No JS minifier dependency was introduced for the small estimated saving.
- Preview: `https://redisenio-mts-preview--ventasbrenda.netlify.app/`, deploy `6ac7cdb59be4fb008e98af58`. Production remains deploy `6ac68b4acf5ff0000808347b`.
- Lighthouse 13.4.1, three sequential mobile runs: 96 / 94 / 93; median 94 (before 92). LCP median 2.709 s (before 3.021 s). CLS 0.004–0.010; TBT 0–0.5 ms. Desktop 100, LCP 0.7 s. Accessibility, best practices and SEO remain 100. The mobile LCP <2.5 s goal is not consistently achieved.
- E2E: 54/54 in Chromium, Firefox and WebKit, desktop/mobile. Resilience: 15/15 including failed fonts. Artifact: 74 public files and seven private paths excluded. Gallery test now waits for the second image to load before testing its zoom, avoiding a race with slide loading.
- Render inspected at 390, 680, 681, 1020, 1021 and 1440 px; remote Chromium desktop and WebKit mobile checked. Evidence and Lighthouse reports: `output/qa/mobile-performance/`. No physical phone verification.
