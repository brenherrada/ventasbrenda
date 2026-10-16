# Migración productiva del catálogo — 16/10/2026

Estado: **publicado, verificado y con observación inicial completada**. La migración se publicó con `de8608696955f9cf0d578d2d6196b2cfea201b64`, deploy `6ad24bcb03a02137c5a36cd2`, el 16/10/2026 a las 16:07:59 UTC. La corrección de la reserva de espacio inicial se publicó con `1a9dae66bd518ee2d21824aed1cdab0ff2ab7ef0`, deploy `6ad24f70fdc53a3f97aa2605`, a las 16:23:26 UTC; ese es el runtime productivo final. Main avanzó por fast-forward; el checkout compartido permanece en `codex/catalogo-mejoras-y-migracion`.

## Autorización y alcance

Bren pidió hacerse cargo de punta a punta hasta producción, después de probar en preview antes de main. Aprobó expresamente «Separar Pendientes y completar la migración», incluyendo una cuenta nueva de solo lectura y su clave secreta en Netlify para producción y prueba final, accesible también al build por el plan disponible. No se reutilizaron claves de Google del puente, ni se cambió el plan, DNS, fórmulas, precios o permisos públicos. Los cambios de UI/minicart ya revisados permanecen en la rama compartida `codex/catalogo-mejoras-y-migracion`; el otro chat confirmó que no tenía ediciones pendientes.

## Datos privados y permisos

