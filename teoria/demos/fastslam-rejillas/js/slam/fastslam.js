// FastSLAM con rejillas de ocupación (filtro de partículas Rao-Blackwellizado):
// cada partícula es una hipótesis de trayectoria con su propio mapa.
import { DEG, wrapAngle } from './world.js';
import { OccupancyGrid } from './occupancy-grid.js';
import { sampleMotionModel } from './motion.js';
import { LIKELIHOOD, scanLogLikelihood, scanMatch } from './observation-model.js';

/**
 * Una partícula: pose actual, peso, mapa y trayectoria.
 * La trayectoria es una lista enlazada hacia atrás ({ x, y, previous }), así que
 * las copias de una misma madre comparten todo el tramo anterior al remuestreo.
 * `parentIndex` es la casilla que ocupaba la madre en la generación anterior.
 */
class Particle {
  constructor(pose, weight, map, trajectory, parentIndex) {
    this.pose = pose;
    this.weight = weight;
    this.map = map;
    this.trajectory = trajectory;
    this.parentIndex = parentIndex;
  }

  /** Poses de la trayectoria, de la más reciente a la inicial. */
  trajectoryPoints() {
    const points = [];
    for (let node = this.trajectory; node; node = node.previous) points.push(node);
    return points;
  }
}

export class FastSlamFilter {
  constructor({ particleCount, resolution, startPose, rng }) {
    this.rng = rng;
    const emptyMap = new OccupancyGrid(resolution);
    const start = { x: startPose.x, y: startPose.y, previous: null };
    this.particles = [];
    for (let i = 0; i < particleCount; i++) {
      const map = i === 0 ? emptyMap : emptyMap.clone();
      this.particles.push(new Particle({ ...startPose }, 1 / particleCount, map, start, i));
    }
  }

  get count() {
    return this.particles.length;
  }

  /** Predicción: cada partícula muestrea su nueva pose del modelo de movimiento. */
  predict(u, noiseScale) {
    for (const particle of this.particles) {
      particle.pose = sampleMotionModel(particle.pose, u, noiseScale, this.rng);
    }
  }

  /**
   * Corrección con el escaneo z_t:
   *  1. (opcional) propuesta mejorada: llevar cada pose al máximo del scan matching;
   *  2. ponderar con p(z_t | x_t, m_{t-1}) usando el mapa ANTERIOR de la partícula;
   *  3. integrar el escaneo en el mapa de cada partícula;
   *  4. remuestrear si Neff < N/2.
   */
  correct(scan, { improvedProposal }) {
    const N = this.count;
    const logLikelihoods = new Float64Array(N);

    for (let i = 0; i < N; i++) {
      const particle = this.particles[i];
      if (improvedProposal) {
        const match = scanMatch(particle.map, particle.pose, scan);
        particle.pose = {
          x: match.pose.x + this.rng.gaussian() * 0.01,
          y: match.pose.y + this.rng.gaussian() * 0.01,
          theta: wrapAngle(match.pose.theta + this.rng.gaussian() * 0.3 * DEG),
        };
        logLikelihoods[i] = match.score;
      } else {
        logLikelihoods[i] = scanLogLikelihood(particle.map, particle.pose, scan);
      }
      logLikelihoods[i] *= LIKELIHOOD.temperature;
    }

    this.#multiplyWeights(logLikelihoods);
    const neff = this.effectiveSampleSize();

    for (const particle of this.particles) {
      particle.map.integrateScan(particle.pose, scan);
      particle.trajectory = { x: particle.pose.x, y: particle.pose.y, previous: particle.trajectory };
    }

    const resampled = neff < N / 2;
    const mapsCopied = resampled ? this.#resample() : 0;
    return { neff, resampled, mapsCopied };
  }

  /** Pesos que tendrían las partículas con este escaneo, sin modificar nada. */
  previewWeights(scan) {
    const scaled = this.particles.map(
      (p) => LIKELIHOOD.temperature * scanLogLikelihood(p.map, p.pose, scan));
    const max = Math.max(...scaled);
    const weights = this.particles.map((p, i) => p.weight * Math.exp(scaled[i] - max));
    const sum = weights.reduce((a, b) => a + b, 0);
    return weights.map((w) => w / sum);
  }

  /** Neff = 1 / Σ w_i² (con pesos normalizados). */
  effectiveSampleSize() {
    let sumOfSquares = 0;
    for (const p of this.particles) sumOfSquares += p.weight * p.weight;
    return 1 / sumOfSquares;
  }

  bestIndex() {
    let best = 0;
    this.particles.forEach((p, i) => {
      if (p.weight > this.particles[best].weight) best = i;
    });
    return best;
  }

  /** w_i ← w_i · exp(log-verosimilitud), restando el máximo para evitar desbordes, y normalizar. */
  #multiplyWeights(logLikelihoods) {
    let max = -Infinity;
    for (const l of logLikelihoods) if (l > max) max = l;
    let sum = 0;
    this.particles.forEach((p, i) => {
      p.weight *= Math.exp(logLikelihoods[i] - max);
      sum += p.weight;
    });
    for (const p of this.particles) p.weight /= sum;
  }

  /**
   * Remuestreo de baja varianza. Las hijas de una misma madre comparten su
   * trayectoria; la última hija se queda con el mapa de la madre y las demás
   * reciben una copia. Devuelve cuántos mapas se han copiado.
   */
  #resample() {
    const old = this.particles;
    const N = old.length;

    // Elegir N madres con un único número aleatorio
    const parents = [];
    const r = this.rng.uniform() / N;
    let cumulative = old[0].weight;
    let i = 0;
    for (let m = 0; m < N; m++) {
      const target = r + m / N;
      while (target > cumulative && i < N - 1) {
        i++;
        cumulative += old[i].weight;
      }
      parents.push(i);
    }

    const children = new Int32Array(N);
    for (const k of parents) children[k]++;
    const assigned = new Int32Array(N);
    let mapsCopied = 0;

    this.particles = parents.map((k) => {
      const mother = old[k];
      assigned[k]++;
      const isLastChild = assigned[k] === children[k];
      if (!isLastChild) mapsCopied++;
      return new Particle(
        { ...mother.pose }, 1 / N,
        isLastChild ? mother.map : mother.map.clone(),
        mother.trajectory, k);
    });
    return mapsCopied;
  }
}
