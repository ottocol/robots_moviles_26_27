// Interfaz: controles, estado de la página y orquestación del dibujo.
import { DEG, MAP_BOUNDS, wrapAngle } from '../slam/world.js';
import { OccupancyGrid } from '../slam/occupancy-grid.js';
import { Simulation } from '../slam/simulation.js';
import { History } from './history.js';
import {
  readTheme, drawWorldView, drawParticleMap, drawThumbnail, drawNeffChart,
} from './render.js';

const $ = (id) => document.getElementById(id);

const MANUAL_TRANSLATION = 0.25;      // m por pulsación
const MANUAL_ROTATION = 10 * DEG;     // rad por pulsación
const THUMBNAIL_INTERVAL_MS = 300;    // refresco de miniaturas mientras se reproduce
const NOTE_DURATION_STEPS = 15;       // pasos que se muestra un aviso de linaje

const controls = {
  worldCanvas: $('worldCanvas'), mapCanvas: $('mapCanvas'), neffCanvas: $('neffCanvas'),
  thumbnails: $('thumbnails'),
  forward: $('forward'), backward: $('backward'), turnLeft: $('turnLeft'), turnRight: $('turnRight'),
  play: $('play'), step: $('step'), undo: $('undo'), undo10: $('undo10'), applyScan: $('applyScan'),
  speed: $('speed'), speedValue: $('speedValue'),
  particleCount: $('particleCount'), resolution: $('resolution'), seed: $('seed'),
  randomSeed: $('randomSeed'), restart: $('restart'),
  motionNoise: $('motionNoise'), motionNoiseValue: $('motionNoiseValue'),
  pauseBeforeClosure: $('pauseBeforeClosure'), improvedProposal: $('improvedProposal'),
  followBest: $('followBest'), showAllTrajectories: $('showAllTrajectories'),
  showRealWalls: $('showRealWalls'),
  banner: $('banner'), bannerText: $('bannerText'),
  worldInfo: $('worldInfo'), mapInfo: $('mapInfo'), memoryText: $('memoryText'),
  stats: {
    step: $('statStep'), neff: $('statNeff'), resamples: $('statResamples'),
    mapsCopied: $('statMapsCopied'), bestError: $('statBestError'),
    odometryError: $('statOdometryError'), mapSize: $('statMapSize'), totalMaps: $('statTotalMaps'),
  },
};

const state = {
  sim: null,
  history: null,
  selected: 0,                     // casilla de la partícula que se ve en grande
  note: null,                      // aviso de linaje: { text, step }
  playing: false,
  timer: null,
  lastThumbnailDraw: 0,
};

// ---------- Ciclo de vida de la simulación ----------

function readConfig() {
  const seed = Math.abs(Math.floor(Number(controls.seed.value))) || 0;
  controls.seed.value = seed;
  return {
    seed,
    particleCount: Number(controls.particleCount.value),
    resolution: Number(controls.resolution.value),
    improvedProposal: controls.improvedProposal.checked,
    motionNoise: Number(controls.motionNoise.value),
  };
}

function restart() {
  stop();
  const config = readConfig();
  state.sim = new Simulation(config);
  state.history = new History(config);
  state.selected = 0;
  state.note = null;
  buildThumbnails();
  updateMemoryText();
  render({ thumbnails: true });
}

/** Ejecuta una acción del usuario y, si hubo remuestreo, sigue el linaje elegido. */
function runAction(action) {
  const resamplesBefore = state.sim.resampleSteps.length;
  const result = action();
  if (state.sim.resampleSteps.length > resamplesBefore) followLineage();
  return result;
}

function advance(u) {
  return runAction(() => {
    const pause = controls.pauseBeforeClosure.checked;
    const result = state.sim.advance(u, { pauseBeforeLoopClosure: pause });
    state.history.recordAdvance(state.sim, u, pause);
    if (result === 'paused') stop();
    return result;
  });
}

function applyScan() {
  if (!state.sim.pending) return;
  runAction(() => {
    state.sim.applyPendingScan();
    state.history.recordApplyScan();
  });
}

/** Un paso de la ruta automática (o aplicar el escaneo si estamos en la pausa). */
function autoStep() {
  if (state.sim.pending) {
    applyScan();
    render({ thumbnails: true });
    return;
  }
  const u = state.sim.route.nextCommand(state.sim.truePose);
  if (!u) {
    stop();
    render({ thumbnails: true });
    return;
  }
  advance(u);
  render();
}

