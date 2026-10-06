/* ==========================================================================
 * corridor/world.js — El mundo 1D: un pasillo con puertas
 *
 * Es el ejemplo de Probabilistic Robotics (Thrun, Burgard, Fox). El mapa m
 * es simplemente la lista de puertas. Dos están cerca y la tercera lejos,
 * para que al ver dos puertas seguidas solo quede una explicación posible.
 *
 * El pasillo es circular: al salir por un extremo se entra por el otro.
 * Así no hay efectos raros en los bordes (las hipótesis que "se salen"
 * no se amontonan contra la pared del final).
 * ========================================================================== */
window.PF = window.PF || {};
PF.corridor = PF.corridor || {};

PF.corridor.createWorld = function () {
  return {
    length: 20, // metros
    doors: [
      { center: 3.0, width: 1.0 },
      { center: 6.0, width: 1.0 },
      { center: 14.5, width: 1.0 },
    ],

    /** ¿Hay una puerta en la posición x? */
    isDoor(x) {
      return this.doors.some((d) => Math.abs(x - d.center) <= d.width / 2);
    },
  };
};
