// Piloto automático: sigue los puntos de la ruta con órdenes de 10° o 25 cm como máximo.
// Se guía por la pose real; es el «conductor», no parte del SLAM.
import { DEG, wrapAngle } from './world.js';

const MAX_ROTATION = 10 * DEG;
const MAX_TRANSLATION = 0.25;
const ARRIVAL_RADIUS = 0.2;
const TURN_IN_PLACE_ABOVE = 12 * DEG;

const clamp = (value, limit) => Math.max(-limit, Math.min(limit, value));

export class RouteFollower {
  constructor(waypoints) {
    this.waypoints = waypoints;
    this.index = 0;  // siguiente punto de la ruta
  }

  get finished() {
    return this.index >= this.waypoints.length;
  }

  /** Siguiente orden u = { rotation, translation }, o null si la ruta ha terminado. */
  nextCommand(pose) {
    while (!this.finished) {
      const [wx, wy] = this.waypoints[this.index];
      const dx = wx - pose.x;
      const dy = wy - pose.y;
      const distance = Math.hypot(dx, dy);
      if (distance < ARRIVAL_RADIUS) {
        this.index++;
        continue;
      }
      const headingError = wrapAngle(Math.atan2(dy, dx) - pose.theta);
      if (Math.abs(headingError) > TURN_IN_PLACE_ABOVE) {
        return { rotation: clamp(headingError, MAX_ROTATION), translation: 0 };
      }
      return {
        rotation: clamp(headingError * 0.6, MAX_ROTATION),
        translation: Math.min(MAX_TRANSLATION, distance),
      };
    }
    return null;
  }
}
