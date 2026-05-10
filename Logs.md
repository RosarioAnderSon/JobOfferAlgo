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
