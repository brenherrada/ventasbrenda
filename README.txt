VENTA POR MUDANZA · NETLIFY

Mantenimiento cotidiano:
ESTILOS · SASS
- Editar scss/, nunca los CSS generados. Ver scss/README.md para el mapa de módulos.
- npm run styles:watch recompila al guardar; usarlo mientras se trabaja en localhost.
- npm run styles:build compila una vez; npm run styles:check detecta salidas desactualizadas.
- npm run build compila Sass y prepara dist. El navegador recibe CSS; no se publica Sass.

1. Editá la Google Sheet “Catálogo · Venta por mudanza”.
2. En Catalogo:
   - disponible = si → aparece
   - disponible = no → se oculta automáticamente
   - vendido = TRUE → se oculta aunque disponible siga en si
   - imagenes → podés pegar links de Google Drive o cualquier URL HTTPS directa de imagen.
   - varias imágenes → separalas con |
   - categoria → elegí una opción del dropdown; la web crea los filtros automáticamente.
3. Config contiene solo las seis claves activas: titulo, intro, nota_reserva, whatsapp, actualizado y meta_total. El título visual del hero se mantiene en el código; titulo cambia la pestaña del navegador. Guía actual en CONFIG.md.

IMPORTANTE
- La Google Sheet debe ser pública en lectura. Las imágenes de Drive deben poder ser leídas por “Cualquier persona con el enlace”. Las URLs externas deben permitir carga pública/hotlink.
- No pongas datos privados, contraseñas, documentos ni información sensible en esas fuentes.
- El sitio conserva /api/catalog, una función de Netlify con respaldo de lectura directa de la planilla pública. La selección y el nombre se guardan localmente en el navegador del visitante hasta que abre WhatsApp.
- El archivo _headers agrega políticas de seguridad compatibles con Netlify.

PUBLICACIÓN
Ejecutá npm run build para generar dist únicamente con archivos públicos. netlify.toml configura ese comando y publica dist; las funciones de netlify/functions y netlify/edge-functions se compilan desde sus fuentes del repo. No subir la raíz ni usar drag-and-drop: ese flujo omitiría las funciones y la vista previa social por filtro. No se entrega ZIP. Esta revisión se mantiene local, sin commit, push ni publicación.

VALIDACIÓN DE LA CANDIDATA · 8/10/2026
Ver RELEASE-QA.md para resultados, evidencia visual, comandos y gates pendientes antes de producción. Los scripts de tests y output/qa quedan fuera de dist. Las fuentes locales incluyen sus licencias OFL en el artefacto.

IMÁGENES EN GOOGLE DRIVE
- En la columna "imagenes" pegá la URL completa que obtenés con Drive > Compartir > Copiar enlace.
- No alcanza con escribir solo el nombre del archivo (por ejemplo IMG_0318.jpg).
- Para varias imágenes, separá las URLs con |.
- En desktop, el catálogo usa tres columnas; hasta 767 px usa un listado de una columna con foto y descripción lado a lado.
- Las imágenes ocupan toda el área de su card. La galería conserva la foto completa y los controles de zoom.
- El menú Catálogo usa el panel de MTS con las categorías y cantidades de la Sheet. En mobile también se abre desde la barra inferior o el selector del catálogo; en pantallas angostas permite scroll interno. Los filtros de desktop se conservan.
- Los artículos cuyo título contiene “RESERVADO/RESERVADAS” siguen visibles, pero no pueden agregarse a la selección.

OPTIMIZACIÓN DE IMÁGENES
- Para imágenes de Google Drive, la web NO descarga el archivo original pesado.
- Listado: el navegador elige un derivado de 300, 450 o 900 px según el espacio disponible y la densidad de pantalla.
- Galería fullscreen: solicita una versión optimizada de hasta aprox. 1600 px.
- Si Google no puede servir el derivado optimizado, se muestra un fallback visual; no se descarga el original.
- Pegá en la Sheet el link de Drive como texto plano, no como chip/pill.


IMÁGENES EXTERNAS HTTPS
- También podés pegar URLs HTTPS directas de imágenes alojadas fuera de Drive.
- Drive se sigue sirviendo mediante derivados redimensionados, nunca el original pesado.
- Para hosts externos, la web usa la URL tal cual; si ese servidor bloquea hotlinking, aparecerá el fallback visual.


La imagen social está en images/venta-por-mudanza-share.jpg y se usa SOLO para Open Graph/Twitter/WhatsApp al compartir el link.
El hero usa mts-hero-desktop.webp y mts-hero-tablet.webp; hasta 680 px carga la composición horizontal compacta mts-hero-mobile-horizontal, con variantes de 540, 720 y 1080 px. El título y la descripción son HTML responsive.

