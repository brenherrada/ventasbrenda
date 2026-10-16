# Migración del lector del catálogo a Google Sheets directo

Fecha: 16/10/2026, Buenos Aires. Estado: **migración productiva autorizada; aislamiento privado completado; validación final y publicación en curso**. Evidencia sintética en [PREVIEW-VERIFICATION.md](PREVIEW-VERIFICATION.md), ejecución actual en [PRODUCTION-VERIFICATION.md](PRODUCTION-VERIFICATION.md) y operación en [README.md](README.md). Las puertas siguientes describen el plan original; las autorizaciones posteriores y los resultados actuales quedan registrados en el informe productivo.

## Resultado y alcance

Reemplazar la lectura `navegador → Netlify → Apps Script → Sheets` por `navegador → Netlify → Sheets`, manteniendo la Sheet privada, datos frescos y el contrato público actual. Preparar y probar todo con producción atendida por el lector existente. Objetivo operativo: **sin ventana de mantenimiento planificada**. Un fallo de proveedor aún puede existir: se reduce su impacto con pruebas previas y una recuperación ensayada, no con una promesa de cero incidentes.

Bren autorizó avanzar con la implementación y conservar todos los cambios actuales y futuros en `codex/catalogo-mejoras-y-migracion`, compartida con el chat del minicart. Creación/custodia de credenciales, permisos, escrituras reales, commit, push y publicación conservan sus puertas específicas. Bren decide sobre cambios de custodia, costo y publicación concretos; el agente investiga, implementa, prueba, opera y documenta el resto, sin trasladarle decisiones técnicas rutinarias.

No migrar la escritura de la lista de espera, cambiar fórmulas/columnas, publicar la Sheet, introducir caché de productos, rediseñar UI, cambiar DNS ni incorporar una base de datos como parte de esta migración. Reutilizar endpoint, proyección y componentes actuales. Las mejoras de UX y minicart se conservan en la rama compartida por instrucción de Bren; revisar el conjunto exacto antes de cualquier publicación.

## Evidencia y límites de lo conocido

- Código activo: `netlify/functions/catalog.mts`, contrato GET `/api/catalog?sheet=Catalogo|Config|Ventas`. Respuesta `{table:{cols,rows}}`, `no-store`, lista fija de recursos y campos. El navegador nunca elige spreadsheet ID, rango ni credenciales.
- Catálogo y Config se solicitan en paralelo. Ventas se consulta después de Config para la meta. No sumar sus tiempos como si bloquearan secuencialmente la aparición de productos.
- `netlify/functions/waitlist.mts` **importa y ejecuta el handler del catálogo** para leer `mostrar_boton_vender` antes de escribir. Migrar el lector afecta también esa comprobación. Su escritura sigue por el puente existente y la identidad escritora separada.
- `netlify/edge-functions/category-preview.ts` cambia metadata social; no consulta Sheets. Verificar que las URLs filtradas conserven esa metadata y sus cabeceras.
- El puente usa una cuenta lectora limitada al archivo de catálogo y otra escritora para el archivo de lista de espera. No usa OAuth personal de la propietaria. Su autorización de Apps Script sigue siendo `script.external_request`.
- Netlify, confirmado por conector durante la planificación: proyecto `ventasbrenda`, ID `14da67c8-b1af-424e-90bc-51aad09c551d`; deploy publicado `6ad174c760716e72a684808b`, ready, producción, commit `d29fb5986526bbe263283a2ffc82bca5a87374fa`, rama `main`, Functions Node.js 24, región `us-east-2`. Registrar de nuevo antes de intervenir: este dato puede cambiar.
- Local: Node 26; pruebas de backend y navegador ejecutadas también con Node 24.20.0. npm y `package-lock.json` son el flujo versionado. Hay cambios ajenos y archivos sin seguimiento. La CLI explícita `/opt/homebrew/bin/netlify` sí permitió leer metadata y construir Functions; la lectura inicial usando otro acceso había fallado. Producción sigue en main y el mismo SHA. No confundir una lectura/build local con publicación probada ni permisos de Google.
- Se observaron consultas del puente de aproximadamente 1,7–6,7 s y 503 intermitentes, incluyendo agotamiento del presupuesto de 17 s. El presupuesto actual permite 12 s + 5 s + pausa, además de costos de red; el cliente aborta a los 20 s. El preview directo sintético completó 60 lecturas sin fallas, Catalogo mediana 538,5 ms/p95 983 ms. No es todavía una comparación equivalente con el catálogo real.
- El README del puente conserva fuera de Netlify sus dos JSON. La excepción de custodia aprobada y documentada solo cubre la cuenta y planilla sintéticas del preview. Custodia productiva y acceso al archivo real requieren resolver las puertas pendientes.

