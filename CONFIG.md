# Configuración desde la planilla

La pestaña **Config** usa A = clave, B = valor. Editá la columna B; no cambies las claves.
Los productos y sus fotos se mantienen en **Catalogo**.

## Reservas desde la planilla

`Catalogo!K` es la columna **reservado**, con casillas nativas independientes de `disponible` y `vendido`.

- Marcar la casilla mantiene el artículo visible como **Reservado**, sin botón de selección. Al recargar, también se retira de una selección guardada anteriormente.
- Desmarcarla permite seleccionarlo otra vez, siempre que `disponible = si` y `vendido` esté desmarcado. Vendido o no disponible tiene prioridad y oculta el artículo.
- El título no determina el estado cuando hay una casilla con valor TRUE/FALSE. Podés quitar la palabra «RESERVADO» del título y dejar solamente el nombre del producto.
- Los datos se actualizan al recargar; no hay sincronización instantánea con una página que ya esté abierta. Seleccionar en la web no marca una reserva en la Sheet: esa confirmación sigue siendo manual.
- Para filas nuevas, la validación de casillas cubre K2:K1003. Una celda todavía vacía conserva la compatibilidad con los títulos antiguos; el primer marcado/desmarcado guarda el estado explícito.

Migración del 13/10/2026: se agregó K sin mover A:J, se inicializaron las 92 filas existentes y se trasladaron 16 marcas de reserva de los títulos a las casillas. Títulos, disponibilidad y vendido se conservaron. La API y la lectura alternativa consultan A:I y K; no se sirve `fecha_alta` de J. Fuentes implementadas y probadas localmente; activación en la web pública pendiente de publicar esta versión.

## Configuraciones activas

| Clave | Uso real |
| --- | --- |
| titulo | Título de la pestaña del navegador. No cambia el título visual del hero ni las etiquetas sociales del HTML. |
| intro | Descripción del hero. |
| nota_reserva | Aviso de reserva en la tira marquee. |
| whatsapp | Contacto del vendedor para consultas: país y área, sin + ni espacios. |
| actualizado | Fecha fija de última edición, escrita por `scripts/catalog-updated.gs`. No usar `NOW()`/`AHORA()`. |
| meta_total | Fórmula dinámica que suma todo Catalogo, incluidos los artículos vendidos. |
| mp_comision_inmediata | Porcentaje SIN IVA por cobrar un Link de pago con disponibilidad inmediata. |
| mp_comision_3_cuotas | Porcentaje adicional SIN IVA por ofrecer 3 cuotas. |
| mp_iva | Porcentaje de IVA sobre ambas comisiones. |

Los valores se leen al abrir o recargar la web. Si Config no carga, el runtime conserva los valores de respaldo; las consultas necesitan un WhatsApp válido y la meta se oculta si falta su valor. El diseño, imágenes, moneda, formato de números, textos de botones, mensajes y etiquetas accesibles se mantienen en el código, no en Config.

El 10/10/2026 se eliminaron las 95 claves sin consumidores del runtime actual (antes filas 7–101). Quedaron seis configuraciones; el 12/10 se sumaron las tres tasas para estimar el pago con tarjeta. Respaldo local en `output/backups/config-cleanup-20261010/`. El script de actualización encuentra su fila por clave, por lo que la limpieza no requiere modificarlo.

## Estimación de tarjeta en 3 cuotas

Config!A8:B10 contiene `mp_comision_inmediata = 6.60`, `mp_comision_3_cuotas = 10.49` y `mp_iva = 21`. Valores comprobados en el simulador de la cuenta el 12/10/2026, para Link de pago con disponibilidad inmediata. Editar B al cambiar las tarifas; 6.60 significa 6,60%, no 0.066. No usar formato porcentual. La web acepta punto o coma decimal y lee Config al cargar o recargar, sin recompilar ni publicar código.

La comisión de cobro con IVA se redondea a dos decimales porcentuales, como en la simulación observada de la cuenta (6.60 × 1.21 → 7.99%). Se suma la financiación con IVA (10.49 × 1.21 → 12.6929%). El total financiado se calcula como `total de artículos / (1 − deducción total / 100)`, redondeando hacia arriba al centavo. No se aplica un recargo fijo ni se suman simplemente las comisiones al precio. Para un total de $100.000 devuelve $126.076,22 y cuotas aproximadas de $42.025,41, coincidiendo con la simulación de referencia.

La estimación se muestra debajo del total del minicart con el SVG custom de tarjeta; selección, eliminación y Config tardía la actualizan. No incluye retenciones fiscales, no crea links ni cobra: el importe final se coordina por WhatsApp. Total de artículos, progreso de la meta y mensaje de consulta conservan el importe base. Si una tasa falta, no es numérica, es negativa o la deducción alcanza el 100%, la estimación se oculta; no hay tarifas de respaldo que puedan quedar desactualizadas.

