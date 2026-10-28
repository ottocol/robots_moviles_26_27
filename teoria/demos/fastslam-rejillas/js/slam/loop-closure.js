// Detector de cierre de ciclo para la pausa didáctica. Hace trampa a propósito:
// usa la pose real del simulador, que el filtro no conoce. Guarda en una rejilla
// gruesa (25 cm) el último paso en que se vio cada celda; hay cierre cuando una
// parte apreciable del escaneo cae en celdas que no se veían desde hace tiempo.
import { MAP_BOUNDS } from './world.js';
import { scanEndpoints } from './laser.js';

export class LoopClosureDetector {
  constructor({ cellSize = 0.25, gapSteps = 40, minFraction = 0.12, minBeams = 4 } = {}) {
    this.cellSize = cellSize;
    this.gapSteps = gapSteps;          // pasos sin ver una celda para que cuente como «antigua»
    this.minFraction = minFraction;    // fracción mínima de impactos en zona antigua
    this.minBeams = minBeams;
    this.nx = Math.round(MAP_BOUNDS.width / cellSize);
    this.ny = Math.round(MAP_BOUNDS.height / cellSize);
    this.lastSeen = new Int32Array(this.nx * this.ny).fill(-1);
  }

  #cell(point) {
    const i = Math.floor((point.x - MAP_BOUNDS.x0) / this.cellSize);
    const j = Math.floor((point.y - MAP_BOUNDS.y0) / this.cellSize);
    if (i < 0 || j < 0 || i >= this.nx || j >= this.ny) return -1;
    return j * this.nx + i;
  }

  /**
   * Haces cuyo punto final cae en zona que no se veía desde hace más de `gapSteps`.
   * Devuelve { beams, isClosure }.
   */
  check(truePose, scan, step) {
    const endpoints = scanEndpoints(truePose, scan);
    const beams = [];
    for (const point of endpoints) {
      const k = this.#cell(point);
      if (k < 0) continue;
      const seen = this.lastSeen[k];
      if (seen >= 0 && step - seen > this.gapSteps) beams.push(point.beam);
    }
    const isClosure = beams.length >= Math.max(this.minBeams, this.minFraction * endpoints.length);
    return { beams, isClosure };
  }

  markSeen(truePose, scan, step) {
    for (const point of scanEndpoints(truePose, scan)) {
      const k = this.#cell(point);
      if (k >= 0) this.lastSeen[k] = step;
    }
  }
}