## Decisiones de diseño de la migración

| Decisión | Elección y motivo | Consecuencia y prueba |
| --- | --- | --- |
| Contrato web | Mantener `/api/catalog`, tablas, campos y estados. Cambiar el transporte en servidor. | Ventanas abiertas y JS anterior deben seguir funcionando. Probar consumidores y comparar respuestas normalizadas. |
| Lector de Google | Identidad técnica nueva y dedicada a Netlify, reader del único archivo necesario, scope `spreadsheets.readonly`, sin roles de proyecto, impersonación ni delegación de dominio. | No reutilizar la clave del puente ni tocar al escritor. Verificar permisos de archivo e IAM, además de la configuración del cliente. |
| Credenciales | Resolver primero custodia del secreto en el plan real de Netlify; preferir disponibilidad solo en Functions. Clave nueva, transferencia privada directa y rotación documentada. | Si el plan exige exposición también a Builds, no asumir equivalencia: presentar impacto y alternativa antes de guardar una clave. No cambiar plan/costo ni agregar otro servicio silenciosamente. |
| Datos privados | La proyección pública sigue siendo una barrera obligatoria del servidor. Google limita por archivo, **no por pestaña o rango**. | La identidad podría leer otros datos del mismo archivo si el servidor fuera comprometido. Inventariar categorías de datos/columnas sin copiar clientes; Bren debe conocer este alcance al aprobar la custodia. Si no es aceptable, detener esta variante y preparar separación de datos o alternativa; no resolverlo publicando la Sheet. |
| Autenticación | Biblioteca oficial de autenticación de Google compatible con Node 24; versión fijada y lockfile revisado. Evitar criptografía propia. | Medir tamaño de función y arranque. Reutilizar solo tokens OAuth válidos en memoria del servidor, con renovación anticipada y una sola renovación concurrente. Ningún caché de stock, precios ni respuestas. |
| Cambio de lector | Selector privado `CATALOG_SOURCE=bridge|direct`, temporal, por deploy; defecto `bridge`, valores inválidos fallan en preflight. Una proyección pública compartida y transportes acotados. | Se puede preparar y ensayar una versión de recuperación con `bridge`. Una variable no es un interruptor instantáneo: Netlify requiere un nuevo deploy para aplicar su valor. No ofrecer selector público por query/header. |
| Fallas del lector directo | Sin fallback automático al puente en cada request. Presupuesto total acotado para autenticación, lectura, renovación/reintento y proyección. | Evita sumar dos caminos lentos y esconder errores. Recuperación operativa: nuevo deploy probado con `bridge`; UX mantiene error/reintento. |
| Agregación | Primera versión conserva lecturas independientes y prioriza Catalogo. | No esperar Ventas/Config para mostrar productos. Evaluar `batchGet` únicamente si la medición demuestra beneficio y no aumenta acoplamiento o datos leídos. |

## Entornos de validación: local → preview → producción

Recomendación concretada tras la consulta de Bren: usar ambos entornos de prueba, en ese orden. No hace falta deshabilitar el catálogo público para implementar ni para validar el nuevo lector.

