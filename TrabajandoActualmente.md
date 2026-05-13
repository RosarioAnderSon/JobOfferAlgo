# TrabajandoActualmente

## 2026-05-13 - Trazabilidad completa + retencion de overlays por variantes de ID
- Causa raiz confirmada: en cleanup/cache habia comparaciones rigidas de `jobId` por igualdad literal, lo que removia overlays validos cuando Upwork representaba el mismo job con formatos distintos (`022...` vs `205...`).
- Trazabilidad aplicada:
  - Nuevo flag `sniper-flow-console-v1`.
  - `appendFlowLog(...)` ahora emite `[Sniper] FLOW: <phase>` en consola cuando `sniper-flow-console-v1=1` o `sniper-log-level-v1=verbose`.
  - El payload de consola incluye `jobId`, `currentJobId`, `reason`, `sessionId`, `url`.
- Retencion aplicada:
  - `cleanupOverlays` y `removeOrphanOverlays` pasaron a validar con `isSameJobId(...)`.
  - Se agregaron fases `overlay-retained-check` y `overlay-removed`.
  - `overlay-removed` registra razon estructurada: `raw*`, `normalized*`, `variants*`, `removeReason`.
  - En cache (`existingOverlayForCard`) la dedupe ahora usa `isSameJobId(...)` y emite `overlay-retained-check` cuando conserva overlay valido.
  - En reconciliacion de card IDs (`stableAttr/attrId/linkId`) se reemplazaron comparaciones literales por `isSameJobId(...)` y `markCardJobId` ahora persiste forma canónica estable.
- Validacion:
  - `node --check` OK en:
    - `sniper-extension/content-script-base.js`
    - `sniper-extension/content-script-methods-overlay-cleanup.js`
    - `sniper-extension/content-script-methods-cache.js`
    - `sniper-extension/content-script-methods-overlay-cards.js`
  - `npm.cmd run check-sniper-guardrails` mantiene fallo preexistente: `Support Avg/hr badge config missing`.
  - Warning actual de line-count >300: `content-script-base.js` (478), `content-script-methods-cache.js` (328), `content-script-methods-flow-route.js` (440).

## 2026-05-13 - Fix final mismatch 022... vs 205... (variantes canonicas)
- Se reemplazo comparacion de IDs por variantes canonicas con `getComparableJobIdVariants(value)` e interseccion en `isSameJobId(a,b)`.
- Para IDs numericos se consideran variantes: original trim, sin ceros iniciales y (si aplica) sin prefijo `02` para casos de Upwork con doble representacion.
- Se mantuvo `normalizeJobIdForCompare` y se reutilizo como base de normalizacion.
- Se estabilizo `getOpenModalJobId()` priorizando atributos del contenedor modal (`data-opening-uid` / `data-ev-opening_uid` / `data-job-id`), luego attrs anidados, y finalmente links.
- En attrs anidados, si hay candidato equivalente a `currentJobId` por `isSameJobId`, se prioriza para evitar alternancia intra-modal.
- Se enriquecieron razones de trazas de cancelacion por mismatch con:
  - `rawJobId`, `rawActiveJobId`
  - `normalizedJobId`, `normalizedActiveJobId`
  - `variantsJobId`, `variantsActiveJobId`
- Verificacion estatica: `node --check` OK en `content-script-base.js`, `content-script-methods-route-detection.js`, `content-script-methods-flow-route.js`.
- Guardrails: persiste fallo preexistente `Support Avg/hr badge config missing`; warning de lineas >300 en `content-script-base.js` (463) y `content-script-methods-flow-route.js` (440).

## 2026-05-13 - Fix comparacion canonica de Job IDs (022... vs 205...)
- Se agregaron utilidades runtime para comparar IDs de job en forma canonica:
  - `normalizeJobIdForCompare(value)`
  - `isSameJobId(a, b)`
- Regla aplicada: si el ID es solo numerico, se recortan ceros a la izquierda antes de comparar; para IDs alfanumericos se conserva el valor trim.
- Se reemplazo comparacion directa en puntos criticos:
  - `checkCurrentPage` (skip de same job)
  - `waitForJobContent` (cancelacion por modal mismatch)
  - `processJobDetail` (guard por modal activo)
  - `renderUI` (guard por modal activo)
- Se extendieron reasons de trazas en cancelaciones para incluir IDs normalizados:
  - `normalizedJobId`
  - `normalizedActiveJobId`
- Verificacion estatica: `node --check` OK en `content-script-base.js`, `content-script-methods-route-detection.js`, `content-script-methods-flow-route.js`.
- Guardrails: `npm.cmd run check-sniper-guardrails` mantiene fallo preexistente de paridad `Support Avg/hr badge config missing`; warning de lineas >300 en `content-script-base.js` (442) y `content-script-methods-flow-route.js` (416).

