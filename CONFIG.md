> Estado: las claves nuevas están guardadas en Config, pero su conexión con la interfaz está pendiente por decisión de Bren. La versión para publicar conserva el comportamiento anterior.

# Configuración desde la planilla

La pestaña **Config** usa A = clave, B = valor. Editá la columna B; no cambies las claves.
Los productos y fotos de productos siguen en **Catalogo**.

- Cambiá entrega_titulo y entrega_texto para adaptar la ciudad y las condiciones.
- En los campos *_mostrar escribí si o no.
- Las imágenes admiten rutas del paquete o links HTTPS públicos; para Drive, pegá el enlace completo. No se ejecuta HTML dentro de los textos.
- whatsapp es el contacto del vendedor; promo_whatsapp es el de la diseñadora. Son independientes.
- Las variables entre llaves (por ejemplo {cantidad}, {producto}, {nombre}) se completan automáticamente. Conservá las variables si las necesitás en el mensaje.
- titulo_linea_1 y titulo_linea_2 son opcionales; vacías = división automática del título.
- Cambios de Config se leen al abrir/recargar el sitio. No hace falta publicar el código de nuevo para los contenidos visibles.
- Si Config falla, la web muestra un error y detiene la carga del catálogo para no ofrecer consultas con datos de otra persona.
- El diseño, layout, breakpoint de 640 px y contratos del catálogo siguen en el paquete. Sheet ID y nombres de pestañas se conectan una vez en config.js al entregar a otro cliente.
- Las etiquetas sociales y favicons del HTML distribuido todavía requieren actualizar el paquete/publicar: los scrapers no dependen del contenido que carga JavaScript. No se promete que el preview de WhatsApp cambie al editar una celda.

## Claves