- Se hizo una copia nativa del workbook, conservando en el nuevo archivo únicamente Pendientes. Se compararon valores, fórmulas, formatos, notas, chips, validaciones y la tabla nativa `SeguimientoPendientes` antes de retirar los registros del original. La copia coincide exactamente y tiene solo a la propietaria como autorizada.
- Se verificó que las fórmulas del catálogo y ventas no dependen de Pendientes. El archivo original conserva el ID de su pestaña y un enlace al archivo privado. Se releyó todo el rango usado después de limpiar: únicamente quedan los tres textos/enlace previstos, sin notas ni registros personales. No se registraron datos de clientas en evidencia, logs o Git.
- Se creó `catalog-netlify-reader@plot-twist-catalog.iam.gserviceaccount.com` sin roles de proyecto, con permiso reader únicamente sobre el archivo del catálogo. Google devolvió 403 al leer Pendientes y la lista de espera, al leer anónimamente el catálogo y al intentar un batch de escritura vacío. La denegación de escritura se comprobó tanto con el scope readonly del runtime como con un token de scope de escritura para verificar el permiso real del archivo.
- Se conserva el historial del archivo original como recuperación de la propietaria; no se promete borrado irreversible de revisiones. Google exige permisos de edición para acceder a [revisiones históricas mediante Drive](https://developers.google.com/workspace/drive/api/guides/manage-revisions); la cuenta nueva es reader. Este punto se contrastó con documentación oficial, sin descargar revisiones ni ampliar permisos. Mantener nuevos datos personales exclusivamente en el archivo privado.
- Las lecturas locales reales de Catalogo (94 filas), Config (10 claves) y Ventas (un agregado) coinciden con el puente. No se copió información privada al artefacto web.
- Las variables productivas se configuraron y releyeron sin imprimir valores. La clave está marcada secreta con Builds/Functions/Runtime. El despliegue publicado permaneció en `6ad174c760716e72a684808b`, SHA `d29fb5986526bbe263283a2ffc82bca5a87374fa`, después del cambio de configuración.

## Preview final y observaciones de preparación

El candidato usa las mismas fuentes de runtime y funciones verificadas en `c84c604`; la configuración auxiliar de build está fuera del checkout y no se distribuye. La instalación de dependencias es real dentro de la copia aislada, sin enlaces externos a node_modules.

La primera prueba de variables específicas por deploy de la CLI 27.5.2 no cambió la configuración efectiva: `6ad248ad146bf043c3f354a2` seguía leyendo la planilla sintética. La comparación de contenidos lo detectó antes de admitir mediciones. Se creó un contexto específico temporal `catalog-migration-validation`, separado del preview genérico. El deploy `6ad249420a9077b7eff20e09`, contexto `branch-deploy`, lee el catálogo real. Nunca se publicó a producción. Las variables temporales ya fueron retiradas al cerrar la prueba; esto no equivale a revocar una clave capturada por un deploy previo.

El build local de la CLI recibe valores secretos enmascarados. El helper temporal omite la clave de Google únicamente en el build estático, que no la utiliza; conserva el preflight del repositorio y comprueba por separado permisos y lectura real de Functions. Los builds de producción recibieron su configuración real y pasaron el gate normal.

## Gates de salida

- Comparación equivalente: 20 ciclos espaciados, mismos datos y proyección idéntica en cada par exitoso. Directo: 60/60 respuestas 200. El puente tuvo un 503 de Ventas a los 17.487 ms. Se incluyen todas las muestras, incluso errores y primeras lecturas; no se eliminan extremos.
- Recuperación: se desplegó fuera de producción un directo con un archivo sin permiso (`6ad24a646698934874844616`): Catalogo y Config devolvieron 503 genérico y la UI ofreció reintento. Después se cambió el contexto de prueba a bridge y se creó el nuevo deploy `6ad24ad50a9a7480b4523478`. Configuración, build, deploy y verificaciones completas tardaron 58 s. Los tres recursos volvieron a 200, la selección persistida se conservó y waitlist siguió bloqueado con 403. La selección de prueba se creó mediante la UI del directo y se transfirió al origen del ensayo para simular una visita existente; no se usaron datos ni storage de visitantes reales.
- Navegador real: Chromium, Firefox y WebKit a 390×900 y 1440×900; seis recorridos y 54 respuestas de API 200. Fotos comerciales por Image CDN/Google cargadas, galería y zoom, descripción, búsqueda vacía/restablecida, categorías por URL, selección y recarga, validación y destino WhatsApp interceptado. Sin excepciones JS, errores de imágenes ni overflow horizontal en esta muestra. Se ajustó el script de QA para abrir la búsqueda mobile y usar descripciones realmente truncadas; no se cambió la aplicación para hacer pasar las pruebas.
- Preflight remoto de waitlist: aprobado antes y después de publicar. Se enviaron inscripciones sintéticas mediante la UI pública, se observaron dos confirmaciones 200 (3.077/2.452 ms), se releyó una única fila con consentimiento en Sheets y se eliminaron exclusivamente sus valores, conservando la validación/formato. Nueva búsqueda: cero coincidencias. El primer script de QA dejó de esperar a los 20 s, antes del máximo del servidor; la inscripción sí estaba guardada. Se ajustó únicamente el timeout de QA y se conservaron las pruebas de deduplicación. No se cambió el timeout de la aplicación.
- Backend y estilos: pruebas del catálogo/privacidad/identidades, 43 casos del lector directo, 39 de waitlist, preflight de build y cinco salidas Sass aprobadas. Los upstream de las pruebas unitarias son sintéticos; la evidencia de Google real se registra por separado.
- Publicación: SHA exacto y estado ready/publicado confirmados. Pasaron seis recorridos públicos en Chromium/Firefox/WebKit a 390×900 y 1440×900, 54 respuestas de API 200, fotos comerciales, galería/zoom, categorías, búsqueda, selección, persistencia y WhatsApp interceptado. Se revisaron capturas con imágenes e iconos ya cargados. No se enviaron mensajes de WhatsApp.

## Verificación de producción

Los 84 archivos del artefacto coinciden con el candidato: 82 byte por byte, HTML exacto tras retirar solo la inyección RUM de Netlify y `_headers` consumido como configuración. Se comprobaron CSP y metadata social de categoría/badge, seis rutas privadas con 404 y ausencia de material de la clave. Las fuentes de las seis piezas de Functions coinciden con el candidato. El último ajuste cambió solo la reserva CSS inicial, su prueba y documentación. Se volvió a comparar el artefacto público completo después de ese ajuste.

Los logs del deploy productivo confirman `source: direct`, lecturas correctas y reutilización de tokens. Las primeras muestras de observabilidad incluyen los 400/404 provocados por QA de límites y cancelaciones 499 de navegaciones/pruebas; se registran separadas de errores del servidor. La prueba inicial de waitlist interrumpida no se presenta como respuesta confirmada.

Los totales se recalcularon desde la proyección pública: 94 artículos, 60 vendidos, $1.334.000 recaudados y meta $2.183.000; coinciden con Config/Ventas. No se modificaron fórmulas comerciales.

Se retiraron las cinco variables del contexto temporal específico. Producción conserva su cuenta nueva; el preview genérico conserva únicamente su cuenta sintética. Se eliminó la copia local de transferencia y se revisaron los auxiliares/cachés del candidato sin encontrar el identificador de la clave nueva. Los deploys históricos conservan la configuración capturada: eliminar el contexto no equivale a revocar la clave.

Se descartaron las capturas intermedias propias y la copia aislada temporal del build después de la revisión, conservando evidencia final y resultados compactos. No se eliminaron las capturas del otro chat. Sass watch permanece activo.

## Estabilidad visual durante la carga

La comprobación pública detectó un salto inicial del banner de LegXercise antes de que app.js insertara los placeholders. Se reservó espacio únicamente cuando la lista está vacía y ocupada, con un único `clamp()` en `scss/catalog/_skeletons.scss`. La regla deja de actuar al llegar los placeholders/productos o al mostrar error/vacío; no cambia datos ni componentes cargados.

El preview `6ad24eeb06a4623004cb390c` pasó antes de avanzar main. Las pruebas de carga se ejecutaron en Chromium, Firefox y WebKit a 320, 390, 766, 767, 768, 1024 y 1440 px, incluyendo llegada tardía de JavaScript/fuentes/datos, reintento y vacío. Pasaron de nuevo contra producción. En tres recargas de Chromium a 390×900 con datos reales, CLS bajó de aproximadamente 0,109–0,116 a 0,0162 / 0,0162 / 0,0138, sin desplazamientos del banner. Son muestras de laboratorio, no métricas de todos los visitantes.

Después de publicar `1a9dae6`, también pasaron dos recorridos comerciales completos en Chromium a 390×900 y 1440×900: 18 respuestas de API 200, imágenes reales, filtros, selección, persistencia y WhatsApp interceptado, sin excepciones ni overflow. Los productos aparecieron en 1.459 y 1.042 ms en esas dos muestras. Las capturas finales se revisaron con las fotos cargadas.

## Comparación equivalente antes del cambio

Duración completa desde esta máquina, incluida la red. p95 muestral por rango más cercano, 20 muestras por recurso/fuente; no certifica un percentil de tráfico productivo ni un arranque frío de infraestructura.

| Recurso / fuente | Primera | Mediana | p95 | Máximo | Fallas |
| --- | ---: | ---: | ---: | ---: | ---: |
| Catalogo puente | 3.366 ms | 2.255 ms | 4.704 ms | 14.729 ms | 0/20 |
| Catalogo directo | 1.924 ms | 640 ms | 1.188 ms | 1.924 ms | 0/20 |
| Config puente | 2.037 ms | 3.051 ms | 4.594 ms | 13.538 ms | 0/20 |
| Config directo | 989 ms | 538 ms | 1.064 ms | 1.130 ms | 0/20 |
| Ventas puente | 2.291 ms | 1.660 ms | 14.429 ms | 17.487 ms | 1/20 |
| Ventas directo | 1.823 ms | 514 ms | 912 ms | 1.823 ms | 0/20 |

Catalogo mejora 72% en mediana y 75% en p95 de esta muestra, cumpliendo el objetivo de p95 ≤2,5 s y mejora ≥30%. Se reutiliza únicamente el token OAuth; precios, stock y configuración continúan leyéndose en cada consulta.

## Observación de producción

Observación activa completada de 2026-10-16T16:08:45.794Z a 2026-10-16T16:39:32.681Z (30.8 minutos): 90 lecturas, todas HTTP 200. Se consultaron los tres recursos una vez por minuto; no se activó ningún criterio de recuperación. Incluye el primer despliegue del lector y el ajuste CSS posterior, que no modificó Functions.

| Recurso | Muestras | Mediana | p95 muestral | Máximo | Fallas |
| --- | ---: | ---: | ---: | ---: | ---: |
| Catalogo | 30 | 966 ms | 2728 ms | 2778 ms | 0 |
| Config | 30 | 1003 ms | 2152 ms | 7209 ms | 0 |
| Ventas | 30 | 918 ms | 1976 ms | 2154 ms | 0 |

El p95 de Catalogo en esta ventana productiva fue 2.728 ms, por encima del objetivo de 2,5 s que sí pasó la comparación equivalente previa. La mediana quedó por debajo de un segundo y no hubo fallas ni umbrales de recuperación activados; conservar el puente y revisar otra ventana representativa antes de retirarlo. No se presenta el rendimiento de laboratorio como garantía para cada visita.

La observabilidad de Netlify para main, de 16:08:00 a 16:39:16 UTC, no registra respuestas 5xx en ninguna ruta. catalog: 257 respuestas 200, 9 respuestas 499, 4 respuestas 400, 2 respuestas 404; waitlist: 3 respuestas 200, 1 respuesta 499. Los 400/404 del catálogo coinciden con las pruebas negativas deliberadas. Los 499 son solicitudes canceladas; no se cuentan como respuestas exitosas ni se atribuyen todas a una causa sin el detalle individual. Esta ventana incluye tráfico de QA y no equivale a una medición exclusiva de visitantes.

Durante la ventana se conservó un outlier de Config: 7.209 ms de extremo a extremo, HTTP 200, mientras Catalogo respondió en 824 ms en el mismo ciclo. La solicitud `01M52RSEF9Y7BJER734RGQ8G6D`, a las 16:30:12 UTC, confirma 7.073 ms en el borde de Netlify, 902 ms de invocación y 163 ms del lector (162 ms de Sheets, token reutilizado, un intento). La demora restante está fuera de la lectura de Google; estos registros no permiten atribuir su causa exacta a infraestructura o red. No se elimina la muestra ni se promete que todas las consultas tarden menos de un segundo. Config no bloquea la aparición de productos.

## Operación después de publicar

Conservar el puente al menos 48 horas y hasta cubrir tráfico representativo, renovación de token y una instancia nueva. No eliminar su escritor ni sus variables: la lista de espera sigue usándolos. La observación inicial prevista es de 30–60 minutos; no representa vigilancia continua posterior al cierre del chat ni QA de dispositivos físicos. Los tests cubren renovación/rechazo de tokens con upstream sintético y los logs reales muestran autenticación y reutilización; esta ventana no demuestra una renovación real por vencimiento de una hora.

Recuperar mediante un nuevo deploy con `CATALOG_SOURCE=bridge` si hay tres fallas consecutivas de Catalogo, dos comprobaciones consecutivas mayores a seis segundos, indisponibilidad reproducible, discrepancia comercial o regresión de inscripción atribuible al cambio. Cambiar una variable requiere redeploy; no es un interruptor instantáneo. Ante exposición de una clave, revocar exclusivamente la afectada y seguir el procedimiento de incidente.

Evidencia local ignorada por Git: `output/qa/catalog-migration/production-google-check.json`, `production-env-metadata.json`, comparación, resultados de navegador y despliegues. No contiene credenciales ni registros de clientas. Las pruebas sintéticas anteriores y su cobertura responsive/adversa están en [PREVIEW-VERIFICATION.md](PREVIEW-VERIFICATION.md).

El cierre del informe se incorpora con un commit exclusivo de documentación y `[skip netlify]`. El runtime publicado sigue siendo `1a9dae6`; no se presenta ese commit documental como un nuevo deploy.