function manualMove(u) {
  if (state.sim.pending) return;
  stop();
  advance(u);
  render({ thumbnails: true });
}

function undo(count) {
  if (!state.history.length) return;
  stop();
  state.sim = state.history.undo(count);
  // Los ajustes actuales de la página valen para los pasos siguientes
  state.sim.improvedProposal = controls.improvedProposal.checked;
  state.sim.motionNoise = Number(controls.motionNoise.value);
  state.note = null;
  render({ thumbnails: true });
}

function tick() {
  if (!state.playing) return;
  autoStep();
  if (state.playing) state.timer = setTimeout(tick, 1000 / Number(controls.speed.value));
}

function play() {
  if (state.sim.pending) return;
  state.playing = true;
  updateButtons();
  tick();
}

function stop() {
  state.playing = false;
  clearTimeout(state.timer);
  if (state.sim) updateButtons();
}

// ---------- Selección de partícula ----------

function selectParticle(index) {
  state.selected = index;
  state.note = null;
  controls.followBest.checked = false;
  render({ thumbnails: true });
}

/**
 * El número de una partícula es solo su casilla: tras remuestrear, la casilla
 * contiene otra partícula. Para seguir a «la misma», pasamos a una de sus hijas.
 */
function followLineage() {
  if (controls.followBest.checked || state.sim.pending) return;
  const step = state.sim.step;
  const children = [];
  state.sim.particles.forEach((p, i) => {
    if (p.parentIndex === state.selected) children.push(i);
  });
  if (children.length) {
    state.note = { text: `linaje seguido (${children.length} ${children.length > 1 ? 'hijas' : 'hija'})`, step };
    state.selected = children[0];
  } else {
    state.note = { text: `el linaje de #${state.selected} se extinguió en el paso ${step}`, step };
    controls.followBest.checked = true;
  }
}

/** Partícula más cercana a un clic en el mundo (a menos de 60 cm). */
function particleAt(event) {
  const rect = controls.worldCanvas.getBoundingClientRect();
  const x = MAP_BOUNDS.x0 + (event.clientX - rect.left) / rect.width * MAP_BOUNDS.width;
  const y = MAP_BOUNDS.y0 + MAP_BOUNDS.height - (event.clientY - rect.top) / rect.height * MAP_BOUNDS.height;
  let nearest = -1;
  let nearestDistance = 0.6;
  state.sim.particles.forEach((p, i) => {
    const d = Math.hypot(p.pose.x - x, p.pose.y - y);
    if (d < nearestDistance) {
      nearestDistance = d;
      nearest = i;
    }
  });
  return nearest;
}

// ---------- Dibujo y textos ----------

function render({ thumbnails = false } = {}) {
  const sim = state.sim;
  const theme = readTheme();
  if (controls.followBest.checked) state.selected = sim.filter.bestIndex();
  if (state.selected >= sim.particles.length) state.selected = 0;
  const particle = sim.particles[state.selected];

  drawWorldView(controls.worldCanvas, sim, state.selected,
    { showAllTrajectories: controls.showAllTrajectories.checked }, theme);
  drawParticleMap(controls.mapCanvas, sim, particle,
    { showRealWalls: controls.showRealWalls.checked }, theme);
  drawNeffChart(controls.neffCanvas, sim, theme);
  updateStats(particle);
  updateHeaders(particle);
  updateBanner();
  updateButtons();

  const now = performance.now();
  if (thumbnails || !state.playing || now - state.lastThumbnailDraw > THUMBNAIL_INTERVAL_MS) {
    updateThumbnails(theme);
    state.lastThumbnailDraw = now;
  }
}

function formatBytes(bytes) {
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(bytes >= 10485760 ? 0 : 1) + ' MB';
  return (bytes / 1024).toFixed(0) + ' KB';
}

function formatPoseError(pose, truth) {
  const distance = Math.hypot(pose.x - truth.x, pose.y - truth.y);
  const angle = Math.abs(wrapAngle(pose.theta - truth.theta)) / DEG;
  return `${distance.toFixed(2)} m · ${angle.toFixed(1)}°`;
}

