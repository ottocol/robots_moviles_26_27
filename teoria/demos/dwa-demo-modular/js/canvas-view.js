/**
 * canvas-view.js — Base común de los dos paneles dibujados en canvas:
 * ajusta la resolución a la pantalla (HiDPI) y ofrece utilidades de dibujo.
 */

export class CanvasView {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = 0; // px CSS
    this.height = 0; // px CSS
  }

  /** Ajusta el tamaño interno del canvas al tamaño con que se muestra. */
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  clear(color) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  /** Polilínea a partir de puntos [x, y] en píxeles. */
  polyline(points, { color, width = 2, dash = [], alpha = 1 }) {
    if (points.length < 2) return;
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let k = 1; k < points.length; k++) ctx.lineTo(points[k][0], points[k][1]);
    ctx.stroke();
    ctx.restore();
  }

  cross(x, y, size, color, width = 2) {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - size, y - size);
    ctx.lineTo(x + size, y + size);
    ctx.moveTo(x - size, y + size);
    ctx.lineTo(x + size, y - size);
    ctx.stroke();
    ctx.restore();
  }

  star(x, y, outer, inner, fill, stroke) {
    const { ctx } = this;
    ctx.save();
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const r = k % 2 === 0 ? outer : inner;
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      const px = x + r * Math.cos(a);
      const py = y + r * Math.sin(a);
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();
  }

  text(str, x, y, { color, size = 12, align = 'left', baseline = 'alphabetic', weight = 500, font = 'var(--font-ui)' }) {
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px ${resolveFontFamily(font)}`;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.fillText(str, x, y);
    ctx.restore();
  }
}

/** El canvas no entiende var(--…): se resuelve la familia tipográfica desde CSS. */
const fontCache = new Map();
function resolveFontFamily(font) {
  if (!font.startsWith('var(')) return font;
  if (!fontCache.has(font)) {
    const name = font.slice(4, -1).trim();
    const family = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    fontCache.set(font, family || 'sans-serif');
  }
  return fontCache.get(font);
}
