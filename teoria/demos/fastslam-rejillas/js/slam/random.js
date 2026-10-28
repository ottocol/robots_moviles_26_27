// Generador pseudoaleatorio con semilla (mulberry32).
// Todo el azar de la simulación pasa por aquí: con la misma semilla y las mismas
// órdenes, la ejecución se repite exactamente.

export class Random {
  constructor(seed) {
    this.state = seed | 0;
  }

  /** Muestra uniforme en [0, 1). */
  uniform() {
    this.state = (this.state + 0x6d2b79f5) | 0;
    const a = this.state;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Muestra de una normal N(0, 1) por Box-Muller. */
  gaussian() {
    let u = 0;
    while (u === 0) u = this.uniform();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * this.uniform());
  }
}