## 2026-05-13 - Flow logger deterministico + fix continuidad detail/feed
- Se agrego `SniperFlowLog` persistente (`sniper-flow-log-v1`) con ring buffer en `localStorage`.
- Cada evento guarda `ts`, `phase`, `jobId`, `currentJobId`, `url`, `reason`, `sessionId`.
- Se expusieron helpers: `window.SniperFlowLog.getEvents()`, `clearEvents()`, `exportEvents()`.
- Se instrumentaron eventos en route/detail, watcher, extract/evaluate/render, cache/feed y cleanup de huerfanos.
- Fix puntual aplicado: en `checkCurrentPage`, si no hay `jobId` pero hay watcher activo y modal visible, no se resetea `currentJobId` inmediatamente para evitar corte de pipeline por transicion rapida.
- Verificacion estatica: `node --check` OK en `content-script-base.js`, `content-script-methods-route-detection.js`, `content-script-methods-flow-route.js`, `content-script-methods-cache.js`, `content-script-methods-overlay-cleanup.js`.
- Guardrails: `npm.cmd run check-sniper-guardrails` falla por issue preexistente (`Support Avg/hr badge config missing`) y reporta warning de tamano >300 lineas en `content-script-base.js` y `content-script-methods-flow-route.js`.

## 2026-05-13 - Fix desaparicion JobCard + logger errores + setup npm
- Se instalo Node LTS con `winget`; `node -v` y `npm.cmd -v` quedaron operativos en esta sesion.
- Se corrigio la carrera en `waitForJobContent(jobId)`: ahora cancela watcher previo, maneja sesion activa por detail y aborta al detectar cambio de modal/job.
- Se reforzo `processJobDetail(jobId)` para no evaluar/renderizar si el modal activo ya no corresponde al job en curso.
- Se paso `jobId` explicito en `evaluateAndRender -> renderUI`; render y cleanup dejaron de depender funcionalmente de `this.currentJobId`.
- Se agrego logger central con niveles `off` (default), `error`, `verbose`.
- Se agrego ring buffer persistente (`sniper-error-log-v1`) con fase, mensaje, timestamp, URL, `currentJobId` y stack.
- Se expusieron helpers de debug manual: `window.SniperErrorLog.getErrors()`, `clearErrors()`, `exportErrors()`.
- Verificacion estatica OK: `node --check` en los tres archivos modificados.
- `npm.cmd run check-sniper-guardrails` ejecuta, pero falla por una paridad existente no ligada a este fix: `Support Avg/hr badge config missing`.
- `check-sniper-lines` dejo warning de tamano en dos archivos: `content-script-base.js` (369) y `content-script-methods-flow-route.js` (309).

## 2026-05-06 - Fix Sniper overlay/runtime y rate-limit
- Corregida dependencia de carga en manifest: content-script-methods-flow-overlay.js se ejecuta antes de route/cache.
- Reemplazado polling fijo de overlays por scheduler gradual (warmup rapido, hold progresivo, jitter y pausa cuando la pestana no esta visible).
- Agregados guards de runtime para evitar errores de metodos faltantes en getCardJobId y removeOrphanOverlays con fallback seguro sin crash.
- Agregado lock de pasada en cache para evitar solapamiento de escaneos DOM.
- Corregidas colisiones de variables const en createSettingsButton y fallback robusto para selectedNicheKey en analytics.
## 2026-05-06 - Hotfix runtime overlay no cargado
- Causa raiz corregida: redeclaracion de const feedbackLink en createSettingsButton que invalidaba todo content-script-methods-flow-overlay.js.
- Se agrego handshake explicito de carga: window.__sniperOverlayLoaded = true al final del modulo overlay.
- hasOverlayRuntimeReady ahora diferencia "modulo overlay no cargado" vs "modulo cargado con metodos faltantes" y evita spam continuo del mismo error.
- evaluateAndRender/renderUI ahora reportan exito de render solo cuando renderUI devuelve true.
- Scheduler mantiene modo gradual y, si overlay no carga, reintenta con espera alta (modo seguro) para no hacer loops agresivos.

## 2026-05-06 - Tooltip informativo en Score Weights
- Se agrego un trigger `(i)` junto al titulo `Score Weights` / `Valores del Algoritmo` dentro del panel de ajustes.
- El tooltip explica formula y normalizacion de pesos: `baseScore = sum(componentScore * (weight / totalWeight))`.
- El tooltip muestra linea dinamica con el total actual de pesos y se actualiza al editar inputs y al guardar/restaurar.
- Se mantuvo UX minimalista con estilos locales del panel, visible por hover y focus sin redisenar layout existente.
- Ajuste UX solicitado: el trigger ahora muestra solo `i` (sin parentesis) para simular mejor el icono circular.
- Ajuste de copy: se elimino la formula tecnica del tooltip y se dejo explicacion corta, simple y directa.

