# Preview de lectura directa — 16/10/2026

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

Bren autorizó guardar y subir el conjunto de cambios en `codex/catalogo-mejoras-y-migracion`. La configuración real de Netlify conserva `main` como rama productiva y `allowed_branches: []`; este push no publica el catálogo. El otro chat confirmó que no tenía ediciones en curso.

- Los hashes de todas las fuentes del catálogo y funciones coinciden con el candidato verificado; las diferencias anteriores al gate eran documentación. Se volvieron a ejecutar build, sincronización Sass, tests de estilos, catálogo, privacidad, identidades, waitlist y configuración de build. La matriz del handler directo con Google simulado pasó en Node 24, Chromium/Firefox/WebKit a 390 y 1440 px.
- Se preservaron en `output/backups/commit-tooling-20261016/` tres archivos auxiliares no versionados (`deno.lock`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`) y se excluyeron de Git. El lock de pnpm no incluía la nueva dependencia y su workspace tenía un valor pendiente; publicarlo habría cambiado la instalación npm existente por [la autodetección de pnpm de Netlify](https://docs.netlify.com/build/configure-builds/manage-dependencies/). `package-lock.json` conserva la fuente única de dependencias.
- La comprobación local del sistema visual aún esperaba la demostración dentro de `dist`, aunque el build ya la excluye. Se corrigió para contrastar las fuentes locales y exigir su exclusión del artefacto público. La copia HTML de demostración se sincronizó con `index.html`, conservando el adaptador sintético. Chromium a 390/1440 px verificó productos, selección, drawer, ausencia de errores/overflow y cero peticiones a `/api/`. Esto no cambia el catálogo distribuido.
- El análisis de archivos no encontró material de claves privadas ni tokens; `.env`, credenciales, evidencia y respaldos quedan fuera de Git. Sass watch y Netlify Dev continúan activos. La migración productiva mantiene las puertas indicadas abajo.

## Próxima puerta

Resolver el aislamiento de datos personales del archivo real y la custodia productiva antes de conceder acceso nuevo. Después: comparación equivalente con datos reales, ensayo de recuperación por `bridge`, revisión del conjunto de cambios y aprobación de producción. La prueba terminada demuestra viabilidad e integración; esas puertas siguen pendientes.
