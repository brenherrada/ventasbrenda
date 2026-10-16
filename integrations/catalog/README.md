# Lector privado del catálogo

Estado 16/10/2026: migración productiva autorizada y en ejecución. [Registro actual de aislamiento, custodia, pruebas y publicación](PRODUCTION-VERIFICATION.md). [Pruebas del preview sintético](PREVIEW-VERIFICATION.md) y [plan operativo](MIGRATION-PLAN.md).

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

## Configuración privada y custodia autorizada

El modo directo usa `CATALOG_SPREADSHEET_ID` y `CATALOG_GOOGLE_CREDENTIALS` en servidor. La credencial debe ser `service_account`, RSA de al menos 2048 bits, sin OAuth personal, impersonación ni endpoints alternativos. El código solicita `spreadsheets.readonly`; los permisos del archivo e IAM se verifican además de validar el JSON.

Bren autorizó el 16/10/2026 separar los datos personales y completar la migración hasta producción. Se creó `catalog-netlify-reader@plot-twist-catalog.iam.gserviceaccount.com` sin roles de proyecto, con permiso reader exclusivamente sobre el archivo del catálogo. Pendientes se copió de forma nativa a un archivo privado accesible solo por la propietaria; se comprobaron valores, formatos, validaciones y tabla antes de retirar los registros del archivo original, donde permanece un enlace. La nueva cuenta no tiene acceso a Pendientes ni a la lista de espera. Google denegó ambas lecturas y la escritura, incluso solicitando un token con scope de escritura para comprobar el permiso reader del archivo.

La clave nueva está marcada secreta en Netlify para producción, con los scopes Builds/Functions/Runtime del plan actual, autorizados expresamente. No se trasladaron las claves de las identidades del puente. El contexto genérico `deploy-preview` conserva una identidad y planilla sintéticas independientes. La validación final usa temporalmente el contexto específico `catalog-migration-validation`; se retira su configuración al cerrar las pruebas. No conceder esta clave productiva a PRs arbitrarios ni a dev.

La custodia incluye a los colaboradores y procesos con acceso al build de producción. Mantener acceso de escritura al repositorio/Netlify limitado a personas de confianza. No imprimir valores secretos, exportarlos al cliente ni copiar archivos de credenciales a Git/dist. Las copias locales de transferencia se eliminan después de comprobar la configuración remota y el runtime.

Rotación: crear una clave de reemplazo para esta misma identidad, actualizar exclusivamente el valor secreto productivo, construir un nuevo deploy y verificar lecturas/logs antes de revocar la anterior. Retirar una variable de contexto no revoca claves ya capturadas por deploys previos. Ante exposición, revocar la clave afectada y ejecutar la recuperación ensayada con el puente; no reutilizar sus JSON ni modificar al escritor de waitlist.

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

La comparación con datos reales, el ensayo de recuperación y la publicación se registran en [PRODUCTION-VERIFICATION.md](PRODUCTION-VERIFICATION.md). El puente se conserva al menos 48 horas y hasta comprobar una ventana representativa, renovación de token y una instancia nueva. La lista de espera sigue necesitándolo después de retirar el lector antiguo.
