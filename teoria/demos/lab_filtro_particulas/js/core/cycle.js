/* ==========================================================================
 * cycle.js — Orquesta las tres fases del filtro
 *
 * Modo "ciclo completo": cada movimiento ejecuta predicción, ponderación
 * y remuestreo seguidos.
 * Modo "paso a paso": el movimiento solo predice; la ponderación y el
 * remuestreo se lanzan con sus botones, para verlos por separado.
 *
 * Estados:  'ready' (esperando un movimiento) → 'predicted' → 'weighted' → 'ready'
 * ========================================================================== */
window.PF = window.PF || {};

PF.Cycle = class {
  /**
   * @param {object} phases  { predict(u), weight(), resample() }.
   *                         predict puede devolver false si el robot no
   *                         se ha podido mover (por ejemplo, choca).
   * @param {function} onChange  se llama tras cada cambio para redibujar.
   */
  constructor(phases, onChange) {
    this.phases = phases;
    this.onChange = onChange;
    this.stepMode = false;
    this.phase = 'ready';
    this.completedCycles = 0;
  }

  /** Intenta mover el robot. Devuelve false si no toca (o si choca). */
  move(u) {
    if (this.stepMode && this.phase !== 'ready') return false;
    if (this.phases.predict(u) === false) return false;
    this.phase = 'predicted';
    if (this.stepMode) {
      this.onChange();
    } else {
      this.weight();
      this.resample();
    }
    return true;
  }

  weight() {
    if (this.phase !== 'predicted') return;
    this.phases.weight();
    this.phase = 'weighted';
    if (this.stepMode) this.onChange();
  }

  resample() {
    if (this.phase !== 'weighted') return;
    this.phases.resample();
    this.phase = 'ready';
    this.completedCycles++;
    this.onChange();
  }

  /** Al volver a ciclo completo se termina el ciclo que estuviera a medias */
  setStepMode(on) {
    this.stepMode = on;
    if (!on) {
      if (this.phase === 'predicted') this.weight();
      if (this.phase === 'weighted') this.resample();
    }
    this.onChange();
  }

  reset() {
    this.phase = 'ready';
    this.completedCycles = 0;
    this.onChange();
  }
};