| Entorno | Datos y permisos | Qué demuestra |
| --- | --- | --- |
| Local con Netlify Dev | Datos sintéticos y, para integración, una Sheet de prueba sin datos personales con credencial dedicada. No importar variables de producción por defecto. | Contrato, proyección pública, errores, reintentos, estados de UI y regresiones. La integración real requiere credenciales válidas; un mock no demuestra autenticación ni velocidad. |
| Preview HTTPS confiable en Netlify | Nueva identidad lectora, acceso de solo lectura al catálogo privado real una vez resuelta su custodia; variables limitadas al contexto/revisión de prueba. | Recorrido real Netlify → Google, empaquetado de Functions, runtime, primeras llamadas, renovaciones y comparación de latencia. No certifica por sí solo el contexto productivo. |
| Producción | Configuración productiva verificada, revisión aprobada y recuperación ensayada. | Comprobación final bajo la URL y el tráfico reales después del cambio; conservar la observación prevista. |

Antes del preview, verificar variables efectivamente heredadas, protección de acceso disponible y consumo del plan. Una URL de preview no es privada automáticamente y puede compartir cuotas de Netlify/Google: limitar las mediciones y no hacer pruebas de carga contra recursos productivos. Si no se puede aislar el contexto con las capacidades disponibles, preparar un sitio de pruebas separado con su costo y mantenimiento explícitos antes de crearlo.

La lista de espera necesita aislamiento propio: la versión publicada no bloquea escrituras por ser un preview. El código nuevo ya lo bloquea usando metadata de contexto entregada por Netlify; se comprobó que un POST directo, incluso con header de contexto falsificado, no llega al escritor. Ocultar el formulario no es suficiente. Las pruebas de persistencia de esta etapa son sintéticas; cualquier escritura real posterior exige escritor/archivo de prueba separado y autorización. No cambiar el flag de la Sheet productiva para desactivar el preview. El ensayo del puente de recuperación conserva su puerta específica de acceso controlado y ausencia de escrituras.

Estado: bloqueo de escritura en servidor y lector directo implementados y probados. Bren autorizó el primer preview con cuenta y planilla de prueba dedicadas, incluyendo clave en Builds/Functions/Runtime del contexto `deploy-preview`. Recursos creados y variables leídas de vuelta; permisos y lecturas reales locales verificados, incluidos 403 para los dos archivos reales. El primer preview usa exclusivamente esos datos sintéticos. El archivo real contiene Pendientes con datos de clientas/pagos/entregas; el acceso directo a ese archivo requiere resolver antes el aislamiento final. El benchmark sintético no reemplaza la comparación equivalente del catálogo real.

## Secuencia de ejecución y puertas

### 0. Congelar el alcance de la publicación y obtener baseline

**Producción:** sigue con el puente.

1. Releer instrucciones, diff y archivos. Por instrucción posterior de Bren, trabajar en el checkout compartido de `codex/catalogo-mejoras-y-migracion`; coordinar propiedad de archivos con el chat del minicart. Registrar SHA base y revisar la lista conjunta de cambios antes de un release, sin descartarlos ni publicar implícitamente.
2. Confirmar proyecto, URL, rama que publica, automatizaciones de deploy y permisos reales de operación. No empujar código a `main` como ensayo. Identificar cómo impedir que otro deploy reemplace el candidato durante el cambio; coordinar solo la publicación, sin suspender ediciones del catálogo.
3. Registrar metadata segura del deploy publicado y configuración necesaria para reconstruir la versión de recuperación. No descargar secretos a reportes ni tratarlos como backups de código.
4. Medir de forma controlada endpoints y catálogo renderizado: errores, tiempos de respuesta, productos utilizables, primer acceso y accesos con instancia activa. Separar API, fuentes y fotos. El Image CDN no se acelera por eliminar Apps Script.
5. Preparar un conjunto sintético para fallas y privacidad. Para el archivo real, comparar solo proyección pública, conteos y hashes normalizados. Mantener las pruebas por debajo de límites compartidos; no lanzar sondas masivas.

**Puerta 0:** origen publicado identificado, alcance aislado y canal de recuperación operativo. Si no se puede desplegar una reparación, no se cambia producción.

### 1. Preparar acceso independiente sin tocar el que funciona

**Producción:** sigue con el puente.

