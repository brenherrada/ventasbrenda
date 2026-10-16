# Lector privado del catálogo

Estado 16/10/2026: implementación en `codex/catalogo-mejoras-y-migracion`; preview con Google real y planilla sintética verificado. [Resultados, seguridad, evidencia y límites](PREVIEW-VERIFICATION.md). Modo productivo y credenciales existentes sin cambios. El plan operativo sigue en [MIGRATION-PLAN.md](MIGRATION-PLAN.md).

## Contrato y ejecución

- GET `/api/catalog?sheet=Catalogo|Config|Ventas`; omitir `sheet` conserva Catalogo como defecto. Se rechazan recursos, parámetros adicionales y parámetros duplicados antes de consultar el proveedor.
- `CATALOG_SOURCE` admite únicamente `bridge` o `direct`. Si no existe, usa `bridge`. Un valor vacío o inválido falla; nunca activa un fallback silencioso.
- `bridge` conserva el transporte Apps Script, las variables `WAITLIST_SCRIPT_URL/SECRET` y su presupuesto anterior. `direct` llama a Sheets desde la función. Ambos pasan por `netlify/lib/catalog-contract.mjs`.
- Se conservan campos públicos, Config filtrada y exclusivamente `TOTAL VENDIDO` de Ventas. Se eliminan columnas privadas y metadata de celdas. El cliente mantiene el mismo formato y `no-store`.
- Rangos fijos: Catalogo A1:K, Config A1:B, Ventas A1:B. Lectura de valores no formateados, fechas seriales y filas, igual que el puente. No se publica una Sheet ni se añade acceso a Google desde el navegador.
- `direct` tiene un presupuesto inicial de 6 segundos para autenticación, lectura, cuerpo y reintento; máximo dos intentos. 401 de Sheets invalida el token rechazado; 403 y respuestas inválidas no se reintentan. El presupuesto requiere validación real antes de activarse en producción.
- `google-auth-library` 11.3.1 firma y obtiene el token. Solo se reutiliza el token en memoria, con renovación 60 segundos antes de vencer y una renovación concurrente por identidad. Los cambios de credencial invalidan ese estado. Productos, stock, precios y configuración se leen cada vez.
- Logs del directo: recurso permitido, ID aleatorio de lectura, intento, motivo acotado y tiempos de autenticación/Sheets/proyección/total. No se registran claves, tokens, URLs, IDs de archivos, filas ni errores crudos del proveedor.
- Límite de respuesta de Sheets y del JSON público: 4 MiB; un exceso falla de forma cerrada. El límite y la ausencia de paginado deben revisarse si crece el catálogo.

## Configuración privada pendiente

El modo directo espera `CATALOG_SPREADSHEET_ID` y `CATALOG_GOOGLE_CREDENTIALS` en el entorno de servidor. La credencial debe ser de tipo `service_account`, RSA de al menos 2048 bits y cuenta técnica; no se acepta OAuth personal, impersonación, endpoints alternativos ni carga automática de archivos/URLs. Solo se solicitan scopes de lectura de Sheets. Los permisos reales del archivo y de IAM deben comprobarse en Google: la validación del JSON no los prueba.

**Autorización recibida el 16/10/2026:** Bren aprobó la cuenta y planilla privadas de prueba, incluyendo custodia de la clave en el contexto de preview y disponibilidad para Builds. Se creó `catalog-preview-reader@plot-twist-catalog.iam.gserviceaccount.com` sin roles de proyecto, reader exclusivamente de la planilla sintética `1l9o08tGSlAVuG2BSGa9fU5PS00wTDaE17UvSynz1bJQ`. El README del puente conserva fuera de Netlify las dos credenciales existentes; la excepción documentada no les afecta. No se autorizó acceso a archivos reales ni custodia productiva.

Las tres variables `CATALOG_*` tienen valor únicamente en `deploy-preview`. La credencial está marcada secreta y disponible para Builds/Functions/Runtime; no hay valor en producción, dev ni branch-deploy. Se verificó metadata después de guardarlas. La primera solicitud de scopes reducidos fue rechazada por el plan y no creó variables; se usaron los scopes estándar ya autorizados, excluyendo postprocesado de la credencial.

Integración real local, Node 24: Catalogo 94 filas en 984 ms, Config 10 filas en 397 ms, Ventas un agregado en 292 ms, con igualdad exacta contra el fixture sintético. Google devolvió 403 para lectura de los dos archivos reales, lectura anónima de la planilla de prueba y escritura con el lector. Una primera medición local no prueba p95, arranques fríos de Netlify ni rendimiento del catálogo real.

