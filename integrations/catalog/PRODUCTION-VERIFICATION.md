# Migración productiva del catálogo — 16/10/2026

Estado: validación final en curso; producción continúa con el despliegue anterior hasta completar la comparación, el ensayo de recuperación y el QA real.

## Autorización y alcance

Bren pidió hacerse cargo de punta a punta hasta producción, después de probar en preview antes de main. Aprobó expresamente «Separar Pendientes y completar la migración», incluyendo una cuenta nueva de solo lectura y su clave secreta en Netlify para producción y prueba final, accesible también al build por el plan disponible. No se reutilizaron claves de Google del puente, ni se cambió el plan, DNS, fórmulas, precios o permisos públicos. Los cambios de UI/minicart ya revisados permanecen en la rama compartida `codex/catalogo-mejoras-y-migracion`; el otro chat confirmó que no tenía ediciones pendientes.

## Datos privados y permisos

- Se hizo una copia nativa del workbook, conservando en el nuevo archivo únicamente Pendientes. Se compararon valores, fórmulas, formatos, notas, chips, validaciones y la tabla nativa `SeguimientoPendientes` antes de retirar los registros del original. La copia coincide exactamente y tiene solo a la propietaria como autorizada.
- Se verificó que las fórmulas del catálogo y ventas no dependen de Pendientes. El archivo original conserva el ID de su pestaña y un enlace al archivo privado. Se releyó todo el rango usado después de limpiar: únicamente quedan los tres textos/enlace previstos, sin notas ni registros personales. No se registraron datos de clientas en evidencia, logs o Git.
- Se creó `catalog-netlify-reader@plot-twist-catalog.iam.gserviceaccount.com` sin roles de proyecto, con permiso reader únicamente sobre el archivo del catálogo. Google devolvió 403 al leer Pendientes y la lista de espera, al leer anónimamente el catálogo y al intentar un batch de escritura vacío. La denegación de escritura se comprobó tanto con el scope readonly del runtime como con un token de scope de escritura para verificar el permiso real del archivo.
- Las lecturas locales reales de Catalogo (94 filas), Config (10 claves) y Ventas (un agregado) coinciden con el puente. No se copió información privada al artefacto web.
- Las variables productivas se configuraron y releyeron sin imprimir valores. La clave está marcada secreta con Builds/Functions/Runtime. El despliegue publicado permaneció en `6ad174c760716e72a684808b`, SHA `d29fb5986526bbe263283a2ffc82bca5a87374fa`, después del cambio de configuración.

## Preview final y observaciones de preparación

El candidato usa las mismas fuentes de runtime y funciones verificadas en `c84c604`; la configuración auxiliar de build está fuera del checkout y no se distribuye. La instalación de dependencias es real dentro de la copia aislada, sin enlaces externos a node_modules.

La primera prueba de variables específicas por deploy de la CLI 27.5.2 no cambió la configuración efectiva: `6ad248ad146bf043c3f354a2` seguía leyendo la planilla sintética. La comparación de contenidos lo detectó antes de admitir mediciones. Se creó un contexto específico temporal `catalog-migration-validation`, separado del preview genérico. El deploy `6ad249420a9077b7eff20e09`, contexto `branch-deploy`, lee el catálogo real. Nunca se publicó a producción. Las variables temporales se retiran al cerrar la prueba; esto no equivale a revocar una clave capturada por un deploy previo.

El build local de la CLI recibe valores secretos enmascarados. El helper temporal omite la clave de Google únicamente en el build estático, que no la utiliza; conserva el preflight del repositorio y comprueba por separado permisos y lectura real de Functions. El build de producción en Netlify debe recibir su configuración real y pasar el gate normal.

## Gates de salida

- Comparación equivalente: 20 ciclos espaciados, mismos datos y proyección idéntica en cada par exitoso. Directo: 60/60 respuestas 200. El puente tuvo un 503 de Ventas a los 17.487 ms. Se incluyen todas las muestras, incluso errores y primeras lecturas; no se eliminan extremos.
- Recuperación: se desplegó fuera de producción un directo con un archivo sin permiso (`6ad24a646698934874844616`): Catalogo y Config devolvieron 503 genérico y la UI ofreció reintento. Después se cambió el contexto de prueba a bridge y se creó el nuevo deploy `6ad24ad50a9a7480b4523478`. Configuración, build, deploy y verificaciones completas tardaron 58 s. Los tres recursos volvieron a 200, la selección persistida se conservó y waitlist siguió bloqueado con 403. La selección de prueba se creó mediante la UI del directo y se transfirió al origen del ensayo para simular una visita existente; no se usaron datos ni storage de visitantes reales.
- Navegador real: Chromium, Firefox y WebKit a 390×900 y 1440×900; seis recorridos y 54 respuestas de API 200. Fotos comerciales por Image CDN/Google cargadas, galería y zoom, descripción, búsqueda vacía/restablecida, categorías por URL, selección y recarga, validación y destino WhatsApp interceptado. Sin excepciones JS, errores de imágenes ni overflow horizontal en esta muestra. Se ajustó el script de QA para abrir la búsqueda mobile y usar descripciones realmente truncadas; no se cambió la aplicación para hacer pasar las pruebas.
- Preflight remoto de waitlist: aprobado; variables productivas protegidas en Builds/Functions. Persistencia real y deduplicación se comprueban después de publicar, con un registro sintético y limpieza exacta.
- Backend y estilos: pruebas del catálogo/privacidad/identidades, 43 casos del lector directo, 39 de waitlist, preflight de build y cinco salidas Sass aprobadas. Los upstream de las pruebas unitarias son sintéticos; la evidencia de Google real se registra por separado.
- Publicación: pendiente de SHA exacto en main y deploy ready/publicado, seguida de verificación pública y observación activa.

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

## Operación después de publicar

Conservar el puente al menos 48 horas y hasta cubrir tráfico representativo, renovación de token y una instancia nueva. No eliminar su escritor ni sus variables: la lista de espera sigue usándolos. La observación inicial es de 30–60 minutos; no representa vigilancia continua posterior al cierre del chat ni QA de dispositivos físicos.

Recuperar mediante un nuevo deploy con `CATALOG_SOURCE=bridge` si hay tres fallas consecutivas de Catalogo, dos comprobaciones consecutivas mayores a seis segundos, indisponibilidad reproducible, discrepancia comercial o regresión de inscripción atribuible al cambio. Cambiar una variable requiere redeploy; no es un interruptor instantáneo. Ante exposición de una clave, revocar exclusivamente la afectada y seguir el procedimiento de incidente.

Evidencia local ignorada por Git: `output/qa/catalog-migration/production-google-check.json`, `production-env-metadata.json`, comparación, resultados de navegador y despliegues. No contiene credenciales ni registros de clientas. Las pruebas sintéticas anteriores y su cobertura responsive/adversa están en [PREVIEW-VERIFICATION.md](PREVIEW-VERIFICATION.md).
