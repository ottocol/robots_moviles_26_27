/* ==========================================================================
 * corridor/markov-grid.js — Filtro de Markov exacto (rejilla) para comparar
 *
 * En 1D se puede calcular la creencia bel(x) casi exacta dividiendo el
 * pasillo en celdas pequeñas. Se dibuja debajo de las partículas para ver
 * que el filtro de partículas es una APROXIMACIÓN de esta distribución:
 * con muchas partículas se parecen mucho; con pocas, no.
 *
 * Usa el mismo modelo de sensor que las partículas. El modelo de movimiento
 * es la misma gaussiana, aplicada como convolución.
 * ========================================================================== */
window.PF = window.PF || {};
PF.corridor = PF.corridor || {};

PF.corridor.MarkovGrid = class {
  constructor(world, cells = 400) {
    this.world = world;
    this.n = cells;
    this.dx = world.length / cells;
    this.reset();
  }

  /** Creencia uniforme: no sabemos dónde está el robot */
  reset() {
    this.p = new Float64Array(this.n).fill(1 / this.n);
  }

  center(i) {
    return (i + 0.5) * this.dx;
  }

  /**
   * Predicción: bel⁻(x) = Σ_x' p(x | u, x') · bel(x')
   * Cada celda reparte su probabilidad en una gaussiana centrada en x' + u.
   * El pasillo es circular: lo que sale por un extremo entra por el otro.
   */
  predict(u, sigma) {
    const { n, dx } = this;
    const s = Math.max(sigma, dx / 2);           // evita una gaussiana más estrecha que una celda
    const kMin = Math.floor((u - 4 * s) / dx);   // desplazamientos posibles, en celdas
    const kMax = Math.ceil((u + 4 * s) / dx);

    const kernel = [];
    let kSum = 0;
    for (let k = kMin; k <= kMax; k++) {
      const w = Math.exp(-0.5 * ((k * dx - u) / s) ** 2);
      kernel.push(w);
      kSum += w;
    }

    const out = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      if (this.p[i] === 0) continue;
      for (let j = 0; j < kernel.length; j++) {
        const target = PF.math.wrap(i + kMin + j, n);
        out[target] += (this.p[i] * kernel[j]) / kSum;
      }
    }
    this.p = out;
  }

  /** Corrección: bel(x) = η · p(z | x) · bel⁻(x) */
  correct(z, likelihood) {
    let sum = 0;
    for (let i = 0; i < this.n; i++) {
      this.p[i] *= likelihood({ x: this.center(i) }, z);
      sum += this.p[i];
    }
    if (sum === 0) return this.reset();
    for (let i = 0; i < this.n; i++) this.p[i] /= sum;
  }
};
