/**
 * colors.js — Colores del tema (leídos de las variables CSS, así los dibujos
 * del canvas siguen el modo claro/oscuro) y escala de color de puntuaciones.
 */

import { clamp, lerp } from './geometry.js';

/** Lee los colores del tema desde las variables CSS de :root. */
export function readTheme() {
  const css = getComputedStyle(document.documentElement);
  const get = (name) => css.getPropertyValue(name).trim();
  return {
    canvasBg: get('--canvas-bg'),
    free: get('--free'),
    obstacle: get('--obstacle'),
    gridLine: get('--grid-line'),
    ink: get('--ink'),
    muted: get('--muted'),
    robot: get('--robot'),
    goal: get('--goal'),
    best: get('--best'),
    bad: get('--bad'),
    window: get('--window'),
    inadmissible: get('--inadmissible'),
    rejected: get('--rejected'),
    trail: get('--trail'),
    scaleLo: hexToRgb(get('--scale-lo')),
    scaleHi: hexToRgb(get('--scale-hi')),
  };
}

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Color de la escala secuencial para t ∈ [0, 1] (0 = peor, 1 = mejor). */
export function scaleColor(t, theme) {
  const u = clamp(t, 0, 1);
  const [r, g, b] = theme.scaleLo.map((lo, i) => Math.round(lerp(lo, theme.scaleHi[i], u)));
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Valor en [0, 1] con el que se colorea cada candidato admisible:
 *   'G'        → G reescalada entre el peor y el mejor de la ventana
 *   criterio   → el criterio normalizado (heading, dist o vel)
 * Devuelve un Map candidato → valor. Los no admisibles no tienen valor.
 */
export function colorValues(candidates, colorBy) {
  const admissible = candidates.filter((c) => c.admissible);
  const values = new Map();
  if (colorBy === 'G') {
    const gs = admissible.map((c) => c.G);
    const lo = Math.min(...gs);
    const hi = Math.max(...gs);
    for (const c of admissible) values.set(c, hi - lo > 1e-9 ? (c.G - lo) / (hi - lo) : 1);
  } else {
    for (const c of admissible) values.set(c, c.norm[colorBy]);
  }
  return values;
}
