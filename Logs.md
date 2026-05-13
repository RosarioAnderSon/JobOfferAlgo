# Logs

## 2026-05-06
### Sniper Extension
- Se estabilizo la ejecucion de overlays para eliminar errores is not a function en route/cache cuando faltaban metodos en runtime.
- Se implemento estrategia gradual anti-rate-limit: arranque rapido, backoff progresivo en inactividad, jitter anti-patron y pausa en pestana oculta.
- Se agregaron protecciones de concurrencia para no solapar applyCachedOverlaysToFeed y reducir mutaciones DOM innecesarias.
- Se reparo regresion de persistencia de niche (selectedNicheKey vs nicheKey) para mantener configuracion del usuario.
### Sniper Extension - Hotfix runtime overlay no cargado
- Se resolvio un error de parseo por redeclaracion de const feedbackLink en createSettingsButton que impedía registrar metodos de overlay.
- Se incorporo handshake de salud del modulo overlay (window.__sniperOverlayLoaded) para diagnostico temprano.
- Se corrigio el flujo de estado: "Renderizado completado" solo se emite cuando realmente se inyecta overlay.
- En fallo de carga del modulo overlay, el scheduler entra en reintento espaciado para reducir presion de DOM y riesgo de deteccion.
### Sniper Extension - Tooltip Score Weights
- Se agrego un indicador `(i)` al lado de `Score Weights`/`Valores del Algoritmo` en el panel de ajustes.
- El tooltip ahora documenta la formula del score base y que los pesos se normalizan por `totalWeight` cuando el total no es 100.
- Se anadio una linea dinamica con el peso total actual para mejorar trazabilidad al editar valores.
- El tooltip abre por hover/focus y no altera la logica de calculo ni el layout general del panel.
- Ajuste posterior: el indicador quedo en `i` (sin parentesis) manteniendo el boton circular.
- Ajuste posterior de contenido: se retiro la formula del tooltip y se reemplazo por una explicacion no tecnica y breve.
### Sniper Extension - Hardening anti-redflag (Cloudflare-safe)
- Se removio el polling de URL de 500ms y se mantuvo navegacion SPA con hooks de history + popstate, agregando dedupe de URL para evitar eventos repetidos de ruta.
- Se anadio dedupe de actividad del scheduler para no reiniciar ciclos por eventos consecutivos identicos en ventanas cortas.
- `applyCachedOverlaysToFeed` ahora aplica presupuesto de mutaciones por tick y marca `truncated` para continuar de forma gradual en ticks posteriores.
- La limpieza huerfana de overlays se hace de forma periodica o por evento de ruta/job, evitando ejecuciones en cada pasada.
- Se agrego retorno temprano en feed inactivo sin cache ni UI sniper existente para reducir consultas/mutaciones innecesarias.
- Se incorporo debounce de render por `jobId` para evitar reinyectar overlays validos en intervalos cortos.
- Los logs verbosos de intentos/extraccion se movieron a `logVerbose` (activable con `localStorage['sniper-debug-verbose-v1']='1'`), dejando por defecto solo hitos y errores.
### Sniper Extension - Runtime log-level + badges mapping hardening
- Se introdujo `sniper-log-level-v1 = minimal|verbose` (default `minimal`) para filtrar consola operativa.
- En modo `minimal` quedan visibles solo: errores Sniper, `Overlay inyectado...` y eventos clave de ruta (`Cambio de URL`, `No estamos en job detail`, `Detectado job detail`).
- Se implemento resolucion robusta de nombres de badge con normalizacion y alias para evitar perdida de badges por variaciones de string.
- Se agrego config UI para `Poco esfuerzo` y fallback neutral para badges no mapeados.
- Se agrego diagnostico `verbose` en inyeccion con listas de badges emitidos/renderizados/alias/unknown para depurar regresiones sin ruido en modo minimo.
### Sniper Extension - Most Recent cards compatibility
- Se corrigio la deteccion de cards en feed para variantes de DOM de Upwork (`most-recent`) usando combinacion de selectores directos y fallback por links `~jobId`.
- Se unifico esa deteccion tanto en `applyCachedOverlaysToFeed` como en `findJobCardById` y limpieza de huerfanos para evitar que overlays validos se pierdan.
- Se añadió confirmacion visible en modo minimo: `OK Overlay inyectado desde cache: N` para validar inyeccion real en feed sin abrir detail.
### Sniper Extension - Fix detail robusto + coherencia de badges nuevos
- Se corrigio la deteccion de `job detail` en vistas SPA (ej. `most-recent`) reforzando la extraccion de `jobId` desde atributos del modal y fallback por link, no solo por `href` visible.
- Se agrego observer ligero del modal para disparar `checkCurrentPage()` cuando el slider aparece/cambia sin evento de URL.
- Se versiono esquema de badges en cache (`badgeSchemaVersion=2`) y se persiste en `setCachedResult`.
- En feed se invalidan entradas `stale` (sin version o version vieja) y no se inyectan badges obsoletos.
- Si habia overlay previo del mismo job con cache `stale`, se remueve para evitar mezcla visual de badges viejos/nuevos.
- Se agrego diagnostico temporal controlado por `localStorage['sniper-diag-badges-v1']='1'` para trazas por `jobId` (emitidos/renderizados/stale).
- No se modifico scoring, formulas ni reglas del evaluator.
### Sniper Extension - Fix duplicados de overlay en feed
- Se corrigio causa raiz de duplicados de badges/score por card endureciendo `cleanupOverlays(card, targetJobId)`.
- En limpieza dirigida, ahora se eliminan overlays/panels legacy y cualquier instancia con `data-job-id` distinto al job objetivo de la card.
- Se agrego dedupe por card para conservar una sola instancia del overlay/panel del mismo `targetJobId`.
- Se mantuvo el comportamiento actual de inyeccion route/cache y los logs operativos minimos sin aumentar ruido.
### Sniper Extension - Fix anti-parpadeo por reinyeccion ciclica en feed
- Se agrego validacion estricta de `jobId` en href (`~id`) para evitar tomar identificadores no-job y eliminar alternancia de IDs por card.
- Se reforzo `getCardJobId` para reconciliar `data-sniper-job-id` con señales reales actuales de la card y reescribirlo cuando hay inconsistencia por virtualizacion.
- Se incorporo guard anti-mutate en cache pass: si la card ya tiene overlay del `jobId` resuelto, se evita cleanup/reinyeccion innecesaria.
- Se preservo el comportamiento de score, badges, settings y nivel de logging operativo.
### Sniper Extension - Fix UI overlay bottom-right + score grade
- Se consolidaron reglas CSS para asegurar que el overlay de badges/score quede en la esquina inferior-derecha en todas las variantes de card del feed.
- Se extendio la cobertura de contenedores de card con `position: relative` para evitar posicionamiento absoluto referenciado a nodos incorrectos.
- Se ajusto el badge de score para que `A+ / A-` no se parta en dos lineas, manteniendo misma tipografia y look actual.
- No hubo cambios en evaluacion de score, inyeccion JS ni nivel de logs.

