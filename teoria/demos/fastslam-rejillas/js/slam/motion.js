// Movimiento del robot. Una orden u = { rotation, translation } significa:
// primero girar `rotation` radianes y luego avanzar `translation` metros.
import { castRay, wrapAngle } from './world.js';

// La rueda real gira un 5 % más de lo que dice la odometría: un error sistemático
// que hace que la estimación solo con odometría se desvíe al dar la vuelta.
export const ODOMETRY_BIAS = 0.05;

/**
 * Modelo de movimiento del filtro: muestrea x_t ~ p(x_t | u_t, x_{t-1}).
 * `noiseScale` multiplica todas las desviaciones típicas (control «Ruido del modelo»).
 */
export function sampleMotionModel(pose, u, noiseScale, rng) {
  const rotation = u.rotation + rng.gaussian() * noiseScale *
    (0.08 * Math.abs(u.rotation) + 0.04 * Math.abs(u.translation) + 0.004);
  const translation = u.translation + rng.gaussian() * noiseScale *
    (0.06 * Math.abs(u.translation) + 0.005);
  const theta = wrapAngle(pose.theta + rotation);
  return {
    x: pose.x + translation * Math.cos(theta),
    y: pose.y + translation * Math.sin(theta),
    theta,
  };
}

/** Movimiento real del robot: la orden con sesgo y ruido. No atraviesa paredes. */
export function moveRealRobot(pose, u, rng) {
  const rotation = u.rotation * (1 + ODOMETRY_BIAS) +
    rng.gaussian() * (0.03 * Math.abs(u.rotation) + 0.01 * Math.abs(u.translation));
  const translation = u.translation * (1 + rng.gaussian() * 0.03);
  const theta = wrapAngle(pose.theta + rotation);
  const moved = { x: pose.x, y: pose.y, theta };
  if (translation !== 0) {
    const heading = translation > 0 ? theta : theta + Math.PI;
    const clearance = castRay(pose.x, pose.y, heading);
    if (clearance > Math.abs(translation) + 0.15) {
      moved.x = pose.x + translation * Math.cos(theta);
      moved.y = pose.y + translation * Math.sin(theta);
    }
  }
  return moved;
}

/** Integración de la odometría sin ruido (la estimación «solo odometría»). */
export function integrateOdometry(pose, u) {
  const theta = wrapAngle(pose.theta + u.rotation);
  return {
    x: pose.x + u.translation * Math.cos(theta),
    y: pose.y + u.translation * Math.sin(theta),
    theta,
  };
}
