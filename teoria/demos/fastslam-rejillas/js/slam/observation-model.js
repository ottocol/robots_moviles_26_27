// Modelo de observación p(z_t | x_t, m) por punto final del haz, y scan matching.
import { DEG, MAP_BOUNDS } from './world.js';
import { LASER, beamAngle } from './laser.js';

export const LIKELIHOOD = {
  zHit: 0.9,       // peso de «el punto final cae en una celda ocupada»
  zRandom: 0.1,    // peso de una medida aleatoria (evita probabilidades nulas)
  // Exponente que suaviza la verosimilitud: con 72 haces, sin él una sola
  // partícula se lleva casi todo el peso en cada paso.
  temperature: 0.1,
};

/**
 * log p(z | x, m). Para cada haz con impacto se toma la probabilidad de ocupación
 * más alta en la vecindad 3x3 del punto final (tolera ±1 celda de error).
 */
export function scanLogLikelihood(grid, pose, scan) {
  const { zHit, zRandom } = LIKELIHOOD;
  const { nx, ny, resolution, logOdds } = grid;
  const cosTheta = Math.cos(pose.theta);
  const sinTheta = Math.sin(pose.theta);
  let total = 0;

  for (let b = 0; b < LASER.beamCount; b++) {
    if (!scan.hit[b]) continue;
    // Punto final: rotar la dirección del haz con la orientación de la pose
    const cosBeam = Math.cos(beamAngle(b));
    const sinBeam = Math.sin(beamAngle(b));
    const range = scan.ranges[b];
    const ex = pose.x + range * (cosTheta * cosBeam - sinTheta * sinBeam);
    const ey = pose.y + range * (sinTheta * cosBeam + cosTheta * sinBeam);
    const i = Math.floor((ex - MAP_BOUNDS.x0) / resolution);
    const j = Math.floor((ey - MAP_BOUNDS.y0) / resolution);

    let maxLogOdds = -Infinity;
    for (let jj = j - 1; jj <= j + 1; jj++) {
      if (jj < 0 || jj >= ny) continue;
      for (let ii = i - 1; ii <= i + 1; ii++) {
        if (ii < 0 || ii >= nx) continue;
        maxLogOdds = Math.max(maxLogOdds, logOdds[jj * nx + ii]);
      }
    }
    // Fuera del mapa: desconocido
    const pOccupied = maxLogOdds === -Infinity ? 0.5 : 1 / (1 + Math.exp(-maxLogOdds));
    total += Math.log(zRandom + zHit * pOccupied);
  }
  return total;
}

/**
 * Scan matching por ascenso de colina: busca cerca de `pose` la pose que mejor
 * encaja el escaneo en el mapa. Pasos iniciales de 8 cm y 2°, que se van
 * dividiendo por 2 en cada una de las 4 rondas.
 */
export function scanMatch(grid, pose, scan) {
  let best = { x: pose.x, y: pose.y, theta: pose.theta };
  let bestScore = scanLogLikelihood(grid, best, scan);
  let stepXY = 0.08;
  let stepTheta = 2 * DEG;
  const moves = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

  for (let round = 0; round < 4; round++) {
    let improved = true;
    for (let iteration = 0; improved && iteration < 8; iteration++) {
      improved = false;
      for (const [mx, my, mt] of moves) {
        const candidate = {
          x: best.x + mx * stepXY,
          y: best.y + my * stepXY,
          theta: best.theta + mt * stepTheta,
        };
        const score = scanLogLikelihood(grid, candidate, scan);
        if (score > bestScore) {
          bestScore = score;
          best = candidate;
          improved = true;
        }
      }
    }
    stepXY /= 2;
    stepTheta /= 2;
  }
  return { pose: best, score: bestScore };
}