## 2026-05-13
### Sniper Extension - Overlay persistente + refactor anti-monolitico
- Se refactorizaron los source files mayores a 300 lineas en modulos por responsabilidad, manteniendo `window.UpworkSniperExtension`, `window.SniperLog`, `window.SniperCoreEvaluate` y los exports de `src/sniper.ts`.
- Se actualizo el orden de carga del manifest para los modulos nuevos de overlay, route detection, skills, badges, preflight y CSS.
- Se corrigio el bug donde cerrar una JobCard o volver al feed podia disparar limpieza de overlays sanos: los feed route changes ya no marcan cleanup huerfano forzado.
- `removeOrphanOverlays()` ahora conserva overlays cuando la card mantiene un `data-sniper-job-id` estable y solo elimina si la card falta, vive dentro del modal, no tiene `data-job-id`, o hay contradiccion estable.
- `scripts/check-sniper-lines.js` ahora revisa `sniper-extension` y `src`; validacion PowerShell confirmo cero source files JS/CSS/TS sobre 300 lineas.
- Validacion npm/tsc pendiente por entorno Windows actual: `node`, `npm` y `tsc` no estan disponibles en PATH.

### Sniper Extension - Hotfix runtime evaluator (`lastViewedDate`)
- Se corrigio `ReferenceError: lastViewedDate is not defined` en `sniper-core-evaluate.js` tras el split de preflight.
- El badge final `Ghost job` ahora usa `daysSinceViewed` del preflight y no depende de variables fuera de scope.
- Se reparo tambien la referencia a `killSwitches` para la rama de badge `New client`, consumiendo el dato retornado por preflight.
- En `sniper-core-preflight.js` se retorno `killSwitches` tambien en el camino sin kill (`killResult: null`) para mantener contrato explicito.
- Verificacion estatica aplicada: sin referencias huérfanas de `lastViewedDate`/`killSwitches` en evaluator.

