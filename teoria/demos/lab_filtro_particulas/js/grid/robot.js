/* ==========================================================================
 * grid/robot.js — El robot "real" simulado en el mapa 2D
 *
 * Tiene su propio ruido de movimiento y de sensor. El filtro solo ve:
 *   - la odometría u (lo que el robot CREE que ha hecho),
 *   - las lecturas del láser z.
 * También guarda la pose que se obtendría integrando solo la odometría
 * (dead reckoning), para ver cómo se desvía sin filtro.
 * ========================================================================== */
window.PF = window.PF || {};
PF.grid = PF.grid || {};

PF.grid.SimulatedRobot = class {
  constructor(map) {
    this.truth = {
      alphas: [0.04, 0.04, 0.02, 0.01], // ruido real del movimiento (α1..α4)
      sigma: 0.03,                      // ruido real del láser (m)
      pRandom: 0.03,                    // probabilidad de una lectura aleatoria
      maxRange: 5,                      // alcance del láser (m)
    };
    this.radius = 0.15;     // m, para las colisiones y el dibujo
    this.stepLength = 0.25; // m por pulsación de avance
    this.turnAngle = Math.PI / 12; // 15° por pulsación de giro
    this.setMap(map);
  }

  setMap(map) {
    this.map = map;
    this.pose = this.randomClearPose();
    this.odomPose = { ...this.pose };
    this.lastScan = null;
  }

  /** Pose libre con margen suficiente para el cuerpo del robot */
  randomClearPose() {
    for (let i = 0; i < 1000; i++) {
      const p = this.map.randomFreePose();
      if (this.map.distanceToObstacle(p.x, p.y) > 0.3) return p;
    }
    return this.map.randomFreePose();
  }

  /** Traduce una orden de teclado a la odometría u = { rot1, trans, rot2 } */
  odometryFor(command) {
    switch (command) {
      case 'forward': return { rot1: 0, trans: this.stepLength, rot2: 0 };
      case 'backward': return { rot1: 0, trans: -this.stepLength, rot2: 0 };
      case 'left': return { rot1: this.turnAngle, trans: 0, rot2: 0 };
      case 'right': return { rot1: -this.turnAngle, trans: 0, rot2: 0 };
      default: return null;
    }
  }

  /**
   * Ejecuta la orden. El movimiento real lleva ruido. Si chocaría con una
   * pared, el robot no se mueve y devuelve null (no hay odometría que dar).
   */
  execute(command) {
    const u = this.odometryFor(command);
    if (!u) return null;
    const next = PF.grid.sampleOdometry(this.pose, u, this.truth.alphas);
    if (this.collides(this.pose, next)) return null;

    this.pose = next;
    // Dead reckoning: integra la odometría como si fuera perfecta
    this.odomPose = PF.grid.sampleOdometry(this.odomPose, u, [0, 0, 0, 0]);
    return u;
  }

  collides(from, to) {
    for (let t = 0.25; t <= 1; t += 0.25) {
      const x = from.x + (to.x - from.x) * t;
      const y = from.y + (to.y - from.y) * t;
      if (this.map.distanceToObstacle(x, y) < this.radius * 0.8 || this.map.isOccupied(x, y)) return true;
    }
    return false;
  }

  /**
   * Lectura del láser: numBeams haces repartidos en 360°.
   * Devuelve z = { angles (relativos al robot), ranges, maxRange }.
   */
  scan(numBeams) {
    const { gaussian, bernoulli, uniform } = PF.random;
    const { maxRange, sigma, pRandom } = this.truth;
    const angles = [];
    const ranges = [];
    for (let k = 0; k < numBeams; k++) {
      const a = (2 * Math.PI * k) / numBeams;
      const trueRange = this.map.raycast(this.pose.x, this.pose.y, this.pose.theta + a, maxRange);
      let r;
      if (bernoulli(pRandom)) r = uniform(0, maxRange);     // lectura espuria
      else if (trueRange >= maxRange) r = maxRange;         // nada al alcance: lectura máxima
      else r = trueRange + gaussian(sigma);                 // lectura normal con ruido
      angles.push(a);
      ranges.push(PF.math.clamp(r, 0, maxRange));
    }
    this.lastScan = { angles, ranges, maxRange };
    return this.lastScan;
  }

  /** Lo cogemos y lo dejamos en otro sitio sin que la odometría se entere */
  kidnap() {
    this.pose = this.randomClearPose();
    this.lastScan = null;
  }
};
