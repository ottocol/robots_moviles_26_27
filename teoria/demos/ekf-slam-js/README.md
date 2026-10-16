# EKF-SLAM: demo interactiva para clase

Abre `index.html` en un navegador moderno. No necesita servidor, instalación ni conexión a Internet.

## Uso

- **Reproducir / Pausar** controla la animación.
- **Siguiente / Anterior** avanza o retrocede una observación (0,2 s de tiempo simulado). El historial conserva los últimos 100 fotogramas.
- **Ir al cierre del ciclo** avanza hasta una reobservación de un landmark tras completar la primera vuelta y se detiene **después de la predicción, antes de la corrección**. Pulsa **Siguiente** para aplicar la medida y comparar las incertidumbres.
- **Escenario ambiguo** coloca cuatro landmarks de la zona inicial en un grupo de unos 2,5 m de diámetro y duplica el ruido del sensor (distancia: 0,2 m; ángulo: 2°). Conserva el resto del mapa, los waypoints y la semilla aleatoria. Al seleccionarlo se activa el vecino más cercano.
- **Cierre falso · prueba de estrés** conserva el mapa y el ruido originales. En el primer cierre de ciclo, sustituye deliberadamente la correspondencia correcta `L1 → L1` por `L1 → L22`, aunque la puerta de Mahalanobis normal la rechazaría (`NIS ≈ 96` frente al umbral `4`). Este caso aísla el efecto de **aceptar** un cierre falso; no pretende ser un fallo espontáneo del vecino más cercano con esta configuración.
- **Ir al primer error de asociación** se detiene antes de que una medida se asigne a la feature de otro landmark. El rayo rojo muestra la correspondencia; en el escenario de puntos cercanos aparece además un recuadro ampliado. Pulsa **Siguiente** para aplicar el error. El contador registra todos los errores detectados.
- **Asociación de datos** permite elegir entre identidad conocida (útil para explicar el cierre) y vecino más cercano con puertas de Mahalanobis, como en la configuración original. Cambiarla reinicia la demo.
- **Dentro del filtro** muestra la matriz completa. En **Covarianza P**, rojo y azul representan valores positivos y negativos, con intensidad según la magnitud. La escala es común a las dos matrices que aparecen al cerrar el ciclo. El contraste lineal permite comparar valores directamente; la raíz cuadrada resalta términos pequeños.
- En **Correlación ρ**, cada celda se divide por las desviaciones típicas de sus dos variables. Así se ven las dependencias entre el robot y el mapa en una escala sin unidades de −1 a +1. Pasa el cursor sobre una celda para leer las variables y su valor.
- Al aplicar el cierre se muestran, con la misma escala de color, las matrices **justo antes** e **inmediatamente después** de la corrección. El resumen inferior compara solo variables de posición, para no mezclar metros y radianes. Al avanzar otro fotograma vuelve la matriz en directo; **Anterior** permite regresar a la comparación.
- Teclado: **Espacio**, **→** y **←**.

## Código

- `slam.js`: mapa y parámetros; modelo de movimiento, `predict()`, `scan()`, `associate()`, `observeModel()`, `correct()` y `augment()`.
- `app.js`: controles, pausa antes de la corrección, historial y dibujo del mapa.
- `matrix.js`: mapa de calor de P, correlaciones normalizadas y comparación antes/después.
- `styles.css`: presentación adaptable a distintas pantallas.

El estado contiene la pose `(x, y, θ)` y pares `(x, y)` de landmarks. `P` es la matriz de covarianza **completa**: sus términos cruzados permiten que una medida de un landmark conocido reduzca también la incertidumbre de otros landmarks.

El diagnóstico de errores usa las identidades reales del mundo simulado **después** de que el algoritmo haya elegido una asociación. Esas identidades no participan en el modo de vecino más cercano. Una observación rechazada por las puertas no cuenta como asociación errónea; aparece por separado en el contador.

La comparación entre los dos escenarios nuevos es deliberada: intercambiar puntos cercanos suele tener poco efecto geométrico; aceptar un cierre con un punto distante puede arrastrar la pose y todo el mapa y, a la vez, reducir falsamente la covarianza. En la prueba de estrés, el error de posición del robot salta aproximadamente de 2,8 m a 37 m mientras el filtro informa de menor incertidumbre.

Se usan el mapa `example_webmap.mat` y los valores de `configfile.m` del simulador MATLAB v1.0 de Tim Bailey y Juan Nieto (2004), con ruido pseudoaleatorio de semilla fija para poder repetir la clase. La corrección procesa medidas conocidas de forma secuencial; el MATLAB original permite actualización por lotes y la tiene activada en su configuración. Por ello, los números exactos pueden diferir, aunque se conserva el modelo EKF-SLAM y el efecto de cierre.

Las elipses representan **2σ** de la covarianza marginal de posición; son una visualización de incertidumbre, no límites absolutos del error.

La diagonal de P contiene varianzas. Las celdas fuera de la diagonal son covarianzas: muestran el acoplamiento que permite propagar una corrección. Tras el cierre suele bajar la magnitud de muchas de ellas, pero los coeficientes de correlación normalizados pueden subir o cambiar de signo; no representan por sí solos la incertidumbre absoluta.