REDISEÑO · 5 OCTUBRE 2026
Sistema visual recuperado del theme activo de Manifest That Shit, contrastado con localhost:8088. Logo, ilustraciones y SVG originales incluidos.
Fuentes locales incluidas con sus licencias. HTML/CSS/JavaScript; el build actual prepara dist sin transformar el código.
El sitio conserva Config, Google Sheets y WhatsApp. No se publicó en Netlify.
La galería usa una imagen reducida de respaldo si falla el derivado grande de Drive.

CORRECCIÓN DE NAVEGACIÓN Y CARGA
- Sin botón Inicio. Barra móvil con Catálogo, Entregas y Mi selección.
- Avisos de venta local y reserva en la marquee amarilla. El botón de pausa muestra todos los textos; con movimiento reducido se muestran estáticos.
- Acción de cada artículo: ¡LO QUIERO!; Elegido y Reservado conservan sus estados.
- Placeholder con icono custom de galería, trama de puntos y fondo neutro mientras carga cada foto del listado o de la galería. Si falla, muestra Foto no disponible.
- Aviso de entregas anclado a la motito, con detección de bordes de pantalla.
- Scrollbar rosa/crema del sistema MTS; su visibilidad depende de la configuración del navegador y del sistema operativo.

TÍTULO DEL HERO · REVISIÓN 4
El título aprobado es DE MI CASA / A LA TUYA., con CASA destacada. Se conserva al cargar la Sheet y no se reconstruye desde Config.titulo. El título de la pestaña sigue usando Config.titulo.

BUSCADOR · REVISIÓN 5
El campo conserva altura, ancho y alineación al escribir, limpiar y enfocar. El botón Limpiar tiene un área de 44×44 px y espacio reservado para evitar saltos.

BOTONES · REVISIÓN 6
Todos los ¡LO QUIERO! son cyan. Los productos reservados conservan su distintivo y precio, pero no muestran botón de selección.

Revisión 7: RESERVADO como sello grande e inclinado sobre la foto, con borde doble y sombra azul. Sigue permitiendo abrir la galería.

Revisión 8: balance de color — sello lavanda, etiquetas de fotos crema y promo peach. Amarillo concentrado en los acentos principales de MTS.

Revisión 9: listado mobile como producción (foto izquierda, contenido y acción derecha), icono custom de galería SVG con contador y sello responsive en la foto. Desktop conserva la grilla.

Revisión 10: los productos elegidos usan la misma sombra normal, hover y foco que todos los demás. El botón Elegido conserva su estado.

Revisión 11: layout mobile replanteado en todos los artículos: título completo arriba, foto cuadrada + resumen, fila de precio/acción independiente. La foto no crece con la descripción ni el botón.

Revisión 12: todos los placeholders y el fondo de carga usan gris neutro uniforme, en listado, galería y error.

Revisión 13: ítems, fotos y botones de selección sin movimientos de hover, foco o pulsación. Sombras constantes; foco de teclado accesible conservado.

Revisión 14: el placeholder «Ya viene la foto» usa el ícono custom de galería en listado y galería.

Revisión 15: hover y pulsación MTS restaurados únicamente en el botón de selección. Cards y fotos permanecen fijas.

Revisión 16: título en la columna de la descripción en mobile; foto cuadrada y acciones debajo.

Revisión 17: precios del catálogo con el componente tape badge amarillo.

Revisión 18: Reservado ocupa el lugar y la misma altura del botón ¡LO QUIERO!, fuera de la foto.

Revisión 19: badge Reservado magenta con sombra estándar ink.

Revisión 20: precio más grande, con tipografía fluida de 14 a 16 px.

Revisión 21: badge del precio sin rotación, manteniendo el tamaño ampliado.

Revisión 22: Reservado con bordes tape y esquinas rectas, sin rotación.

Revisión 23: selector de categorías como bottom sheet en mobile, una categoría por fila y paleta sobria.

Revisión 24: selector Categoría sticky debajo del header en mobile.

Revisión 25 · 7/10/2026: cierres unificados con el popup de Entregas; paneles sin overflow hidden, cierres fuera del scroll interior y aviso de selección con cierre accesible. Ver REDISENO.md para validación y límites.

Revisión 26: recuperado el diseño original del menú desktop. El selector mobile conserva el bottom sheet sobrio. Se mantiene el cierre unificado y los paneles sin recortes.

