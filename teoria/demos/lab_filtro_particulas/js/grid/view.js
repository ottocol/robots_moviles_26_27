/* ==========================================================================
 * grid/view.js — Dibujo del mapa 2D en un canvas
 *
 * Partículas: flechitas rojas (posición y orientación). Su opacidad es
 * proporcional al peso, así que tras la ponderación las improbables se
 * desvanecen, como en las transparencias.
 * Robot real: disco azul. Estimación: anillo ámbar. Odometría pura: círculo
 * discontinuo gris.
 * ========================================================================== */
window.PF = window.PF || {};
PF.grid = PF.grid || {};

PF.grid.View = class {
  constructor(canvas) {
    this.canvas = canvas;
  }

  /**
   * @param {object} s  { map, particles, robot, estimate, showEstimate,
   *                      showBeams, showOdometry }
   */
  draw(s) {
    const map = s.map;
    const width = this.canvas.clientWidth;
    if (width === 0) return;
    const scale = width / map.width;              // píxeles por metro
    const height = Math.round(map.height * scale);
    const prepared = PF.ui.prepareCanvas(this.canvas, height);
    if (!prepared) return;
    const { ctx } = prepared;
    const c = PF.ui.colors();

    // Mundo (m, y hacia arriba) → pantalla (px, y hacia abajo)
    const P = (x, y) => [x * scale, height - y * scale];

    // ---------- Mapa ----------
    ctx.fillStyle = c.floor;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = c.wall;
    const cs = map.cellSize * scale;
    for (let r = 0; r < map.rows; r++) {
      for (let col = 0; col < map.cols; col++) {
        if (map.occupied[r][col]) {
          ctx.fillRect(Math.floor(col * cs), Math.floor(r * cs), Math.ceil(cs) + 1, Math.ceil(cs) + 1);
        }
      }
    }

    // ---------- Partículas ----------
    let wMax = 0;
    for (const p of s.particles) wMax = Math.max(wMax, p.w);
    const arrowLen = Math.max(7, 0.16 * scale);
    ctx.strokeStyle = c.particle;
    ctx.lineWidth = 1.2;
    for (const p of s.particles) {
      const { x, y, theta } = p.state;
      ctx.globalAlpha = 0.12 + 0.88 * (p.w / wMax);
      const [px, py] = P(x, y);
      const tx = px + arrowLen * Math.cos(theta);
      const ty = py - arrowLen * Math.sin(theta);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(tx, ty);
      // punta de flecha
      const head = arrowLen * 0.4;
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx - head * Math.cos(theta - 0.5), ty + head * Math.sin(theta - 0.5));
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx - head * Math.cos(theta + 0.5), ty + head * Math.sin(theta + 0.5));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    const robot = s.robot;
    const rPx = Math.max(6, robot.radius * scale);

    // ---------- Haces del láser real ----------
    if (s.showBeams && robot.lastScan) {
      const z = robot.lastScan;
      const [rx, ry] = P(robot.pose.x, robot.pose.y);
      ctx.strokeStyle = c.robot;
      ctx.fillStyle = c.robot;
      ctx.lineWidth = 1;
      for (let k = 0; k < z.ranges.length; k++) {
        const a = robot.pose.theta + z.angles[k];
        const [ex, ey] = P(robot.pose.x + z.ranges[k] * Math.cos(a), robot.pose.y + z.ranges[k] * Math.sin(a));
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        if (z.ranges[k] < z.maxRange) {
          ctx.globalAlpha = 0.9;
          ctx.beginPath();
          ctx.arc(ex, ey, 2.2, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }

    // ---------- Odometría pura (dead reckoning) ----------
    if (s.showOdometry) {
      const [ox, oy] = P(robot.odomPose.x, robot.odomPose.y);
      ctx.strokeStyle = c.muted;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(ox, oy, rPx, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + rPx * 1.4 * Math.cos(robot.odomPose.theta), oy - rPx * 1.4 * Math.sin(robot.odomPose.theta));
      ctx.stroke();
    }

    // ---------- Robot real ----------
    const [rx, ry] = P(robot.pose.x, robot.pose.y);
    ctx.fillStyle = c.robot;
    ctx.beginPath();
    ctx.arc(rx, ry, rPx, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = c.surface;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(rx + rPx * Math.cos(robot.pose.theta), ry - rPx * Math.sin(robot.pose.theta));
    ctx.stroke();

    // ---------- Estimación del filtro ----------
    if (s.showEstimate) {
      const e = s.estimate;
      const [ex, ey] = P(e.x, e.y);
      ctx.strokeStyle = c.estimate;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(ex, ey, rPx + 4, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex + (rPx + 12) * Math.cos(e.theta), ey - (rPx + 12) * Math.sin(e.theta));
      ctx.stroke();
    }
  }
};
