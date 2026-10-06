/* ==========================================================================
 * grid/app.js — Conecta el mapa 2D con la interfaz
 *
 * Igual que en el pasillo: aquí solo se cablean piezas. El modelo de
 * movimiento y el de sensor están en model.js; el robot simulado, en robot.js.
 * ========================================================================== */
window.PF = window.PF || {};
PF.grid = PF.grid || {};

PF.grid.createApp = function () {
  const { fmt } = PF.ui;

  const params = {
    particles: 1000,
    init: 'global',            // 'global' (no sabemos nada) o 'local' (pose inicial conocida)
    noiseFactor: 1.5,          // ruido del modelo = ruido real × noiseFactor
    modelAlphas: [0, 0, 0, 0], // se recalcula a partir de noiseFactor
    sensorModel: 'beam',
    beams: 12,
    sigma: 0.15,
    zRand: 0.1,
    resamplePolicy: 'always', // 'always' | 'adaptive' | 'never'
    resampleMethod: 'systematic',
    randomFraction: 0,
    showBeams: true,
    showOdometry: true,
    autopilot: false,
  };

  let map = new PF.grid.GridMap(PF.grid.MAPS[0]);
  const robot = new PF.grid.SimulatedRobot(map);
  let model = PF.grid.createModel(map, params);
  const filter = new PF.ParticleFilter(model);
  const view = new PF.grid.View(document.getElementById('grid-canvas'));

  const cycle = new PF.Cycle(
    {
      predict(command) {
        const u = robot.execute(command);   // el robot real se mueve (con su ruido)
        if (!u) return false;               // ha chocado: no hay odometría
        filter.predict(u);                  // Fase 1, con la odometría
      },
      weight() {
        const z = robot.scan(params.beams); // lectura real del láser
        filter.weight(z);                   // Fase 2
      },
      resample() {
        if (!filter.needsResampling(params.resamplePolicy)) {
          if (cycle.stepMode && params.resamplePolicy === 'adaptive') flash('N_eff ≥ M/2: esta vez no hace falta remuestrear.');
          return;
        }
        filter.resample(params.resampleMethod); // Fase 3
        filter.injectRandom(params.randomFraction);
      },
    },
    render
  );

  let ready = false;

  function restart() {
    if (params.init === 'global') {
      filter.init(params.particles);
    } else {
      // Seguimiento: partículas alrededor de la pose real
      const { gaussian } = PF.random;
      const p0 = robot.pose;
      filter.init(params.particles, () => ({
        x: p0.x + gaussian(0.2),
        y: p0.y + gaussian(0.2),
        theta: PF.math.normalizeAngle(p0.theta + gaussian(0.15)),
      }));
    }
    robot.odomPose = { ...robot.pose };
    robot.lastScan = null;
    cycle.reset();
  }

  function changeMap(id) {
    map = new PF.grid.GridMap(PF.grid.MAPS.find((m) => m.id === id));
    robot.setMap(map);
    model = PF.grid.createModel(map, params);
    filter.model = model;
    document.getElementById('g-map-desc').textContent = map.def.description;
    restart();
  }

  function command(cmd) {
    if (!cycle.move(cmd)) {
      if (cycle.stepMode && cycle.phase !== 'ready') flash('Termina el ciclo con los botones 2 y 3 antes de moverte.');
      else flash('Hay una pared delante.');
      return false;
    }
    return true;
  }

  // ---------- Controles ----------
  // El desplegable de mapas se rellena con la lista de maps.js
  const mapSelect = document.getElementById('g-map');
  for (const m of PF.grid.MAPS) mapSelect.add(new Option(m.name, m.id));
  PF.ui.select('g-map', (v) => ready && changeMap(v));
  PF.ui.button('g-fwd', () => command('forward'));
  PF.ui.button('g-back', () => command('backward'));
  PF.ui.button('g-left', () => command('left'));
  PF.ui.button('g-right', () => command('right'));
  PF.ui.checkbox('g-auto', (v) => { params.autopilot = v; });
  PF.ui.radios('g-mode', (v) => ready && cycle.setStepMode(v === 'step'));
  const weightBtn = PF.ui.button('g-weight', () => cycle.weight());
  const resampleBtn = PF.ui.button('g-resample', () => cycle.resample());

  PF.ui.range('g-n', (v) => { params.particles = v; if (ready) restart(); });
  PF.ui.select('g-init', (v) => { params.init = v; if (ready) restart(); });
  PF.ui.range('g-noise', (v) => {
    params.noiseFactor = v;
    params.modelAlphas = robot.truth.alphas.map((a) => a * v);
  }, (v) => `× ${fmt(v, 2)}`);
  PF.ui.select('g-sensor', (v) => { params.sensorModel = v; });
  PF.ui.range('g-beams', (v) => { params.beams = v; });
  PF.ui.range('g-sigma', (v) => { params.sigma = v; }, (v) => `${fmt(v, 2)} m`);
  PF.ui.range('g-zrand', (v) => { params.zRand = v; }, (v) => fmt(v, 2));
  PF.ui.select('g-policy', (v) => { params.resamplePolicy = v; });
  PF.ui.select('g-method', (v) => { params.resampleMethod = v; });
  PF.ui.range('g-random', (v) => { params.randomFraction = v / 100; }, (v) => `${v} %`);
  PF.ui.checkbox('g-beams-on', (v) => { params.showBeams = v; render(); });
  PF.ui.checkbox('g-odom-on', (v) => { params.showOdometry = v; render(); });
  PF.ui.button('g-reset', restart);
  PF.ui.button('g-kidnap', () => { robot.kidnap(); render(); flash('Robot secuestrado. Ni la odometría ni el filtro lo saben.'); });

  // ---------- Paseo automático ----------
  // Avanza mientras no tenga una pared cerca delante; si la tiene, gira
  // hacia un lado durante unos pasos. Solo funciona en ciclo completo.
  let turnDir = 'left';
  let turnSteps = 0;
  setInterval(() => {
    if (!params.autopilot || cycle.stepMode || !isVisible()) return;
    const front = map.raycast(robot.pose.x, robot.pose.y, robot.pose.theta, 1);
    if (turnSteps > 0) {
      turnSteps--;
      cycle.move(turnDir);
    } else if (front < 0.55 || Math.random() < 0.06) {
      turnDir = Math.random() < 0.5 ? 'left' : 'right';
      turnSteps = 2 + Math.floor(Math.random() * 5);
    } else if (!cycle.move('forward')) {
      turnSteps = 3;
    }
  }, 260);

  function isVisible() {
    return !document.getElementById('panel-mapa').hidden;
  }

  // ---------- Dibujo y lecturas ----------
  const status = document.getElementById('g-status');
  let flashTimer = null;
  function flash(text) {
    status.textContent = text;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { status.textContent = ''; }, 3500);
  }

  function render() {
    if (!ready) return;
    const estimate = filter.estimate();
    const started = cycle.completedCycles > 0 || cycle.phase !== 'ready';
    view.draw({
      map,
      particles: filter.particles,
      robot,
      estimate,
      showEstimate: started,
      showBeams: params.showBeams,
      showOdometry: params.showOdometry,
    });

    PF.ui.showPhase('grid-phases', cycle);
    weightBtn.disabled = !(cycle.stepMode && cycle.phase === 'predicted');
    resampleBtn.disabled = !(cycle.stepMode && cycle.phase === 'weighted');
    document.getElementById('g-stepbuttons').hidden = !cycle.stepMode;

    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    setText('g-out-err', started ? `${fmt(dist(estimate, robot.pose), 2)} m` : '—');
    setText('g-out-odom', `${fmt(dist(robot.odomPose, robot.pose), 2)} m`);
    setText('g-out-neff', `${Math.round(filter.stats.neff)} / ${filter.size}`);
    const ll = filter.stats.logMeanLikelihood;
    setText('g-out-ll', ll === null ? '—' : ll === -Infinity ? '−∞' : fmt(ll, 1));
    if (filter.stats.allRejected) flash('Ninguna partícula explica la lectura. Prueba a subir z_rand o σ.');
  }

  function setText(id, text) {
    document.getElementById(id).textContent = text;
  }

  ready = true;
  changeMap(document.getElementById('g-map').value);

  return {
    render,
    handleKey(key) {
      const keys = { ArrowUp: 'forward', ArrowDown: 'backward', ArrowLeft: 'left', ArrowRight: 'right' };
      if (!keys[key]) return false;
      command(keys[key]);
      return true;
    },
  };
};
