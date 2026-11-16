/**
 * geometry.js — Utilidades matemáticas pequeñas, sin dependencias.
 */

export const TAU = 2 * Math.PI;

/** Normaliza un ángulo al intervalo (-π, π]. */
export function wrapAngle(angle) {
  let a = (angle + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}

export function clamp(x, lo, hi) {
  return Math.min(hi, Math.max(lo, x));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** n valores equiespaciados entre lo y hi (ambos incluidos); devuelve el k-ésimo. */
export function linspaceAt(lo, hi, n, k) {
  return n <= 1 ? (lo + hi) / 2 : lo + ((hi - lo) * k) / (n - 1);
}

export function radToDeg(rad) {
  return (rad * 180) / Math.PI;
}
