// Dibujo en los lienzos. Solo lee la simulación; no la modifica.
import { MAP_BOUNDS, WORLD, OBSTACLES, WALLS, START_POSE, LOOP_ROUTE } from '../slam/world.js';
import { scanEndpoints } from '../slam/laser.js';

/** Colores del tema actual (claro u oscuro), leídos de las variables CSS. */
export function readTheme() {
  const style = getComputedStyle(document.documentElement);
  const get = (name) => style.getPropertyValue(name).trim();
  return {
    background: get('--bg'), panel: get('--panel'), ink: get('--ink'), line: get('--line'),
    muted: get('--muted'), truth: get('--truth'), odometry: get('--odo'),
    particle: get('--particle'), wall: get('--wall'), scan: get('--scan'), warn: get('--warn'),
  };
}

/** Paso de metros a píxeles para un lienzo que muestra MAP_BOUNDS entero (y hacia arriba). */
class Projection {
  constructor(canvas) {
    this.scale = canvas.width / MAP_BOUNDS.width;
  }
  x(x) { return (x - MAP_BOUNDS.x0) * this.scale; }
  y(y) { return (MAP_BOUNDS.y0 + MAP_BOUNDS.height - y) * this.scale; }
}

// ---------- Primitivas ----------

function strokePath(ctx, view, points) {
  ctx.beginPath();
  points.forEach((p, k) => {
    if (k === 0) ctx.moveTo(view.x(p.x), view.y(p.y));
    else ctx.lineTo(view.x(p.x), view.y(p.y));
  });
  ctx.stroke();
}

function drawRobot(ctx, view, pose, color, radius) {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.arc(view.x(pose.x), view.y(pose.y), radius * view.scale, 0, 2 * Math.PI);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(view.x(pose.x), view.y(pose.y));
  ctx.lineTo(view.x(pose.x + Math.cos(pose.theta) * radius * 1.9),
             view.y(pose.y + Math.sin(pose.theta) * radius * 1.9));
  ctx.stroke();
}

function drawWalls(ctx, view, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  for (const [xa, ya, xb, yb] of WALLS) {
    ctx.moveTo(view.x(xa), view.y(ya));
    ctx.lineTo(view.x(xb), view.y(yb));
  }
  ctx.stroke();
}

