/* ==========================================================================
 * controls.js — Pequeños ayudantes de interfaz
 *
 * Enlazan los controles HTML con funciones JavaScript, leen los colores
 * del tema y preparan los canvas. Nada de esto tiene que ver con el filtro.
 * ========================================================================== */
window.PF = window.PF || {};

PF.ui = {
  /**
   * Enlaza un <input type="range"> con su <output for="id">.
   * Llama a onInput(valor) al moverlo y una vez al principio.
   */
  range(id, onInput, format = (v) => String(v)) {
    const input = document.getElementById(id);
    const output = document.querySelector(`output[for="${id}"]`);
    const update = () => {
      const v = parseFloat(input.value);
      if (output) output.textContent = format(v);
      onInput(v);
    };
    input.addEventListener('input', update);
    update();
    return input;
  },

  checkbox(id, onChange) {
    const input = document.getElementById(id);
    const update = () => onChange(input.checked);
    input.addEventListener('change', update);
    update();
    return input;
  },

  select(id, onChange) {
    const input = document.getElementById(id);
    const update = () => onChange(input.value);
    input.addEventListener('change', update);
    update();
    return input;
  },

  /** Grupo de radios con el mismo name */
  radios(name, onChange) {
    const inputs = document.querySelectorAll(`input[name="${name}"]`);
    const update = () => {
      const checked = [...inputs].find((i) => i.checked);
      if (checked) onChange(checked.value);
    };
    inputs.forEach((i) => i.addEventListener('change', update));
    update();
  },

  button(id, onClick) {
    const b = document.getElementById(id);
    b.addEventListener('click', onClick);
    return b;
  },

  /**
   * Marca en la barra de fases cuál fue la última fase ejecutada y cuál
   * viene después, a partir del estado del PF.Cycle.
   */
  showPhase(listId, cycle) {
    const done = { ready: cycle.completedCycles > 0 ? 'resample' : null, predicted: 'predict', weighted: 'weight' }[cycle.phase];
    const next = { ready: 'predict', predicted: 'weight', weighted: 'resample' }[cycle.phase];
    document.querySelectorAll(`#${listId} [data-phase]`).forEach((li) => {
      li.classList.toggle('is-done', li.dataset.phase === done);
      li.classList.toggle('is-next', cycle.stepMode && li.dataset.phase === next);
    });
  },

  /** Colores del tema (definidos en css/styles.css) para dibujar en el canvas */
  colors() {
    const cs = getComputedStyle(document.documentElement);
    const get = (name) => cs.getPropertyValue(`--${name}`).trim();
    return {
      surface: get('surface'),
      ink: get('ink'),
      muted: get('muted'),
      line: get('line'),
      wall: get('wall'),
      floor: get('floor'),
      door: get('door'),
      particle: get('particle'),
      robot: get('robot'),
      estimate: get('estimate'),
      belief: get('belief'),
      mono: get('font-mono'),
    };
  },

  /**
   * Ajusta la resolución interna del canvas al tamaño en pantalla y a la
   * densidad de píxeles. Devuelve { ctx, width, height } en píxeles CSS,
   * o null si el canvas está oculto.
   */
  prepareCanvas(canvas, cssHeight) {
    const width = canvas.clientWidth;
    if (width === 0) return null;
    const dpr = window.devicePixelRatio || 1;
    canvas.style.height = `${cssHeight}px`;
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(cssHeight * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(cssHeight * dpr);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, width, height: cssHeight };
  },

  /** Número con formato español y n decimales */
  fmt(v, n = 2) {
    return v.toLocaleString('es-ES', { minimumFractionDigits: n, maximumFractionDigits: n });
  },
};