function updateStats(particle) {
  const sim = state.sim;
  const s = controls.stats;
  const mapBytes = OccupancyGrid.bytesFor(sim.config.resolution);
  s.step.textContent = sim.step;
  s.neff.textContent = sim.lastNeff ? `${sim.lastNeff.toFixed(1)} / ${sim.particles.length}` : '–';
  s.resamples.textContent = sim.resampleSteps.length;
  s.mapsCopied.textContent = sim.mapsCopied;
  s.bestError.textContent = formatPoseError(particle.pose, sim.truePose);
  s.odometryError.textContent = formatPoseError(sim.odometryPose, sim.truePose);
  s.mapSize.textContent = formatBytes(mapBytes);
  s.totalMaps.textContent = formatBytes(mapBytes * sim.particles.length);
}

function updateHeaders(particle) {
  const sim = state.sim;
  const i = state.selected;

  if (sim.pending) controls.worldInfo.textContent = 'pausado antes de cerrar el ciclo';
  else if (sim.closureStep > 0) controls.worldInfo.textContent = `ciclo cerrado en el paso ${sim.closureStep}`;
  else controls.worldInfo.textContent = '';

  const parts = [`${controls.followBest.checked ? 'mejor: ' : ''}#${i}`];
  let weight = `peso ${(particle.weight * 100).toFixed(1)} %`;
  if (sim.pending) weight += ` → ${(sim.pending.previewWeights[i] * 100).toFixed(1)} %`;
  parts.push(weight);
  const lastResample = sim.resampleSteps[sim.resampleSteps.length - 1];
  if (lastResample === sim.step && !sim.pending) parts.push(`copia de #${particle.parentIndex} (remuestreo)`);
  if (state.note && sim.step - state.note.step < NOTE_DURATION_STEPS) parts.push(state.note.text);
  controls.mapInfo.textContent = parts.join(' · ');
}

function updateBanner() {
  const sim = state.sim;
  controls.banner.hidden = !sim.pending;
  if (!sim.pending) return;
  controls.bannerText.textContent =
    `Paso ${sim.step}: el siguiente escaneo vuelve a ver zona que no se veía desde hace más de ` +
    `${sim.loopClosure.gapSteps} pasos (${sim.pending.revisitedBeams.length} haces en naranja). ` +
    'Las partículas ya se han movido, pero todavía no se han ponderado ni han actualizado su mapa. ' +
    'En las miniaturas, «→» indica el peso que tendría cada partícula tras este escaneo; pincha en ' +
    'las que suben y en las que bajan y mira si los puntos naranjas caen sobre las paredes que ' +
    'mapearon al principio. El cierre completo dura unos 20 pasos: después sigue el ciclo y observa ' +
    'el error de la mejor partícula y la gráfica de Neff.';
}

function updateButtons() {
  const sim = state.sim;
  const paused = Boolean(sim.pending);
  const routeDone = sim.route.finished;
  for (const button of [controls.forward, controls.backward, controls.turnLeft, controls.turnRight]) {
    button.disabled = paused;
  }
  controls.step.textContent = paused ? 'Aplicar el escaneo' : 'Paso';
  controls.step.disabled = !paused && routeDone;
  controls.play.disabled = paused || routeDone;
  controls.undo.disabled = controls.undo10.disabled = !state.history.length;
  if (routeDone) controls.play.textContent = 'Ruta terminada';
  else if (state.playing) controls.play.textContent = '⏸ Pausar';
  else controls.play.textContent = sim.step > 0 ? '▶ Seguir el ciclo' : '▶ Recorrer el ciclo';
}

function updateMemoryText() {
  const { particleCount, resolution } = state.sim.config;
  const nx = Math.round(MAP_BOUNDS.width / resolution);
  const ny = Math.round(MAP_BOUNDS.height / resolution);
  const perMap = OccupancyGrid.bytesFor(resolution);
  const examples = [[30, 0.1], [100, 0.1], [200, 0.05], [1000, 0.05]]
    .map(([n, r]) => `${n} partículas a ${r * 100} cm: ${formatBytes(n * OccupancyGrid.bytesFor(r))}`)
    .join('; ');
  controls.memoryText.textContent =
    `Ahora: rejilla de ${MAP_BOUNDS.width} × ${MAP_BOUNDS.height} m a ${resolution * 100} cm = ` +
    `${nx} × ${ny} = ${(nx * ny).toLocaleString('es')} celdas en Float32, ${formatBytes(perMap)} por ` +
    `partícula y ${formatBytes(perMap * particleCount)} para ${particleCount} partículas. ` +
    `Otras combinaciones: ${examples}. La memoria no es el problema en un navegador; lo que limita ` +
    'es el tiempo por paso (trazar 72 rayos por partícula y copiar mapas al remuestrear) y, con la ' +
    'propuesta mejorada, el scan matching de cada partícula.';
}