## 2026-05-06 - Hardening anti-redflag (scheduler/router/DOM/logs)
- Se elimino el polling de URL cada 500ms y se dejo deteccion por `pushState/replaceState + popstate` con dedupe temporal de URL para evitar eventos duplicados.
- Se agrego dedupe en `markOverlayActivity` para no resetear el scheduler multiples veces por el mismo evento consecutivo.
- Se implemento presupuesto de mutaciones por tick en `applyCachedOverlaysToFeed` (limite por pasada + continuidad en ticks siguientes).
- La limpieza de overlays huerfanos paso a modo menos frecuente (cada N ticks o forzada por cambio de ruta/job detail) en lugar de ejecutarse siempre.
- Se agrego short-circuit cuando cache esta vacio y no hay UI de sniper en DOM para evitar trabajo innecesario.
- Se agrego debounce de render por `jobId` para no reinyectar overlay si ya existe y fue renderizado recientemente.
- Logging por defecto queda en hitos; logs de intentos internos/extraccion detallada pasan a modo `verbose` opcional con `localStorage['sniper-debug-verbose-v1']='1'`.

## 2026-05-06 - Consola minima + integridad de badges nuevos
- Se agrego control de nivel de logs por `localStorage['sniper-log-level-v1']` con default `minimal` y modo `verbose` opcional.
- En `minimal` ahora solo salen errores de Sniper, inyeccion de overlay y eventos clave de ruta/job detail.
- Se reforzo resolucion de badges con normalizacion (trim, case-insensitive, acentos) y alias para variaciones de nombre.
- Se agrego cobertura explicita del badge `Poco esfuerzo` en catalogo UI para evitar fallback no deseado.
- Se incorporo fallback neutral para badges desconocidos y trazas `verbose` de emitidos/renderizados/alias/unknown en el punto de inyeccion.

## 2026-05-06 - Fix badges no visibles en Most Recent
- Se amplio la deteccion de cards del feed con helper `getFeedJobCards()` (selectores fuertes + fallback por `a[href*="~"]` y `closest(...)`), para compatibilidad con variantes SPA de Upwork.
- Se aplico el mismo origen de cards en cache (`applyCachedOverlaysToFeed`) y en route (`findJobCardById`) para evitar inconsistencias entre inyeccion y busqueda.
- Se amplio deteccion de card padre en limpieza de huerfanos (`removeOrphanOverlays`) para no eliminar overlays validos por selector incompleto.
- Se agrego log operativo minimo `OK Overlay inyectado desde cache: N` para confirmar inyeccion de badges en feed sin abrir detail.

## 2026-05-06 - Fix detail detection + badge schema coherency
- Se fortalecio la deteccion de job detail para modal SPA con fuentes multiples de `jobId`: atributos (`data-opening-uid`, `data-ev-opening_uid`, `data-job-id`) y fallback por links `~id`.
- Se agrego observer liviano de modal para re-ejecutar `checkCurrentPage()` cuando aparece/cambia el slider sin cambio de URL.
- Se agrego `badgeSchemaVersion` runtime (`2`) y bandera de diagnostico `sniper-diag-badges-v1`.
- Se agrego hardening de cache: cada `setCachedResult` guarda `badgeSchemaVersion` y en feed se marcan como `stale` entradas sin version o version vieja.
- Politica aplicada: no inyectar badges `stale`; si existen overlays del mismo job se retiran para evitar mostrar badges viejos.
- Se agrego diagnostico temporal por flag (en modo minimal): `emit/render/cache-read/cache-write` con `jobId`, `badgeCount` y lista de badges.

## 2026-05-10 - Fix duplicado de overlay en feed
- Se endurecio `cleanupOverlays(card, targetJobId)` para limpieza dirigida por card: cuando hay `targetJobId`, elimina overlays/panels legacy y tambien los de `jobId` distinto.
- Se aplico politica de instancia unica por card: si hay mas de un overlay/panel del mismo `targetJobId`, se conserva solo el primero y se remueven duplicados.
- Se mantuvo el flujo existente de route/cache y logs operativos (`Overlay inyectado...`) sin agregar ruido adicional.