### Sniper Extension - Fix desaparicion JobCard + logger de errores
- Se instalo Node LTS con `winget` para recuperar tooling local; en esta sesion funcionaron `node -v` y `npm.cmd -v`.
- Se corrigio una condicion de carrera entre aperturas consecutivas de job detail: `waitForJobContent(jobId)` ahora cancela watcher previo, controla sesion activa y aborta si el modal cambia de job.
- Se endurecio `processJobDetail(jobId)` con validacion de modal activo antes de evaluar/renderizar para evitar inyecciones tardias sobre cards equivocadas.
- Se paso `jobId` explicito en `evaluateAndRender -> renderUI`, eliminando dependencia funcional de `this.currentJobId` dentro de busqueda de card, cleanup e inyeccion.
- Se agrego logger central de errores con niveles `off` (default), `error`, `verbose`; los errores se persisten en ring buffer `localStorage` (`sniper-error-log-v1`) con contexto (fase, mensaje, URL, timestamp, `currentJobId`, stack).
- Se expusieron helpers de diagnostico manual: `window.SniperErrorLog.getErrors()`, `clearErrors()`, `exportErrors()`.
- Se sincronizo `window.__sniperCurrentJobId` desde route detection para trazabilidad consistente del logger.
- Validacion estatica: `node --check` OK en los archivos modificados.
- Guardrails: `npm.cmd run check-sniper-guardrails` corre, pero falla por paridad previa no ligada a este fix (`Support Avg/hr badge config missing`) y reporta warning de tamano en `content-script-base.js` (369) y `content-script-methods-flow-route.js` (309).

### Sniper Extension - Flow logger de pipeline + fix continuidad detail/feed
- Se agrego un canal de trazas persistentes `SniperFlowLog` (`sniper-flow-log-v1`) separado de errores, sin salida de consola por defecto.
- El flow logger persiste eventos de pipeline con `ts`, `phase`, `jobId`, `currentJobId`, `url`, `reason`, `sessionId` y helpers de export/clear en `window.SniperFlowLog`.
- Se instrumentaron transiciones clave:
  - `checkCurrentPage`: `detail-detected`, `detail-skipped-same-id`, `route-no-detail`.
  - `waitForJobContent`: `watcher-start`, `watcher-cancel-session`, `watcher-cancel-modal-mismatch`, `watcher-ready`, `watcher-timeout`.
  - `process/evaluate/render`: `extract-start/end`, `evaluate-start/end`, `render-start`, `render-cancel-modal-mismatch`, `card-found/miss`, `overlay-injected`.
  - `cache/feed`: `feed-pass-start/end`, `cache-hit/miss`, `cache-write`, `inject-from-cache`, `cleanup-orphan-remove`.
- Se aplico fix puntual de continuidad: si la ruta cae temporalmente a feed pero el modal sigue visible y hay watcher activo, no se resetea `currentJobId` en ese ciclo para evitar abortos silenciosos del pipeline.
- Verificacion tecnica:
  - `node --check` OK en todos los archivos modificados en esta tarea.
  - `npm.cmd run check-sniper-guardrails` falla por issue preexistente de paridad (`Support Avg/hr badge config missing`) y reporta warning de archivos >300 lineas (`content-script-base.js`, `content-script-methods-flow-route.js`).

### Sniper Extension - Fix mismatch falso por formato de jobId
- Causa raiz confirmada por trazas: cancelaciones `watcher-cancel-modal-mismatch` por comparar IDs equivalentes con distinto formato (`022...` vs `205...`), no por cambio real de job.
- Se agrego comparacion canonica en runtime:
  - `normalizeJobIdForCompare(value)` (trim + strip de ceros a la izquierda para IDs numericos)
  - `isSameJobId(a, b)` (comparacion por valor normalizado)
- Se sustituyeron comparaciones directas de IDs en:
  - `checkCurrentPage` (ruta/detail same-job)
  - `waitForJobContent` (cancelacion watcher)
  - `processJobDetail` (cancelacion extract)
  - `renderUI` (cancelacion render)
- Se reforzaron razones de trazas en cancelaciones por mismatch incluyendo:
  - `normalizedJobId`
  - `normalizedActiveJobId`
- Verificacion:
  - `node --check` OK en archivos tocados.
  - `npm.cmd run check-sniper-guardrails` mantiene fallo preexistente de paridad `Support Avg/hr badge config missing`.
  - Warning de tamano >300 lineas actualizado: `content-script-base.js` (442), `content-script-methods-flow-route.js` (416).

