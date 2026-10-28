// Mapa de ocupación en log-odds: l = log(p / (1 - p)). Una celda desconocida vale 0 (p = 0,5).
import { MAP_BOUNDS } from './world.js';
import { LASER, beamAngle } from './laser.js';

// Modelo inverso del sensor: cuánto suma cada observación al log-odds de la celda.
export const INVERSE_SENSOR_MODEL = {
  occupied: 0.9,   // celda donde termina un haz con impacto
  free: -0.4,      // celdas que atraviesa el haz
  limit: 6,        // saturación: |l| ≤ 6 (p entre 0,0025 y 0,9975)
};

export class OccupancyGrid {
  constructor(resolution, logOdds = null) {
    this.resolution = resolution;
    this.nx = Math.round(MAP_BOUNDS.width / resolution);
    this.ny = Math.round(MAP_BOUNDS.height / resolution);
    // Float32: 4 bytes por celda
    this.logOdds = logOdds ? new Float32Array(logOdds) : new Float32Array(this.nx * this.ny);
  }

  /** Bytes que ocupa un mapa con esta resolución. */
  static bytesFor(resolution) {
    return Math.round(MAP_BOUNDS.width / resolution) * Math.round(MAP_BOUNDS.height / resolution) * 4;
  }

  clone() {
    return new OccupancyGrid(this.resolution, this.logOdds);
  }

  /** Índice de la celda que contiene (x, y), o -1 si cae fuera del mapa. */
  cellIndex(x, y) {
    const i = Math.floor((x - MAP_BOUNDS.x0) / this.resolution);
    const j = Math.floor((y - MAP_BOUNDS.y0) / this.resolution);
    if (i < 0 || j < 0 || i >= this.nx || j >= this.ny) return -1;
    return j * this.nx + i;
  }

  /**
   * Integra un escaneo tomado desde `pose`: las celdas recorridas por cada haz se
   * vuelven más libres y la celda del impacto más ocupada.
   */
  integrateScan(pose, scan) {
    const { occupied, free, limit } = INVERSE_SENSOR_MODEL;
    const step = this.resolution * 0.5;
    const cells = this.logOdds;
    for (let b = 0; b < LASER.beamCount; b++) {
      const angle = pose.theta + beamAngle(b);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const range = scan.ranges[b];

      // Recorrer el haz a pasos de media celda, sin actualizar dos veces la misma
      let previous = -1;
      for (let t = 0; t < range - this.resolution; t += step) {
        const k = this.cellIndex(pose.x + cos * t, pose.y + sin * t);
        if (k >= 0 && k !== previous) {
          cells[k] = Math.max(-limit, cells[k] + free);
          previous = k;
        }
      }

      if (scan.hit[b]) {
        const k = this.cellIndex(pose.x + cos * range, pose.y + sin * range);
        if (k >= 0) cells[k] = Math.min(limit, cells[k] + occupied);
      }
    }
  }
}
