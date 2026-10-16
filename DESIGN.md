# Plot Twist — diseño del catálogo standalone

Documento de referencia del diseño implementado. Relevado contra las fuentes locales el 16 de octubre de 2026. Describe este catálogo; no certifica el estado de un deploy ni reemplaza la revisión visual en navegador.

## Alcance y autoridad

La identidad pública es **Plot Twist · Venta de garage**. El producto permite explorar artículos, armar una selección y consultar por WhatsApp para coordinar disponibilidad, pago y entrega. La selección no constituye una reserva, un pedido confirmado ni un pago.

Este runtime usa HTML, Sass/CSS y JavaScript sin framework. Los datos llegan por `/api/catalog`, con el lector privado directo de Google Sheets descrito en [AGENTS.md](AGENTS.md). WordPress y WooCommerce no gobiernan esta interfaz.

Orden de referencia para trabajar:

1. Instrucciones actuales de Bren y [AGENTS.md](AGENTS.md).
2. Componentes de [index.html](index.html), sus renderers en [app.js](app.js) y [navigation.js](navigation.js), y sus fuentes Sass. El render actual completa la comprobación de la cascada.
3. Este documento como mapa de decisiones y fuentes; actualizarlo cuando cambie una decisión aprobada.
4. [REDISENO.md](REDISENO.md) como historial contextual. Sus fechas, montos, colores anteriores, breakpoints y referencias a ZIP/publicación no describen necesariamente el estado actual.

El [DESIGN.md del theme](../local/theme/manifest-that-shit/DESIGN.md) explica el origen visual, pero no debe copiarse como contrato de este catálogo. Por ejemplo, sus reglas de checkout, precios WooCommerce, personalidades y acciones de compra no se trasladan automáticamente.

## Dirección visual

Lenguaje expresivo heredado de Kinetic Memphis: base clara cálida, puntos de color, contornos ink, sombras sólidas desplazadas, etiquetas tipo cinta, ilustraciones y acentos vivos. La personalidad aparece en los assets y la composición existentes. Los artículos reales, sus fotos, precios y acciones deben seguir siendo legibles y protagonistas del catálogo.

Preservar el logo ilustrado Plot Twist y el cartel «Venta de garage», el hero original, los SVG custom y las imágenes existentes. No reemplazarlos por texto tipográfico, iconos genéricos o ilustraciones nuevas sin autorización. No convertir el catálogo en una grilla genérica de paneles con sombras difusas.

Los degradados actuales del hero, panel de selección y banner promocionado son decisiones concretas de esos componentes. No eliminarlos por una regla estética genérica ni extenderlos a todas las superficies.

## Fuentes editables y distribución

| Fuente | Responsabilidad |
| --- | --- |
| [scss/tokens.scss](scss/tokens.scss) | Colores, fuentes, geometría, espaciado y motion compartidos |
| [scss/styles.scss](scss/styles.scss) | Orden de cascada de los módulos del catálogo |
| [scss/README.md](scss/README.md) | Entradas Sass, salidas generadas y mantenimiento |
| [scss/fonts.scss](scss/fonts.scss) | Declaraciones de fuentes locales |
| [scss/promo.scss](scss/promo.scss) | Invitación al servicio y su popover |
| [scss/no-script.scss](scss/no-script.scss) | Presentación sin JavaScript |
| [scripts/styles.mjs](scripts/styles.mjs) | Compilación de las cinco entradas de producción |
| [scripts/build.mjs](scripts/build.mjs) | Lista de recursos públicos y composición de `site.css` |

Editar Sass; no editar directamente `tokens.css`, `styles.css`, `promo.css`, `fonts/fonts.css` ni `no-script.css`. Tras un cambio de estilos, ejecutar `npm run styles:build` y `npm run styles:check` desde standalone. El build combina las fuentes de CSS en `site.css` para distribución. Este documento no se incluye en el sitio público.

## Paleta real

Valores de `scss/tokens.scss`. Conservar los nombres semánticos aunque su nombre histórico no coincida con una interpretación convencional del color.

