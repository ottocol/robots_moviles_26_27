/* ==========================================================================
 * corridor/model.js — Modelos probabilísticos del pasillo
 *
 * Implementa la interfaz que espera PF.ParticleFilter. El estado de una
 * partícula es { x } (posición en metros a lo largo del pasillo).
 *
 * `params` es un objeto compartido con la interfaz: los sliders lo
 * modifican y el modelo lo lee en cada llamada, así los cambios se notan
 * en directo.
 * ========================================================================== */
window.PF = window.PF || {};
PF.corridor = PF.corridor || {};

PF.corridor.createModel = function (world, params) {
  const { uniform, gaussian } = PF.random;

  return {
    randomState() {
      return { x: uniform(0, world.length) };
    },

    /**
     * FASE 1 — Modelo de movimiento: x_t = x_{t-1} + u + ε,
     * con ε gaussiano y desviación proporcional a la distancia recorrida.
     * El pasillo es circular, así que la posición da la vuelta.
     */
    sampleMotion(state, u) {
      const sigma = params.motionNoise * Math.abs(u);
      const x = PF.math.wrap(state.x + u + gaussian(sigma), world.length);
      return { x };
    },

    /**
     * FASE 2 — Modelo del sensor: detector binario de puerta.
     * z = true  → el sensor dice "puerta"
     * z = false → el sensor dice "pared"
     *
     *                        frente a puerta    frente a pared
     *   p(z = puerta | x)    pDoorGivenDoor     pDoorGivenWall
     *   p(z = pared  | x)    1 − pDoorGivenDoor 1 − pDoorGivenWall
     */
    likelihood(state, z) {
      const pDoor = world.isDoor(state.x) ? params.pDoorGivenDoor : params.pDoorGivenWall;
      return z ? pDoor : 1 - pDoor;
    },

    logLikelihood(state, z) {
      return Math.log(this.likelihood(state, z));
    },

    /**
     * Estimación = media ponderada de las partículas.
     * Como el pasillo es circular, se promedia igual que un ángulo (media
     * circular): si no, la media de 19,9 m y 0,1 m saldría 10 m.
     * Ojo: con una distribución multimodal la media puede caer en un sitio
     * donde no hay ninguna partícula. Se ve muy bien al principio.
     */
    estimate(particles) {
      const k = (2 * Math.PI) / world.length;
      let s = 0, c = 0;
      for (const p of particles) {
        s += p.w * Math.sin(k * p.state.x);
        c += p.w * Math.cos(k * p.state.x);
      }
      return { x: PF.math.wrap(Math.atan2(s, c) / k, world.length) };
    },
  };
};
