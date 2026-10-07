VENTA POR MUDANZA · NETLIFY

Mantenimiento cotidiano:
1. Editá la Google Sheet “Catálogo · Venta por mudanza”.
2. En Catalogo:
   - disponible = si → aparece
   - disponible = no → se oculta automáticamente
   - vendido = TRUE → se oculta aunque disponible siga en si
   - imagenes → podés pegar links de Google Drive o cualquier URL HTTPS directa de imagen.
   - varias imágenes → separalas con |
   - categoria → elegí una opción del dropdown; la web crea los filtros automáticamente.
3. Config conserva la conexión existente para título, introducción, nota de reserva, WhatsApp y actualización. Las claves nuevas ya están cargadas en la planilla, pero todavía no están vinculadas a la interfaz.

IMPORTANTE
- La Google Sheet debe ser pública en lectura. Las imágenes de Drive deben poder ser leídas por “Cualquier persona con el enlace”. Las URLs externas deben permitir carga pública/hotlink.
- No pongas datos privados, contraseñas, documentos ni información sensible en esas fuentes.
- El sitio incluye una función de Netlify que consulta la planilla pública. La selección, el nombre y el comentario opcional se guardan localmente en el navegador del visitante hasta que abre WhatsApp.
- El archivo _headers agrega políticas de seguridad compatibles con Netlify.

PUBLICACIÓN
Desplegá esta carpeta con Netlify CLI (netlify deploy --build --prod) o un repositorio conectado para incluir netlify/functions/catalog.mts. netlify.toml configura la raíz como directorio de publicación. El drag-and-drop solo publica los estáticos y utiliza la consulta directa de respaldo; no compila la función /api/catalog.

IMÁGENES EN GOOGLE DRIVE
- En la columna "imagenes" pegá la URL completa que obtenés con Drive > Compartir > Copiar enlace.
- No alcanza con escribir solo el nombre del archivo (por ejemplo IMG_0318.jpg).
- Para varias imágenes, separá las URLs con |.
- En desktop, el catálogo usa una grilla responsive de dos columnas; en tablet y mobile pasa a una columna compacta.
- En mobile, cada producto conserva una miniatura lateral para reducir el scroll. Las portadas de libros se muestran completas dentro de su marco.
- En mobile, las categorías se eligen desde un selector que abre un panel inferior. En desktop, todas las categorías se muestran en hasta dos líneas.
- Los artículos cuyo título contiene “RESERVADO/RESERVADAS” siguen visibles, pero no pueden agregarse a la selección.

OPTIMIZACIÓN DE IMÁGENES
- Para imágenes de Google Drive, la web NO descarga el archivo original pesado.
- Listado: solicita automáticamente una versión reducida (aprox. 900 px).
- Galería fullscreen: solicita una versión optimizada de hasta aprox. 1600 px.
- Si Google no puede servir el derivado optimizado, se muestra un fallback visual; no se descarga el original.
- Pegá en la Sheet el link de Drive como texto plano, no como chip/pill.


IMÁGENES EXTERNAS HTTPS
- También podés pegar URLs HTTPS directas de imágenes alojadas fuera de Drive.
- Drive se sigue sirviendo mediante derivados redimensionados, nunca el original pesado.
- Para hosts externos, la web usa la URL tal cual; si ese servidor bloquea hotlinking, aparecerá el fallback visual.


La imagen social está en images/venta-por-mudanza-share.jpg y se usa SOLO para Open Graph/Twitter/WhatsApp al compartir el link.
El hero del sitio usa images/hero-illustration.webp, sin texto dentro de la imagen; el título y la descripción son HTML responsive.