| Token | Valor actual | Función de referencia |
| --- | --- | --- |
| `--color-ink`, `--color-border` | `#121212` | Texto, contornos y sombras |
| `--color-cream` | `#fff9e6` | Superficies cálidas |
| `--color-butter` | `hsl(52, 100%, 97%)` | Fondo base y papel |
| `--color-toolbar` | `#f0ede7` | Superficies neutras auxiliares |
| `--color-white` | `#fff` | Cards y controles |
| `--color-yellow` | `yellow` | Precios, etiquetas y selección de categorías |
| `--color-cobalt` | `cornflowerblue` | Foco, puntos y acentos |
| `--color-pink` | `hotpink` | Etiquetas, sombras y feedback |
| `--color-cyan` | `cyan` | Selección de artículos y acentos |
| `--color-lavender` | `#d8b4f8` | Acciones y superficies auxiliares |
| `--color-orange` | `lightsalmon` | Puntos y acentos |
| `--color-peach` | `#ffe5cc` | Estado seleccionado y superficies |
| `--color-sky` | `lightskyblue` | Base del hero |
| `--color-lime` | `#ccff00` | Acentos puntuales |
| `--color-green` | `#38ef7d` | Acción de WhatsApp e invitación de contacto |

La existencia de un token no determina por sí sola el aspecto de un botón. Leer su consumidor y la cascada: `.hero-cta` usa ink/blanco con sombra rosa aunque `--action-primary-fg` sea amarillo; `.select-btn` usa cyan, `.send` usa `--action-purchase-bg` verde y `.web-promo-contact` tiene su regla verde. No homogeneizar estos roles a partir de un único token.

## Tipografía, geometría y ritmo

- **Playpen Sans:** `--font-display` y `--font-action`; titulares, nombres de producto y acciones principales. Los nombres del listado y selección comparten peso 600.
- **Nunito:** `--font-body`; texto general y formularios. El cuerpo parte de 16 px y peso 500.
- **Space Mono:** `--font-mono` y `--font-utility-action`; datos, utilidades y etiquetas. La descripción del hero también usa mono: no asumir que todos los párrafos usan Nunito.
- **Knewave:** excepción localizada del banner LegXercise, mediante `--feature-brush`; no reemplaza la fuente display global.

Mantener las fuentes locales y su carga existente. Las excepciones tipográficas se leen en el componente: el hero actual tiene `letter-spacing: -0.025em`; la prohibición histórica del theme de WordPress no describe esa regla de standalone.

Contorno compartido de 3 px y contorno fuerte de 4 px. Sombras sólidas ink: 1.5, 3, 5 y 9 px según token; feedback de sombra de 2 px. Radios compartidos de 10, 18 y 28 px, con geometrías específicas por componente; no aplicar un radio único a toda la UI. El cierre es circular y las cintas de precio tienen laterales discontinuos y radio cero.

Contenedor máximo de 1280 px. `.shell` usa `min(calc(100% - clamp(24px, 2.78vw, 40px)), var(--container))`. Reutilizar `--space`, `--card-space` y los tokens de espaciado. Todo valor que deba escalar debe tener un único `clamp()` en su fuente legítima, sin sobrescrituras en media/container queries ni shorthands. Esto es una regla de mantenimiento; no una afirmación de que la cascada histórica haya sido auditada por completo.

## Composición y responsive

| Superficie | Implementación que se debe preservar |
| --- | --- |
| Fondo | Butter con capa fija de puntos cobalt/orange, patrón de 32 px; fuente: `scss/layout/_header.scss` |
| Header | Navegación sticky, logo central y controles existentes; mobile reorganiza accesos y búsqueda |
| Hero | Dos columnas de texto e ilustración; pasa a composición vertical hasta 680 px. Mantener los recortes originales por tamaño |
| Listado | Tres columnas sobre 767 px. Hasta 767 px, una lista de cards con imagen a la izquierda, resumen a la derecha y fila inferior de precio/acción |
| Imagen de card | Cuadrada en composición desktop; en mobile usa `--product-image-listing-ratio: 1/1.2`. `--product-image-ratio: 4/5` no equivale al ratio efectivo de todas las imágenes |
| Navegación mobile | Barra inferior fija hasta 767 px, con espacio reservado y safe areas; acciones críticas visibles sin hover |
| Categorías | Menú desktop de dos columnas y presentación mobile de una columna; preservar el comportamiento de `navigation.js` |
| Selección | Panel flotante derecho de hasta 480 px, con margen seguro en los cuatro lados, contorno y esquinas redondeadas; encabezado y acciones separados del scroll interior |
| Meta | Componente compartido entre listado y selección; cambia composición con `@container goal (min-width:701px)` |
| LegXercise | Dos columnas; hasta 600 px reordena texto, producto y acción en una columna |

