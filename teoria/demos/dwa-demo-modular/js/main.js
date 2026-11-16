/**
 * main.js — Estado de la aplicación y bucle principal. Une el algoritmo
 * (dwa.js), el mundo (world.js) y las vistas (render-*.js, panel.js).
 *
 * Flujo de un paso:
 *   el plan actual ya está dibujado → se aplica su mejor (v, ω) durante Δt
 *   → el robot se mueve → se calcula y dibuja el plan del nuevo estado.
 */

import { DEFAULT_PARAMS, PARAM_SPECS, WORLD_SIZE } from './config.js';
import { admissibleRegion, chooseCommand, planDwa } from './dwa.js';
import { readTheme } from './colors.js';
import { OccupancyGrid } from './world.js';
import { advanceRobot } from './robot.js';
import { DEFAULT_SCENARIO, SCENARIOS } from './scenarios.js';
import { WorldView } from './render-world.js';
import { VelocityView } from './render-velocity.js';
import { BreakdownPanel } from './panel.js';
import { bindKeys, bindPointer, bindToggleGroup, buildParamControls } from './ui.js';

const NO_PROGRESS_STEPS = 60; // pasos sin acercarse al objetivo → se considera atascado

/* ------------------------------------------------------------------ */
/* Estado                                                              */
/* ------------------------------------------------------------------ */

const params = { ...DEFAULT_PARAMS };
const grid = new OccupancyGrid(WORLD_SIZE);

const app = {
  start: null, // pose inicial {x, y, theta}
  goal: null, // {x, y}
  robot: null, // {x, y, theta, v, w}
  trail: [],
  plan: null, // {window, candidates, best}
  region: null, // admisibilidad sobre todo V_s
  step: 0,
  status: 'ready', // ready | running | goal | stuck
  emergency: false,
  playing: false,
  stepsPerSecond: 4,
  bestGoalDistance: Infinity,
  stepsWithoutProgress: 0,
  tool: 'paint', // paint | erase | robot | goal
  brushRadius: 0.3,
  brush: null, // previsualización del pincel
  colorBy: 'G',
  hover: null, // candidato señalado con el ratón
};

/* ------------------------------------------------------------------ */
/* Vistas                                                              */
/* ------------------------------------------------------------------ */

const dom = {
  worldCanvas: document.getElementById('world-canvas'),
  velocityCanvas: document.getElementById('velocity-canvas'),
  status: document.getElementById('status'),
  stepCount: document.getElementById('step-count'),
  playButton: document.getElementById('btn-play'),
  stepButton: document.getElementById('btn-step'),
  resetButton: document.getElementById('btn-reset'),
  clearButton: document.getElementById('btn-clear'),
  scenarioSelect: document.getElementById('scenario'),
  colorBySelect: document.getElementById('color-by'),
  normalizationSelect: document.getElementById('normalization'),
  speedInput: document.getElementById('speed'),
  speedOutput: document.getElementById('speed-out'),
  brushInput: document.getElementById('brush'),
  brushOutput: document.getElementById('brush-out'),
};

const worldView = new WorldView(dom.worldCanvas, grid);
const velocityView = new VelocityView(dom.velocityCanvas);
const breakdown = new BreakdownPanel(document.getElementById('breakdown'));

/* ------------------------------------------------------------------ */
/* Acciones                                                            */
/* ------------------------------------------------------------------ */

function loadScenario(name) {
  const { start, goal } = SCENARIOS[name].build(grid);
  app.start = start;
  app.goal = goal;
  resetRun();
}

/** Devuelve el robot a la pose inicial (conserva mapa y objetivo). */
function resetRun() {
  app.playing = false;
  app.robot = { ...app.start, v: 0, w: 0 };
  app.trail = [{ x: app.start.x, y: app.start.y }];
  app.step = 0;
  app.status = 'ready';
  app.emergency = false;
  resetProgress();
  setPlaying(false);
  replan();
}

function resetProgress() {
  app.bestGoalDistance = Infinity;
  app.stepsWithoutProgress = 0;
}

/** Recalcula el plan para el estado actual (sin mover el robot). */
function replan() {
  app.plan = planDwa(app.robot, grid, app.goal, params);
  app.region = admissibleRegion(app.robot, grid, params);
  if (app.hover && !app.plan.candidates.includes(app.hover)) app.hover = null;
  requestRender();
}

