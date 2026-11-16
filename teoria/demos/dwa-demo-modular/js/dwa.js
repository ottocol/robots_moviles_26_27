/**
 * dwa.js — El algoritmo de la ventana dinámica (Fox, Burgard y Thrun, 1997).
 *
 *   1. Ventana dinámica: los (v, ω) que el robot puede alcanzar en el
 *      siguiente Δt con sus aceleraciones máximas, dentro de los límites Vs.
 *   2. Para cada (v, ω) muestreado se calculan tres criterios:
 *        heading: cuánto mira al objetivo tras Δt y frenar,
 *        dist:    distancia libre a lo largo de su curvatura (tope dMax),
 *        vel:     la propia v.
 *   3. Se descartan los no admisibles (los que no pueden frenar antes del
 *      obstáculo), se normalizan los criterios y se puntúa
 *          G(v, ω) = α·heading + β·dist + γ·vel
 *   4. Se aplica el (v, ω) con mayor G.
 */

import { clamp, linspaceAt, wrapAngle } from './geometry.js';
import { curvatureArc, integratePose } from './robot.js';

export const CRITERIA = ['heading', 'dist', 'vel'];

/* ------------------------------------------------------------------ */
/* 1. Ventana dinámica                                                  */
/* ------------------------------------------------------------------ */

/** Velocidades alcanzables en Δt (V_d) intersecadas con las posibles (V_s). */
export function dynamicWindow(robot, p) {
  return {
    vLo: Math.max(0, robot.v - p.accV * p.dt),
    vHi: Math.min(p.vMax, robot.v + p.accV * p.dt),
    wLo: Math.max(-p.wMax, robot.w - p.accW * p.dt),
    wHi: Math.min(p.wMax, robot.w + p.accW * p.dt),
  };
}

/** Rejilla de nV × nW pares (v, ω) dentro de la ventana. */
export function sampleWindow(win, nV, nW) {
  const samples = [];
  for (let a = 0; a < nV; a++) {
    for (let b = 0; b < nW; b++) {
      samples.push({
        v: linspaceAt(win.vLo, win.vHi, nV, a),
        w: linspaceAt(win.wLo, win.wHi, nW, b),
      });
    }
  }
  return samples;
}

/* ------------------------------------------------------------------ */
/* 2. Simulación y criterios                                           */
/* ------------------------------------------------------------------ */

/**
 * Recorre la curvatura hasta el primer choque del disco del robot.
 * Devuelve el índice de la pose de choque (-1 si no choca) y la distancia
 * libre recorrida (con tope dMax; un giro sobre sí mismo sin choque vale dMax).
 */
export function freeDistanceAlong(path, grid, p) {
  for (let k = 0; k < path.length; k++) {
    if (grid.clearanceAt(path[k].x, path[k].y) < p.radius) {
      return { collisionIndex: k, dist: Math.min(p.dMax, path[k].s) };
    }
  }
  return { collisionIndex: -1, dist: p.dMax };
}

/**
 * Admisible: puede detenerse antes de recorrer `dist`.
 * En el paper: v ≤ √(2·dist·a). Aquí se usa la versión para control discreto:
 * el robot mantiene v durante Δt y después frena, así que necesita
 *     v·Δt + v²/(2a) ≤ dist
 */
export function isAdmissible(v, dist, p) {
  return v * p.dt + (v * v) / (2 * p.accV) <= dist + 1e-9;
}

/**
 * Pose en la que se mide el heading: la que alcanzaría tras aplicar (v, ω)
 * durante Δt y frenar después (aproximado como Δt + tiempo de frenada,
 * manteniendo ω), como en el paper.
 */
export function headingPose(robot, v, w, p) {
  const t = p.dt + v / p.accV;
  return integratePose(robot, v, w, t);
}

/** La curvatura de (v, ω) que se evalúa y se dibuja. */
export function candidatePath(robot, v, w, p) {
  return curvatureArc(robot, v, w, p.dMax, p.arcStep);
}