1. Verificar en Google la identidad lectora actual, archivo autorizado y API habilitada mediante metadata segura; no solicitar la contraseña ni imprimir la clave existente.
2. Resolver el gate de custodia de la tabla anterior y la política de variables sensibles/previews. Google sigue privado. Si hay costos o límites de plan que alteren la elección, preparar alternativas con consecuencias antes de ejecutar.
3. Cuando esté autorizado, crear la identidad lectora nueva y su credencial; compartir solo el archivo del catálogo como reader. No reutilizar ni revocar la credencial actual. No conceder acceso al archivo de contactos ni roles amplios de Drive/Google Cloud.
4. Configurar variables nuevas por contexto con nombres explícitos, por ejemplo `CATALOG_GOOGLE_CREDENTIALS`, `CATALOG_SPREADSHEET_ID` y `CATALOG_SOURCE`. El spreadsheet ID es una configuración privada fija; el request no puede sustituirlo. El inventario de validación publica solo presencia, contexto y scopes, nunca valores.
5. Usar credenciales sintéticas/archivo de prueba en local. La prueba con el archivo real se ejecuta solo en un deploy de código confiable, con permisos de lectura y acceso a logs revisados. No entregar secretos de producción a previews de terceros ni a contextos `dev` por defecto.
6. Confirmar formatos reales de valores: encabezados, celdas vacías, números, booleanos, formulas y totales. Mantener `UNFORMATTED_VALUE` y las normalizaciones del puente; no cambiar datos de Sheets para que pase el adaptador.

**Puerta 1:** lectura directa autenticada de los tres recursos, permisos auditados y ausencia de secretos en código, comandos visibles, Git, dist, respuestas y logs. Un mock no cierra esta puerta.

### 2. Implementar la ruta compatible y su observabilidad

**Producción:** sigue con el puente.

1. Extraer/reutilizar validación y proyección compartidas. El puente y el lector directo deben terminar en el mismo contrato público; no mantener dos definiciones de campos/configuración.
2. Leer solo rangos fijos de Catalogo/Config/Ventas; rechazar método, recurso o parámetros que pretendan ampliar acceso antes de consultar Google. Validar respuesta completa antes de devolver 200. `Ventas` devuelve exclusivamente `TOTAL VENDIDO`, no sus filas comerciales.
3. Manejar credencial ausente/malformada, 401/403, límite 429, red, deadline y respuesta inválida. Un 403/configuración inválida no se reintenta ciegamente; renovar un token inválido como máximo una vez y dentro del mismo presupuesto. Reintentar solo fallas transitorias con espera acotada.
4. Instrumentar duraciones por etapa, estado, lector y un ID de correlación seguro. No loguear tokens, JSON de credencial, filas privadas, nombres, mails ni cuerpos del proveedor. No exponer detalles internos de errores al visitante.
5. Incorporar preflight por proveedor: `direct` exige configuración válida en runtime; `bridge` exige la actual. El build valida configuración no secreta y cualquier clave presente, pero no exige ampliar una clave de Functions a Builds. Leer de vuelta scopes/configuración y probar runtime es puerta separada obligatoria. La lista de espera conserva `WAITLIST_SCRIPT_URL/SECRET` en producción; no eliminar su gate de build.
6. Conservar rate limits, CSP, CORS restrictivo/mismo origen, `no-store`, exclusión de fuentes/secretos del bundle y límites de respuesta. El usuario no recibe credenciales ni conecta directamente a Google.
7. Medir el costo/tamaño del cliente de autenticación y evitar incluirlo en recursos descargados por el navegador. Mantener funcionamiento Node 24 en Functions, no solo Node 26 local.

**Puerta 2:** código, contratos, preflight, seguridad y ambos modos probados; el modo direct todavía no atiende producción.

### 3. Pruebas automatizadas y candidato desplegado

**Producción:** sigue con el puente.