## 2026-05-10 - Fix anti-parpadeo por reinyeccion ciclica
- Se endurecio la validacion de `jobId` en links con `isLikelyJobId` para aceptar solo IDs con forma real de job y descartar `~id` auxiliares.
- `getCardJobId` ahora reconcilia `data-sniper-job-id` contra señales reales de la card (atributos y links validos) para corregir cards recicladas sin alternancia de ID.
- En `applyCachedOverlaysToFeed`, se agrego guard anti-mutate por card: si ya existe overlay del mismo `jobId` objetivo, no limpia ni reinyecta.
- Se mantuvo logging minimo actual (`Overlay inyectado...`) sin aumentar ruido de consola.

## 2026-05-10 - Fix posicion overlay + layout score grade
- Se reforzo el anclaje CSS de `.sniper-overlay` a esquina inferior-derecha para variantes reales de card (`section/article/data-test/class* job-tile`).
- Se amplio `position: relative` en contenedores de card para evitar referencias de posicionamiento a bloques superiores.
- Se corrigio layout de `.sniper-score` para evitar salto de `+/-` a linea inferior: `flex-wrap: nowrap`, `white-space: nowrap` y `line-height` consistente en value/grade.
- No se modifico logica JS de score, badges, cache ni scheduler.

## 2026-05-12 - Badges compactos con hover panel + fix posición overlay

### Fix posición overlay (root cause final)
- Causa raíz identificada: `[class*="job-tile"]` en `getFeedJobCards()` estaba matcheando elementos como `h3.job-tile-title` (el título del job). Esto hacía que el overlay se inyectara *dentro* del `H3` del título (arriba a la derecha) en lugar de la card.
- Se reescribió `getFeedJobCards()` para ignorar explícitamente tags de encabezados (`H1-H6`, `A`, `SPAN`, `P`) y cualquier elemento con "title" en su clase.
- Se refinó la selección de cards para que capture siempre `section.air3-card-section` o directamente el wrapper `div.air3-card`.
- `resolveOuterCard()` se simplificó para comprobar el `parentElement` sin escalar fuera de la card real.
- **Fix desaparición de overlays:** Se arregló `removeOrphanOverlays()`. Como el overlay ahora vive en `div.air3-card`, su función `closest()` estaba ignorándolo y escalando hasta atrapar el feed entero (por culpa del comodín `[data-test*="job-tile"]` matcheando `job-tile-list`). Esto causaba que el limpiador de huérfanos borrara los overlays sanos un segundo después de crearlos. Se corrigió usando selectores estrictos que incluyen `div.air3-card`.

### Badges compactos (badge counter)
- Se reemplazó la fila de badges individuales por un solo icono contador (`.sniper-badge-counter`) con el número de badges.
- Al hover del contenedor se muestra el panel vertical con icono, nombre y descripción de cada badge.
- Ya no se crean elementos `.sniper-badge` individuales; se extraen los datos directamente de `getBadgeConfig()`.

## 2026-05-13 - Fix persistencia overlay + refactor anti-monolitico
- Se separaron modulos grandes del content script: ruta/i18n, overlay cards/cleanup/render/settings/refresh, skills analytics, badges, core preflight y estilos.
- Se actualizo `manifest.json` para cargar los modulos nuevos antes de instanciar `UpworkSniperExtension`.
- Se corrigio el caso de cierre de JobCard/feed route: los cambios de URL del feed ya no fuerzan limpieza huerfana inmediata de overlays.
- `removeOrphanOverlays()` ahora prioriza el `data-sniper-job-id` marcado en la card antes de re-resolver desde links dinamicos, evitando borrar overlays validos al cerrar modal.
- Se dividio `src/sniper.ts` en tipos/helpers/post-badges manteniendo exports publicos existentes.
- Se actualizo `scripts/check-sniper-lines.js` para cubrir `sniper-extension` y `src` con limite de 300 lineas.
- Validado con PowerShell: no hay source JS/CSS/TS sobre 300 lineas, todos los archivos del manifest existen y no se detectaron tokens de mojibake en `sniper-extension`/`src`.
- Pendiente por entorno: `node`, `npm` y `tsc` no estan disponibles en este PowerShell, por lo que los guardrails npm/runtime quedan pendientes.

## 2026-05-13 - Hotfix runtime `lastViewedDate is not defined`
- Causa raiz: en `sniper-core-evaluate.js` quedo una referencia a `lastViewedDate` tras extraer preflight, pero la variable ya no existia en ese scope.
- Se corrigio el evaluador para usar `daysSinceViewed` del preflight al decidir el badge `Ghost job`.
- Se corrigio tambien el uso de `killSwitches` en la rama de `New client` tomando el valor desde preflight en lugar de una variable local removida.
- En `sniper-core-preflight.js` se expuso `killSwitches` incluso cuando `killResult` es `null`, para evitar referencias implicitas futuras.
- Verificacion estatica: no quedan referencias a `lastViewedDate` fuera de preflight y no quedan usos huérfanos de `killSwitches` en evaluator.
