/* ==========================================================================
 * particle-filter.js — Filtro de partículas genérico
 *
 * Este fichero no sabe nada de robots, pasillos ni láseres. Todo lo que
 * depende del problema está en el MODELO, un objeto con cuatro funciones:
 *
 *   randomState()            Estado aleatorio en el mapa (inicialización
 *                            global y partículas aleatorias).
 *   sampleMotion(state, u)   Muestra de p(x_t | u_t, x_{t-1}).   → Fase 1
 *   logLikelihood(state, z)  log p(z_t | x_t, m).                → Fase 2
 *   estimate(particles)      Estado estimado a partir de las partículas.
 *
 * El pasillo 1D (js/corridor/model.js) y el mapa 2D (js/grid/model.js) usan
 * esta misma clase con modelos distintos.
 *
 * Cada partícula es un objeto { state, w }, con los pesos normalizados.
 * ========================================================================== */
window.PF = window.PF || {};

(function () {
  /** log( (1/M) Σ exp(v_m) ) calculado sin desbordamientos */
  function logMeanExp(values) {
    let max = -Infinity;
    for (const v of values) if (v > max) max = v;
    if (max === -Infinity) return -Infinity;
    let sum = 0;
    for (const v of values) sum += Math.exp(v - max);
    return max + Math.log(sum / values.length);
  }

  PF.ParticleFilter = class {
    constructor(model) {
      this.model = model;
      this.particles = [];
      this.stats = {
        neff: 0,                  // tamaño efectivo de la muestra TRAS PONDERAR
                                  // (antes del remuestreo, que es cuando informa)
        logMeanLikelihood: null,  // log de la verosimilitud media de la última medida
        allRejected: false,       // ninguna partícula era compatible con la medida
      };
    }

    get size() {
      return this.particles.length;
    }

    /**
     * Crea M partículas con pesos iguales. Por defecto se reparten al azar
     * por todo el mapa (localización global); se puede pasar otro sampler
     * para empezar alrededor de una pose conocida (seguimiento).
     */
    init(M, sampler = () => this.model.randomState()) {
      this.particles = [];
      for (let m = 0; m < M; m++) {
        this.particles.push({ state: sampler(), w: 1 / M });
      }
      this.stats.logMeanLikelihood = null;
      this.stats.allRejected = false;
      this.updateStats();
    }

    /**
     * FASE 1 — Predicción.
     * Cada partícula se mueve según el control u con el modelo de movimiento,
     * que añade ruido. Por eso las copias idénticas que deja el remuestreo
     * se vuelven a separar aquí.
     */
    predict(u) {
      for (const p of this.particles) {
        p.state = this.model.sampleMotion(p.state, u);
      }
    }

    /**
     * FASE 2 — Ponderación: w ← w · p(z | x, m).
     * Tras un remuestreo todos los pesos valen 1/M, así que queda w ∝ p(z | x, m).
     * Si no se remuestrea, los pesos se van acumulando de un paso a otro.
     *
     * Se trabaja con logaritmos: el producto de muchas probabilidades
     * pequeñas (por ejemplo 20 haces de láser) da 0 en coma flotante.
     */
    weight(z) {
      const M = this.particles.length;
      const logLik = new Float64Array(M);
      const logW = new Float64Array(M);
      let maxLogW = -Infinity;

      for (let m = 0; m < M; m++) {
        const p = this.particles[m];
        logLik[m] = this.model.logLikelihood(p.state, z);
        logW[m] = Math.log(p.w) + logLik[m];
        if (logW[m] > maxLogW) maxLogW = logW[m];
      }

      // Diagnóstico: verosimilitud media de la medida. Si cae de golpe,
      // probablemente el robot se ha perdido (o lo han secuestrado).
      this.stats.logMeanLikelihood = logMeanExp(logLik);

      if (maxLogW === -Infinity) {
        // Ninguna partícula explica la medida: no se puede normalizar.
        // Dejamos los pesos iguales y lo señalamos en la interfaz.
        for (const p of this.particles) p.w = 1 / M;
        this.stats.allRejected = true;
      } else {
        // Normalización estable: w_m = exp(logW_m − max) / Σ_k exp(logW_k − max)
        let sum = 0;
        for (let m = 0; m < M; m++) {
          logW[m] = Math.exp(logW[m] - maxLogW);
          sum += logW[m];
        }
        for (let m = 0; m < M; m++) this.particles[m].w = logW[m] / sum;
        this.stats.allRejected = false;
      }
      this.updateStats();
    }

    /**
     * ¿Hace falta remuestrear? Depende de la política:
     *   'always'    en cada ciclo (lo que hace el algoritmo básico y AMCL)
     *   'adaptive'  solo si N_eff < M/2: los pesos se han degenerado
     *   'never'     nunca (para ver qué pasa sin remuestreo)
     *
     * Remuestrear tiene un coste oculto: cada vez se pierden hipótesis
     * (copias repetidas, partículas descartadas). Si se hace solo cuando
     * hace falta, se conserva más diversidad.
     */
    needsResampling(policy) {
      if (policy === 'always') return true;
      if (policy === 'never') return false;
      return this.stats.neff < this.particles.length / 2;
    }

    /**
     * FASE 3 — Remuestreo.
     * Se eligen M partículas con reemplazo y probabilidad proporcional al
     * peso. Las nuevas copian el estado de la elegida y vuelven a tener
     * peso 1/M. N_eff no se recalcula aquí: daría siempre M, que no informa
     * de nada. Se muestra el valor que tenía antes de remuestrear.
     */
    resample(method = 'systematic') {
      const weights = this.particles.map((p) => p.w);
      const indices = PF.resampling[method](weights);
      const M = this.particles.length;
      this.particles = indices.map((i) => ({
        state: { ...this.particles[i].state },
        w: 1 / M,
      }));
    }

    /**
     * Sustituye una fracción de las partículas por estados aleatorios.
     * Es la estrategia más simple contra el "secuestro" del robot: siempre
     * queda alguna hipótesis repartida por el mapa. (AMCL va más allá y
     * decide cuántas inyectar comparando la verosimilitud media a corto y
     * a largo plazo.) Se llama justo después del remuestreo.
     */
    injectRandom(fraction) {
      const k = Math.round(fraction * this.particles.length);
      for (let j = 0; j < k; j++) {
        const m = Math.floor(Math.random() * this.particles.length);
        this.particles[m].state = this.model.randomState();
      }
    }

    /**
     * Tamaño efectivo de la muestra: N_eff = 1 / Σ w².
     * Vale M si todos los pesos son iguales y 1 si una sola partícula
     * acapara todo el peso. Indica cuántas partículas están "trabajando".
     */
    updateStats() {
      let s = 0;
      for (const p of this.particles) s += p.w * p.w;
      this.stats.neff = s > 0 ? 1 / s : 0;
    }

    estimate() {
      return this.model.estimate(this.particles);
    }
  };
})();