### Sniper Extension - Matching por variantes canonicas + fuente estable de activeModalJobId
- Se fortalecio `isSameJobId(a,b)` para comparar interseccion de variantes, no solo una forma normalizada.
- Nuevo helper `getComparableJobIdVariants(value)`:
  - agrega valor trim original
  - agrega version sin ceros iniciales
  - para IDs numericos largos con prefijo `02`, agrega variante sin esos dos caracteres (caso observado `022...` vs `205...`).
- `getOpenModalJobId()` ahora prioriza el atributo del contenedor modal (`data-opening-uid`/`data-ev-opening_uid`/`data-job-id`), luego attrs anidados y por ultimo links.
- En candidatos anidados, si existe uno equivalente a `currentJobId` por `isSameJobId`, se elige ese para reducir alternancia intra-modal.
- Se ampliaron razones de trazas en cancelaciones por mismatch para incluir:
  - `rawJobId`, `rawActiveJobId`
  - `normalizedJobId`, `normalizedActiveJobId`
  - `variantsJobId`, `variantsActiveJobId`
- Verificacion tecnica:
  - `node --check` OK en los tres archivos modificados.
- `npm.cmd run check-sniper-guardrails` mantiene fallo preexistente `Support Avg/hr badge config missing`.
- Warning de lineas >300 actualizado: `content-script-base.js` (463), `content-script-methods-flow-route.js` (440).

### Sniper Extension - Trazabilidad completa + retencion de overlays
- Causa raiz confirmada: limpieza/dedupe de overlays con igualdad literal de IDs (`===`) eliminaba overlays validos cuando el mismo job llegaba con formatos distintos (`022...` vs `205...`).
- Se agrego flag operativo `sniper-flow-console-v1`; `appendFlowLog(...)` ahora imprime `[Sniper] FLOW: <phase>` con payload (`jobId`, `currentJobId`, `reason`, `sessionId`, `url`) cuando el flag esta en `1` o el log level es `verbose`.
- En `content-script-methods-overlay-cleanup.js`:
  - `cleanupOverlays` y `removeOrphanOverlays` migraron a comparacion por `isSameJobId(...)`.
  - Se agregaron eventos `overlay-retained-check` y `overlay-removed`.
  - En `overlay-removed` se registra payload estructurado con `rawOverlayJobId`, `rawResolvedCardJobId`, `normalizedOverlayJobId`, `normalizedResolvedCardJobId`, `variantsOverlay`, `variantsResolved`, `removeReason`.
- En `content-script-methods-cache.js`, la dedupe `existingOverlayForCard` ahora usa `isSameJobId(...)` y emite `overlay-retained-check` cuando retiene overlay valido.
- En `content-script-methods-overlay-cards.js`, la reconciliacion `stableAttr/attrId/linkId` usa `isSameJobId(...)` y el marcado de `data-sniper-job-id` queda estable con forma canonica para evitar re-marcados oscilantes.
- Validaciones:
  - `node --check` OK en los 4 archivos tocados.
  - `npm.cmd run check-sniper-guardrails` sigue fallando por issue preexistente: `Support Avg/hr badge config missing`.
  - Warning line-count >300 actualizado: `content-script-base.js` (478), `content-script-methods-cache.js` (328), `content-script-methods-flow-route.js` (440).

### Sniper Extension - Fix scoring de Gasto/Actividad/Proposals
- Se corrigio `Gasto total` en score base para que use `totalSpent` directo; ya no depende de `totalSpent/totalHires` para la calificacion del componente `spend`.
- Se ajusto `Activity` para depender exclusivamente de `Last viewed by client`; cuando no existe ese dato, el componente puntua frio (`0`) y no usa `postedAt`.
- Se actualizaron defaults de `activity thresholds` a `fresh=1` y `recent=3` (runtime evaluator + defaults de settings).
- Se reforzo parsing de `Proposals` para formatos reales de Upwork (`Less than 5`, `5 to 10`, `10 to 15`, `15 to 20`, `20 to 50`, `50+`, `5-10`, separadores degradados).
- Regla de mapeo aplicada para evitar solape de fronteras: `5-10 => 5`; `10-15 => 11`; `15-20 => 16`; `20-50 => 21`.
- Validaciones ejecutadas:
  - parser de proposals validado por casos en Node (incluyendo `10–15` y `10?15`).
  - smoke de score `spend` con umbrales custom (`A=600`, `B=200`, `C=100`) y distintos `totalSpent`.
  - smoke de score `activity` variando solo `lastViewed`.
  - `npm.cmd run test-content -- test/upwork-job-detail.html` OK.
- Guardrails: `npm.cmd run check-sniper-guardrails` mantiene issue preexistente no ligado a este fix (`Support Avg/hr badge config missing`) y warnings de line-count en archivos grandes ya existentes.
