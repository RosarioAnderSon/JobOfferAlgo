# TrabajandoActualmente

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
