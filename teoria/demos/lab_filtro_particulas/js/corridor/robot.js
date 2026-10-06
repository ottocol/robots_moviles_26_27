/* ==========================================================================
 * corridor/robot.js — El robot "real" simulado
 *
 * Se mueve y mide con su propio ruido. El filtro no conoce estos valores:
 * solo recibe el control ordenado u y la lectura del sensor z. Si el
 * modelo del filtro se aleja mucho de esta realidad (prueba a bajar el
 * ruido de movimiento a 0, o a poner p(puerta | pared) en 0,01), el
 * filtro se vuelve demasiado confiado y acaba perdiéndose.
 * ========================================================================== */
window.PF = window.PF || {};
PF.corridor = PF.corridor || {};

PF.corridor.SimulatedRobot = class {
  constructor(world) {
    this.world = world;
    this.truth = {
      motionNoise: 0.1,     // desviación típica por metro recorrido
      pDoorGivenDoor: 0.8,  // tasa de acierto ante una puerta
      pDoorGivenWall: 0.1,  // falsos positivos ante una pared
    };
    this.startX = 1.0;
    this.reset();
  }

  reset() {
    this.x = this.startX;
    this.lastReading = null; // null = todavía no ha medido
  }

  /** Ejecuta el movimiento ordenado u (metros, con signo), con ruido */
  move(u) {
    const sigma = this.truth.motionNoise * Math.abs(u);
    this.x = PF.math.wrap(this.x + u + PF.random.gaussian(sigma), this.world.length);
  }

  /** Lee el detector de puerta. Devuelve true ("puerta") o false ("pared") */
  sense() {
    const pDoor = this.world.isDoor(this.x) ? this.truth.pDoorGivenDoor : this.truth.pDoorGivenWall;
    this.lastReading = PF.random.bernoulli(pDoor);
    return this.lastReading;
  }

  /** Lo cogemos y lo dejamos en otro sitio sin que el filtro lo sepa */
  kidnap() {
    this.x = PF.random.uniform(0.5, this.world.length - 0.5);
    this.lastReading = null;
  }
};
