/**
 * render-world.js — Panel del mundo: mapa, robot, objetivo, rastro y las
 * curvaturas de todos los (v, ω) evaluados, coloreadas según su puntuación.
 * El origen (0, 0) está abajo a la izquierda; y crece hacia arriba.
 */

import { CanvasView } from './canvas-view.js';
import { colorValues, scaleColor } from './colors.js';
import { radToDeg } from './geometry.js';

export class WorldView extends CanvasView {
  constructor(canvas, grid) {
    super(canvas);
    this.grid = grid;
    this.mapCanvas = document.createElement('canvas'); // imagen del mapa (1 px = 1 celda)
    this.mapKey = ''; // versión del mapa + tema con que se generó la imagen
    this.scale = 1; // px por metro
    this.ox = 0;
    this.oy = 0;
  }

  /* ---------- Coordenadas ---------- */

  layout() {
    const { grid } = this;
    this.scale = Math.min(this.width / grid.width, this.height / grid.height);
    this.ox = (this.width - grid.width * this.scale) / 2;
    this.oy = (this.height - grid.height * this.scale) / 2;
  }

  toPx(x, y) {
    return [this.ox + x * this.scale, this.oy + (this.grid.height - y) * this.scale];
  }

  toWorld(px, py) {
    return { x: (px - this.ox) / this.scale, y: this.grid.height - (py - this.oy) / this.scale };
  }

  /** Candidato cuya curvatura pasa más cerca del punto (px, py), o null. */
  candidateNear(px, py, candidates, maxPx = 10) {
    let best = null;
    let bestD = maxPx;
    for (const c of candidates) {
      for (const pose of visiblePath(c)) {
        const [x, y] = this.toPx(pose.x, pose.y);
        const d = Math.hypot(x - px, y - py);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
    }
    return best;
  }

  /* ---------- Dibujo ---------- */

  draw(scene) {
    this.layout();
    this.clear(scene.theme.canvasBg);
    this.drawMap(scene.theme);
    this.drawMetricGrid(scene.theme);
    this.drawTrail(scene);
    if (scene.plan) this.drawCandidates(scene);
    this.drawGoal(scene);
    this.drawRobot(scene);
    if (scene.focus) this.drawHeadingGhost(scene);
    if (scene.brush) this.drawBrush(scene);
    this.drawScaleBar(scene.theme);
  }

  /** El mapa se rasteriza a una imagen pequeña y se escala sin suavizar. */
  drawMap(theme) {
    const { grid, mapCanvas } = this;
    const key = `${grid.version}|${theme.free}|${theme.obstacle}`;
    if (key !== this.mapKey) {
      mapCanvas.width = grid.cols;
      mapCanvas.height = grid.rows;
      const mctx = mapCanvas.getContext('2d');
      mctx.fillStyle = theme.free;
      mctx.fillRect(0, 0, grid.cols, grid.rows);
      mctx.fillStyle = theme.obstacle;
      for (let j = 0; j < grid.rows; j++) {
        for (let i = 0; i < grid.cols; i++) {
          if (grid.cells[grid.index(i, j)]) mctx.fillRect(i, grid.rows - 1 - j, 1, 1);
        }
      }
      this.mapKey = key;
    }
    const { ctx } = this;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(mapCanvas, this.ox, this.oy, grid.width * this.scale, grid.height * this.scale);
    ctx.restore();
  }

  /** Rejilla de 1 m. */
  drawMetricGrid(theme) {
    const { ctx, grid } = this;
    ctx.save();
    ctx.strokeStyle = theme.gridLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 1; x < grid.width; x++) {
      const [px] = this.toPx(x, 0);
      ctx.moveTo(Math.round(px) + 0.5, this.oy);
      ctx.lineTo(Math.round(px) + 0.5, this.oy + grid.height * this.scale);
    }
    for (let y = 1; y < grid.height; y++) {
      const [, py] = this.toPx(0, y);
      ctx.moveTo(this.ox, Math.round(py) + 0.5);
      ctx.lineTo(this.ox + grid.width * this.scale, Math.round(py) + 0.5);
    }
    ctx.stroke();
    ctx.restore();
  }

  drawTrail({ trail, theme }) {
    this.polyline(
      trail.map((p) => this.toPx(p.x, p.y)),
      { color: theme.trail, width: 2.5, dash: [1, 6] },
    );
  }

