/* ==========================================================================
 * grid/model.js — Modelos probabilísticos del robot en el mapa 2D
 *
 * Implementa la interfaz que espera PF.ParticleFilter. El estado de una
 * partícula es una pose { x, y, theta }.
 * ========================================================================== */
window.PF = window.PF || {};
PF.grid = PF.grid || {};

/**
 * Modelo de movimiento por odometría muestreado
 * (Probabilistic Robotics, tabla 5.6: sample_motion_model_odometry).
 *
 * El control es lo que dice la odometría que ha hecho el robot,
 * descompuesto en tres pasos:
 *   u = { rot1, trans, rot2 }   girar rot1, avanzar trans, girar rot2
 *
 * alphas = [α1, α2, α3, α4] son los parámetros de ruido, con el mismo
 * significado que en AMCL (alpha1..alpha4 en ROS 1 y Nav2):
 *   α1: ruido en la rotación debido a la rotación
 *   α2: ruido en la rotación debido a la traslación
 *   α3: ruido en la traslación debido a la traslación
 *   α4: ruido en la traslación debido a la rotación
 *
 * La usan las partículas Y el robot simulado (cada uno con sus alphas).
 */
PF.grid.sampleOdometry = function (pose, u, alphas) {
  const { gaussian } = PF.random;
  const [a1, a2, a3, a4] = alphas;

  const rot1 = u.rot1 - gaussian(Math.sqrt(a1 * u.rot1 ** 2 + a2 * u.trans ** 2));
  const trans = u.trans - gaussian(Math.sqrt(a3 * u.trans ** 2 + a4 * (u.rot1 ** 2 + u.rot2 ** 2)));
  const rot2 = u.rot2 - gaussian(Math.sqrt(a1 * u.rot2 ** 2 + a2 * u.trans ** 2));

  return {
    x: pose.x + trans * Math.cos(pose.theta + rot1),
    y: pose.y + trans * Math.sin(pose.theta + rot1),
    theta: PF.math.normalizeAngle(pose.theta + rot1 + rot2),
  };
};

/**
 * @param {PF.grid.GridMap} map
 * @param {object} params  compartido con la interfaz:
 *   modelAlphas   [α1..α4] del modelo de movimiento del filtro
 *   sensorModel   'beam' (modelo de haz) o 'field' (likelihood field)
 *   sigma         desviación típica del modelo del sensor (m)
 *   zRand         peso de la componente aleatoria uniforme (0..1)
 */
PF.grid.createModel = function (map, params) {
  const { gaussianPdf } = PF.random;

  return {
    randomState() {
      return map.randomFreePose();
    },

    /** FASE 1 — Mover la partícula según la odometría, con ruido */
    sampleMotion(state, u) {
      return PF.grid.sampleOdometry(state, u, params.modelAlphas);
    },

    /**
     * FASE 2 — log p(z | x, m) para un láser de varios haces.
     *
     * Se suponen haces independientes, así que la probabilidad total es el
     * producto de la de cada haz (la suma de logaritmos). Cada haz se
     * modela como una mezcla de dos componentes:
     *
     *   p(z_k | x, m) = z_hit · N(error; 0, σ) + z_rand · 1/z_max
     *
     * La componente uniforme z_rand representa lecturas inexplicables
     * (personas, reflejos, ruido). Sin ella, un solo haz erróneo anula una
     * partícula que estaba en el sitio correcto.
     */
    logLikelihood(state, z) {
      // Una partícula dentro de una pared es imposible
      if (map.isOccupied(state.x, state.y)) return -Infinity;

      const zHit = 1 - params.zRand;
      const pRand = params.zRand / z.maxRange;
      let logP = 0;

      for (let k = 0; k < z.ranges.length; k++) {
        const angle = state.theta + z.angles[k];
        const measured = z.ranges[k];
        let pHit;

        if (params.sensorModel === 'beam') {
          // Modelo de haz: ¿qué distancia mediría el láser desde esta pose?
          const expected = map.raycast(state.x, state.y, angle, z.maxRange);
          pHit = gaussianPdf(measured, expected, params.sigma);
        } else {
          // Likelihood field: proyecta el extremo del haz sobre el mapa y
          // mira a qué distancia queda del obstáculo más cercano. Es mucho
          // más barato porque no traza rayos. Es el modelo por defecto de AMCL.
          if (measured >= z.maxRange) continue; // las lecturas máximas no aportan nada aquí
          const ex = state.x + measured * Math.cos(angle);
          const ey = state.y + measured * Math.sin(angle);
          pHit = gaussianPdf(map.distanceToObstacle(ex, ey), 0, params.sigma);
        }

        logP += Math.log(zHit * pHit + pRand);
      }
      return logP;
    },

    /**
     * Estimación = media ponderada. El ángulo NO se puede promediar
     * directamente (la media de 179° y −179° no es 0°): se promedian sus
     * vectores unitarios (media circular).
     */
    estimate(particles) {
      let x = 0, y = 0, s = 0, c = 0;
      for (const p of particles) {
        x += p.w * p.state.x;
        y += p.w * p.state.y;
        s += p.w * Math.sin(p.state.theta);
        c += p.w * Math.cos(p.state.theta);
      }
      return { x, y, theta: Math.atan2(s, c) };
    },
  };
};
