/* ==========================================================================
 * grid/grid-map.js — Rejilla de ocupación y trazado de rayos
 *
 * Coordenadas del mundo en metros, con el convenio habitual en robótica:
 * x hacia la derecha, y hacia arriba, θ en radianes en sentido antihorario
 * desde el eje x.
 * ========================================================================== */
window.PF = window.PF || {};
PF.grid = PF.grid || {};

PF.grid.GridMap = class {
  constructor(def) {
    this.def = def;
    this.cellSize = def.cellSize;
    this.rows = def.rows.length;
    this.cols = def.rows[0].length;
    this.width = this.cols * this.cellSize;
    this.height = this.rows * this.cellSize;

    // occupied[r][c] con r = 0 en la fila de ARRIBA del dibujo de texto
    this.occupied = def.rows.map((row) => [...row].map((ch) => ch === '#'));

    this.freeCells = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (!this.occupied[r][c]) this.freeCells.push({ r, c });
      }
    }

    this.distanceField = null; // se calcula la primera vez que se necesita
  }

  /** Celda (fila, columna) que contiene el punto (x, y) */
  cellAt(x, y) {
    return {
      r: this.rows - 1 - Math.floor(y / this.cellSize),
      c: Math.floor(x / this.cellSize),
    };
  }

  /** Fuera del mapa cuenta como ocupado */
  isOccupied(x, y) {
    const { r, c } = this.cellAt(x, y);
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return true;
    return this.occupied[r][c];
  }

  /** Pose aleatoria en una celda libre, con orientación aleatoria */
  randomFreePose() {
    const { uniform } = PF.random;
    const cell = this.freeCells[Math.floor(Math.random() * this.freeCells.length)];
    return {
      x: (cell.c + Math.random()) * this.cellSize,
      y: (this.rows - 1 - cell.r + Math.random()) * this.cellSize,
      theta: uniform(-Math.PI, Math.PI),
    };
  }

  /**
   * Distancia desde (x, y) hasta el primer obstáculo en la dirección angle.
   * Avanza a pasitos de cellSize/5 hasta pisar una celda ocupada. No es el
   * método más rápido (el algoritmo DDA lo es), pero es el más fácil de leer.
   */
  raycast(x, y, angle, maxRange) {
    const step = this.cellSize / 5;
    const dx = Math.cos(angle) * step;
    const dy = Math.sin(angle) * step;
    let px = x;
    let py = y;
    for (let d = step; d < maxRange; d += step) {
      px += dx;
      py += dy;
      if (this.isOccupied(px, py)) return d;
    }
    return maxRange;
  }

  /**
   * Distancia (m) desde (x, y) al obstáculo más cercano. Es lo que usa el
   * modelo "likelihood field". Se precalcula una vez para cada celda.
   */
  distanceToObstacle(x, y) {
    if (!this.distanceField) this.computeDistanceField();
    const { r, c } = this.cellAt(x, y);
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return PF.grid.GridMap.MAX_FIELD_DISTANCE;
    return this.distanceField[r][c];
  }

  /** Fuerza bruta: para cada celda, la distancia a la celda ocupada más próxima */
  computeDistanceField() {
    const occupiedCells = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.occupied[r][c]) occupiedCells.push({ r, c });
      }
    }
    const max = PF.grid.GridMap.MAX_FIELD_DISTANCE;
    this.distanceField = [];
    for (let r = 0; r < this.rows; r++) {
      const row = [];
      for (let c = 0; c < this.cols; c++) {
        if (this.occupied[r][c]) {
          row.push(0);
          continue;
        }
        let best = Infinity;
        for (const o of occupiedCells) {
          const d2 = (o.r - r) ** 2 + (o.c - c) ** 2;
          if (d2 < best) best = d2;
        }
        // distancia entre centros menos media celda ≈ distancia al borde del obstáculo
        row.push(Math.min(max, Math.max(0, (Math.sqrt(best) - 0.5) * this.cellSize)));
      }
      this.distanceField.push(row);
    }
  }
};

PF.grid.GridMap.MAX_FIELD_DISTANCE = 2.0; // metros