/** Flecha de una partícula; la opacidad indica el peso relativo al máximo. */
function drawParticle(ctx, view, pose, color, opacity) {
  const x = view.x(pose.x);
  const y = view.y(pose.y);
  const a = -pose.theta;  // el eje y del lienzo va hacia abajo
  const length = 9;
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + Math.cos(a) * length, y + Math.sin(a) * length);
  ctx.lineTo(x + Math.cos(a + 2.5) * length * 0.6, y + Math.sin(a + 2.5) * length * 0.6);
  ctx.lineTo(x + Math.cos(a - 2.5) * length * 0.6, y + Math.sin(a - 2.5) * length * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

// ---------- Mapa de ocupación como imagen ----------

const gridCanvas = document.createElement('canvas');
const gridContext = gridCanvas.getContext('2d');
let gridImage = null;

/** Pinta un mapa en un lienzo auxiliar de 1 píxel por celda: negro ocupado, blanco libre. */
function gridToImage(grid) {
  if (gridCanvas.width !== grid.nx || gridCanvas.height !== grid.ny || !gridImage) {
    gridCanvas.width = grid.nx;
    gridCanvas.height = grid.ny;
    gridImage = gridContext.createImageData(grid.nx, grid.ny);
  }
  const pixels = gridImage.data;
  for (let j = 0; j < grid.ny; j++) {
    const row = (grid.ny - 1 - j) * grid.nx;  // la fila 0 del mapa va abajo
    for (let i = 0; i < grid.nx; i++) {
      const freeProbability = 1 / (1 + Math.exp(grid.logOdds[j * grid.nx + i]));
      const k = (row + i) * 4;
      pixels[k] = pixels[k + 1] = pixels[k + 2] = 255 * freeProbability;
      pixels[k + 3] = 255;
    }
  }
  gridContext.putImageData(gridImage, 0, 0);
  return gridCanvas;
}

// ---------- Vistas ----------

/**
 * Mundo real: paredes, ruta, láser, robot real, odometría y todas las partículas.
 * Durante la pausa, los haces que vuelven a ver zona antigua salen en naranja.
 */
export function drawWorldView(canvas, sim, selectedIndex, { showAllTrajectories }, theme) {
  const ctx = canvas.getContext('2d');
  const view = new Projection(canvas);
  const particles = sim.particles;
  const selected = particles[selectedIndex];
  const maxWeight = Math.max(...particles.map((p) => p.weight));

  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = theme.panel;
  ctx.fillRect(view.x(0), view.y(WORLD.height), WORLD.width * view.scale, WORLD.height * view.scale);
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = theme.line;
  for (const [x0, y0, x1, y1] of OBSTACLES) {
    ctx.fillRect(view.x(x0), view.y(y1), (x1 - x0) * view.scale, (y1 - y0) * view.scale);
  }
  ctx.globalAlpha = 1;
  drawWalls(ctx, view, theme.wall, 2);

  // Ruta prevista
  ctx.setLineDash([2, 6]);
  ctx.strokeStyle = theme.muted;
  ctx.lineWidth = 1;
  strokePath(ctx, view, [START_POSE, ...LOOP_ROUTE.map(([x, y]) => ({ x, y }))]);
  ctx.setLineDash([]);

  // Láser desde la pose real
  const scan = sim.pending ? sim.pending.scan : sim.lastScan;
  if (scan) {
    const revisited = new Set(sim.pending ? sim.pending.revisitedBeams : []);
    ctx.lineWidth = 1;
    for (const point of scanEndpoints(sim.truePose, scan)) {
      const color = revisited.has(point.beam) ? theme.warn : theme.scan;
      ctx.strokeStyle = color;
      ctx.globalAlpha = revisited.has(point.beam) ? 0.9 : 0.35;
      ctx.beginPath();
      ctx.moveTo(view.x(sim.truePose.x), view.y(sim.truePose.y));
      ctx.lineTo(view.x(point.x), view.y(point.y));
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = color;
      ctx.fillRect(view.x(point.x) - 2, view.y(point.y) - 2, 4, 4);
    }
  }

  // Árbol de trayectorias: con el tiempo, todas convergen en un antepasado común
  if (showAllTrajectories) {
    ctx.strokeStyle = theme.particle;
    ctx.globalAlpha = Math.max(0.06, 2 / particles.length);
    ctx.lineWidth = 1;
    for (const p of particles) strokePath(ctx, view, p.trajectoryPoints());
    ctx.globalAlpha = 1;
  }

  // Odometría (discontinua) y robot real
  ctx.lineWidth = 2;
  ctx.strokeStyle = theme.odometry;
  ctx.setLineDash([6, 4]);
  strokePath(ctx, view, sim.odometryTrail);
  ctx.setLineDash([]);
  ctx.strokeStyle = theme.truth;
  strokePath(ctx, view, sim.trueTrail);
  drawRobot(ctx, view, sim.odometryPose, theme.odometry, 0.14);
  drawRobot(ctx, view, sim.truePose, theme.truth, 0.18);

  // Partícula seleccionada: su trayectoria y un círculo alrededor
  ctx.strokeStyle = theme.particle;
  ctx.lineWidth = 2;
  strokePath(ctx, view, selected.trajectoryPoints());
  for (const p of particles) {
    drawParticle(ctx, view, p.pose, theme.particle, 0.12 + 0.88 * p.weight / maxWeight);
  }
  ctx.strokeStyle = theme.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(view.x(selected.pose.x), view.y(selected.pose.y), 13, 0, 2 * Math.PI);
  ctx.stroke();
}

/** Mapa de una partícula con su trayectoria y el último escaneo visto desde su pose. */
export function drawParticleMap(canvas, sim, particle, { showRealWalls }, theme) {
  const ctx = canvas.getContext('2d');
  const view = new Projection(canvas);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(gridToImage(particle.map), 0, 0, canvas.width, canvas.height);

  if (showRealWalls) {
    ctx.globalAlpha = 0.6;
    drawWalls(ctx, view, theme.odometry, 1.5);
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = theme.particle;
  ctx.lineWidth = 2;
  strokePath(ctx, view, particle.trajectoryPoints());

  const scan = sim.pending ? sim.pending.scan : sim.lastScan;
  if (scan) {
    ctx.fillStyle = sim.pending ? theme.warn : theme.scan;
    for (const point of scanEndpoints(particle.pose, scan)) {
      ctx.fillRect(view.x(point.x) - 2.5, view.y(point.y) - 2.5, 5, 5);
    }
  }
  drawRobot(ctx, view, particle.pose, theme.particle, 0.16);
}

/** Miniatura del mapa de una partícula con un punto en su pose. */
export function drawThumbnail(canvas, particle, theme) {
  const ctx = canvas.getContext('2d');
  const view = new Projection(canvas);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(gridToImage(particle.map), 0, 0, canvas.width, canvas.height);
  ctx.fillStyle = theme.particle;
  ctx.beginPath();
  ctx.arc(view.x(particle.pose.x), view.y(particle.pose.y), 3, 0, 2 * Math.PI);
  ctx.fill();
}

/** Gráfica de Neff/N con el umbral N/2, las marcas de remuestreo y el paso del cierre. */
export function drawNeffChart(canvas, sim, theme) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const history = sim.neffHistory;
  const span = Math.max(history.length, 60);
  const px = (step) => 4 + (width - 8) * step / (span - 1);
  const py = (ratio) => height - 6 - (height - 12) * ratio;

  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = theme.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const ratio of [0, 1]) {
    ctx.moveTo(0, py(ratio));
    ctx.lineTo(width, py(ratio));
  }
  ctx.stroke();

  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = theme.muted;
  ctx.beginPath();
  ctx.moveTo(0, py(0.5));
  ctx.lineTo(width, py(0.5));
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = theme.warn;
  for (const step of sim.resampleSteps) ctx.fillRect(px(step) - 1, height - 5, 2, 5);
  if (sim.closureStep > 0) {
    ctx.strokeStyle = theme.warn;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px(sim.closureStep), 0);
    ctx.lineTo(px(sim.closureStep), height);
    ctx.stroke();
  }

  ctx.strokeStyle = theme.particle;
  ctx.lineWidth = 2;
  ctx.beginPath();
  history.forEach((ratio, step) => {
    if (step === 0) ctx.moveTo(px(step), py(ratio));
    else ctx.lineTo(px(step), py(ratio));
  });
  ctx.stroke();
  if (history.length) {
    const last = history.length - 1;
    ctx.fillStyle = theme.particle;
    ctx.beginPath();
    ctx.arc(px(last), py(history[last]), 3.5, 0, 2 * Math.PI);
    ctx.fill();
  }
}