Hay ajustes adicionales a 540 px y una composición de card en una columna hasta 300 px. El hero también cambia de recurso a 1020 px. Estos límites tienen responsabilidades diferentes: no sustituirlos por un breakpoint global inventado. Revisar antes, en y después del límite del componente afectado.

## Componentes y estados

| Componente | Contrato visual y funcional | Fuente principal |
| --- | --- | --- |
| Card | Fondo blanco, borde ink, sin desplazamiento de card/foto al hover. Foto abre galería; título, descripción, precio y selección mantienen su jerarquía | `scss/catalog/_products.scss`, `app.js` |
| Precio | `.price.mts-badge.mts-badge--tape`, amarillo, laterales discontinuos, sin rotación en precio; variante compacta reutilizada en selección | `scss/components/_actions.scss`, `scss/catalog/_products.scss` |
| Disponible | «¡LO QUIERO!» agrega a selección local | `app.js` |
| Seleccionado | Contorno discontinuo cyan; acción peach «❌ Ya no lo quiero ❌», reversible | `app.js`, `scss/catalog/_products.scss` |
| Reservado | `.card.reserved`: borde double y escala de grises. Estado ocupa el lugar de la acción; no habilitar selección | `scss/catalog/_products.scss`, `app.js` |
| Recién agregado | Asset `images/badge-recien-agregado.webp` y filtro `badge=recien-agregado`; no reemplazar por badge inventado | `app.js` |
| Descripción | «Ver descripción» con SVG custom cuando corresponde; diálogo con encabezado y contenido desplazable | `scss/catalog/_filters.scss`, `scss/overlays/_description.scss` |
| Cierre | `.dismiss-button`, 44 × 44 px, blanco, borde de 3 px, sombra de 3 px, `icons/dismiss.svg` de 20 px y etiqueta accesible propia | `scss/base/_elements.scss` |
| Selección | Nombre y tape compacto; quitar accesible; formulario, estimación y consulta por WhatsApp. No presentar una consulta como venta confirmada | `scss/cart/_drawer.scss`, `app.js` |
| Galería | Imagen, controles, paginación y zoom existentes; preservar navegación y cierre accesibles | `scss/gallery/_lightbox.scss`, `app.js` |
| Meta | Recaudado real separado de la proyección de selección. La meta incluye artículos vendidos; filtrar el listado no redefine el objetivo | `scss/components/_goal.scss`, `app.js` |
| Promoción independiente | Foto original LegXercise, recorte blanco, cintas y manchas locales; contacto separado del catálogo y confirmación de destinatario | `scss/components/_product-feature.scss`, `index.html`, `app.js` |

Preservar estados de carga/skeleton, error con recuperación, búsqueda vacía, selección vacía/poblada, reservado, vendido y ausencia/error de imagen. Reutilizar el placeholder de `scss/catalog/_placeholders.scss` y su renderer, sin crear otra ilustración de reemplazo. No inventar valores de stock, precio, recaudación o entrega para completar una pantalla.

## Interacción, accesibilidad y movimiento

La carga inicial muestra la página sin esperar las fuentes. El bootstrap diferido comprueba sus familias en segundo plano, manteniendo el fallback por visita si fallan. Antes de ejecutar `app.js`, el listado vacío y ocupado reserva espacio para evitar que el banner inferior aparezca y se desplace al insertar las cards de carga. Esa reserva solo aplica a `aria-busy=true` y `:empty`; éxito, error y catálogo vacío recuperan su altura natural. El listado anuncia «Cargando catálogo…», muestra seis skeletons con la misma composición de las cards y avisa si la espera supera seis segundos. No se presentan productos ni disponibilidad de una caché local; éxito, vacío y error sustituyen ese estado con los datos recién consultados o el reintento correspondiente.