1. Adaptar `tests/catalog-api.mjs` para probar ambos transportes y la proyección compartida. Probar autenticación/token vencido, renovación concurrente y errores sin secretos con credenciales efímeras.
2. Ejecutar `tests/catalog-privacy.mjs`, `tests/google-identities.mjs`, `tests/waitlist.mjs`, `tests/waitlist-build.mjs`, `tests/web-promo-config.mjs`, `tests/resilience.mjs`, E2E y build/check pertinentes. No cambiar pruebas para esconder errores reales.
3. Crear un candidato HTTPS confiable fuera de la URL pública, con lector directo y configuración real revisada. No habilitar escrituras reales en previews por heredar variables de producción. El formulario se prueba primero con mocks/servicio de prueba.
4. Comparar los tres recursos con el puente, contemplando ediciones entre lecturas. Si difieren, repetir contra una versión estable del contenido; no congelar todo el catálogo ni aceptar discrepancias de precios/estados como ruido.
5. Probar UI mobile/desktop y tamaños intermedios: carga, error/reintento, filtros, búsquedas, paginación, vendidos/reservados, galería, selección persistida, totales, meta y enlaces de WhatsApp sin enviar mensajes. Incluir pestaña que ya estaba abierta y recarga desde una URL filtrada.
6. Probar por separado el consumidor servidor de Config: la lista de espera debe respetar flag encendido/apagado, fallar sin escribir si Config falla y conservar validación/deduplicación del escritor. El contacto de Laura sigue independiente.
7. Hacer mediciones reales controladas en varias ventanas. Comparar distribuciones y fallas, no un único HTTP 200. No invocar un segundo lector de Google por cada visitante para hacer una comparación permanente.

**Puerta 3:** mismo contenido/contrato, pruebas de fallas y UI aprobadas, mejora real de latencia y límites de permisos cerrados. El candidato no se publica porque solo haya pasado el build.

### 4. Ensayar recuperación ANTES de cambiar tráfico

**Producción:** sigue con el puente.

1. Preparar una revisión de recuperación del mismo alcance con `CATALOG_SOURCE=bridge`, sin quitar los cambios ajenos ni depender de credenciales nuevas.
2. Desplegarla como candidato confiable y comprobar lectura real del puente y consumo de Config por waitlist. Registrar SHA, contexto, variables requeridas y pasos exactos para reproducirla como un nuevo deploy de producción.
3. Cronometrar build, deploy y verificación de recuperación. La evidencia anterior de un deploy de 12 s no garantiza el tiempo de un build nuevo; registrar la duración del ensayo y acordar el presupuesto de incidente antes del cambio.
4. Simular indisponibilidad/credencial inválida del directo fuera de producción y ejecutar la recuperación. Confirmar que se preservan selección y compatibilidad de API.

**Puerta 4:** la recuperación está ensayada y puede ejecutarse con el acceso disponible. No basta con “guardamos el SHA”. Una variable de entorno requiere redeploy y la recuperación incluye ese tiempo.

### 5. Cambio controlado en producción

1. Contrastar la revisión concreta con la autorización vigente: SHA, pruebas, custodia/costos, mediciones, pendientes y recuperación. Bren autorizó hacerse cargo de punta a punta hasta producción y aprobó expresamente separar Pendientes y completar la migración con la cuenta nueva. No pedir nuevamente una autorización ya recibida; consultar solo un cambio material no cubierto.
2. Reconfirmar deploy publicado y ausencia de cambios concurrentes en el destino. Leer de vuelta metadata de configuración productiva; no confundir valores locales o de preview con producción.
3. Incorporar solo el alcance revisado y publicar por el workflow identificado. La configuración `direct` debe existir antes del build/deploy que la usa; el deploy anterior sigue sirviendo con su configuración propia.
4. Netlify construye una versión nueva mientras la anterior sigue publicada. Si el build falla, conservar la anterior e investigar; no desmontar el sitio ni revocar nada. Verificar el cambio atómico de versión y el SHA/contexto esperados, no asumirlos por un push exitoso.
5. Inmediatamente probar la URL pública real, sin interceptar API: Catalogo, Config, total de Ventas, categorías compartibles, productos utilizables en mobile/desktop, selección y controles. Releer datos públicos y confirmar que la función usa `direct` en logs seguros; un flag declarado no prueba el recorrido.
6. Cuando esté autorizada la prueba de escritura, verificar una inscripción sintética identificable y consentida, leerla en su Sheet, repetir y comprobar una única fila; eliminar solo ese registro de prueba. No contactar personas ni usar datos de clientes. Si no está autorizada/disponible, registrar la puerta pendiente y no declarar el flujo de inscripciones verificado.
7. Quien publica permanece durante la verificación; no dejar a Bren monitoreando. Ante criterios de recuperación, ejecutar la revisión preparada como **nuevo deploy correctivo**. No depender de restaurar un deploy viejo como procedimiento del agente.