Revisión 27: Ver descripción con icono custom Info, texto cobalt y alineación izquierda sin padding ni margin.

Revisión 28: popup de descripción con la misma animación pop del globito de contacto, compartida y compatible con movimiento reducido.

Revisión 29: precios del minicart con el mismo tape del listado y Quitar con icono y diseño original de MTS.

Revisión 30: Quiero mi catálogo en mayúsculas, texto y emoji centrados, fondo lime.

Revisión 31: ¿Querés una web así? comparte el redondeado de ¡LO QUIERO!.

Revisión 32: menú desktop neutro; fondos blancos, selección amarilla y sombra ink constante.

Revisión 33: precio compacto en el minicart y nombres con la misma tipografía del listado.

Revisión 34: cada item del minicart con el borde superior discontinuo original de MTS.

Revisión 35: minicart con total y WhatsApp fijos, formulario solo con nombre, avisos compactos y toast debajo del encabezado sin cubrir controles. Las miniaturas conservan su espacio al cargar o fallar y reutilizan el icono de galería sobre fondo neutro. Nombres largos con más ancho; estado vacío con acción Ver catálogo. No se incluyen comentarios anteriores en la consulta.

Revisión 36: fondo del selector sticky de categoría con --color-toolbar de MTS.

Revisión 37: meta compacta original de MTS debajo del listado y en el minicart. Meta dinámica en Config!B102 suma todo Catalogo (incluidos vendidos). Recaudado desde TOTAL VENDIDO de Ventas. Selección como proyección separada; cambios de la planilla se leen al recargar. Fórmula y documentación en CONFIG.md. Sin publicación en Netlify.

Revisión 38: en el minicart, meta antes del formulario de nombre.

Revisión 39: en el minicart, meta antes del listado de artículos, al comienzo del cuerpo.

Revisión 40: los ocho cierres usan la misma X SVG con centrado geométrico y visual, conservando el diseño de Entregas.

REVISIÓN 41 · REPO CANÓNICO
Fuente: /Users/brenherrada/Sites/ManifestThatShit/standalone.
Rama del rediseño: feat/redisenio-mts, basada en 37f8d12.
Este proyecto es standalone: HTML/CSS/JS, Sheets y WhatsApp; no usa WooCommerce.
El rediseño de la revisión 40 conserva los cambios recientes de lectura API con respaldo directo, vendidos, reintento, almacenamiento restringido y ResizeObserver opcional. Ventas se consulta por API solo para obtener TOTAL VENDIDO.

BADGE RECIÉN AGREGADO
En Catalogo, columna badge, escribí «Recién agregado» para marcar un producto.
Dejá la celda vacía para quitar la marca; su categoría original se conserva.
El filtro aparece después de Todos, en desktop y en el selector mobile.
URL compartible: /?badge=recien-agregado#catalogo
Una categoría o el badge a la vez: si llegan ambos parámetros, el badge tiene prioridad. Cambiar a una categoría o Todos quita badge. Si no quedan productos marcados disponibles, el enlace muestra el estado vacío. La búsqueda se aplica dentro del filtro seleccionado. La función Edge conserva el título del badge y la imagen general al compartir, cuando se publique.

VISTA PREVIA LOCAL
Con Netlify CLI ya instalado: netlify dev --offline --dir . --port 8765 --no-open
Esto compila y sirve las funciones localmente; no publica el sitio.
QA y respaldos están en output/ y no forman parte de dist.

Fuentes locales: el head precarga los WOFF2 críticos. fonts/font-loading.js se ejecuta con defer y comprueba su carga hasta 2 segundos sin ocultar ni bloquear la página. Si falla la carga, usa tipografía del sistema durante esa visita para evitar cambios tardíos. El catálogo muestra su estado de carga y placeholders mientras consulta datos frescos; no guarda precios ni disponibilidad en el navegador.

Fotos de Drive: optimización automática mediante Netlify Image CDN.
Al reemplazar una foto, subí un archivo nuevo y actualizá su enlace en la Sheet.
No hace falta comprimirla ni copiarla al repositorio. Ver CONFIG.md para tamaños,
recuperación, validación y límites. Reiniciar netlify dev al cambiar netlify.toml.

AUTOMATIZACIÓN DEL CATÁLOGO
- Al activar installCatalogAutomation en Apps Script, los productos nuevos reciben fecha_alta y Recién agregado por 7 días. Los existentes conservan sus estados.
- vendido = TRUE sincroniza disponible = no; desmarcar vendido no republica automáticamente.
- Instalación, recuperación y verificación nativa en CONFIG.md. Prueba local: npm run test:catalog-automation.