Verificado mediante conectores: las dos variables actuales tienen valores solo en producción; el secreto está marcado como tal y sus scopes incluyen Builds/Functions/Runtime. El plan no ofrece el aislamiento de scopes propuesto como preferencia en el plan. La custodia final de credenciales de producción sigue pendiente.

El archivo real contiene Catalogo, LEEME, Config, Ventas y Pendientes. Se inspeccionaron solo metadata y encabezados: Pendientes incluye Clienta, Productos/cantidades, Pago, Saldo por cobrar, Entrega, Próximo paso, Fecha/horario y Notas. No se copiaron registros. Como Google concede lectura por archivo, una cuenta con acceso al catálogo real tendría capacidad técnica de leer también esos datos. La proyección del endpoint no elimina esa capacidad de la credencial; resolver aislamiento antes de concederla a Netlify.

## Preview y lista de espera

`waitlist.mts` permite intentar una escritura únicamente cuando el `context.deploy.context` entregado por Netlify es `production`. Local, deploy-preview, branch-deploy y contextos ausentes/desconocidos devuelven 403 antes de consultar Config o Apps Script. Un header enviado por el visitante no modifica esta decisión. La UI puede mostrar la invitación según Config; eso no habilita la escritura del servidor.

En producción se conservan validación de datos, consentimiento, bandera `mostrar_boton_vender`, límites y escritor actual. No eliminar sus variables aunque el catálogo use `direct`. Las pruebas de persistencia de este turno son sintéticas; falta la verificación real autorizada después de cualquier publicación.

## Build y distribución

- `scripts/catalog-build-config.mjs` verifica selector y configuración no secreta antes de reemplazar `dist`. En builds desplegados, bridge exige su conexión; direct exige ID válido y valida la credencial si está disponible en Builds.
- No se obliga a copiar una clave exclusiva de Functions a Builds. **Un build directo exitoso no demuestra presencia de credenciales en runtime:** se exige leer de vuelta configuración/scopes reales y probar el deploy antes de cambiar tráfico. La barrera de waitlist en producción se conserva.
- Los módulos privados están fuera del directorio de endpoints para no crear funciones públicas accidentales. El build de Netlify genera solo catalog y waitlist. Ambas incluyen la librería porque waitlist consume Config. La librería se carga al autenticar direct; permanece empaquetada durante la transición, aunque bridge no la ejecute.
- `dist` no contiene código de autenticación, librerías de servidor, claves ni módulos privados. No se agrega un servicio, una base de datos, caché de catálogo ni cambios de región.

## Verificaciones reproducibles

Ejecutar con Node 24 o superior:

```sh
npm run test:catalog-api
node tests/waitlist.mjs
node tests/waitlist-build.mjs
npm run build
npm run styles:check
npm run test:catalog-browser
netlify functions:build --src netlify/functions --functions output/qa/catalog-migration/functions
```

El test de navegador requiere Playwright y sus navegadores instalados; `PLAYWRIGHT_MODULE` permite reutilizar una instalación existente. Usa HTTPS y puerto dinámico propios, sin cambiar Netlify Dev. El navegador consume `dist` y los handlers reales; únicamente Google se simula en el servidor. Ninguna clave efímera se envía a Google ni se guarda.

Resultados locales: 43 comprobaciones del directo, 39 de waitlist, pruebas del puente/privacidad/identidades/build; Chromium, Firefox y WebKit a 390×900 y 1440×900. Se verificaron productos, selección, reservados/vendidos, filtro, error/reintento, vacío y POST de preview bloqueado. Evidencia en `output/qa/catalog-migration/`. Las capturas ilustran datos sintéticos; no acreditan Google real, rendimiento productivo, dispositivos físicos ni la operación del nuevo secreto.

Build de funciones local: catalog aproximadamente 677 kB comprimidos, waitlist 678 kB; dos funciones y sin archivos de secretos. `npm audit` no reportó vulnerabilidades en la revisión actual. El tamaño comprimido no demuestra el tiempo de arranque.

Preview real: 60 consultas sin fallas en el candidato verificado; Catalogo mediana 538,5 ms y p95 muestral 983 ms. Matriz de navegador real aprobada, cambios de precio visibles en la siguiente lectura y permiso de escritura denegado. La copia temporal de la clave fue eliminada. Ver el informe para los fallos de preparación corregidos y los límites de esas métricas.

Próximo paso: resolver aislamiento de datos reales/custodia productiva, comparar fuentes equivalentes y ensayar recuperación. Producción permanece con el puente hasta completar esas puertas y recibir aprobación de publicación.