**Puerta 5:** publicación y recorridos reales verificados. La publicación cuenta con autorización explícita posterior al plan; conservar todos los gates técnicos.

### 6. Observación y cierre

- Primera ventana: observación activa 30–60 min desde la publicación, con muestras acotadas y logs reales. Segunda ventana: comparar errores/latencia al día siguiente mediante una revisión programada solo si Bren autoriza agendarla; no prometer vigilancia persistente de un chat inactivo.
- Mantener el puente y sus permisos durante al menos 48 h y hasta cubrir una ventana representativa de tráfico, tokens renovados e instancia nueva. El plazo por sí solo no acredita estabilidad.
- Revisar arranques, renovaciones de token y tasas 401/403/429/5xx. El token no debe renovarse por cada lectura ni quedar congelado hasta que expire.
- Retirar después la selección temporal del lector y las dependencias solo de lectura que hayan quedado sin uso. **No borrar Apps Script, su identidad escritora ni WAITLIST_SCRIPT_URL/SECRET:** la lista de espera continúa necesitándolos. Comprobar si conserva otras dependencias antes de revocar al lector viejo.
- Actualizar AGENTS, README de integración, preflight, política de custodia, rotación y registro del deploy. No dejar dos contratos o dos procesos activos indefinidamente. Mantener pruebas; limpiar evidencia descartable según la política del repo.

## Aceptación, recuperación y presupuestos

Objetivos iniciales a verificar, no resultados prometidos:

| Área | Aceptación para cambiar producción | Motivo para no cambiar o para recuperar |
| --- | --- | --- |
| Datos y privacidad | Proyección equivalente para los tres recursos; Config solo claves permitidas; Ventas solo agregado. Sin secretos/datos privados en respuestas, dist ni logs. | Cualquier discrepancia comercial persistente, exposición o permiso excesivo bloquea. Si ya se publicó, recuperación inmediata; ante exposición, revocar solo la clave nueva y aplicar procedimiento de incidente. |
| Velocidad | Al menos 20 ciclos comparados y espaciados; mediana/p95 separados por recurso, primeras llamadas y calientes. Objetivo Catalogo p95 ≤2,5 s y mejora ≥30% contra baseline equivalente. | Si el presupuesto no se cumple, investigar antes de cambiar; no ocultar cold starts, errores o timeout como muestras descartadas. Proponer un nuevo objetivo solo con evidencia. |
| Deadline | Propuesta inicial: máximo 6 s total del lector directo, incluidos token, renovación y reintento. Debe probarse que admite el p95 real de primera llamada; el navegador mantiene margen mayor. | No recortar el deadline si eso simplemente convierte respuestas lentas en más fallas. Si no se alcanza, ajustar diseño/objetivo antes de publicar; no mantener silenciosamente la cadena de 17 s. |
| Fallas | Cero fallas inesperadas en muestras previas, pruebas de errores controladas aprobadas; tasa postcambio no peor que baseline. | Tres fallas consecutivas en lecturas reales de Catalogo, o dos comprobaciones consecutivas >6 s, o indisponibilidad reproducida desde un navegador: iniciar recuperación sin seguir experimentando sobre visitantes. Una muestra sin tráfico suficiente no certifica un p95 de producción. |
| Waitlist | Flag correcto, no escritura si Config falla, validación/deduplicación preservadas; prueba pública con persistencia cuando esté autorizada. | Fallo atribuible a nuevo lector de Config o cambio en consentimiento/guardado bloquea o recupera. |
| Continuidad | No hay mantenimiento planificado; ambos caminos utilizables hasta cerrar el cambio. Tiempo de recuperación real medido antes de producción. | Sin acceso operativo, sin credenciales anteriores válidas o sin ensayo de recuperación: no se hace el cambio. |

