/**
 * config.js — Tamaño del mundo, parámetros por defecto y descripción de los
 * controles de la interfaz (la UI se genera a partir de PARAM_SPECS).
 */

/** Mundo de 12 × 8 m con celdas de 10 cm. */
export const WORLD_SIZE = { width: 12, height: 8, cell: 0.1 };

export const DEFAULT_PARAMS = {
  // Pesos de la función objetivo G(v, ω) = α·heading + β·dist + γ·vel
  alpha: 0.4,
  beta: 0.4,
  gamma: 0.2,

  // Robot (diferencial, modelado como un disco)
  radius: 0.25, // m
  vMax: 1.0, // m/s   (no se permite marcha atrás: v ∈ [0, vMax])
  wMax: 2.5, // rad/s (ω ∈ [-wMax, wMax])
  accV: 0.5, // m/s²  aceleración / frenada lineal máxima
  accW: 2.0, // rad/s² aceleración angular máxima

  // Algoritmo
  dt: 0.25, // s  periodo de control: la ventana es lo alcanzable en Δt
  samplesV: 7, // muestras de v dentro de la ventana
  samplesW: 17, // muestras de ω dentro de la ventana
  dMax: 2.0, // m  longitud de curvatura evaluada = tope del criterio dist
  arcStep: 0.05, // m  resolución al recorrer cada curvatura
  normalization: 'minmax', // 'minmax' (sobre la ventana) | 'fixed' (máximo teórico)

  goalTolerance: 0.3, // m
};

/** Controles deslizantes, agrupados. `key` es la clave en DEFAULT_PARAMS. */
export const PARAM_SPECS = [
  {
    group: 'Pesos de G(v, ω)',
    items: [
      { key: 'alpha', label: 'α · heading', min: 0, max: 1, step: 0.05 },
      { key: 'beta', label: 'β · dist', min: 0, max: 1, step: 0.05 },
      { key: 'gamma', label: 'γ · vel', min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    group: 'Robot',
    items: [
      { key: 'vMax', label: 'v máx', unit: 'm/s', min: 0.2, max: 2, step: 0.1 },
      { key: 'wMax', label: 'ω máx', unit: 'rad/s', min: 0.5, max: 4, step: 0.1 },
      { key: 'accV', label: 'aceleración lineal', unit: 'm/s²', min: 0.2, max: 3, step: 0.1 },
      { key: 'accW', label: 'aceleración angular', unit: 'rad/s²', min: 0.5, max: 10, step: 0.5 },
      { key: 'radius', label: 'radio', unit: 'm', min: 0.1, max: 0.5, step: 0.05 },
    ],
  },
  {
    group: 'Algoritmo',
    items: [
      { key: 'dt', label: 'Δt (periodo de control)', unit: 's', min: 0.1, max: 0.5, step: 0.05 },
      { key: 'samplesV', label: 'muestras de v', min: 3, max: 15, step: 1 },
      { key: 'samplesW', label: 'muestras de ω', min: 5, max: 31, step: 2 },
      { key: 'dMax', label: 'arco evaluado (tope de dist)', unit: 'm', min: 0.5, max: 5, step: 0.25 },
    ],
  },
];