// ---------- Miniaturas ----------

function buildThumbnails() {
  controls.thumbnails.textContent = '';
  state.sim.particles.forEach((_, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'thumb';
    button.innerHTML =
      '<canvas width="108" height="84"></canvas>' +
      '<div class="weight-bar"><i></i></div>' +
      `<small><span>#${i}</span><span class="weight"></span></small>`;
    button.addEventListener('click', () => selectParticle(i));
    controls.thumbnails.appendChild(button);
  });
}

function updateThumbnails(theme) {
  const sim = state.sim;
  const best = sim.filter.bestIndex();
  const maxWeight = Math.max(...sim.particles.map((p) => p.weight));
  [...controls.thumbnails.children].forEach((button, i) => {
    const particle = sim.particles[i];
    drawThumbnail(button.querySelector('canvas'), particle, theme);
    button.querySelector('.weight-bar i').style.width = `${(100 * particle.weight / maxWeight).toFixed(0)}%`;
    let weight = (particle.weight * 100).toFixed(1);
    if (sim.pending) weight += '→' + (sim.pending.previewWeights[i] * 100).toFixed(1);
    button.querySelector('.weight').textContent = `${i === best ? '★ ' : ''}${weight}%`;
    button.classList.toggle('selected', i === state.selected);
  });
}

// ---------- Eventos ----------

controls.forward.addEventListener('click', () => manualMove({ rotation: 0, translation: MANUAL_TRANSLATION }));
controls.backward.addEventListener('click', () => manualMove({ rotation: 0, translation: -MANUAL_TRANSLATION }));
controls.turnLeft.addEventListener('click', () => manualMove({ rotation: MANUAL_ROTATION, translation: 0 }));
controls.turnRight.addEventListener('click', () => manualMove({ rotation: -MANUAL_ROTATION, translation: 0 }));
controls.play.addEventListener('click', () => (state.playing ? stop() : play()));
controls.step.addEventListener('click', () => {
  stop();
  autoStep();
  render({ thumbnails: true });
});
controls.applyScan.addEventListener('click', () => {
  applyScan();
  render({ thumbnails: true });
});
controls.undo.addEventListener('click', () => undo(1));
controls.undo10.addEventListener('click', () => undo(10));
controls.restart.addEventListener('click', restart);
for (const input of [controls.particleCount, controls.resolution, controls.seed]) {
  input.addEventListener('change', restart);
}
controls.randomSeed.addEventListener('click', () => {
  controls.seed.value = Math.floor(Math.random() * 100000);
  restart();
});
controls.improvedProposal.addEventListener('change', () => {
  state.sim.improvedProposal = controls.improvedProposal.checked;
});
controls.motionNoise.addEventListener('input', () => {
  controls.motionNoiseValue.textContent = controls.motionNoise.value;
  state.sim.motionNoise = Number(controls.motionNoise.value);
});
controls.speed.addEventListener('input', () => {
  controls.speedValue.textContent = controls.speed.value;
});
for (const box of [controls.followBest, controls.showAllTrajectories, controls.showRealWalls]) {
  box.addEventListener('change', () => {
    state.note = null;
    render({ thumbnails: true });
  });
}
controls.worldCanvas.addEventListener('click', (event) => {
  const index = particleAt(event);
  if (index >= 0) selectParticle(index);
});

const ARROW_KEYS = {
  ArrowUp: controls.forward, ArrowDown: controls.backward,
  ArrowLeft: controls.turnLeft, ArrowRight: controls.turnRight,
};
document.addEventListener('keydown', (event) => {
  const tag = event.target.tagName;
  if (tag === 'SELECT' || tag === 'INPUT') return;
  if (ARROW_KEYS[event.key]) {
    event.preventDefault();
    ARROW_KEYS[event.key].click();
  } else if (event.key === ' ') {
    event.preventDefault();
    if (!state.sim.pending) state.playing ? stop() : play();
  } else if (event.key === 'Backspace') {
    event.preventDefault();
    undo(1);
  } else if (event.key === 'Enter' && tag !== 'BUTTON') {
    event.preventDefault();
    controls.step.click();
  }
});

// Redibujar si cambia el tema claro/oscuro
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => render({ thumbnails: true }));
new MutationObserver(() => render({ thumbnails: true }))
  .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

restart();