No hay garantía transaccional de reserva/pago en este catálogo de consultas. Mantener estados y textos existentes; migrar el lector no añade esa garantía.

## Matriz proporcional de capas

| Capa | Estado del plan / puerta |
| --- | --- |
| Contratos y consumidores | APLICA: endpoint web, Config interno de waitlist y formas de respuesta. Puertas 2–3. |
| Backend y fallas parciales | APLICA: Google auth, lectura directa, deadlines, token, validación y recuperación. Puertas 1–4. |
| Seguridad y datos | APLICA: nueva custodia, archivo completo, reader separado, proyección y aislamiento de contactos. Puerta 1 bloqueante. |
| UI y accesibilidad | APLICA como regresión del recorrido; no rediseño. Carga/error, filtros, selección, foco y responsive. Puerta 3 y comprobación pública. |
| WordPress/WooCommerce/React | NO APLICA: runtime standalone HTML/JS, Functions TypeScript, Apps Script V8 y Sheets REST. |
| Recursos/build/SEO | APLICA: auth solo en Functions, Node 24, lockfile, dist sin secretos/fuentes privadas y metadata social conservada. |
| Repositorio/operación | APLICA: checkout compartido, alcance aislado, deploy atómico, configuración por deploy, permisos reales y recuperación ensayada. |

## Pendientes explícitos antes de implementar/publicar

1. Acceso operativo de Google/Netlify y despliegue del candidato sintético verificados. Falta ensayar recuperación por el puente en un candidato autorizado y registrar su tiempo real.
2. Custodia de prueba aprobada y configurada solo en deploy-preview, con scopes estándar del plan y cuenta nueva sin acceso real. Custodia de producción y aislamiento del archivo real siguen pendientes.
3. Inventario seguro de datos privados dentro del workbook; aceptar conscientemente el alcance reader por archivo. Si se exige mantener credenciales lectoras fuera de Netlify, la variante directa propuesta no está aprobada y se requiere otra decisión.
4. Autenticación y benchmark desde Netlify verificados con la Sheet sintética. Falta comparación equivalente con datos reales una vez resuelto su aislamiento. No prometer latencia productiva ni fecha de cambio antes de medirlos.
5. Alcance exacto de commit/release y autorizaciones para datos reales, publicación y prueba sintética de inscripción. El candidato sintético ya estaba autorizado y fue desplegado sin publicar producción.

## Fuentes verificadas

- Código: `netlify/functions/catalog.mts`, `netlify/functions/waitlist.mts`, `netlify/edge-functions/category-preview.ts`, `app.js`, `scripts/build.mjs`, `scripts/waitlist-build-config.mjs`, `scripts/check-waitlist-deployment.mjs`, `integrations/waitlist/Code.gs`, `GoogleSheets.gs`, README y pruebas existentes.
- [Autenticación servidor a servidor de Google](https://developers.google.com/identity/protocols/oauth2/service-account).
- [Scopes de Google Sheets: por archivo, no pestaña](https://developers.google.com/workspace/sheets/api/scopes).
- [Gestión de claves de cuentas de servicio](https://docs.cloud.google.com/iam/docs/best-practices-for-managing-service-account-keys).
- [Variables de Functions y configuración capturada por deploy](https://docs.netlify.com/build/functions/environment-variables/).
- [Variables sensibles y deploys no confiables](https://docs.netlify.com/build/environment-variables/get-started/).
- [Functions en desarrollo local con Netlify CLI](https://docs.netlify.com/api-and-cli-guides/cli-guides/manage-functions/).
- [Deploy Previews, acceso y variables por contexto](https://docs.netlify.com/deploy/deploy-types/deploy-previews/).
- [Deploys atómicos de Netlify](https://docs.netlify.com/deploy/deploy-overview/).
- Skill de Netlify Deploy: procedimiento del agente mediante nuevo deploy correctivo; no restauración de deploy viejo. Estándar de entrega del proyecto: autorización y QA real de publicación.