/** Evalúa un par (v, ω): sus criterios en bruto (sin normalizar). */
export function evaluateVelocity(robot, v, w, grid, goal, p) {
  const path = candidatePath(robot, v, w, p);
  const { collisionIndex, dist } = freeDistanceAlong(path, grid, p);
  const poseH = headingPose(robot, v, w, p);
  const bearing = Math.atan2(goal.y - poseH.y, goal.x - poseH.x);
  const headingError = Math.abs(wrapAngle(bearing - poseH.theta)); // 0 = mira al objetivo

  return {
    v,
    w,
    path,
    collisionIndex,
    admissible: isAdmissible(v, dist, p),
    headingPose: poseH,
    headingError,
    raw: { heading: Math.PI - headingError, dist, vel: v },
    norm: null, // se rellena en scoreCandidates
    G: 0,
  };
}

/* ------------------------------------------------------------------ */
/* 3. Normalización y puntuación                                       */
/* ------------------------------------------------------------------ */

/** Rango [lo, hi] con el que se normaliza cada criterio. */
function normalizationRanges(admissible, p) {
  const theoreticalMax = { heading: Math.PI, dist: p.dMax, vel: p.vMax };
  const ranges = {};
  for (const k of CRITERIA) {
    if (p.normalization === 'minmax' && admissible.length > 0) {
      const values = admissible.map((c) => c.raw[k]);
      ranges[k] = { lo: Math.min(...values), hi: Math.max(...values) };
    } else {
      ranges[k] = { lo: 0, hi: theoreticalMax[k] };
    }
  }
  return ranges;
}

export function criterionWeights(p) {
  return { heading: p.alpha, dist: p.beta, vel: p.gamma };
}

/**
 * Normaliza cada criterio a [0, 1], calcula G y devuelve el mejor admisible
 * (o null si no hay ninguno). Si todos los candidatos empatan en un
 * criterio, ese criterio vale 1 para todos: no discrimina.
 */
export function scoreCandidates(candidates, p) {
  const admissible = candidates.filter((c) => c.admissible);
  const ranges = normalizationRanges(admissible, p);
  const weights = criterionWeights(p);
  let best = null;

  for (const c of candidates) {
    c.norm = {};
    c.G = 0;
    for (const k of CRITERIA) {
      const { lo, hi } = ranges[k];
      c.norm[k] = hi - lo > 1e-9 ? clamp((c.raw[k] - lo) / (hi - lo), 0, 1) : 1;
      c.G += weights[k] * c.norm[k];
    }
    if (c.admissible && (best === null || c.G > best.G)) best = c;
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* 4. Un ciclo completo y el comando resultante                        */
/* ------------------------------------------------------------------ */

/** Un ciclo de DWA: ventana, candidatos evaluados y el mejor. */
export function planDwa(robot, grid, goal, p) {
  const window = dynamicWindow(robot, p);
  const candidates = sampleWindow(window, p.samplesV, p.samplesW).map(({ v, w }) =>
    evaluateVelocity(robot, v, w, grid, goal, p),
  );
  const best = scoreCandidates(candidates, p);
  return { window, candidates, best };
}

/**
 * Comando a aplicar: el mejor candidato o, si ninguno es admisible,
 * frenada de emergencia (frenar lo máximo posible en Δt).
 */
export function chooseCommand(robot, best, p) {
  if (best) return { v: best.v, w: best.w, emergency: false };
  const v = Math.max(0, robot.v - p.accV * p.dt);
  const dw = p.accW * p.dt;
  const w = Math.abs(robot.w) <= dw ? 0 : robot.w - Math.sign(robot.w) * dw;
  return { v, w, emergency: true };
}

/**
 * Admisibilidad sobre todo V_s (no solo la ventana), en una rejilla nV × nW,
 * para sombrear en el panel (v, ω) la zona en la que no daría tiempo a frenar.
 */
export function admissibleRegion(robot, grid, p, nV = 28, nW = 44) {
  const admissible = new Uint8Array(nV * nW);
  for (let a = 0; a < nV; a++) {
    const v = ((a + 0.5) / nV) * p.vMax;
    for (let b = 0; b < nW; b++) {
      const w = -p.wMax + ((b + 0.5) / nW) * 2 * p.wMax;
      const { dist } = freeDistanceAlong(candidatePath(robot, v, w, p), grid, p);
      admissible[a * nW + b] = isAdmissible(v, dist, p) ? 1 : 0;
    }
  }
  return { nV, nW, admissible };
}
