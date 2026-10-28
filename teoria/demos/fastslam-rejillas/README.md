# Demo de FastSLAM con rejillas de ocupación

- `fastslam-rejillas.html`: la demo en un solo archivo. Se abre con doble clic.
- `index.html`: la misma demo con el código en módulos separados. Como usa módulos JavaScript, hay que servir la carpeta (`python3 -m http.server` y abrir http://localhost:8000).
- `python3 build.py`: regenera `fastslam-rejillas.html` a partir de `index.html`, `css/` y `js/`. Las modificaciones se hacen en los módulos, nunca en el archivo generado.

## Estructura del código

`js/slam/` contiene la simulación y el algoritmo, sin nada de la página:

| Archivo | Contenido |
|---|---|
| `random.js` | Generador aleatorio con semilla (mulberry32): misma semilla y mismas órdenes, misma ejecución |
| `world.js` | Planta, obstáculos, pose inicial, ruta del ciclo y trazado de rayos contra las paredes |
| `laser.js` | Láser simulado (72 haces, 5 m, 3 cm de ruido) y puntos finales de un escaneo |
| `occupancy-grid.js` | Mapa en log-odds y modelo inverso del sensor (`integrateScan`) |
| `motion.js` | Modelo de movimiento del filtro, movimiento real con sesgo y odometría |
| `observation-model.js` | Verosimilitud por punto final, p(z \| x, m), y scan matching |
| `fastslam.js` | El filtro: predicción, corrección, Neff y remuestreo de baja varianza |
| `loop-closure.js` | Detector de cierre de ciclo para la pausa (usa la pose real) |
| `route.js` | Piloto automático que recorre el ciclo |
| `simulation.js` | Une todo lo anterior en un paso: mover, predecir, pausar o corregir |

`js/ui/` contiene la página:

| Archivo | Contenido |
|---|---|
| `main.js` | Controles, selección y linaje de partículas, textos de estado |
| `render.js` | Dibujo del mundo, del mapa de una partícula, de las miniaturas y de la gráfica de Neff |
| `history.js` | Retroceder: rehace la simulación con las mismas acciones menos las últimas |

El paso del filtro está en `FastSlamFilter.correct` (`js/slam/fastslam.js`), con los cuatro pasos comentados.