  /**
   * Curvaturas evaluadas: primero las no admisibles (discontinuas), luego las
   * admisibles de peor a mejor, para que las buenas queden encima.
   */
  drawCandidates({ plan, theme, colorBy, hover }) {
    const values = colorValues(plan.candidates, colorBy);
    const toPx = (p) => this.toPx(p.x, p.y);

    for (const c of plan.candidates) {
      if (c.admissible) continue;
      this.polyline(visiblePath(c).map(toPx), { color: theme.rejected, width: 1.2, dash: [4, 4] });
    }
    const admissible = plan.candidates.filter((c) => c.admissible);
    admissible.sort((a, b) => values.get(a) - values.get(b));
    for (const c of admissible) {
      this.polyline(visiblePath(c).map(toPx), { color: scaleColor(values.get(c), theme), width: 2 });
    }

    // Puntos de choque dentro del arco evaluado
    for (const c of plan.candidates) {
      if (c.collisionIndex < 0) continue;
      const [x, y] = toPx(c.path[c.collisionIndex]);
      this.cross(x, y, 3.5, theme.bad, 1.8);
    }

    // El elegido: halo ámbar con trazo oscuro encima
    if (plan.best) {
      const pts = visiblePath(plan.best).map(toPx);
      this.polyline(pts, { color: theme.best, width: 9, alpha: 0.85 });
      this.polyline(pts, { color: theme.ink, width: 2.5 });
    }
    if (hover && hover !== plan.best) {
      const pts = visiblePath(hover).map(toPx);
      this.polyline(pts, { color: theme.ink, width: 6, alpha: 0.25 });
      this.polyline(pts, { color: theme.ink, width: 2 });
    }
  }

  drawRobot({ robot, params, theme }) {
    const { ctx } = this;
    const [x, y] = this.toPx(robot.x, robot.y);
    const r = params.radius * this.scale;
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = theme.robot;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = theme.robot;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + r * Math.cos(robot.theta), y - r * Math.sin(robot.theta));
    ctx.stroke();
    ctx.restore();
  }

  drawGoal({ goal, params, theme }) {
    const { ctx } = this;
    const [x, y] = this.toPx(goal.x, goal.y);
    ctx.save();
    ctx.strokeStyle = theme.goal;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.arc(x, y, params.goalTolerance * this.scale, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.restore();
    this.star(x, y, 11, 4.5, theme.goal);
  }

  /**
   * Para el candidato enfocado: la pose en la que se mide el heading (robot
   * fantasma) y el ángulo entre su orientación y la dirección al objetivo.
   */
  drawHeadingGhost({ focus, goal, params, theme }) {
    const { ctx } = this;
    const pose = focus.headingPose;
    const [x, y] = this.toPx(pose.x, pose.y);
    const [gx, gy] = this.toPx(goal.x, goal.y);
    const r = params.radius * this.scale;
    ctx.save();
    ctx.strokeStyle = theme.ink;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(gx, gy);
    ctx.globalAlpha = 0.6;
    ctx.stroke();
    ctx.restore();

    // Orientación prevista
    const hx = x + 1.8 * r * Math.cos(pose.theta);
    const hy = y - 1.8 * r * Math.sin(pose.theta);
    this.polyline([[x, y], [hx, hy]], { color: theme.ink, width: 2.5 });
    this.text(`Δθ = ${radToDeg(focus.headingError).toFixed(0)}°`, x + r + 6, y - r - 4, {
      color: theme.ink,
      size: 12,
      weight: 600,
      font: 'var(--font-mono)',
    });
  }

  drawBrush({ brush, theme }) {
    const { ctx } = this;
    const [x, y] = this.toPx(brush.x, brush.y);
    ctx.save();
    ctx.strokeStyle = brush.erase ? theme.bad : theme.ink;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.arc(x, y, brush.r * this.scale, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.restore();
  }

  drawScaleBar(theme) {
    const [x0, y0] = this.toPx(0.3, 0.3);
    const x1 = x0 + this.scale;
    this.polyline([[x0, y0], [x1, y0]], { color: theme.ink, width: 3 });
    this.text('1 m', (x0 + x1) / 2, y0 - 7, { color: theme.ink, size: 11, align: 'center', weight: 600 });
  }
}

/** Tramo de la curvatura que se dibuja: hasta el choque, si lo hay. */
function visiblePath(candidate) {
  return candidate.collisionIndex < 0
    ? candidate.path
    : candidate.path.slice(0, candidate.collisionIndex + 1);
}
