# Estilos del catálogo

Esta carpeta es la fuente editable. Los CSS de la raíz y `fonts/fonts.css` son salidas generadas, versionadas para conservar el servidor local y los consumidores existentes.

## Entradas

| Fuente | Salida | Responsabilidad |
| --- | --- | --- |
| `styles.scss` | `styles.css` | Componentes y composición del catálogo |
| `tokens.scss` | `tokens.css` | Paleta, tipografía, geometría y roles semánticos |
| `fonts.scss` | `fonts/fonts.css` | Fuentes locales; URLs relativas a la salida en `fonts/` |
| `promo.scss` | `promo.css` | Invitación y popover del servicio de catálogo |
| `no-script.scss` | `no-script.css` | Fallback cuando JavaScript está desactivado |

## Organización

`styles.scss` es el índice. Sus módulos usan `@use` y se organizan en `base/`, `catalog/`, `cart/`, `gallery/`, `overlays/`, `layout/`, `navigation/`, `components/` y `responsive/`.

- Indentación de dos espacios; una declaración por línea; secciones con título visible.
- Anidar elementos, modificadores, pseudoestados y descendientes con `&`, conservando los selectores originales y su especificidad. Evitar anidamiento que dependa innecesariamente del HTML.
- Los grupos compartidos permanecen explícitos. No usar `@extend` ni copiar declaraciones para resolver roles compartidos.
- Conservar las variables CSS: las usan tanto JavaScript como las variantes y los estados del sitio.
- Definir cada valor fluido con un único `clamp()` en su fuente. Los breakpoints cambian composición o comportamiento.
- El índice conserva el orden de cascada aprobado, incluidas reglas compartidas que afectan varios componentes. Reordenar módulos requiere comprobar todos sus consumidores.

## Trabajo diario

1. Instalar las dependencias con `npm ci`.
2. Mantener el servidor local existente y ejecutar `npm run styles:watch` en otra terminal.
3. Editar los archivos `.scss`, guardar y recargar localhost.
4. Ejecutar `npm run styles:check` antes de entregar o commitear.

`npm run styles:build` compila las cinco entradas. Si una contiene un error, no reemplaza ningún CSS y el watcher sigue escuchando para recuperarse al corregirlo. Escribe solo salidas que cambiaron.

`npm run test:styles` verifica compilación, detección de CSS desactualizado, preservación de las salidas cuando Sass falla y recuperación automática del watcher, en una copia temporal aislada.

`npm run build` compila primero y conserva el bundle público `site.css` del catálogo, comprimido para producción. `dist` excluye SCSS, herramientas de desarrollo, backups y documentación.

## Migración

La migración preserva los valores y el orden de las reglas del CSS existente; no es un rediseño ni una afirmación de conformidad global. Hay reglas históricas compartidas y ajustes responsive previos que requieren una auditoría separada antes de consolidar la cascada. No agregar nuevas excepciones ni sobrescrituras fluidas.

La presentación del sistema visual queda pendiente y fuera del build del catálogo. `sistema-visual.scss` se conserva localmente y no forma parte de esta entrega.
