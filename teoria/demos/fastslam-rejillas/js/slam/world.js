// El mundo simulado: una planta de 16 x 12 m con un bloque central, de modo que el
// pasillo da la vuelta completa y el robot puede cerrar un ciclo.
// Coordenadas en metros, con el eje y hacia arriba; los ángulos, en radianes.

export const DEG = Math.PI / 180;

/** Normaliza un ángulo a (-π, π]. */
export function wrapAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export const WORLD = { width: 16, height: 12 };

// Zona que cubre cada mapa de ocupación: el mundo más 1 m de margen por cada lado,
// para que una partícula desviada no se salga del mapa.
export const MAP_BOUNDS = { x0: -1, y0: -1, width: 18, height: 14 };

// Obstáculos como rectángulos [x0, y0, x1, y1]. El primero es el bloque central;
// el resto son armarios, columnas y entrantes que dan detalles al láser.
export const OBSTACLES = [
  [3, 3, 13, 9],
  // pasillo sur
  [5, 0, 6, 0.6], [9.5, 0, 11, 0.4], [12, 2.4, 12.4, 2.8],
  // pasillo este
  [15.4, 4, 16, 5.5], [13, 6.5, 13.5, 7],
  // pasillo norte
  [10, 11.4, 11, 12], [6, 11.5, 8, 12], [4, 9.1, 4.4, 9.5],
  // pasillo oeste
  [0, 4, 0.5, 5], [0, 7.5, 0.7, 8.2], [2.6, 5.5, 3, 6],
];

function rectangleSides([x0, y0, x1, y1]) {
  return [[x0, y0, x1, y0], [x1, y0, x1, y1], [x1, y1, x0, y1], [x0, y1, x0, y0]];
}

/** Todas las paredes como segmentos [xa, ya, xb, yb]: el contorno exterior y los obstáculos. */
export const WALLS = [
  ...rectangleSides([0, 0, WORLD.width, WORLD.height]),
  ...OBSTACLES.flatMap(rectangleSides),
];

export const START_POSE = Object.freeze({ x: 1.5, y: 1.5, theta: 0 });

// Una vuelta en sentido antihorario y unos metros más, para recorrer de nuevo
// la zona inicial después de cerrar el ciclo.
export const LOOP_ROUTE = [[14.5, 1.5], [14.5, 10.5], [1.5, 10.5], [1.5, 1.5], [9, 1.5]];

/**
 * Distancia desde (x, y) a la primera pared en la dirección `angle`
 * (Infinity si no hay ninguna).
 */
export function castRay(x, y, angle) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let nearest = Infinity;
  for (const [xa, ya, xb, yb] of WALLS) {
    // Resolver (x, y) + t·(dx, dy) = (xa, ya) + u·(ex, ey) con t > 0 y 0 ≤ u ≤ 1
    const ex = xb - xa;
    const ey = yb - ya;
    const den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-12) continue; // paralelos
    const qx = xa - x;
    const qy = ya - y;
    const t = (qx * ey - qy * ex) / den;
    const u = (qx * dy - qy * dx) / den;
    if (t > 1e-9 && u >= 0 && u <= 1 && t < nearest) nearest = t;
  }
  return nearest;
}
