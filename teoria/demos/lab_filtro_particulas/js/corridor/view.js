/* ==========================================================================
 * corridor/view.js — Dibujo del pasillo en un canvas
 *
 * Tres bandas, de arriba abajo:
 *   1. El pasillo con sus puertas y el robot real con su sensor.
 *   2. Las partículas: tamaño proporcional al peso. Se separan en vertical
 *      solo para que se vean; la única coordenada que importa es x.
 *   3. La densidad: histograma de las partículas y, si se activa, la
 *      creencia exacta del filtro de Markov.
 * ========================================================================== */
window.PF = window.PF || {};
PF.corridor = PF.corridor || {};

PF.corridor.View = class {
  constructor(canvas, world) {
    this.canvas = canvas;
    this.world = world;
    this.height = 400;
  }

  /**
   * @param {object} s  { particles, robot, estimate, grid (o null), showEstimate }
   */
  draw(s) {
    const prepared = PF.ui.prepareCanvas(this.canvas, this.height);
    if (!prepared) return;
    const { ctx, width, height } = prepared;
    const c = PF.ui.colors();
    const L = this.world.length;

    const left = 46;
    const right = 18;
    const plotW = width - left - right;
    const X = (x) => left + (x / L) * plotW;

    ctx.clearRect(0, 0, width, height);
    ctx.font = `11px ${c.mono}`;
    ctx.textBaseline = 'middle';

    // ---------- 1. Pasillo ----------
    const wallTop = 16;
    const wallH = 30;
    const floorY = 108;

    ctx.fillStyle = c.wall;
    ctx.fillRect(X(0), wallTop, plotW, wallH);
    for (const d of this.world.doors) {
      const x0 = X(d.center - d.width / 2);
      const x1 = X(d.center + d.width / 2);
      ctx.fillStyle = c.door;
      ctx.fillRect(x0, wallTop, x1 - x0, wallH);
      ctx.fillStyle = c.surface;
      ctx.beginPath(); // pomo
      ctx.arc(x1 - 5, wallTop + wallH / 2, 2, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.strokeStyle = c.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(X(0), floorY);
    ctx.lineTo(X(L), floorY);
    ctx.stroke();

    // Robot real y haz del sensor
    const robotX = X(s.robot.x);
    const robotY = floorY - 22;
    if (s.robot.lastReading !== null) {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = s.robot.lastReading ? c.door : c.muted;
      ctx.beginPath();
      ctx.moveTo(robotX, robotY - 9);
      ctx.lineTo(robotX - 9, wallTop + wallH);
      ctx.lineTo(robotX + 9, wallTop + wallH);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = c.ink;
    ctx.fillRect(robotX - 10, robotY + 9, 6, 6); // ruedas
    ctx.fillRect(robotX + 4, robotY + 9, 6, 6);
    ctx.fillStyle = c.robot;
    ctx.beginPath();
    ctx.arc(robotX, robotY, 10, 0, 2 * Math.PI);
    ctx.fill();

    if (s.robot.lastReading !== null) {
      const label = s.robot.lastReading ? 'z = puerta' : 'z = pared';
      ctx.fillStyle = c.ink;
      ctx.textAlign = robotX > width - 110 ? 'right' : 'left';
      ctx.fillText(label, robotX + (ctx.textAlign === 'left' ? 16 : -16), robotY);
    }

    // ---------- 2. Partículas ----------
    const pTop = 126;
    const pH = 72;
    const M = s.particles.length;
    this.bandLabel(ctx, c, 'partículas', left, pTop + pH / 2);

    ctx.fillStyle = c.particle;
    ctx.globalAlpha = 0.7;
    s.particles.forEach((p, i) => {
      const y = pTop + 6 + PF.corridor.View.jitter(i) * (pH - 12);
      const r = PF.math.clamp(2.2 * Math.sqrt(p.w * M), 1.2, 8);
      ctx.beginPath();
      ctx.arc(X(p.state.x), y, r, 0, 2 * Math.PI);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    if (s.showEstimate) {
      const ex = X(s.estimate.x);
      ctx.strokeStyle = c.estimate;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(ex, pTop - 4);
      ctx.lineTo(ex, pTop + pH + 4);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // ---------- 3. Densidad ----------
    const cTop = 222;
    const cBottom = height - 30;
    const cH = cBottom - cTop;
    this.bandLabel(ctx, c, 'bel(x)', left, cTop + cH / 2);

    // Puertas sombreadas también en la gráfica, como referencia
    ctx.fillStyle = c.door;
    ctx.globalAlpha = 0.12;
    for (const d of this.world.doors) {
      ctx.fillRect(X(d.center - d.width / 2), cTop, X(d.width) - X(0), cH);
    }
    ctx.globalAlpha = 1;

    // Histograma de las partículas (densidad = peso / anchura del bin)
    const bins = 50;
    const binW = L / bins;
    const hist = new Float64Array(bins);
    for (const p of s.particles) {
      const b = Math.min(bins - 1, Math.floor(p.state.x / binW));
      hist[b] += p.w / binW;
    }

    let yMax = Math.max(...hist);
    if (s.grid) {
      for (const v of s.grid.p) yMax = Math.max(yMax, v / s.grid.dx);
    }
    yMax = yMax * 1.1 || 1;
    const Y = (v) => cBottom - (v / yMax) * cH;

    ctx.fillStyle = c.particle;
    ctx.globalAlpha = 0.5;
    const barW = Math.max(1, X(binW) - X(0) - 1);
    for (let b = 0; b < bins; b++) {
      if (hist[b] > 0) ctx.fillRect(X(b * binW) + 0.5, Y(hist[b]), barW, cBottom - Y(hist[b]));
    }
    ctx.globalAlpha = 1;

    if (s.grid) {
      const g = s.grid;
      ctx.beginPath();
      ctx.moveTo(X(0), cBottom);
      for (let i = 0; i < g.n; i++) ctx.lineTo(X(g.center(i)), Y(g.p[i] / g.dx));
      ctx.lineTo(X(L), cBottom);
      ctx.closePath();
      ctx.fillStyle = c.belief;
      ctx.globalAlpha = 0.12;
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.beginPath();
      for (let i = 0; i < g.n; i++) {
        const px = X(g.center(i));
        const py = Y(g.p[i] / g.dx);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = c.belief;
      ctx.lineWidth = 1.75;
      ctx.stroke();
    }

    // Eje x en metros
    ctx.strokeStyle = c.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(X(0), cBottom);
    ctx.lineTo(X(L), cBottom);
    ctx.stroke();
    ctx.fillStyle = c.muted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const tickStep = plotW < 420 ? 5 : 2;
    for (let x = 0; x <= L; x += tickStep) {
      ctx.beginPath();
      ctx.moveTo(X(x), cBottom);
      ctx.lineTo(X(x), cBottom + 4);
      ctx.stroke();
      ctx.fillText(`${x} m`, X(x), cBottom + 7);
    }
  }

  /** Altura pseudoaleatoria pero fija para cada índice de partícula (solo visual) */
  static jitter(i) {
    return (Math.imul(i + 1, 2654435761) >>> 0) / 4294967296;
  }

  bandLabel(ctx, c, text, left, y) {
    ctx.save();
    ctx.translate(left - 14, y);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = c.muted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }
};
