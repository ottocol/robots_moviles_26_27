/* ==========================================================================
 * random.js — Números aleatorios, densidades y utilidades matemáticas
 *
 * Todo el código cuelga del objeto global PF. No se usan módulos ES a
 * propósito: así la demo funciona abriendo index.html con doble clic,
 * sin servidor web.
 * ========================================================================== */
window.PF = window.PF || {};

PF.random = {
  /** Número uniforme en [a, b) */
  uniform(a, b) {
    return a + (b - a) * Math.random();
  },

  /** Devuelve true con probabilidad p */
  bernoulli(p) {
    return Math.random() < p;
  },

  /** Muestra de una gaussiana de media 0 y desviación típica sigma (Box-Muller) */
  gaussian(sigma) {
    if (sigma <= 0) return 0;
    let u = 0;
    while (u === 0) u = Math.random(); // evita log(0)
    const v = Math.random();
    return sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  },

  /** Densidad de una gaussiana N(mu, sigma²) evaluada en x */
  gaussianPdf(x, mu, sigma) {
    const d = (x - mu) / sigma;
    return Math.exp(-0.5 * d * d) / (sigma * Math.sqrt(2 * Math.PI));
  },
};

PF.math = {
  clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  },

  /** Lleva x al intervalo [0, L), dando la vuelta (mundo circular) */
  wrap(x, L) {
    return ((x % L) + L) % L;
  },

  /** Lleva un ángulo al intervalo (-π, π] */
  normalizeAngle(a) {
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a <= -Math.PI) a += 2 * Math.PI;
    return a;
  },
};
