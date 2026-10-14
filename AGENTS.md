# Standalone — fuente y alcance

Por instrucción explícita de Bren del 7/10/2026, este repo es la única fuente activa del catálogo standalone. Las instrucciones del AGENTS.md padre que describen WordPress, WooCommerce, Docker o theme.css generado no aplican a este runtime. No modificar el theme de WooCommerce para resolver tareas de este proyecto.

- Stack: HTML, CSS y JavaScript sin framework; Google Sheets pública; selección local y consultas por WhatsApp. Netlify sirve estáticos, /api/catalog y las vistas previas sociales de filtros.
- Leer y aplicar ../../standards/UX-UI-STANDARD.md, ENGINEERING-DELIVERY-STANDARD.md, SECURITY-DATA-STANDARD.md y adapters/html-css.md.
- Fuente visual: rediseño aprobado de este chat (REDISENO.md), tokens.css, componentes reales y assets custom; el theme MTS es referencia de lectura, no runtime ni destino de cambios.
- Sass es la fuente editable: scss/styles.scss organiza los módulos de catálogo; scss/tokens.scss, promo.scss, fonts.scss, y no-script.scss mantienen sus entradas. styles.css, tokens.css, promo.css, fonts/fonts.css, y no-script.css son generados y NO se editan directamente. Ejecutar npm run styles:build / styles:watch; npm run styles:check verifica sincronización. npm run build compila Sass antes de preparar dist. Mantener orden de cascada, selectores, tokens CSS y contratos existentes de Netlify/Sheets; no hay bundler de JavaScript.
- Trabajar desde la raíz de este repo, comprobar rama/diff antes de editar y preservar cambios ajenos. Implementar no autoriza commit, push ni despliegue.
- Mantener badge=recien-agregado, categoria, búsqueda, historial, selección, reservados, vendidos, galería, carga/error/reintento y meta dinámica. Meta suma todo Catalogo, incluidos vendidos; recaudado solo TOTAL VENDIDO de Ventas. No retornar detalles de ventas desde la API.
- Reutilizar componentes y tokens. Un único clamp en la fuente para cada valor fluido, sin overrides en breakpoints. Cards y fotos no se desplazan con hover; los botones conservan feedback aprobado.
- Revisar render desktop/mobile, teclado, cierres, foco, overflow, sticky, red y movimiento reducido. Todos los cierres usan dismiss-button e icons/dismiss.svg. Panels exteriores sin overflow hidden; scroll interior cuando corresponda.
- Push y producción: aplicar la puerta obligatoria de la sección 15 de ../../standards/ENGINEERING-DELIVERY-STANDARD.md. Un push que publique incluye seguir el deploy del SHA esperado y verificar el recorrido real en la URL pública, con persistencia comprobada cuando corresponda. Para la lista de espera, ejecutar `npm run waitlist:preflight` con el proyecto explícito y completar la prueba pública y lectura de Google Sheets descritas en integrations/waitlist/README.md. El agente se hace cargo de esos pasos antes de cerrar la entrega.
- Evidencia en output/qa/; backups en output/backups/. No incluir output, .git, node_modules, secretos o archivos históricos en dist. No se entrega ZIP.
- Registrar navegador, tamaños y limitaciones concretas; no declarar conformidad global ni validación física a partir de capturas o tests.

- Higiene solicitada por Bren: no acumular capturas, propuestas ni reportes generados de QA. Usar `npm run clean:qa` al terminar su revisión y antes de un nuevo ciclo; conservar tests y backups. No dejar artefactos temporales en la raíz.
