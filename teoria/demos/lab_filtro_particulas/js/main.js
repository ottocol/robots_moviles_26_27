/* ==========================================================================
 * main.js — Arranque: pestañas, teclado y redibujado al cambiar el tamaño
 * ========================================================================== */
window.PF = window.PF || {};

(function () {
  const apps = {
    pasillo: PF.corridor.createApp(),
    mapa: PF.grid.createApp(),
  };

  const tabs = [...document.querySelectorAll('[role="tab"]')];
  let active = 'pasillo';

  function showTab(name) {
    if (!tabs.some((t) => t.dataset.tab === name)) name = 'pasillo';
    active = name;
    for (const t of tabs) {
      const selected = t.dataset.tab === name;
      t.setAttribute('aria-selected', String(selected));
      t.tabIndex = selected ? 0 : -1;
      document.getElementById(`panel-${t.dataset.tab}`).hidden = !selected;
    }
    if (apps[name]) apps[name].render(); // el canvas oculto no se puede dibujar
  }

  tabs.forEach((t) => t.addEventListener('click', () => {
    showTab(t.dataset.tab);
    history.replaceState(null, '', `#${t.dataset.tab}`);
  }));

  // Flechas del teclado → robot de la pestaña activa, salvo si el foco está
  // en un slider o un desplegable, que necesitan las flechas para sí.
  // (En radios y casillas sí se capturan, para que no cambien de opción.)
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t.tagName === 'SELECT' || t.tagName === 'TEXTAREA') return;
    if (t.tagName === 'INPUT' && !['radio', 'checkbox'].includes(t.type)) return;
    const app = apps[active];
    if (app && app.handleKey(e.key)) e.preventDefault();
  });

  // Redibujar al cambiar el tamaño de la ventana o el tema claro/oscuro
  const redraw = () => apps[active] && apps[active].render();
  new ResizeObserver(redraw).observe(document.querySelector('main'));
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', redraw);
  new MutationObserver(redraw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  showTab(location.hash.replace('#', '') || 'pasillo');
})();
