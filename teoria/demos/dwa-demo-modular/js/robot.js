/**
 * robot.js — Modelo cinemático de un robot diferencial (uniciclo).
 *
 * Con (v, ω) constantes el robot describe un arco de circunferencia de radio
 * v/ω (una recta si ω = 0). Se integra de forma exacta, sin error acumulado.
 */

/** Pose tras moverse durante t segundos con (v, ω) constantes. */
export function integratePose(pose, v, w, t) {
  const { x, y, theta } = pose;
  if (Math.abs(w) < 1e-6) {
    return { x: x + v * t * Math.cos(theta), y: y + v * t * Math.sin(theta), theta };
  }
  const r = v / w;
  const theta2 = theta + w * t;
  return {
    x: x + r * (Math.sin(theta2) - Math.sin(theta)),
    y: y - r * (Math.cos(theta2) - Math.cos(theta)),
    theta: theta2,
  };
}

/**
 * Curvatura de (v, ω): el trozo de circunferencia de radio v/ω que seguiría
 * el robot, muestreado cada `ds` metros hasta una longitud `length`.
 * Solo depende de la forma del arco (ω/v), no del tiempo: así se mide la
 * distancia libre "a lo largo de la curvatura", como en el paper.
 *   · v = 0, ω = 0 → la recta hacia donde mira el robot (límite v → 0⁺).
 *   · v = 0, ω ≠ 0 → giro sobre sí mismo: un solo punto.
 * Cada pose lleva su recorrido s (m).
 */
export function curvatureArc(pose, v, w, length, ds) {
  const start = { x: pose.x, y: pose.y, theta: pose.theta, s: 0 };
  if (v <= 1e-9 && Math.abs(w) > 1e-9) return [start];

  const kappa = v <= 1e-9 ? 0 : w / v; // curvatura (1/m)
  const poses = [start];
  const n = Math.round(length / ds);
  for (let k = 1; k <= n; k++) {
    const s = k * ds;
    // Recorrer s metros con curvatura κ equivale a integrar con v = 1, ω = κ durante s
    const p = integratePose(pose, 1, kappa, s);
    poses.push({ ...p, s });
  }
  return poses;
}

/** Aplica el comando (v, ω) durante dt y devuelve el nuevo estado del robot. */
export function advanceRobot(robot, command, dt) {
  const pose = integratePose(robot, command.v, command.w, dt);
  return { ...pose, v: command.v, w: command.w };
}