## Meta dinámica

`meta_total` queda en Config!A7 y su fórmula en B7:

```
=TEXT(SUMIF(Catalogo!B2:B,"<>",Catalogo!D2:D),"0")
```

Suma todos los artículos con título, incluidos vendidos. No reemplaces la fórmula por un monto fijo. TEXT devuelve dígitos sin separadores para la lectura pública de Config. Los precios deben seguir siendo números en Catalogo!D. El runtime busca la clave `meta_total`; no depende de que esté en una fila determinada.

Lo recaudado proviene de **TOTAL VENDIDO** en **Ventas**, cuyo cálculo depende de los checkboxes vendido en Catalogo. No cambies ese rótulo. `SALES_SHEET` en config.js define la pestaña. El porcentaje mostrado se calcula con ambos valores; el sitio no registra ventas al seleccionar artículos.

Listado y minicart comparten el estado de progreso. Si Ventas falla, conservan el catálogo y muestran una indicación para recargar. Si meta_total falta, es inválido o es cero, los bloques se ocultan. No hay una meta de respaldo inventada.

## Optimización automática de fotos de Drive

Las URLs de `imagenes` siguen siendo enlaces públicos de Drive separados por `|`. No hace falta comprimir ni subir fotos al repositorio. Para reemplazar una foto, subir un archivo nuevo y cambiar su enlace en la Sheet (criterio confirmado por Bren el 8/10/2026). El nuevo ID produce otra URL de CDN; no se promete actualización inmediata de un archivo reemplazado conservando su ID.

- Carrito: `srcset` de 64/128/192 px para miniaturas de 64 px y densidades 1×/2×/3×.
- Listado: 300/450/600/900/1200 px con `sizes` responsivo y carga cerca del viewport.
- Galería: derivado de hasta 1600 px de ancho, reservado a la vista ampliada y su precarga adyacente; conserva el detalle del zoom existente.
- Netlify transforma un único derivado Google `w1600` a WebP, calidad 85, sin recorte (`fit=contain`). CSS conserva los recortes aprobados del listado/carrito.
- Recuperación: Netlify → derivado Google al tamaño seleccionado → thumbnail Google → placeholder. Los proveedores fallidos no se reintentan con otros tamaños. Nunca se solicita el archivo original de Drive.
- La allowlist en `netlify.toml` admite únicamente `https://lh3.googleusercontent.com/d/ID=w1600`. No admite hosts ni rutas arbitrarios. Los enlaces externos (por ejemplo Mercado Libre) conservan su comportamiento anterior y no pasan por el CDN.
- Sin timestamps aleatorios ni regeneración de URLs en cada visita. El contenido y las dimensiones forman la clave estable. Google/Netlify controlan sus cachés; los headers del sitio no fijan el TTL de una fuente remota.

Desarrollo: usar `netlify dev`; reiniciarlo tras modificar `[images]`. Un servidor estático simple no tiene `/.netlify/images`, pero el fallback permite seguir viendo las fotos. Pruebas del artefacto: `QA_ARTIFACT=dist QA_PORT=8768 QA_UPSTREAM_PORT=8770 node tests/serve-https.mjs` con Netlify dev escuchando en 8770. `tests/image-cdn.mjs` requiere Playwright existente y ese adaptador; no publica nada.

Validación pendiente antes de producción: comportamiento real de CDN/cache/latencia y consumo en un deploy autorizado, además de dispositivos físicos. El emulador prueba las transformaciones y el flujo, no la caché de borde. La cuenta consultada es Personal (1000 créditos/ciclo); no se verificó saldo actual. Bandwidth y requests consumen créditos compartidos con el resto de la cuenta. No se modificó plan ni facturación.

Documentación oficial: https://docs.netlify.com/build/image-cdn/overview/ y https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/.

## Fecha real de actualización

El script vinculado `scripts/catalog-updated.gs` registra las ediciones manuales de valores en Catalogo, Config y Ventas, incluyendo pegados y borrado de contenido. Abrir la web o recalcular fórmulas no modifica la fecha. Los cambios por API/otros scripts no disparan `onEdit`: esas integraciones deben escribir también Config.actualizado. Cambios exclusivamente estructurales o de formato tampoco disparan este handler. La hora usa la zona horaria de la Sheet.


## Automatización de altas y disponibilidad

Fuente: `scripts/catalog-updated.gs`, instalada en el proyecto Apps Script vinculado a esta planilla. `scripts/catalog-automation-qa.gs` contiene una verificación nativa que crea y elimina una pestaña temporal, sin escribir productos en Catalogo.

