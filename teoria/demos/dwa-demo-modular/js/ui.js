/**
 * ui.js — Construcción y enlace de los controles HTML. No contiene lógica del
 * algoritmo: solo traduce acciones del usuario en llamadas a funciones de main.
 */

/**
 * Crea un deslizador por parámetro a partir de PARAM_SPECS.
 * Devuelve sync(), que vuelve a leer `params` y actualiza los controles.
 */
export function buildParamControls(container, specs, params, onChange) {
  const inputs = [];
  for (const group of specs) {
    const fieldset = document.createElement('fieldset');
    fieldset.innerHTML = `<legend>${group.group}</legend>`;
    for (const spec of group.items) {
      const id = `param-${spec.key}`;
      const row = document.createElement('div');
      row.className = 'param';
      row.innerHTML = `
        <label for="${id}">${spec.label}</label>
        <output for="${id}" class="mono"></output>
        <input type="range" id="${id}" min="${spec.min}" max="${spec.max}" step="${spec.step}">`;
      const input = row.querySelector('input');
      const output = row.querySelector('output');
      const show = () => {
        const decimals = spec.step >= 1 ? 0 : spec.step >= 0.1 ? 1 : 2;
        output.textContent = `${Number(params[spec.key]).toFixed(decimals)}${spec.unit ? ' ' + spec.unit : ''}`;
      };
      input.addEventListener('input', () => {
        params[spec.key] = Number(input.value);
        show();
        onChange(spec.key);
      });
      inputs.push({ input, spec, show });
      fieldset.appendChild(row);
    }
    container.appendChild(fieldset);
  }
  const sync = () => {
    for (const { input, spec, show } of inputs) {
      input.value = params[spec.key];
      show();
    }
  };
  sync();
  return sync;
}

/** Grupo de botones excluyentes (data-value). Llama a onChange con el valor. */
export function bindToggleGroup(container, onChange) {
  const buttons = [...container.querySelectorAll('button[data-value]')];
  const select = (value) => {
    for (const b of buttons) b.setAttribute('aria-pressed', String(b.dataset.value === value));
    onChange(value);
  };
  for (const b of buttons) b.addEventListener('click', () => select(b.dataset.value));
  return select;
}

/**
 * Ratón / dedo sobre un canvas. Los manejadores reciben la posición en px
 * relativa al canvas.
 *   onDown(px, py), onDrag(px, py), onUp(), onHover(px, py), onLeave()
 */
export function bindPointer(canvas, handlers) {
  let dragging = false;
  const local = (e) => {
    const rect = canvas.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  };
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    canvas.setPointerCapture(e.pointerId);
    handlers.onDown?.(...local(e));
  });
  canvas.addEventListener('pointermove', (e) => {
    if (dragging) handlers.onDrag?.(...local(e));
    else handlers.onHover?.(...local(e));
  });
  const end = (e) => {
    if (!dragging) return;
    dragging = false;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    handlers.onUp?.();
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointerleave', () => {
    if (!dragging) handlers.onLeave?.();
  });
}

/** Atajos de teclado, ignorados mientras se escribe en un control. */
export function bindKeys(map) {
  window.addEventListener('keydown', (e) => {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    const action = map[e.key];
    if (action) {
      e.preventDefault();
      action();
    }
  });
}