/** Aplica el mejor (v, ω) durante Δt y planifica de nuevo. */
function stepOnce() {
  if (app.status === 'goal' || app.status === 'stuck') return;
  const command = chooseCommand(app.robot, app.plan.best, params);
  app.emergency = command.emergency;
  app.robot = advanceRobot(app.robot, command, params.dt);
  app.trail.push({ x: app.robot.x, y: app.robot.y });
  app.step++;
  app.status = 'running';
  app.hover = null;
  checkProgress();
  replan();
}

function checkProgress() {
  const d = Math.hypot(app.goal.x - app.robot.x, app.goal.y - app.robot.y);
  if (d <= params.goalTolerance) {
    app.status = 'goal';
    setPlaying(false);
    return;
  }
  if (d < app.bestGoalDistance - 0.05) {
    app.bestGoalDistance = d;
    app.stepsWithoutProgress = 0;
  } else if (++app.stepsWithoutProgress >= NO_PROGRESS_STEPS) {
    app.status = 'stuck';
    setPlaying(false);
  }
}

/* ---------- Reproducción continua ---------- */

let lastTime = 0;
let accumulator = 0;

function setPlaying(on) {
  app.playing = on && app.status !== 'goal' && app.status !== 'stuck';
  dom.playButton.textContent = app.playing ? 'Pausa' : 'Reproducir';
  dom.playButton.setAttribute('aria-pressed', String(app.playing));
  if (app.playing) {
    lastTime = performance.now();
    accumulator = 0;
    requestAnimationFrame(tick);
  }
  updateStatus();
}

function tick(now) {
  if (!app.playing) return;
  accumulator += (now - lastTime) / 1000;
  lastTime = now;
  const period = 1 / app.stepsPerSecond;
  let steps = 0;
  while (accumulator >= period && app.playing && steps < 5) {
    stepOnce();
    accumulator -= period;
    steps++;
  }
  requestAnimationFrame(tick);
}

/* ------------------------------------------------------------------ */
/* Dibujo                                                              */
/* ------------------------------------------------------------------ */

let renderQueued = false;
function requestRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    render();
  });
}

function render() {
  const theme = readTheme();
  const focus = app.hover ?? app.plan?.best ?? null;
  const scene = {
    theme,
    params,
    robot: app.robot,
    goal: app.goal,
    trail: app.trail,
    plan: app.plan,
    region: app.region,
    colorBy: app.colorBy,
    hover: app.hover,
    focus,
    brush: app.brush,
  };
  worldView.draw(scene);
  velocityView.draw(scene);
  breakdown.update(focus, params, app.hover ? 'hover' : 'best', focus === app.plan?.best);
  updateStatus();
}

const STATUS_TEXT = {
  ready: 'Listo. Pulsa «Paso» para aplicar el par elegido durante Δt.',
  running: 'Navegando.',
  goal: 'Objetivo alcanzado.',
  stuck: `Sin acercarse al objetivo en ${NO_PROGRESS_STEPS} pasos: probablemente un mínimo local.`,
};

function updateStatus() {
  let text = STATUS_TEXT[app.status];
  if (app.status === 'running' && app.emergency) text = 'Ningún par admisible: frenada de emergencia.';
  dom.status.textContent = text;
  dom.status.dataset.state = app.emergency && app.status === 'running' ? 'warning' : app.status;
  const t = app.step * params.dt;
  dom.stepCount.textContent = `paso ${app.step} · t = ${t.toFixed(2)} s · v = ${app.robot.v.toFixed(2)} m/s · ω = ${app.robot.w.toFixed(2)} rad/s`;
  dom.stepButton.disabled = app.status === 'goal' || app.status === 'stuck';
}

/* ------------------------------------------------------------------ */
/* Interacción                                                         */
/* ------------------------------------------------------------------ */

