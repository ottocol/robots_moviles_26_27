/**
 * render-velocity.js — Panel del espacio de velocidades (v, ω).
 *
 *   · Rectángulo completo = V_s, las velocidades posibles del robot.
 *   · Zona sombreada = no admisible (no daría tiempo a frenar).
 *   · Recuadro verde = ventana dinámica, lo alcanzable en el siguiente Δt.
 *   · Puntos = pares muestreados, coloreados según su puntuación.
 * Convención: ω > 0 (giro a la izquierda) a la izquierda del eje.
 */

import { CanvasView } from './canvas-view.js';
import { colorValues, scaleColor } from './colors.js';

const MARGIN = { left: 50, right: 16, top: 14, bottom: 46 };

export class VelocityView extends CanvasView {
  constructor(canvas) {
    super(canvas);
    this.params = null;
    this.plot = { x0: 0, y0: 0, x1: 0, y1: 0 };
  }

  /* ---------- Coordenadas ---------- */

  layout(params) {
    this.params = params;
    this.plot = {
      x0: MARGIN.left,
      y0: MARGIN.top,
      x1: this.width - MARGIN.right,
      y1: this.height - MARGIN.bottom,
    };
  }

  toPx(v, w) {
    const { x0, y0, x1, y1 } = this.plot;
    const { vMax, wMax } = this.params;
    return [x0 + ((wMax - w) / (2 * wMax)) * (x1 - x0), y1 - (v / vMax) * (y1 - y0)];
  }

  /** Muestra de la ventana más cercana al punto (px, py), o null. */
  candidateNear(px, py, candidates, maxPx = 14) {
    if (!this.params) return null;
    let best = null;
    let bestD = maxPx;
    for (const c of candidates) {
      const [x, y] = this.toPx(c.v, c.w);
      const d = Math.hypot(x - px, y - py);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  /* ---------- Dibujo ---------- */

  draw(scene) {
    this.layout(scene.params);
    this.clear(scene.theme.canvasBg);
    this.drawVs(scene);
    if (scene.region) this.drawInadmissibleRegion(scene);
    this.drawAxes(scene);
    if (scene.plan) {
      this.drawWindow(scene);
      this.drawSamples(scene);
    }
    this.drawCurrentVelocity(scene);
  }

  drawVs({ theme }) {
    const { ctx } = this;
    const { x0, y0, x1, y1 } = this.plot;
    ctx.save();
    ctx.fillStyle = theme.free;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.strokeStyle = theme.muted;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    ctx.restore();
  }

  drawInadmissibleRegion({ region, theme }) {
    const { ctx } = this;
    const { x0, y0, x1, y1 } = this.plot;
    const cw = (x1 - x0) / region.nW;
    const ch = (y1 - y0) / region.nV;
    ctx.save();
    ctx.fillStyle = theme.inadmissible;
    for (let a = 0; a < region.nV; a++) {
      for (let b = 0; b < region.nW; b++) {
        if (region.admissible[a * region.nW + b]) continue;
        // b crece con ω, y ω > 0 se dibuja a la izquierda
        const x = x1 - (b + 1) * cw;
        const y = y1 - (a + 1) * ch;
        ctx.fillRect(x - 0.3, y - 0.3, cw + 0.6, ch + 0.6);
      }
    }
    ctx.restore();
  }

  drawAxes({ params, theme }) {
    const { ctx } = this;
    const { x0, y0, x1, y1 } = this.plot;
    const label = { color: theme.muted, size: 11, font: 'var(--font-mono)' };

    // Eje ω = 0
    const [xZero] = this.toPx(0, 0);
    ctx.save();
    ctx.strokeStyle = theme.gridLine;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(xZero, y0);
    ctx.lineTo(xZero, y1);
    ctx.stroke();
    ctx.restore();

    // Marcas de v
    for (const v of [0, params.vMax / 2, params.vMax]) {
      const [, y] = this.toPx(v, 0);
      this.text(v.toFixed(1), x0 - 8, y, { ...label, align: 'right', baseline: 'middle' });
    }
    // Marcas de ω
    for (const w of [params.wMax, 0, -params.wMax]) {
      const [x] = this.toPx(0, w);
      const txt = w === 0 ? '0' : (w > 0 ? '+' : '−') + Math.abs(w).toFixed(1);
      this.text(txt, x, y1 + 16, { ...label, align: 'center' });
    }

    this.text('ω (rad/s)', (x0 + x1) / 2, y1 + 36, { color: theme.ink, size: 12, align: 'center', weight: 600 });
    this.text('← izquierda', x0, y1 + 36, { color: theme.muted, size: 11 });
    this.text('derecha →', x1, y1 + 36, { color: theme.muted, size: 11, align: 'right' });

    ctx.save();
    ctx.translate(14, (y0 + y1) / 2);
    ctx.rotate(-Math.PI / 2);
    this.text('v (m/s)', 0, 0, { color: theme.ink, size: 12, align: 'center', baseline: 'middle', weight: 600 });
    ctx.restore();
  }

  drawWindow({ plan, theme }) {
    const { ctx } = this;
    const { vLo, vHi, wLo, wHi } = plan.window;
    const [xa, ya] = this.toPx(vHi, wHi);
    const [xb, yb] = this.toPx(vLo, wLo);
    const pad = 7;
    ctx.save();
    ctx.strokeStyle = theme.window;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(xa - pad, ya - pad, xb - xa + 2 * pad, yb - ya + 2 * pad, 6);
    ctx.stroke();
    ctx.restore();
  }

  drawSamples({ plan, theme, colorBy, hover, params }) {
    const values = colorValues(plan.candidates, colorBy);
    // Radio de los puntos según la separación entre muestras
    const { vLo, vHi, wLo, wHi } = plan.window;
    const [xa, ya] = this.toPx(vHi, wHi);
    const [xb, yb] = this.toPx(vLo, wLo);
    const gapX = Math.abs(xb - xa) / Math.max(1, params.samplesW - 1);
    const gapY = Math.abs(yb - ya) / Math.max(1, params.samplesV - 1);
    const r = Math.max(2.5, Math.min(6, 0.38 * Math.min(gapX || 99, gapY || 99)));
    const { ctx } = this;

    for (const c of plan.candidates) {
      const [x, y] = this.toPx(c.v, c.w);
      if (!c.admissible) {
        this.cross(x, y, r * 0.7, theme.rejected, 1.5);
        continue;
      }
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fillStyle = scaleColor(values.get(c), theme);
      ctx.fill();
    }
    if (plan.best) {
      const [x, y] = this.toPx(plan.best.v, plan.best.w);
      this.star(x, y, r + 7, r + 1, theme.best, theme.ink);
    }
    if (hover) {
      const [x, y] = this.toPx(hover.v, hover.w);
      ctx.save();
      ctx.strokeStyle = theme.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, r + 5, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.restore();
    }
  }

  /** Velocidad actual del robot: el centro de la ventana. */
  drawCurrentVelocity({ robot, theme }) {
    const { ctx } = this;
    const [x, y] = this.toPx(robot.v, robot.w);
    ctx.save();
    ctx.strokeStyle = theme.robot;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 7, y);
    ctx.lineTo(x + 7, y);
    ctx.moveTo(x, y - 7);
    ctx.lineTo(x, y + 7);
    ctx.stroke();
    ctx.restore();
  }
}
