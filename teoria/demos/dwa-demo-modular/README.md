# Ventana dinámica (DWA): demo interactiva

## Cómo abrirla

- **Un solo archivo:** `dwa_demo.html`. Se abre con doble clic.
- **Versión modular:** `index.html` + `css/` + `js/`. Los módulos ES no cargan desde `file://`, así que hay que servirla:

  ```bash
  cd dwa-demo
  python3 -m http.server 8000      # y abrir http://localhost:8000
  ```

Si editas los módulos, regenera el archivo único con `python3 build_single.py`.

## Estructura

| Fichero | Qué contiene |
|---|---|
| `js/config.js` | Tamaño del mundo, parámetros por defecto y descripción de los deslizadores |
| `js/dwa.js` | **El algoritmo**: ventana dinámica, criterios, admisibilidad, normalización y G |
| `js/robot.js` | Modelo uniciclo: integración exacta y curvatura de cada (v, ω) |
| `js/world.js` | Mapa de ocupación y transformada de distancia (distancia al obstáculo más cercano) |
| `js/scenarios.js` | Escenarios predefinidos |
| `js/render-world.js` | Dibujo del mundo y de las curvaturas evaluadas |
| `js/render-velocity.js` | Dibujo del espacio (v, ω) y de la ventana |
| `js/panel.js` | Desglose de G del par elegido o señalado |
| `js/canvas-view.js`, `js/colors.js` | Utilidades de dibujo y colores del tema |
| `js/ui.js` | Controles HTML y ratón (sin lógica del algoritmo) |
| `js/main.js` | Estado de la aplicación y bucle de ejecución |

## Decisiones respecto al paper

- **dist** es la distancia libre a lo largo de la *curvatura* de (v, ω), con tope `dMax`, no a lo largo del arco recorrido en un tiempo fijo. Con (v, ω) = (0, 0) se usa la recta hacia donde mira el robot, y un giro sobre sí mismo sin choque vale `dMax`.
- **Admisibilidad** en versión de control discreto: v·Δt + v²/(2a) ≤ dist (el paper usa v ≤ √(2·dist·a)).
- **heading** se mide en la pose tras aplicar (v, ω) durante Δt + el tiempo de frenada, manteniendo ω.
- **Suavizado σ opcional** (casilla en Parámetros, desactivado por defecto): G = media ponderada (núcleo 3 × 3: 1-2-1 / 2-4-2 / 1-2-1) de la suma α·heading + β·dist + γ·vel del par y sus 8 vecinos en la rejilla (v, ω). Los no admisibles cuentan como 0 y en el borde de la ventana solo se promedian los vecinos que existen.
- dist se mide hasta la última pose de la curvatura **sin** choque (no hasta la primera que choca), para no sobrestimar el espacio libre.