function bindWorldInteraction() {
  const toWorld = (px, py) => worldView.toWorld(px, py);
  let robotDragOrigin = null;

  const paintAt = (px, py) => {
    const { x, y } = toWorld(px, py);
    grid.paintDisc(x, y, app.brushRadius, app.tool === 'paint');
    app.brush = { x, y, r: app.brushRadius, erase: app.tool === 'erase' };
    replan();
  };

  bindPointer(dom.worldCanvas, {
    onDown(px, py) {
      const p = toWorld(px, py);
      if (app.tool === 'paint' || app.tool === 'erase') paintAt(px, py);
      else if (app.tool === 'robot') {
        robotDragOrigin = p;
        app.start = { x: p.x, y: p.y, theta: app.start.theta };
        resetRun();
      } else if (app.tool === 'goal') {
        app.goal = { x: p.x, y: p.y };
        if (app.status === 'goal' || app.status === 'stuck') app.status = 'ready';
        resetProgress();
        replan();
      }
    },
    onDrag(px, py) {
      const p = toWorld(px, py);
      if (app.tool === 'paint' || app.tool === 'erase') paintAt(px, py);
      else if (app.tool === 'robot' && robotDragOrigin) {
        // Arrastrar fija la orientación inicial
        const theta = Math.atan2(p.y - robotDragOrigin.y, p.x - robotDragOrigin.x);
        app.start = { ...app.start, theta };
        resetRun();
      } else if (app.tool === 'goal') {
        app.goal = { x: p.x, y: p.y };
        replan();
      }
    },
    onUp() {
      robotDragOrigin = null;
    },
    onHover(px, py) {
      const { x, y } = toWorld(px, py);
      app.brush = app.tool === 'paint' || app.tool === 'erase'
        ? { x, y, r: app.brushRadius, erase: app.tool === 'erase' }
        : null;
      app.hover = app.plan ? worldView.candidateNear(px, py, app.plan.candidates) : null;
      requestRender();
    },
    onLeave() {
      app.brush = null;
      app.hover = null;
      requestRender();
    },
  });
}

function bindVelocityInteraction() {
  bindPointer(dom.velocityCanvas, {
    onHover(px, py) {
      app.hover = app.plan ? velocityView.candidateNear(px, py, app.plan.candidates) : null;
      requestRender();
    },
    onLeave() {
      app.hover = null;
      requestRender();
    },
  });
}

function bindControls() {
  dom.stepButton.addEventListener('click', () => {
    setPlaying(false);
    stepOnce();
  });
  dom.playButton.addEventListener('click', () => setPlaying(!app.playing));
  dom.resetButton.addEventListener('click', resetRun);
  dom.clearButton.addEventListener('click', () => {
    grid.clear();
    replan();
  });

  for (const [key, s] of Object.entries(SCENARIOS)) {
    dom.scenarioSelect.add(new Option(s.label, key));
  }
  dom.scenarioSelect.value = DEFAULT_SCENARIO;
  dom.scenarioSelect.addEventListener('change', () => loadScenario(dom.scenarioSelect.value));

  dom.colorBySelect.addEventListener('change', () => {
    app.colorBy = dom.colorBySelect.value;
    requestRender();
  });
  dom.normalizationSelect.value = params.normalization;
  dom.normalizationSelect.addEventListener('change', () => {
    params.normalization = dom.normalizationSelect.value;
    replan();
  });

  const showSpeed = () => (dom.speedOutput.textContent = `${app.stepsPerSecond} pasos/s`);
  dom.speedInput.value = app.stepsPerSecond;
  dom.speedInput.addEventListener('input', () => {
    app.stepsPerSecond = Number(dom.speedInput.value);
    showSpeed();
  });
  showSpeed();

  const showBrush = () => (dom.brushOutput.textContent = `${app.brushRadius.toFixed(2)} m`);
  dom.brushInput.value = app.brushRadius;
  dom.brushInput.addEventListener('input', () => {
    app.brushRadius = Number(dom.brushInput.value);
    showBrush();
  });
  showBrush();

  bindToggleGroup(document.getElementById('tools'), (tool) => {
    app.tool = tool;
    dom.worldCanvas.dataset.tool = tool;
  })('paint');

  buildParamControls(document.getElementById('param-controls'), PARAM_SPECS, params, () => replan());

  bindKeys({
    ' ': () => setPlaying(!app.playing),
    ArrowRight: () => {
      setPlaying(false);
      stepOnce();
    },
    r: resetRun,
  });
}

function bindResizeAndTheme() {
  const resize = () => {
    worldView.resize();
    velocityView.resize();
    render();
  };
  new ResizeObserver(resize).observe(dom.worldCanvas);
  new ResizeObserver(resize).observe(dom.velocityCanvas);
  // Re-dibujar si cambia el tema (preferencia del sistema o atributo data-theme)
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', requestRender);
  new MutationObserver(requestRender).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme', 'class'],
  });
}

/* ------------------------------------------------------------------ */
/* Arranque                                                            */
/* ------------------------------------------------------------------ */

bindControls();
bindWorldInteraction();
bindVelocityInteraction();
loadScenario(DEFAULT_SCENARIO);
bindResizeAndTheme();
