# Lista de espera de la web colectiva

El globito existente abre un formulario con nombre y mail. Al enviarlo, la persona acepta que Bren la contacte por esta invitación cuando la web esté disponible. No se envían mails automáticamente ni se confirma su incorporación a la comunidad.

## Recorrido y fuentes

1. `index.html`, `waitlist.js` y `scss/promo.scss` reutilizan el popover y los controles del catálogo. El formulario no conserva datos personales en localStorage.
2. `/api/waitlist` valida método, origen, JSON, tamaño, nombre, mail, consentimiento y honeypot. Consulta el mismo `mostrar_boton_vender` de Config antes de intentar guardar. La regla de Netlify limita cinco solicitudes por IP y dominio en sesenta segundos. Su respuesta 429 se verificó en producción; la aplicación puede demorar hasta diez segundos después de superar el umbral, según la documentación de Netlify.
3. La función utiliza `WAITLIST_SCRIPT_URL` y `WAITLIST_SCRIPT_SECRET`, variables privadas disponibles para Functions. El plan actual no permite elegir un scope exclusivo: la URL utiliza los scopes permitidos del proyecto y la clave los de Builds, Functions y Runtime, con valores solo para producción y marcada como secreta. No deben figurar en `config.js`, HTML, Git, logs ni respuestas públicas.
4. Google Apps Script recibe la solicitud con la clave de conexión, valida los datos nuevamente y escribe únicamente en la pestaña `Lista de espera` de la planilla privada indicada en `WAITLIST_SHEET_ID`. Esta lista no pertenece a la planilla de gestión del catálogo, que también debe permanecer privada.
5. El script toma un lock, busca el mail sin distinguir mayúsculas y agrega una fila solo si no existe. Guarda fecha, nombre, mail, estado `En espera`, fecha de contacto vacía y consentimiento `waitlist-v1`. Los caracteres que podrían iniciar fórmulas se guardan como texto literal. No expone una ruta de lectura de los contactos.
6. Solo una respuesta de guardado confirmada muestra éxito y limpia el formulario. Un error, timeout o respuesta no confirmada conserva los campos y permite reintentar. El mismo mail se considera una inscripción existente; no se revela ni reemplaza su nombre.

## Activación

La planilla privada y el script están activos. La versión 3 utiliza dos cuentas de servicio limitadas por archivo; la autorización personal anterior de Sheets fue revocada. Los IDs y las credenciales no se distribuyen en el sitio.

1. Guardar `Code.gs`, `GoogleSheets.gs` y `appsscript.json` en Apps Script. Conservar `WAITLIST_SHEET_ID` y `WAITLIST_SECRET` en Script Properties. Guardar allí los JSON de las cuentas del puente en `CATALOG_SERVICE_ACCOUNT` y `WAITLIST_SERVICE_ACCOUNT`; nunca en código, Git, Netlify ni archivos públicos. Excepción independiente autorizada por Bren el 16/10/2026: una cuenta nueva `catalog-preview-reader`, sin acceso a los archivos reales, usa `CATALOG_GOOGLE_CREDENTIALS` secreta únicamente en el contexto `deploy-preview` de Netlify para leer una planilla sintética privada. Sus scopes incluyen Builds/Functions/Runtime por el plan disponible. Esto no autoriza trasladar las claves del puente ni dar acceso a datos reales. Ver [integración del catálogo](../catalog/README.md).
2. En el proyecto Google Cloud `plot-twist-catalog`, mantener Sheets API habilitada y las cuentas sin roles de proyecto. Compartir únicamente el archivo del catálogo como reader con `catalog-reader@plot-twist-catalog.iam.gserviceaccount.com` y el archivo de lista de espera como writer con `waitlist-writer@plot-twist-catalog.iam.gserviceaccount.com`. Autorizar al script solo `script.external_request`, ejecutar la Web app como propietaria y conservar el endpoint protegido por la clave de conexión. No volver a conceder acceso OAuth personal a Sheets. El aislamiento de Google es por archivo, no por pestaña; la proyección pública sigue siendo obligatoria.
3. Guardar la URL `/exec` en `WAITLIST_SCRIPT_URL` y la misma clave en `WAITLIST_SCRIPT_SECRET` de Netlify, incluyendo Functions entre los scopes permitidos por el plan. No solicitar un scope exclusivo de Functions si el plan lo rechaza. La clave de producción está marcada como secreta. Para desarrollo local se utiliza `.env` ignorado por Git; Netlify no permite marcar como secreta una variable del contexto dev. No enviar la clave por chat. Rotarla en ambos destinos si se expone.
4. Probar una inscripción sintética, confirmar su fila en Google Sheets, repetir el mismo mail y comprobar que no se duplica. Eliminar únicamente esa fila de prueba después de verificar su contenido exacto.
5. Publicar el sitio solo con autorización. Verificar el formulario en el deploy real, la regla de rate limit y que no aparecen datos personales en respuestas ni logs.

