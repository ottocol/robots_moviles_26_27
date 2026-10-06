/* ==========================================================================
 * resampling.js — Algoritmos de remuestreo (Fase 3)
 *
 * Ambos reciben los pesos normalizados (suman 1) y devuelven un array de M
 * índices: qué partícula antigua se copia en cada posición del nuevo
 * conjunto. Una partícula con mucho peso aparecerá varias veces; una con
 * poco peso probablemente no aparecerá ninguna.
 * ========================================================================== */
window.PF = window.PF || {};

PF.resampling = {
  /**
   * Multinomial: M extracciones independientes, cada una con probabilidad
   * proporcional al peso. Es literalmente el "draw i with probability ∝ w[i]"
   * del algoritmo de las transparencias.
   */
  multinomial(weights) {
    const M = weights.length;

    // Pesos acumulados: cumulative[i] = w[0] + ... + w[i]
    const cumulative = new Float64Array(M);
    let total = 0;
    for (let i = 0; i < M; i++) {
      total += weights[i];
      cumulative[i] = total;
    }

    const indices = new Array(M);
    for (let m = 0; m < M; m++) {
      const r = Math.random() * total;
      // Búsqueda binaria del primer i con cumulative[i] >= r
      let lo = 0;
      let hi = M - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (cumulative[mid] < r) lo = mid + 1;
        else hi = mid;
      }
      indices[m] = lo;
    }
    return indices;
  },

  /**
   * Sistemático o de baja varianza (Probabilistic Robotics, tabla 4.4).
   * Un único número aleatorio r y M "dientes de peine" equiespaciados
   * r, r + 1/M, r + 2/M, ... Recorre los pesos una sola vez (O(M)) y
   * pierde menos diversidad que el multinomial. Es el que se usa en la práctica.
   */
  systematic(weights) {
    const M = weights.length;
    const indices = new Array(M);
    const step = 1 / M;
    const r = Math.random() * step;

    let i = 0;
    let c = weights[0]; // peso acumulado hasta la partícula i
    for (let m = 0; m < M; m++) {
      const u = r + m * step;
      while (u > c && i < M - 1) {
        i++;
        c += weights[i];
      }
      indices[m] = i;
    }
    return indices;
  },
};