- Ejecutar `installCatalogAutomation` una vez desde el editor de Apps Script. Requiere autorizar acceso a la planilla actual y creación de un disparador. La función agrega `fecha_alta` después de las columnas existentes, registra los IDs actuales como anteriores a la automatización y programa una limpieza diaria entre las 03 y 04 h de Argentina. Repetir la instalación no duplica el disparador ni modifica las fechas o estados existentes.
- Para un producto nuevo, usar una fila nueva y un **ID único y estable**. Al completar `id`, `titulo` y un precio numérico mayor que cero, estando disponible y no vendido, el script registra su fecha de alta y coloca `Recién agregado` si el badge está vacío. Fotos y descripción pueden completarse después. Los artículos sin fotos siguen admitidos por el catálogo.
- Editar el producto no reinicia la fecha. No copiar `fecha_alta` de otro producto ni cambiar un ID existente para reutilizarlo. La identidad y el alta se conservan en las propiedades del documento; la columna muestra la fecha, pero editarla no cambia esa identidad.
- El badge automático vence al cumplirse 7 días. Se quita en la siguiente revisión diaria, o antes si se edita el producto después del vencimiento. La limpieza solo retira `Recién agregado`; conserva otros badges y la fecha de alta.
- Los badges manuales que existían antes de la instalación se conservan sin inventar una fecha original ni un vencimiento. Quitar manualmente un badge automático no provoca que vuelva al editar el artículo.
- Marcar `vendido` pone `disponible = no` en esa fila, incluyendo pegados de varias filas. Desmarcarlo **no** vuelve a publicar el producto: hay que poner disponible en si explícitamente. La web conserva además su filtro de vendido.
- Los artículos existentes no cambian durante la instalación. La sincronización de disponibilidad se aplica al editar sus filas en adelante.

### Consumo, errores y recuperación

`onEdit` solo procesa las filas editadas; lee los IDs para evitar marcar duplicados y escribe cambios por lotes. La revisión diaria hace una lectura acotada a las filas usadas y no actualiza Config.actualizado si no retiró ningún badge. La web continúa leyendo Sheets a través del flujo existente; sus visitas no ejecutan este script. No hay correos, consultas a Drive, nuevas dependencias ni nuevas claves de Config.

Las ejecuciones usan un bloqueo del documento para evitar colisiones entre scripts. Una escritura interrumpida conserva un alta pendiente: repetir la edición repara fecha/badge sin reiniciar el tiempo. Un bloqueo agotado o permisos insuficientes se registra como fallo; volver a editar la fila permite reintentar. Apps Script solo encola dos eventos onEdit: para cargas grandes, pegar varias filas juntas en vez de hacer muchas ediciones simultáneas. Los cambios por API u otros scripts deben invocar la misma lógica explícitamente; no disparan onEdit.

Prueba local: `npm run test:catalog-automation` (dobles controlados de los servicios). Prueba nativa: ejecutar `verifyCatalogAutomation` en Apps Script; el log debe indicar PASS y la pestaña temporal debe desaparecer. Reversión: restaurar el script anterior desde `output/backups/catalog-automation-20261010/installed-before.gs` y eliminar únicamente el disparador `expireCatalogBadges`; conservar la columna de fecha y propiedades evita perder historial. Nunca borrar las propiedades de todo el proyecto para reiniciar una instalación.

Activación verificada el 10/10/2026 en el proyecto vinculado «Plot Twist · fecha del catálogo»: autorización concedida, código guardado comparado con la fuente local, prueba nativa PASS e instalación ejecutada dos veces sin duplicar el disparador. La pantalla de disparadores confirmó una sola tarea `expireCatalogBadges`, diaria de 03 a 04 h, GMT-03:00. La lectura posterior de la Sheet confirmó `fecha_alta` en J y los 86 productos previos sin cambios en A:I ni fechas inventadas. La pestaña temporal de QA fue eliminada.

La prueba nativa verificó altas, fechas, pegados, vendidos, reversa y vencimiento contra servicios reales de Sheets en una pestaña aislada. La limpieza se ejecutó manualmente sobre el catálogo actual: retiró cero badges y conservó tanto A:J como Config, incluida su fecha de actualización. El despacho de `onEdit`, recuperación de escrituras parciales y reinstalación con altas pendientes tienen pruebas locales. No se insertaron productos ficticios en el catálogo publicado: queda observar la primera alta manual real y la primera ejecución programada nocturna en el historial de Apps Script. Cuotas oficiales: https://developers.google.com/apps-script/guides/services/quotas. Disparadores: https://developers.google.com/apps-script/guides/triggers.
