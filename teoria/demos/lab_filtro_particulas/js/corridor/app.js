/* ==========================================================================
 * corridor/app.js — Conecta el pasillo 1D con la interfaz
 *
 * Aquí se juntan las piezas: mundo, modelo, filtro, filtro exacto, robot
 * simulado, vista y controles. Si quieres cambiar cómo funciona el filtro,
 * lo normal es tocar model.js, no este fichero.
 * ========================================================================== */
window.PF = window.PF || {};
PF.corridor = PF.corridor || {};

PF.corridor.createApp = function () {
  const { fmt } = PF.ui;

  // Parámetros que controla la interfaz. El modelo los lee en cada llamada.
  const params = {
    particles: 300,
    step: 0.5,               // metros por pulsación
    motionNoise: 0.1,        // σ del modelo de movimiento, por metro recorrido
    pDoorGivenDoor: 0.8,     // modelo del sensor
    pDoorGivenWall: 0.1,
    resamplePolicy: 'always', // 'always' | 'adaptive' | 'never'
    resampleMethod: 'systematic',
    randomFraction: 0,       // fracción de partículas aleatorias tras remuestrear
    showExact: true,
  };

  const world = PF.corridor.createWorld();
  const model = PF.corridor.createModel(world, params);
  const filter = new PF.ParticleFilter(model);
  const exact = new PF.corridor.MarkovGrid(world);
  const robot = new PF.corridor.SimulatedRobot(world);
  const view = new PF.corridor.View(document.getElementById('corridor-canvas'), world);

  // Las tres fases. Cada una actúa a la vez sobre las partículas y sobre el
  // filtro exacto, para poder compararlos.
  const cycle = new PF.Cycle(
    {
      predict(u) {
        robot.move(u);                                       // el robot real se mueve (con su ruido)
        filter.predict(u);                                   // Fase 1 en las partículas
        exact.predict(u, params.motionNoise * Math.abs(u));  // y en la rejilla
      },
      weight() {
        const z = robot.sense();                             // lectura real del sensor
        filter.weight(z);                                    // Fase 2
        exact.correct(z, (state, zz) => model.likelihood(state, zz));
      },
      resample() {
        if (!filter.needsResampling(params.resamplePolicy)) {
          if (cycle.stepMode && params.resamplePolicy === 'adaptive') flash('N_eff ≥ M/2: esta vez no hace falta remuestrear.');
          return;
        }
        filter.resample(params.resampleMethod);              // Fase 3
        filter.injectRandom(params.randomFraction);
      },
    },
    render
  );

  let ready = false;

  function restart() {
    filter.init(params.particles);   // localización global: partículas uniformes
    exact.reset();
    robot.reset();
    cycle.reset();
  }

  function move(direction) {
    if (!cycle.move(direction * params.step)) flash('Termina el ciclo con los botones 2 y 3 antes de moverte.');
  }

  // ---------- Controles ----------
  PF.ui.button('c-left', () => move(-1));
  PF.ui.button('c-right', () => move(+1));
  PF.ui.radios('c-mode', (v) => ready && cycle.setStepMode(v === 'step'));
  const weightBtn = PF.ui.button('c-weight', () => cycle.weight());
  const resampleBtn = PF.ui.button('c-resample', () => cycle.resample());

  PF.ui.range('c-n', (v) => {
    params.particles = v;
    if (ready) restart();
  });
  PF.ui.range('c-motion', (v) => { params.motionNoise = v; }, (v) => fmt(v, 2));
  PF.ui.range('c-pdd', (v) => { params.pDoorGivenDoor = v; render(); }, (v) => fmt(v, 2));
  PF.ui.range('c-pdw', (v) => { params.pDoorGivenWall = v; render(); }, (v) => fmt(v, 2));
  PF.ui.select('c-policy', (v) => { params.resamplePolicy = v; });
  PF.ui.select('c-method', (v) => { params.resampleMethod = v; });
  PF.ui.range('c-random', (v) => { params.randomFraction = v / 100; }, (v) => `${v} %`);
  PF.ui.checkbox('c-exact', (v) => { params.showExact = v; render(); });
  PF.ui.button('c-reset', restart);
  PF.ui.button('c-kidnap', () => { robot.kidnap(); render(); flash('Robot secuestrado. El filtro no sabe nada todavía.'); });

  // ---------- Dibujo y lecturas ----------
  const status = document.getElementById('c-status');
  let flashTimer = null;
  function flash(text) {
    status.textContent = text;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { status.textContent = ''; }, 3500);
  }

  function render() {
    if (!ready) return;
    const estimate = filter.estimate();
    view.draw({
      particles: filter.particles,
      robot,
      estimate,
      grid: params.showExact ? exact : null,
      showEstimate: cycle.completedCycles > 0 || cycle.phase !== 'ready',
    });

    PF.ui.showPhase('corridor-phases', cycle);
    weightBtn.disabled = !(cycle.stepMode && cycle.phase === 'predicted');
    resampleBtn.disabled = !(cycle.stepMode && cycle.phase === 'weighted');
    document.getElementById('c-stepbuttons').hidden = !cycle.stepMode;

    setText('c-out-reading', robot.lastReading === null ? '—' : robot.lastReading ? 'puerta' : 'pared');
    setText('c-out-real', `${fmt(robot.x, 2)} m`);
    setText('c-out-est', `${fmt(estimate.x, 2)} m`);
    const d = Math.abs(estimate.x - robot.x);
    setText('c-out-err', `${fmt(Math.min(d, world.length - d), 2)} m`); // distancia en el anillo
    setText('c-out-neff', `${Math.round(filter.stats.neff)} / ${filter.size}`);
  }

  function setText(id, text) {
    document.getElementById(id).textContent = text;
  }

  ready = true;
  restart();

  return {
    render,
    handleKey(key) {
      if (key === 'ArrowLeft') { move(-1); return true; }
      if (key === 'ArrowRight') { move(+1); return true; }
      return false;
    },
  };
};
