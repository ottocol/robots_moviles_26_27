// Láser simulado: 360°, 72 haces (uno cada 5°), alcance 5 m y ruido gaussiano de 3 cm.
import { castRay } from './world.js';

export const LASER = { beamCount: 72, maxRange: 5, rangeNoise: 0.03 };

/** Ángulo del haz i respecto al frente del robot. */
export function beamAngle(i) {
  return -Math.PI + i * 2 * Math.PI / LASER.beamCount;
}

/**
 * Escaneo z_t desde la pose real. Devuelve las distancias y, para cada haz,
 * si ha chocado con algo (hit = 1) o ha llegado al alcance máximo (hit = 0).
 */
export function simulateScan(pose, rng) {
  const ranges = new Float32Array(LASER.beamCount);
  const hit = new Uint8Array(LASER.beamCount);
  for (let i = 0; i < LASER.beamCount; i++) {
    const distance = castRay(pose.x, pose.y, pose.theta + beamAngle(i));
    if (distance < LASER.maxRange) {
      ranges[i] = Math.max(0.05, distance + rng.gaussian() * LASER.rangeNoise);
      hit[i] = 1;
    } else {
      ranges[i] = LASER.maxRange;
    }
  }
  return { ranges, hit };
}

/** Puntos finales de los haces con impacto, vistos desde `pose`: [{ x, y, beam }]. */
export function scanEndpoints(pose, scan) {
  const points = [];
  for (let i = 0; i < LASER.beamCount; i++) {
    if (!scan.hit[i]) continue;
    const angle = pose.theta + beamAngle(i);
    points.push({
      x: pose.x + scan.ranges[i] * Math.cos(angle),
      y: pose.y + scan.ranges[i] * Math.sin(angle),
      beam: i,
    });
  }
  return points;
}
