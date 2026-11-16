/**
 * scenarios.js — Escenarios predefinidos. Cada uno dibuja sus obstáculos en el
 * mapa y devuelve la pose inicial del robot y el objetivo.
 * Coordenadas en metros; el mundo mide 12 × 8 m; θ en radianes.
 */

export const SCENARIOS = {
  puerta: {
    label: 'Puerta estrecha',
    build(grid) {
      grid.clear();
      grid.fillRect(5.9, 0, 6.1, 3.45); // pared con un hueco de 1 m
      grid.fillRect(5.9, 4.45, 6.1, 8);
      return { start: { x: 1.5, y: 2.0, theta: 0.3 }, goal: { x: 10.5, y: 6.0 } };
    },
  },

  pared: {
    label: 'Pared frontal',
    build(grid) {
      grid.clear();
      grid.fillRect(6.6, 2.2, 6.8, 5.8);
      return { start: { x: 1.5, y: 4.0, theta: 0 }, goal: { x: 10.5, y: 4.0 } };
    },
  },

  trampaU: {
    label: 'Trampa en U (mínimo local)',
    build(grid) {
      grid.clear();
      grid.fillRect(5.0, 5.4, 8.2, 5.6); // brazo superior
      grid.fillRect(5.0, 2.4, 8.2, 2.6); // brazo inferior
      grid.fillRect(8.0, 2.4, 8.2, 5.6); // fondo de la U
      return { start: { x: 1.5, y: 4.0, theta: 0 }, goal: { x: 10.5, y: 4.0 } };
    },
  },

  bosque: {
    label: 'Obstáculos dispersos',
    build(grid) {
      grid.clear();
      const discs = [
        [3.0, 2.2, 0.45], [4.2, 4.6, 0.5], [2.6, 6.2, 0.4], [6.0, 1.6, 0.5],
        [6.3, 3.9, 0.55], [5.6, 6.4, 0.45], [8.1, 2.8, 0.5], [8.4, 5.3, 0.5],
        [9.8, 1.4, 0.4], [10.0, 4.2, 0.45], [7.2, 7.1, 0.35],
      ];
      for (const [x, y, r] of discs) grid.paintDisc(x, y, r, true);
      return { start: { x: 1.0, y: 1.0, theta: 0.6 }, goal: { x: 11.0, y: 7.0 } };
    },
  },

  vacio: {
    label: 'Vacío (pinta tú)',
    build(grid) {
      grid.clear();
      return { start: { x: 1.5, y: 4.0, theta: 0 }, goal: { x: 10.5, y: 4.0 } };
    },
  },
};

export const DEFAULT_SCENARIO = 'puerta';