Sin la URL y la clave configuradas, el endpoint responde 503. No simula un guardado exitoso. La autorización, la conexión y la persistencia real en Google Sheets están verificadas. Dos envíos con el mismo mail generaron una única fila. Las pruebas automatizadas de estados de interfaz usan respuestas simuladas; el envío desde el navegador local se verifica además contra el endpoint real. El 14/10/2026 se corrigió la configuración de producción y se publicó el deploy `6acf6de6fc5efdb6fa15a057`, desde el commit `27a1b1d`. El formulario público respondió 200 desde desktop y mobile; ambos envíos generaron una sola fila en la planilla privada.

## Validación

- `node tests/waitlist.mjs`: validación, flag, fallas, configuración privada, lock, duplicados y escape de fórmulas. El servicio Google se simula en estas pruebas.
- `node tests/google-identities.mjs`: firma RSA real con clave efímera, JWT, scopes separados, caché, archivos/rangos fijos, denegación de escritura del lector y errores sin credenciales. No utiliza las claves reales.
- `PLAYWRIGHT_MODULE=... QA_URL=... node tests/waitlist-ui.mjs`: formulario vacío, envío en curso, doble submit, error/reintento, éxito, foco y tamaños de 320 a 1440 px, incluyendo ventanas bajas.
- `node tests/web-promo-config.mjs`: encendido/apagado desde Config, recarga, Config lenta/fallida, ausencia de conexiones directas a Google y sin JavaScript.
- `npm run build`, `npm run styles:check` y pruebas E2E del catálogo. Revisar el artefacto distribuido; `Code.gs`, el manifiesto, documentos y secretos no se copian a `dist`.

