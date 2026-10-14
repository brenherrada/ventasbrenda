# Lista de espera de la web colectiva

El globito existente abre un formulario con nombre y mail. Al enviarlo, la persona acepta que Bren la contacte por esta invitación cuando la web esté disponible. No se envían mails automáticamente ni se confirma su incorporación a la comunidad.

## Recorrido y fuentes

1. `index.html`, `waitlist.js` y `scss/promo.scss` reutilizan el popover y los controles del catálogo. El formulario no conserva datos personales en localStorage.
2. `/api/waitlist` valida método, origen, JSON, tamaño, nombre, mail, consentimiento y honeypot. Consulta el mismo `mostrar_boton_vender` de Config antes de intentar guardar. La regla de Netlify limita cinco solicitudes por IP y dominio en sesenta segundos. Su respuesta 429 se verificó en producción; la aplicación puede demorar hasta diez segundos después de superar el umbral, según la documentación de Netlify.
3. La función utiliza `WAITLIST_SCRIPT_URL` y `WAITLIST_SCRIPT_SECRET`, variables privadas disponibles para Functions. El plan actual no permite elegir un scope exclusivo: la URL utiliza los scopes permitidos del proyecto y la clave los de Builds, Functions y Runtime, con valores solo para producción y marcada como secreta. No deben figurar en `config.js`, HTML, Git, logs ni respuestas públicas.
4. Google Apps Script recibe la solicitud con la clave de conexión, valida los datos nuevamente y escribe únicamente en la pestaña `Lista de espera` de la planilla privada indicada en `WAITLIST_SHEET_ID`. Esta lista no pertenece a la planilla pública del catálogo.
5. El script toma un lock, busca el mail sin distinguir mayúsculas y agrega una fila solo si no existe. Guarda fecha, nombre, mail, estado `En espera`, fecha de contacto vacía y consentimiento `waitlist-v1`. Los caracteres que podrían iniciar fórmulas se guardan como texto literal. No expone una ruta de lectura de los contactos.
6. Solo una respuesta de guardado confirmada muestra éxito y limpia el formulario. Un error, timeout o respuesta no confirmada conserva los campos y permite reintentar. El mismo mail se considera una inscripción existente; no se revela ni reemplaza su nombre.

## Activación

La planilla privada y el script ya están activos. Google fue autorizado y la versión 1 del endpoint quedó publicada durante esta tarea. Los IDs privados se mantienen en la configuración de Google, fuera de los archivos públicos del sitio.

1. Guardar `Code.gs` y `appsscript.json` en el proyecto de Apps Script propio de Bren. Configurar `WAITLIST_SHEET_ID` y una clave aleatoria de conexión en `WAITLIST_SECRET`, en Script Properties.
2. Autorizar el permiso de Google Sheets y desplegar como Web app, ejecutar como propietaria y permitir solicitudes anónimas al endpoint. El endpoint exige la clave de conexión para guardar; la planilla permanece privada. El permiso OAuth de Sheets es amplio a las planillas de la cuenta: requiere aprobación expresa antes de otorgarlo, aunque el código solo use esta lista.
3. Guardar la URL `/exec` en `WAITLIST_SCRIPT_URL` y la misma clave en `WAITLIST_SCRIPT_SECRET` de Netlify, incluyendo Functions entre los scopes permitidos por el plan. No solicitar un scope exclusivo de Functions si el plan lo rechaza. La clave de producción está marcada como secreta. Para desarrollo local se utiliza `.env` ignorado por Git; Netlify no permite marcar como secreta una variable del contexto dev. No enviar la clave por chat. Rotarla en ambos destinos si se expone.
4. Probar una inscripción sintética, confirmar su fila en Google Sheets, repetir el mismo mail y comprobar que no se duplica. Eliminar únicamente esa fila de prueba después de verificar su contenido exacto.
5. Publicar el sitio solo con autorización. Verificar el formulario en el deploy real, la regla de rate limit y que no aparecen datos personales en respuestas ni logs.

Sin la URL y la clave configuradas, el endpoint responde 503. No simula un guardado exitoso. La autorización, la conexión y la persistencia real en Google Sheets están verificadas. Dos envíos con el mismo mail generaron una única fila. Las pruebas automatizadas de estados de interfaz usan respuestas simuladas; el envío desde el navegador local se verifica además contra el endpoint real. El 14/10/2026 se corrigió la configuración de producción y se publicó el deploy `6acf6de6fc5efdb6fa15a057`, desde el commit `27a1b1d`. El formulario público respondió 200 desde desktop y mobile; ambos envíos generaron una sola fila en la planilla privada.

## Validación

- `node tests/waitlist.mjs`: validación, flag, fallas, configuración privada, lock, duplicados y escape de fórmulas. El servicio Google se simula en estas pruebas.
- `PLAYWRIGHT_MODULE=... QA_URL=... node tests/waitlist-ui.mjs`: formulario vacío, envío en curso, doble submit, error/reintento, éxito, foco y tamaños de 320 a 1440 px, incluyendo ventanas bajas.
- `node tests/web-promo-config.mjs`: encendido/apagado desde Config, recarga, Config lenta/fallida, JSONP y sin JavaScript.
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