| Clave | Cómo se usa |
|---|---|
| titulo | Nombre del sitio; también se usa en la pestaña del navegador. |
| intro | Introducción del hero. |
| nota_reserva | Aviso debajo del hero. |
| whatsapp | Número de consultas por productos, con país y área; sin + ni espacios. |
| actualizado | Fecha fija de la última edición, escrita por `scripts/catalog-updated.gs`. No usar `NOW()`/`AHORA()`. |
| titulo_linea_1 | Opcional: primera parte del título. Vacío = separación automática del título. |
| titulo_linea_2 | Opcional: parte destacada del título. |
| moneda | Código de moneda, por ejemplo ARS, USD o EUR. |
| idioma_formato | Formato de números y fechas; por ejemplo es-AR, es-ES o en-US. |
| entrega_mostrar | si/no: mostrar el bloque de entrega local. |
| entrega_titulo | Título del bloque local; cambiá la ciudad aquí. |
| entrega_texto | Condiciones de entrega, retiro y envío. |
| entrega_icono | Símbolo o emoji del bloque de entrega. |
| hero_boton | Acción del hero. |
| hero_imagen | URL HTTPS de imagen pública (Drive también), o ruta relativa dentro del paquete. |
| hero_imagen_mostrar | si/no: mostrar imagen del hero en desktop; en <=640 px sigue oculta. |
| catalogo_titulo | Título del listado. |
| actualizado_etiqueta | Etiqueta de la fecha. |
| busqueda_placeholder | Placeholder de búsqueda. |
| categoria_etiqueta | Etiqueta del filtro móvil. |
| categoria_todos | Texto del filtro sin categoría. |
| categorias_titulo | Título del panel de categorías. |
| categorias_eyebrow | Texto pequeño del panel de categorías. |
| orden_categorias | Orden opcional de categorías, separadas por \|; las nuevas aparecen al final. |
| seleccion_titulo | Título del panel. |
| seleccion_etiqueta | Etiqueta accesible del carrito. |
| seleccion_icono | Emoji del carrito y del aviso de agregado. |
| seleccion_vacia | Mensaje con selección vacía. |
| seleccion_quitar | Acción de quitar. |
| seleccion_total | Etiqueta del total. |
| nombre_etiqueta | Etiqueta del nombre. |
| nombre_placeholder | Ejemplo del nombre. |
| nombre_error | Validación del nombre. |
| mensaje_etiqueta | Etiqueta del comentario. |
| mensaje_placeholder | Ejemplo del comentario. |
| consulta_boton | Botón principal. |
| consulta_ayuda | Ayuda debajo de la consulta. |
| producto_elegir | Botón de producto disponible. |
| producto_elegido | Botón de producto elegido. |
| producto_reservado | Etiqueta y botón de artículo reservado. |
| producto_descripcion | Botón de descripción. |
| producto_foto | Botón de una foto. |
| producto_fotos | Botón de varias fotos. Conservá {cantidad}. |
| producto_sin_foto | Placeholder de foto; conservá {producto}. |
| contador_singular | Contador del listado. |
| contador_plural | Contador del listado. |
| contador_disponible_singular | Contador del hero. |
| contador_disponible_plural | Contador del hero. |
| contador_filtrado | Contador al filtrar. |
| estado_cargando | Carga del listado. |
| estado_vacio | Catálogo vacío. |
| estado_sin_resultados | Búsqueda sin resultados. |
| estado_error_catalogo | Error al cargar productos. |
| estado_error_config | Error al cargar Config; se detiene el catálogo para no mostrar datos de otro vendedor. |
| estado_error_contacto | Contacto faltante o inválido. |
| aviso_agregado | Aviso de agregado. |
| aviso_quitado | Aviso de quitado. |
| aviso_reservado | Aviso para producto reservado. |
| aviso_sin_seleccion | Aviso al consultar sin artículos. |
| whatsapp_saludo | Primera línea de la consulta de productos. |
| whatsapp_presentacion | Presentación; conservá {nombre}. |
| whatsapp_lista | Introducción de la lista de productos. |
| whatsapp_comentario | Etiqueta de comentario; conservá {mensaje}. |
| whatsapp_cierre | Última línea de consulta. |
| promo_mostrar | si/no: mostrar la invitación de diseñadora web. |
| promo_trigger_linea_1 | Primera línea del botón; usar texto breve. |
| promo_trigger_linea_2 | Segunda línea del botón; usar texto breve. |
| promo_titulo | Título del globito. |
| promo_texto | Texto del servicio. |
| promo_boton | Acción del servicio. |
| promo_whatsapp | Contacto de la diseñadora; independiente del WhatsApp del vendedor. |
| promo_mensaje | Mensaje de consulta por una web. |
| promo_avatar | Imagen del botón: URL HTTPS pública o ruta del paquete. |
| promo_ilustracion | Ilustración del globito: URL HTTPS pública o ruta del paquete. |
| galeria_cargando | Carga de imágenes. |
| galeria_no_disponible | Error de imagen. |
| accesible_buscar | Nombre accesible de búsqueda. |
| accesible_limpiar | Nombre accesible de limpiar búsqueda. |
| accesible_filtros | Nombre del grupo de filtros. |
| accesible_categorias | Nombre accesible del listado de categorías. |
| accesible_filtrar | Nombre de los filtros de desktop. |
| accesible_cerrar_seleccion | Nombre del cierre del panel. |
| accesible_abrir_seleccion | Nombre del carrito. |
| accesible_cerrar_promo | Nombre del cierre del globito. |
| accesible_cerrar_categoria | Nombre del cierre de categorías. |
| accesible_cerrar_descripcion | Nombre del cierre de descripción. |
| accesible_galeria | Nombre del visor. |
| accesible_cerrar_galeria | Nombre del cierre del visor. |
| accesible_foto_anterior | Nombre del control anterior. |
| accesible_foto_siguiente | Nombre del control siguiente. |
| accesible_zoom | Nombre del grupo de zoom. |
| accesible_alejar | Nombre de alejar. |
| accesible_acercar | Nombre de acercar. |
| accesible_restaurar_zoom | Nombre de restaurar zoom. |
| accesible_abrir_galeria | Nombre de abrir imagen. |
| accesible_descripcion | Nombre de abrir descripción. |
| accesible_agregar | Nombre de agregar. |
| accesible_quitar | Nombre de quitar. |
| accesible_reservado | Nombre de producto reservado. |
| accesible_actualizado | Nombre de fecha. |

## Meta dinámica · conectada en revisión 37

Config!A102 contiene `meta_total` y B102 la fórmula:

```
=TEXT(SUMIF(Catalogo!B2:B,"<>",Catalogo!D2:D),"0")
```

Suma todos los artículos con título, incluidos vendidos. No reemplaces la fórmula por un monto fijo. TEXT devuelve dígitos sin separadores para que la lectura pública de Config conserve el valor; la web lo presenta en ARS. Los precios deben seguir siendo números en Catalogo!D.

Lo recaudado proviene de la fila **TOTAL VENDIDO** en **Ventas** (actualmente B3), cuyo cálculo existente depende del checkbox vendido en Catalogo. No cambies ese rótulo. `SALES_SHEET` en config.js define el nombre de la pestaña. Al editar productos o vendido, la planilla recalcula; el visitante obtiene los datos nuevos al recargar el sitio.

El listado y el minicart comparten el mismo estado. La selección solo muestra cuánto sumaría; no registra una venta. Si Ventas falla, se muestra — y una indicación para recargar, conservando el catálogo. Si falta meta_total, tiene un error o es cero, los bloques se ocultan. No se usa una meta de respaldo inventada.

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
