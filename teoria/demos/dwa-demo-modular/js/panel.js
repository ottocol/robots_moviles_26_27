/**
 * panel.js — Desglose de la puntuación del par (v, ω) enfocado: valor en bruto
 * de cada criterio, su valor normalizado, la contribución ponderada y G.
 */

import { CRITERIA, criterionWeights } from './dwa.js';
import { radToDeg } from './geometry.js';

const CRITERION_INFO = {
  heading: { name: 'heading', symbol: 'α', raw: (c) => `Δθ = ${radToDeg(c.headingError).toFixed(0)}°` },
  dist: { name: 'dist', symbol: 'β', raw: (c) => `${c.raw.dist.toFixed(2)} m libres` },
  vel: { name: 'vel', symbol: 'γ', raw: (c) => `${c.raw.vel.toFixed(2)} m/s` },
};

export class BreakdownPanel {
  constructor(root) {
    this.root = root;
    root.innerHTML = `
      <div class="bd-head">
        <span class="bd-title"></span>
        <span class="bd-vw mono"></span>
      </div>
      <div class="bd-rows">
        ${CRITERIA.map(
          (k) => `
          <div class="bd-row" data-criterion="${k}">
            <span class="bd-name">${CRITERION_INFO[k].name}</span>
            <span class="bd-raw mono"></span>
            <span class="bd-bar"><i></i></span>
            <span class="bd-contrib mono"></span>
          </div>`,
        ).join('')}
      </div>
      <div class="bd-total">
        <span class="bd-name">G</span>
        <span class="bd-stack">${CRITERIA.map((k) => `<i data-criterion="${k}"></i>`).join('')}</span>
        <span class="bd-g mono"></span>
      </div>
      <p class="bd-note"></p>`;
    this.el = {
      title: root.querySelector('.bd-title'),
      vw: root.querySelector('.bd-vw'),
      rows: Object.fromEntries(CRITERIA.map((k) => [k, root.querySelector(`.bd-row[data-criterion="${k}"]`)])),
      stack: Object.fromEntries(CRITERIA.map((k) => [k, root.querySelector(`.bd-stack i[data-criterion="${k}"]`)])),
      g: root.querySelector('.bd-g'),
      note: root.querySelector('.bd-note'),
    };
  }

  /**
   * @param candidate  el par a desglosar (o null)
   * @param role       'best' | 'hover'
   */
  update(candidate, params, role, isBest) {
    const { el } = this;
    this.root.classList.toggle('is-empty', !candidate);
    if (!candidate) {
      el.title.textContent = 'Sin par admisible';
      el.vw.textContent = '';
      el.note.textContent = 'Ningún (v, ω) de la ventana permite frenar a tiempo: el robot frena al máximo.';
      return;
    }

    el.title.textContent = role === 'hover' ? (isBest ? 'Par señalado (el elegido)' : 'Par señalado') : 'Par elegido';
    el.vw.textContent = `v = ${candidate.v.toFixed(2)} m/s · ω = ${candidate.w.toFixed(2)} rad/s`;

    const weights = criterionWeights(params);
    const weightSum = CRITERIA.reduce((s, k) => s + weights[k], 0) || 1;
    for (const k of CRITERIA) {
      const row = el.rows[k];
      const norm = candidate.norm[k];
      const contrib = weights[k] * norm;
      row.querySelector('.bd-raw').textContent = CRITERION_INFO[k].raw(candidate);
      row.querySelector('.bd-bar i').style.width = `${(norm * 100).toFixed(1)}%`;
      row.querySelector('.bd-contrib').textContent =
        `${CRITERION_INFO[k].symbol} ${weights[k].toFixed(2)} × ${norm.toFixed(2)} = ${contrib.toFixed(2)}`;
      el.stack[k].style.width = `${((contrib / weightSum) * 100).toFixed(1)}%`;
    }
    el.g.textContent = candidate.G.toFixed(3);
    el.note.textContent = noteFor(candidate, params);
  }
}

function noteFor(c, p) {
  const needed = c.v * p.dt + (c.v * c.v) / (2 * p.accV);
  if (!c.admissible) {
    return `No admisible: para frenar necesita ${needed.toFixed(2)} m y solo tiene ${c.raw.dist.toFixed(2)} m libres.`;
  }
  if (c.v < 1e-6 && Math.abs(c.w) > 1e-6) return 'Giro sobre sí mismo: no avanza, solo reorienta.';
  if (c.collisionIndex >= 0) {
    return `Su curvatura choca a ${c.raw.dist.toFixed(2)} m, pero puede frenar antes (necesita ${needed.toFixed(2)} m).`;
  }
  return `Sin obstáculos en los ${p.dMax.toFixed(1)} m de curvatura evaluados.`;
}