Referencias oficiales: [Web Apps de Google Apps Script](https://developers.google.com/apps-script/guides/web), [LockService](https://developers.google.com/apps-script/reference/lock/lock-service), [API de Netlify Functions](https://docs.netlify.com/build/functions/api/).

## Incidente y puerta de producción — 14/10/2026

El deploy inicial del formulario estaba publicado sin las variables de conexión. La configuración intentaba usar un scope exclusivo de Functions que el plan no permite; las confirmaciones de comandos y conectores no demostraban persistencia. El servidor local utilizaba su `.env`, por eso el guardado local no detectó la falta de configuración remota. Se reprodujo el 503 público, se guardaron y verificaron las dos variables en el dashboard y la API, y se regeneró producción. No se cambiaron los permisos de la planilla.

Antes de publicar cualquier cambio de esta función, ejecutar:

```sh
NETLIFY_SITE_ID=14da67c8-b1af-424e-90bc-51aad09c551d npm run waitlist:preflight
```

El preflight falla si no puede leer el proyecto, falta una variable de producción, no está disponible para Builds y Functions o la clave no está protegida. No imprime valores. Su aprobación no prueba el deploy: después de publicar, abrir la URL pública, enviar datos sintéticos desde el formulario sin simular la API, verificar la fila en Google Sheets, repetir el mismo mail para comprobar duplicados y retirar solo el registro de prueba. Conservar request IDs y capturas sin datos de clientas.

La prueba real de producción se ejecutó en Chromium a 1440×900 y 390×844, con respuestas 200, campos limpiados y confirmación visible. Se verificó una sola fila para dos envíos del mismo mail y se retiraron únicamente los valores de ese registro sintético. Los registros anteriores se conservaron. La prueba del limitador utilizó solicitudes inválidas que no guardan contactos; se confirmó el 429 después del intervalo de aplicación. Ver [tiempo de aplicación del limitador](https://docs.netlify.com/manage/security/secure-access-to-sites/rate-limiting/#enforcement-timing).

## Bloqueo automático del build

`scripts/build.mjs` ejecuta `verifyWaitlistBuildConfig()` antes de reemplazar `dist`. En builds de Netlify con contexto `production`, falla si falta la URL o la clave, si la URL no es un endpoint `/exec` válido, o si la clave está vacía, enmascarada o tiene menos de 32 caracteres. No imprime valores y no carga el `.env` local: exige que Netlify entregue la configuración al proceso de build. Las variables deben estar disponibles para Builds y Functions. El control se aplica mientras la función forme parte del artefacto, aunque el globito esté oculto desde Config, porque puede habilitarse sin otro despliegue.

Local, dev y previews conservan su build habitual; eso no certifica su guardado real. Ejecutar `npm run test:waitlist-build` verifica los casos de configuración ausente o inválida y reproduce el fallo a través del entry point real del build. Esta barrera automática protege contra publicar sin variables; la prueba pública y la lectura de persistencia siguen siendo obligatorias según la sección 15 del estándar global. Ver [variables del build y metadatos de contexto de Netlify](https://docs.netlify.com/build/configure-builds/environment-variables/).


## Puente compartido de catálogo privado — 15/10/2026

El puente atiende `action: "catalog.read"`, únicamente con la clave servidor-servidor y una pestaña de la lista permitida. No acepta IDs, consultas, rangos ni propiedades adicionales para esa acción. Solo devuelve la proyección pública definida por `readPublicCatalog_`; GET y pedidos sin clave responden `{ok:false}`. No hay ruta de lectura de contactos. Netlify utiliza las mismas variables `WAITLIST_SCRIPT_URL` y `WAITLIST_SCRIPT_SECRET` y vuelve a proyectar la respuesta. Desde la versión 3, Apps Script firma JWT de las dos identidades privadas para llamar a Sheets REST; no usa `SpreadsheetApp` ni el token personal del propietario. El lock continúa cubriendo búsqueda y alta para impedir duplicados. Mantener fuente local, editor y versión desplegada sincronizados.

Verificado el 15/10/2026: versión 3 en la misma URL, autorización anterior revocada y nuevo consentimiento limitado a «Connect to an external service». Google confirmó 403 al intentar escribir con el lector y en ambos accesos cruzados entre archivos. Catálogo, Config y Ventas públicos respondieron 200; ambas planillas rechazaron exportación anónima con 401. El formulario público en Chrome, 390×844 y 1440×900, confirmó dos envíos del mismo correo sintético: una sola fila, fecha nativa, estado y consentimiento correctos. Se limpiaron solo sus valores A:F. Las copias temporales de claves se eliminaron después de verificar Script Properties.

Rotación: generar una clave de reemplazo para la misma identidad, sustituir su propiedad privada y verificar catálogo/inscripción antes de revocar la anterior. El ID de clave forma parte de la clave de caché de tokens. Rollback: conservar permisos restringidos y reparar la versión 3; las versiones 1 y 2 dependen del permiso personal retirado y no son un rollback operativo seguro. No hacer pública ninguna planilla ni reautorizar acceso amplio como recuperación.
