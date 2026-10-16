# Preview de lectura directa — 16/10/2026

Registro histórico de la etapa sintética. Bren autorizó posteriormente separar Pendientes y completar la migración hasta producción; los gates con datos reales y el estado actual están en [PRODUCTION-VERIFICATION.md](PRODUCTION-VERIFICATION.md).

Resultado: integración real Netlify → Google Sheets verificada con datos sintéticos. Esta etapa está completada; no autoriza migrar datos reales ni publicar en producción.

- [Preview verificado](https://6ad230b987955831f386cee3--ventasbrenda.netlify.app).
- [Planilla privada de prueba](https://docs.google.com/spreadsheets/d/1l9o08tGSlAVuG2BSGa9fU5PS00wTDaE17UvSynz1bJQ/edit): 94 productos ficticios, 86 disponibles, Config y agregado de ventas. No contiene datos de clientes. Las fotos ausentes son intencionales.
- Deploy `6ad230b987955831f386cee3`, contexto `deploy-preview`, ready, `published_at: null`, Functions Node 24. La URL del preview es accesible por enlace; la planilla requiere autorización. Netlify entrega `X-Robots-Tag: noindex`.
- Copia de los cambios sin commit de `codex/catalogo-mejoras-y-migracion`, base `d29fb5986526bbe263283a2ffc82bca5a87374fa`. Netlify etiqueta `branch: main` por la configuración del sitio y `commit_ref: null`; no representa un push a main. La procedencia efectiva queda en `output/qa/catalog-migration/candidate-manifest.json` (204 archivos y hashes).
- Producción siguió en `6ad174c760716e72a684808b`, commit `d29fb5986526bbe263283a2ffc82bca5a87374fa`. No se hizo commit, push, cambio de DNS ni publicación productiva.

## Mediciones del candidato verificado

20 ciclos con los tres recursos, espaciados 4,2 segundos después de completar cada grupo. 60 respuestas 200 con igualdad exacta al fixture y `Cache-Control: no-store`. Duración de extremo a extremo desde esta máquina, incluida la red. La primera solicitud no acredita por sí sola un arranque frío de infraestructura.

| Recurso | Primera | Mediana | p95 de la muestra | Máximo | Fallas |
| --- | ---: | ---: | ---: | ---: | ---: |
| Catalogo | 1.420 ms | 538,5 ms | 983 ms | 1.420 ms | 0/20 |
| Config | 1.187 ms | 527 ms | 1.007 ms | 1.187 ms | 0/20 |
| Ventas | 1.016 ms | 855,5 ms | 1.124 ms | 1.136 ms | 0/20 |

Logs de Netlify confirman `source: direct`, lecturas reales de Sheets y reutilización del token (`auth_ms: 0` en lecturas posteriores). Se cambió solo `Catalogo!D2` de la planilla sintética de 10.000 a 12.345: la siguiente lectura devolvió 12.345. Se restauró a 10.000 y se verificó la siguiente lectura, sin redeploy ni caché de productos.

No se calcula una mejora porcentual frente a producción: son archivos y contenidos diferentes. Esta muestra acotada tampoco certifica p95 productivo, tráfico concurrente, renovación real después de una hora ni comportamiento del Image CDN.

## Seguridad y recorrido real

- Cuenta nueva `catalog-preview-reader@plot-twist-catalog.iam.gserviceaccount.com`, creada sin roles de proyecto. Solo owner y este reader figuran en los permisos de la planilla de prueba.
- OAuth de Sheets de solo lectura. Google devolvió 403 para escritura, lectura anónima de la planilla de prueba y lectura de ambos archivos reales (catálogo y lista de espera). No se copiaron sus registros ni se reutilizaron claves existentes.
- `CATALOG_SOURCE`, `CATALOG_SPREADSHEET_ID` y `CATALOG_GOOGLE_CREDENTIALS` solo tienen valor en `deploy-preview`. Clave marcada secreta, scopes Builds/Functions/Runtime según el plan autorizado. Producción, dev y branch-deploy no recibieron esa credencial.
- Las respuestas excluyen columnas privadas, la clave sintética privada de Config y las filas de Ventas salvo `TOTAL VENDIDO`. Parámetros arbitrarios/duplicados y Pendientes rechazados con 400/404.
- POST real del preview a waitlist devolvió `403 registration_disabled`, incluso intentando falsificar el contexto con un header. No hubo alta ni mensaje a una persona.
- Se revisaron los 84 archivos públicos y los dos ZIP de funciones: ningún material de la clave real quedó incrustado. App/config/waitlist/navigation/CSS servidos coinciden byte por byte con el candidato. Rutas `.env`, módulos privados y documentación devuelven 404; CSP conservada.
- Copia temporal de la clave eliminada tras verificar custodia e integración. La clave activa queda en Netlify para este preview. Retirar el valor del contexto no revoca credenciales ya capturadas por deploys anteriores: al finalizar la prueba, revocar la clave de esta cuenta en Google y retirar su permiso/variables, sin tocar las identidades del puente.

## Navegador y evidencia

Sin interceptar la API ni simular Google: Chromium, Firefox y WebKit en 390×900 y 1440×900; Chromium también en 768×900. Datos visibles en 1,17–2,43 s durante estas navegaciones. Verificados productos, exclusión de vendidos, filtro por URL, selección persistida, drawer, eliminación y ausencia de errores JS/overflow horizontal. Capturas revisadas de mobile, tablet y desktop. Iconos y acciones del drawer comprobados después de cargar sus imágenes.

Las pruebas locales adicionales cubren errores/reintento, vacío, reservas, cancelación, límites y renovación de token con upstream sintético (43 casos del directo y 39 de waitlist). No equivalen a fallas inducidas en Google real. No se probaron dispositivos físicos, fotos de productos reales ni envíos de WhatsApp.

Evidencia local ignorada por Git en `output/qa/catalog-migration/`: `google-live-check.json`, `preview-benchmark.json`, `freshness.json`, `preview-browser.json`, `preview-safety.json`, manifiesto y capturas `preview-*.png`. Se conservan aparte las capturas del otro chat en `output/qa/minicart/`.

## Problemas encontrados y procedimiento reproducible

1. El plan rechazó scopes personalizados para variables no secretas, sin crear variables. Se aplicaron los scopes estándar del plan, ya autorizados; el secreto excluye postprocesado.
2. La CLI 27.5.2 entrega valores enmascarados para secretos; el preflight rechazó correctamente ese valor durante el primer build. Para el candidato exitoso, un helper local suministró la clave directamente al build. Tras verificar el runtime y eliminar la copia temporal, la receta de repetición omite la clave del entorno del build (no la utiliza) y conserva el gate de runtime. Se comprobó ese build sin clave. El código de validación del repositorio no se relajó.
3. Un primer candidato `6ad230423293a5b5d49e2d3e` devolvió 503 por empaquetar un enlace externo a `node_modules`, dejando fuera la dependencia. Se corrigió con `npm ci --ignore-scripts` dentro de la copia aislada, se inspeccionaron los ZIP y se desplegó un candidato nuevo. Este fallo previo no se incluye como éxito de latencia ni se oculta: las mediciones de la tabla corresponden exclusivamente al candidato corregido. Los ZIP finales tienen 129 archivos; catalog 381.007 bytes y waitlist 381.931 bytes, con la biblioteca presente.
4. La copia aislada excluye `.env`, `.git`, `.netlify` y evidencia. La configuración temporal de build vive fuera del checkout; `netlify.toml` del repositorio no fue modificado. Se usó `netlify deploy --context deploy-preview`, sin `--prod`; build y deploy exitosos tardaron 22 s en esta ejecución. Esto no es todavía el ensayo de recuperación por el puente.
5. Las comprobaciones iniciales de navegador se ajustaron a IDs normalizados a minúsculas y a esperar Ventas antes de navegar de nuevo. No se cambió la aplicación para hacerlas pasar. La matriz final completa pasó.

## Gate de commit y push de la rama — 16/10/2026

Bren autorizó guardar y subir el conjunto de cambios en `codex/catalogo-mejoras-y-migracion`. La configuración real de Netlify conserva `main` como rama productiva. El otro chat confirmó que no tenía ediciones en curso.

- Los hashes de todas las fuentes del catálogo y funciones coinciden con el candidato verificado; las diferencias anteriores al gate eran documentación. Se volvieron a ejecutar build, sincronización Sass, tests de estilos, catálogo, privacidad, identidades, waitlist y configuración de build. La matriz del handler directo con Google simulado pasó en Node 24, Chromium/Firefox/WebKit a 390 y 1440 px.
- Se preservaron en `output/backups/commit-tooling-20261016/` tres archivos auxiliares no versionados (`deno.lock`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`) y se excluyeron de Git. El lock de pnpm no incluía la nueva dependencia y su workspace tenía un valor pendiente; publicarlo habría cambiado la instalación npm existente por [la autodetección de pnpm de Netlify](https://docs.netlify.com/build/configure-builds/manage-dependencies/). `package-lock.json` conserva la fuente única de dependencias.
- La comprobación local del sistema visual aún esperaba la demostración dentro de `dist`, aunque el build ya la excluye. Se corrigió para contrastar las fuentes locales y exigir su exclusión del artefacto público. La copia HTML de demostración se sincronizó con `index.html`, conservando el adaptador sintético. Chromium a 390/1440 px verificó productos, selección, drawer, ausencia de errores/overflow y cero peticiones a `/api/`. Esto no cambia el catálogo distribuido.
- El análisis de archivos no encontró material de claves privadas ni tokens; `.env`, credenciales, evidencia y respaldos quedan fuera de Git. Sass watch y Netlify Dev continúan activos. La migración productiva mantiene las puertas indicadas abajo.

El primer commit `24be682` quedó subido y sincronizado. La interpretación inicial de `allowed_branches: []` fue incorrecta: Netlify permite todas las ramas con ese valor. Se activó el branch-deploy `6ad23a73c5772af35267a462`; instaló npm correctamente, pero el preflight detuvo el build por falta de configuración privada en ese contexto. No se publicó ni cambió producción. La credencial de prueba permanece exclusivamente en `deploy-preview`.

Se añadió una regla `ignore` solo para `branch-deploy` de esta rama: el push guarda el trabajo y Netlify omite su build. `production`, `deploy-preview` y otras ramas conservan su configuración; no se amplían permisos ni secretos. La regla se contrasta con el resolutor real de Netlify y los códigos de salida documentados en [Ignore builds](https://docs.netlify.com/build/configure-builds/ignore-builds/). Seguimiento remoto confirmado: el deploy `6ad23b1253362833c6e6d76b`, correspondiente a `c84c604`, se canceló en `checking build content for changes` con `Canceled build due to no content change`, antes de compilar.

## QA del preview antes de main — 16/10/2026

Resultado de esta ronda: **pasaron las pruebas del preview sintético; main y producción permanecen sin cambios**. Rama local y remota verificadas en `c84c6048ec8d7fa893b9d483536111fb1637b1cc`; main local/remota y producción siguen en `d29fb5986526bbe263283a2ffc82bca5a87374fa`. No se modificó código de aplicación ni se hizo otro deploy durante esta ronda.

### Correspondencia del preview con la rama

`npm run build` pasó: cinco salidas Sass sincronizadas, 84 archivos, 3,35 MiB. Se contrastaron los hashes de fuentes de runtime y funciones con el manifiesto del candidato desplegado: coinciden. Las diferencias son documentación, tooling local, exclusiones de Git y la regla para omitir el branch-deploy; no cambian la aplicación distribuida.

De los 84 archivos del artefacto, 82 coinciden byte por byte con las respuestas del preview. `_headers` devuelve 404 porque Netlify consume ese archivo de configuración. `index.html` coincide exactamente al retirar únicamente el script RUM que inyecta Netlify. No se equipara la etiqueta `branch: main` del deploy manual con un commit: la evidencia es la comparación de fuentes y contenido servido.

### Navegación con la integración real

Sin simular `/api/catalog`: primera matriz de siete combinaciones (Chromium 390/768/1440 px; Firefox y WebKit 390/1440 px), seguida de seis recorridos ampliados en los tres motores a 390×900 y 1440×900. Los recorridos ampliados verificaron:

- Los 86 artículos disponibles mediante paginación, exclusión de vendidos y bloqueo de reservados.
- Categoría, badge, historial, recarga filtrada, búsqueda vacía y restablecimiento.
- Descripción larga con scroll hasta el final, galería con dos imágenes servidas, navegación, zoom y foco contenido.
- Selección, totales, cuotas, validación del nombre, privacidad del almacenamiento, persistencia al recargar, eliminación y devolución del foco.
- Pago, entrega y confirmación exclusiva de Laura. Se inspeccionó el destino y texto de WhatsApp interceptando la salida; no se enviaron mensajes.

Los seis recorridos ampliados tuvieron 54 respuestas reales de catálogo/configuración/ventas, todas 200, sin excepciones JS ni respuestas HTTP de error. El tiempo hasta tener catálogo, meta y fuentes listos fue de 1,84–2,75 s en sus primeras navegaciones. Esta medida incluye más que la consulta y no es un p95 productivo ni una comparación equivalente contra la planilla real.

La descripción larga, dos rutas de imágenes existentes y un badge reconocido se cargaron temporalmente en `Catalogo!C2/F2/I2` de la planilla sintética. Al terminar, las tres celdas se restauraron a sus valores originales; el conector y la siguiente lectura del preview confirmaron la restauración, 94 filas y `Cache-Control: no-store`, sin redeploy. Las imágenes usadas en este recorrido son assets del sitio: no validan las fotos comerciales de Drive ni su Image CDN.

### Estados adversos y revisión visual

Las siguientes suites se ejecutaron contra los recursos públicos del preview, con respuestas de API controladas para reproducir estados concretos. No representan fallas inducidas en Google real:

| Prueba | Cobertura | Resultado |
| --- | --- | --- |
| `tests/e2e.mjs` | Chromium, Firefox y WebKit; mobile y desktop | 60 pasadas, 0 fallidas |
| `tests/resilience.mjs` | Chromium; red/reintento/vacío, storage denegado/corrupto, privacidad, reservas, imágenes/fuentes fallidas, XSS y configuración de pagos | 27 pasadas, 0 fallidas |
| `tests/catalog-loading.mjs` | Tres motores; contenido visible antes de datos/fuentes, seis skeletons, aviso de demora, error, reintento y vacío; 320–1440 px | Pasada |
| `tests/product-feature.mjs` | Tres motores; 11 tamaños, descripciones largas, confirmación/cancelación de Laura, foco, teclado/touch, ausencia de JS y fallo de catálogo | Pasada |

Además, se usó la API real con diez productos seleccionados en Chromium con touch emulado: 320, 390, 539/540/541, 599/600/601, 639/640/641, 679/680/681, 766/767/768/769, 1024 y 1440 px. Sin overflow horizontal; último artículo, nombre y CTA alcanzables. También pasaron 844×390, 390×430 y 320×568; la altura reducida no sustituye un teclado físico real. Animación normal, apertura/cierre interrumpidos, movimiento reducido, foco y liberación del scroll comprobados.

Se inspeccionaron capturas reales del drawer en mobile/desktop y pantallas bajas, descripción larga, galería y confirmación de Laura. No se encontró un defecto visual bloqueante en los estados revisados. Firefox informa correcciones de métricas de la fuente Knewave y protección antifingerprinting en RUM; la fuente renderiza y los recorridos pasan. WebKit registra un bloqueo CSP de estilos al tomar capturas con Playwright: se reprodujo ligado a cada captura, con cero violaciones al navegar sin capturar. Se conservó la CSP estricta; no se añadió `unsafe-inline` para silenciar la herramienta.

### Seguridad, operación y límites

- Se volvió a comprobar la proyección pública de Catalogo, las diez claves permitidas de Config y únicamente `TOTAL VENDIDO` de Ventas. Parámetros arbitrarios/duplicados: 400; pestañas privadas/desconocidas: 404.
- La lectura anónima de la planilla devolvió 403. Waitlist en preview devolvió 403 incluso con un header que intentaba fingir producción. Archivos privados, documentación, demostración y módulos de servidor devuelven 404. CSP, `nosniff`, `noindex` y `no-store` conservados.
- Una muestra actual de logs (100 entradas, 49 eventos de lectura) confirma `source: direct`, `reason: ok` y reutilización de token. Es una muestra, no un análisis completo del histórico ni una prueba de carga.
- Producción se verificó nuevamente a las 15:12 UTC en `6ad174c760716e72a684808b`; el preview sigue `ready`, `deploy-preview`, sin publicación productiva. Sass watch continúa activo.
- No se repitieron con una clave local las comprobaciones previas de escritura denegada y falta de acceso a archivos reales: la copia temporal fue eliminada. La evidencia de esa etapa permanece en el informe anterior. No se ampliaron permisos para esta ronda.

Evidencia local: `output/qa/catalog-migration/current-artifact-parity.json`, `preview-current-safety.json`, `preview-browser.json`, `preview-extended.json`, `preview-stress.json`, `webkit-csp-trace.json`, `preview-current-logs.json`, `current-final-state.json` y capturas `extended-*.png`/`stress-*.png`. Regresión funcional en `output/qa/catalog-migration/regression/`; carga en `output/qa/catalog-loading/`; resiliencia en `output/qa/release-2026-10-08/`; producto especial en `output/qa/legxercise/` (son los destinos configurados por esas suites).

Esta ronda no habilita todavía la migración productiva: siguen pendientes aislamiento y custodia de datos reales, comparación equivalente y ensayo de recuperación por el puente. Tampoco prueba dispositivos físicos, zoom del navegador, concurrencia productiva, fotos comerciales de Drive ni el envío efectivo de WhatsApp/lista de espera.

## Próxima puerta

Resolver el aislamiento de datos personales del archivo real y la custodia productiva antes de conceder acceso nuevo. Después: comparación equivalente con datos reales, ensayo de recuperación por `bridge`, revisión del conjunto de cambios y aprobación de producción. La prueba terminada demuestra viabilidad e integración; esas puertas siguen pendientes.
