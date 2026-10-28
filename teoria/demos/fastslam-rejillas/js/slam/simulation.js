// La simulación completa: robot real, odometría, láser, filtro FastSLAM y la pausa
// antes de cerrar el ciclo. No sabe nada de la página; la interfaz solo la lee.
import { START_POSE, LOOP_ROUTE } from './world.js';
import { Random } from './random.js';
import { simulateScan } from './laser.js';
import { moveRealRobot, integrateOdometry } from './motion.js';
import { FastSlamFilter } from './fastslam.js';
import { LoopClosureDetector } from './loop-closure.js';
import { RouteFollower } from './route.js';

export class Simulation {
  /**
   * @param {object} config
   * @param {number} config.seed              semilla del generador aleatorio
   * @param {number} config.particleCount     número de partículas N
   * @param {number} config.resolution        tamaño de celda en metros
   * @param {boolean} config.improvedProposal usar scan matching en la propuesta
   * @param {number} config.motionNoise       factor de ruido del modelo de movimiento
   */
  constructor(config) {
    this.config = { ...config };
    this.improvedProposal = config.improvedProposal;
    this.motionNoise = config.motionNoise;
    this.rng = new Random(config.seed);

    this.step = 0;
    this.truePose = { ...START_POSE };
    this.odometryPose = { ...START_POSE };
    this.trueTrail = [{ ...START_POSE }];
    this.odometryTrail = [{ ...START_POSE }];

    this.filter = new FastSlamFilter({
      particleCount: config.particleCount,
      resolution: config.resolution,
      startPose: START_POSE,
      rng: this.rng,
    });
    this.route = new RouteFollower(LOOP_ROUTE);
    this.loopClosure = new LoopClosureDetector();

    // Estadísticas para la interfaz
    this.neffHistory = [];      // Neff / N tras cada corrección
    this.resampleSteps = [];    // pasos en los que se remuestreó
    this.mapsCopied = 0;
    this.lastNeff = null;
    this.lastScan = null;
    this.closureStep = -1;      // paso en que se detectó el cierre (-1: todavía no)

    // Escaneo retenido en la pausa: { scan, revisitedBeams, previewWeights }
    this.pending = null;

    // Primer escaneo desde la pose inicial conocida
    this.#correct(simulateScan(this.truePose, this.rng));
  }

  get particles() {
    return this.filter.particles;
  }

  /**
   * Un paso completo: mover el robot, predecir y corregir con el nuevo escaneo.
   * Si `pauseBeforeLoopClosure` y el escaneo cierra el ciclo, se queda en pausa
   * entre la predicción y la corrección, y devuelve 'paused'.
   */
  advance(u, { pauseBeforeLoopClosure }) {
    if (this.pending) return 'pending';
    this.step++;

    this.truePose = moveRealRobot(this.truePose, u, this.rng);
    this.odometryPose = integrateOdometry(this.odometryPose, u);
    this.trueTrail.push(this.truePose);
    this.odometryTrail.push(this.odometryPose);

    this.filter.predict(u, this.motionNoise);

    const scan = simulateScan(this.truePose, this.rng);
    const closure = this.loopClosure.check(this.truePose, scan, this.step);
    if (this.closureStep < 0 && closure.isClosure) {
      this.closureStep = this.step;
      if (pauseBeforeLoopClosure) {
        this.lastScan = scan;
        this.pending = {
          scan,
          revisitedBeams: closure.beams,
          previewWeights: this.filter.previewWeights(scan),
        };
        return 'paused';
      }
    }
    this.#correct(scan);
    return 'ok';
  }

  /** Sale de la pausa aplicando el escaneo retenido. */
  applyPendingScan() {
    if (!this.pending) return;
    const { scan } = this.pending;
    this.pending = null;
    this.#correct(scan);
  }

  #correct(scan) {
    this.lastScan = scan;
    const result = this.filter.correct(scan, {
      improvedProposal: this.improvedProposal && this.step > 2,
    });
    this.loopClosure.markSeen(this.truePose, scan, this.step);
    this.lastNeff = result.neff;
    this.neffHistory.push(result.neff / this.filter.count);
    if (result.resampled) {
      this.resampleSteps.push(this.step);
      this.mapsCopied += result.mapsCopied;
    }
  }
}