Mantener semántica nativa, labels, foco visible, Escape y retorno al disparador en los flujos que correspondan. Los paneles modales deben bloquear el fondo y permitir llegar al último contenido y todas las acciones. Mantener scroll interior y cierres fuera de él; no aplicar `overflow:hidden` al panel exterior para ocultar defectos. El recorte de fotos y decoraciones es otra responsabilidad.

Motion compartido: `--motion-fast:400ms`, `--motion-modal:500ms`, `--motion-category:500ms`; `--ease:cubic-bezier(.2,.8,.2,1)` y `--ease-pop:cubic-bezier(.34,1.56,.64,1)`. Los componentes conservan excepciones explícitas:

- Botones compartidos: desplazamiento y compresión de sombra en hover/foco/presión; no trasladar ese movimiento a cards o fotos.
- Descripción, invitación y minicart: una misma declaración compartida de `popup-pop`, de 360 ms, curva `cubic-bezier(.2,.8,.25,1)`, entrada desde `translateY(14px) scale(.88)` con pequeño rebote. El minicart reutiliza los keyframes originales del modal de descripción; su cierre conserva el fundido.
- Globitos anclados (catálogo, entregas y pagos): transición de opacidad y `translateY(-10px) scale(.97)`, con `--motion-modal` y `--ease`. Es un efecto distinto del modal de descripción y no se aplica al minicart.
- Cartel del logo: oscilación propia; la tira informativa conserva su control de pausa.
- `prefers-reduced-motion`: desactiva animaciones/transiciones y scroll suave; la tira se recompone sin desplazamiento. Mantener información y feedback visibles.

Estas referencias describen fuentes; apertura, reversa, interrupción y recuperación requieren prueba real al modificar el comportamiento.

## Assets y recursos

Logo: `images/plot-twist-desktop.webp` y `plot-twist-mobile.webp`. Hero: familia `mts-hero-*`, con variantes AVIF/WebP y recortes mobile horizontal/tablet/desktop definidos en `index.html`. Banner: `images/legxercise/`. Iconos: carpeta `icons/`, conservando SVG custom y accesibilidad existentes.

Conservar dimensiones, `srcset`, `sizes`, prioridad y lazy loading según el uso real. No ampliar prioridad alta a todo el catálogo ni servir el recurso desktop a todos los tamaños. Las fotos comerciales y sus datos vienen del catálogo; no sustituirlas por los fixtures de demostración.

## Sistema visual y variantes: estado real

[sistema-visual.html](sistema-visual.html) es una referencia local que carga estilos del catálogo y muestra capturas. [sistema-runtime.html](sistema-runtime.html) y [sistema-runtime.js](sistema-runtime.js) contienen la demostración con datos ilustrativos. Las capturas son una instantánea: no se actualizan automáticamente cuando cambia un componente ni prueban interacción.

[sistema-visual-calmo.html](sistema-visual-calmo.html) es un estudio separado con overrides propios. **No es el diseño activo de `index.html` ni un modo de personalidad integrado.** No aplicar sus fuentes, paleta o geometría al catálogo sin una decisión explícita.

En el build inspeccionado, estas páginas, `sistema-visual.css`, `scss/sistema-visual.scss` e `images/system-preview/` no forman parte de la lista pública. El compilador de producción mantiene cinco entradas; no asumir que compila el sistema visual. Mantener clara la diferencia entre referencia local, componente ejecutable y recurso distribuido.

## Mantenimiento y criterio de aceptación

Antes de cambiar una pieza, localizar sus selectores, tokens y consumidores; elegir reutilizar, extender, refactorizar y solo entonces crear. Actualizar este documento cuando cambien decisiones, no para registrar cada ajuste menor. Si el historial contradice la implementación o una instrucción nueva, resolver y registrar la diferencia sin convertirla en un rediseño implícito.

Para una modificación de UI: verificar render desktop/mobile y anchos intermedios afectados, estados reales, texto largo, foco/teclado, touch, safe areas, scroll, carga de recursos, movimiento reducido y recuperación de error cuando corresponda. Contrastar listado, selección y demostraciones si comparten la pieza. Reportar navegador, tamaños, evidencia y pendientes físicos concretos; un build no reemplaza estas pruebas.

Esta incorporación es documental: se contrastaron reglas, valores, assets y distribución con las fuentes locales. No modifica UI, datos, dependencias ni publicación, y no constituye una nueva auditoría visual o funcional del catálogo completo.
