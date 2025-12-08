# Anderson's Sniper - Upwork Job Evaluator

Extensión MV3 para Chrome/Edge que puntúa y etiqueta ofertas de Upwork en tiempo real usando el core de `sniper.ts`.

## Instalación (modo desarrollador)

1) `chrome://extensions` (o `edge://extensions`)  
2) Activa **Developer mode**.  
3) **Load unpacked** y selecciona la carpeta `sniper-extension/`.  
4) Abre un feed o detalle de Upwork (`/nx/search/jobs`, `/jobs/...`) y verás el badge de score + emojis.

## Estructura

- `manifest.json` – Config MV3.  
- `sniper-core.js` – Core transpilado a JS + UMD (`window.evaluateSniper`).  
- `content-script.js` – Inyector: parsea cards/detalles, evalúa y renderiza badges.  
- `styles.css` – Estilos del score/badges.  
- `icons/` – Placeholders PNG (puedes reemplazarlos por tus logos).

## Notas de uso

- Badges usan emojis para carga instantánea.  
- El script observa mutaciones para captar tarjetas que aparecen dinámicamente.  
- En páginas de detalle intenta parsear datos del sidebar; si algo falta usa fallbacks conservadores.

## Próximos pasos sugeridos

- Sustituir `icons/` por assets de marca.  
- Afinar parsers con HTML real de Upwork (agrega selectores específicos si cambian).  
- Añadir `browser_specific_settings` para Firefox MV3 si lo quieres publicar allí.

