/**
 * world.js — Mapa de ocupación con campo de distancias.
 *
 * El mapa es una rejilla de celdas libres (0) u ocupadas (1). Para saber rápido
 * a qué distancia está el obstáculo más cercano desde cualquier punto, se
 * calcula una transformada de distancia euclídea exacta (Felzenszwalb y
 * Huttenlocher, 2012) cada vez que el mapa cambia.
 */

const EDT_BIG = 1e10; // "infinito" finito, para no generar NaN en la transformada

export class OccupancyGrid {
  constructor({ width, height, cell }) {
    this.width = width; // m
    this.height = height; // m
    this.cell = cell; // m
    this.cols = Math.round(width / cell);
    this.rows = Math.round(height / cell);
    this.cells = new Uint8Array(this.cols * this.rows); // 1 = ocupada
    this.distance = new Float32Array(this.cols * this.rows); // m al obstáculo más cercano
    this.version = 0; // aumenta con cada edición (lo usan las cachés de dibujo)
    this.distanceDirty = true;
  }

  index(i, j) {
    return j * this.cols + i;
  }

  inside(i, j) {
    return i >= 0 && j >= 0 && i < this.cols && j < this.rows;
  }

  isOccupied(i, j) {
    return !this.inside(i, j) || this.cells[this.index(i, j)] === 1;
  }

  /** Marca el mapa como modificado. */
  touch() {
    this.version++;
    this.distanceDirty = true;
  }

  clear() {
    this.cells.fill(0);
    this.touch();
  }

  /** Pinta (occupied = true) o borra un disco de radio r (m) centrado en (x, y). */
  paintDisc(x, y, r, occupied) {
    const value = occupied ? 1 : 0;
    const ci = Math.floor(x / this.cell);
    const cj = Math.floor(y / this.cell);
    const rc = Math.ceil(r / this.cell);
    let changed = false;
    for (let j = cj - rc; j <= cj + rc; j++) {
      for (let i = ci - rc; i <= ci + rc; i++) {
        if (!this.inside(i, j)) continue;
        const cx = (i + 0.5) * this.cell;
        const cy = (j + 0.5) * this.cell;
        if (Math.hypot(cx - x, cy - y) > r) continue;
        const k = this.index(i, j);
        if (this.cells[k] !== value) {
          this.cells[k] = value;
          changed = true;
        }
      }
    }
    if (changed) this.touch();
  }

  /** Rellena un rectángulo [x0, x1] × [y0, y1] (m). */
  fillRect(x0, y0, x1, y1) {
    const i0 = Math.max(0, Math.floor(x0 / this.cell));
    const i1 = Math.min(this.cols - 1, Math.ceil(x1 / this.cell) - 1);
    const j0 = Math.max(0, Math.floor(y0 / this.cell));
    const j1 = Math.min(this.rows - 1, Math.ceil(y1 / this.cell) - 1);
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) this.cells[this.index(i, j)] = 1;
    }
    this.touch();
  }

  /**
   * Distancia libre (m) desde (x, y) al obstáculo o al borde del mapa más
   * cercano. Fuera del mapa devuelve 0.
   */
  clearanceAt(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return 0;
    if (this.distanceDirty) this.computeDistanceField();
    const i = Math.floor(x / this.cell);
    const j = Math.floor(y / this.cell);
    const toBorder = Math.min(x, y, this.width - x, this.height - y);
    return Math.min(this.distance[this.index(i, j)], toBorder);
  }

  /** Transformada de distancia euclídea exacta: primero columnas, luego filas. */
  computeDistanceField() {
    const { cols, rows, cells } = this;
    const n = Math.max(cols, rows);
    const f = new Float64Array(n);
    const out = new Float64Array(n);
    const v = new Int32Array(n);
    const z = new Float64Array(n + 1);
    const d2 = new Float64Array(cols * rows); // distancias al cuadrado, en celdas²

    for (let k = 0; k < cells.length; k++) d2[k] = cells[k] ? 0 : EDT_BIG;

    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) f[j] = d2[this.index(i, j)];
      edt1d(f, rows, out, v, z);
      for (let j = 0; j < rows; j++) d2[this.index(i, j)] = out[j];
    }
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) f[i] = d2[this.index(i, j)];
      edt1d(f, cols, out, v, z);
      for (let i = 0; i < cols; i++) d2[this.index(i, j)] = out[i];
    }

    // De centro de celda a centro de celda ocupada, menos media celda (borde del obstáculo)
    for (let k = 0; k < d2.length; k++) {
      this.distance[k] = Math.max(0, Math.sqrt(d2[k]) * this.cell - this.cell / 2);
    }
    this.distanceDirty = false;
  }
}

/** Transformada de distancia 1D (envolvente inferior de parábolas). */
function edt1d(f, n, out, v, z) {
  let k = 0;
  v[0] = 0;
  z[0] = -Infinity;
  z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    out[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}
