// ===================== Núcleo de simulación VFF / VFH =====================
const Sim = (() => {
  const CS = 0.1;            // tamaño de celda (m)
  const GW = 80, GH = 56;    // rejilla 8 m x 5.6 m
  const WW = GW * CS, WH = GH * CS;
  const NSEC = 72, ALPHA = 360 / NSEC;   // sectores de 5°
  const RR = 0.2;            // radio del robot (m)
  const D2R = Math.PI / 180;
  const CMAX = 15;

  const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mod = (a, n) => ((a % n) + n) % n;

  function mulberry(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  let rng = mulberry(12345);
  function gauss() {
    let u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  const defaults = {
    vmax: 0.6, wmax: 90, kw: 2.5, hz: 10, lag: 0.4,
    Ws: 33, range: 2.0, nrays: 48, noise: 0.02, spurious: 0.02, known: false,
    Fct: 1.0, Fcr: 0.003,
    tau: 150, l: 5, smax: 16, hm: 1200, footprint: true, fp: 1.0, beyond: true,
  };

  // ---------------- mundo ----------------
  function makeWorld() {
    return { occ: new Uint8Array(GW * GH), start: { x: 1, y: 2.8, th: 0 }, target: { x: 7, y: 2.8 } };
  }
  const idx = (i, j) => j * GW + i;
  function cellAt(x, y) {
    const i = Math.floor(x / CS), j = Math.floor(y / CS);
    if (i < 0 || j < 0 || i >= GW || j >= GH) return -1;
    return idx(i, j);
  }
  function border(w) {
    for (let i = 0; i < GW; i++) { w.occ[idx(i, 0)] = 1; w.occ[idx(i, GH - 1)] = 1; }
    for (let j = 0; j < GH; j++) { w.occ[idx(0, j)] = 1; w.occ[idx(GW - 1, j)] = 1; }
  }
  function rect(w, x0, y0, x1, y1, v = 1) {
    const i0 = Math.round(x0 / CS), i1 = Math.round(x1 / CS), j0 = Math.round(y0 / CS), j1 = Math.round(y1 / CS);
    for (let j = Math.max(0, j0); j < Math.min(GH, j1); j++)
      for (let i = Math.max(0, i0); i < Math.min(GW, i1); i++) w.occ[idx(i, j)] = v;
  }
  function disk(w, cx, cy, r, v = 1) {
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
      const x = (i + 0.5) * CS, y = (j + 0.5) * CS;
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) w.occ[idx(i, j)] = v;
    }
  }

  // Escenarios (coordenadas en metros, y hacia abajo en pantalla)
  const presets = {
    muro: {
      name: 'Muro frente al objetivo',
      build(w) {
        rect(w, 4.0, 1.4, 4.2, 4.2);
        w.start = { x: 1.0, y: 2.8, th: 0 }; w.target = { x: 7.0, y: 2.8 };
      },
    },
    trampaU: {
      name: 'Trampa en U',
      build(w) {
        rect(w, 3.4, 1.5, 5.6, 1.7);
        rect(w, 3.4, 3.9, 5.6, 4.1);
        rect(w, 5.4, 1.5, 5.6, 4.1);
        w.start = { x: 1.0, y: 2.8, th: 0 }; w.target = { x: 7.0, y: 2.8 };
      },
    },
    puerta: {
      name: 'Pasar por una puerta',
      build(w) {
        rect(w, 3.9, 0, 4.1, 2.4);
        rect(w, 3.9, 3.2, 4.1, WH);
        w.start = { x: 1.0, y: 1.2, th: 0 }; w.target = { x: 6.6, y: 4.3 };
      },
    },
    pasillo: {
      name: 'Pasillo estrecho',
      build(w) {
        rect(w, 2.0, 0, 6.8, 2.1);
        rect(w, 2.0, 3.5, 6.8, WH);
        w.start = { x: 0.6, y: 1.4, th: 0 }; w.target = { x: 7.4, y: 2.8 };
      },
    },
    bosque: {
      name: 'Campo de obstáculos',
      build(w) {
        const r = mulberry(w.forestSeed || 3);
        let n = 0, tries = 0;
        while (n < 15 && tries < 500) {
          tries++;
          const cx = 1.8 + r() * 4.6, cy = 0.6 + r() * 4.4, rad = 0.12 + r() * 0.2;
          if (Math.hypot(cx - 0.8, cy - 2.8) < 1 || Math.hypot(cx - 7.2, cy - 2.8) < 0.8) continue;
          if (r() < 0.5) disk(w, cx, cy, rad); else rect(w, cx - rad, cy - rad, cx + rad, cy + rad);
          n++;
        }
        w.start = { x: 0.8, y: 2.8, th: 0 }; w.target = { x: 7.2, y: 2.8 };
      },
    },
    oficina: {
      name: 'Oficina (dos salas, dos puertas)',
      build(w) {
        // tabique con una puerta ancha (arriba) y una estrecha (abajo)
        rect(w, 4.0, 0, 4.2, 0.9);
        rect(w, 4.0, 2.1, 4.2, 3.9);
        rect(w, 4.0, 4.6, 4.2, WH);
        // mobiliario
        rect(w, 1.6, 2.2, 2.6, 2.8);
        rect(w, 0.6, 4.2, 1.4, 5.0);
        rect(w, 5.6, 0.8, 6.6, 1.4);
        disk(w, 6.0, 3.3, 0.3);
        w.start = { x: 0.8, y: 1.2, th: 0 }; w.target = { x: 6.8, y: 4.3 };
      },
    },
    vacio: {
      name: 'Vacío (pinta tus obstáculos)',
      build(w) { w.start = { x: 1.0, y: 2.8, th: 0 }; w.target = { x: 7.0, y: 2.8 }; },
    },
  };

  function loadPreset(w, key) {
    w.occ.fill(0);
    border(w);
    presets[key].build(w);
  }

  // ---------------- robot ----------------
  function makeRobot(alg, s) {
    return {
      alg, x: s.x, y: s.y, th: s.th, grid: new Float32Array(GW * GH),
      cmd: undefined, ctrlT: 0,
      trail: [[s.x, s.y]], t: 0, dist: 0, v: 0, w: 0, state: 'run', stuck: false,
      collisions: 0, posLog: [], rays: [], forces: null, hist: null, lastTrail: 0,
      flips: 0, lastSign: 0,
    };
  }
  function resetRobot(r, s) { Object.assign(r, makeRobot(r.alg, s)); }

  function collides(w, x, y) {
    if (x < RR || y < RR || x > WW - RR || y > WH - RR) return true;
    const i0 = Math.floor((x - RR) / CS), i1 = Math.floor((x + RR) / CS);
    const j0 = Math.floor((y - RR) / CS), j1 = Math.floor((y + RR) / CS);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      if (i < 0 || j < 0 || i >= GW || j >= GH) return true;
      if (!w.occ[idx(i, j)]) continue;
      const nx = clamp(x, i * CS, (i + 1) * CS), ny = clamp(y, j * CS, (j + 1) * CS);
      if ((nx - x) ** 2 + (ny - y) ** 2 < RR * RR) return true;
    }
    return false;
  }

  // Sensor de rango (anillo de N haces) + mapa HIMM (+3 en el impacto, -1 a lo largo del haz)
  function sense(r, w, P) {
    r.rays.length = 0;
    const n = P.nrays, step = 0.02;
    if (P.known) for (let k = 0; k < w.occ.length; k++) r.grid[k] = w.occ[k] ? CMAX : 0;
    for (let k = 0; k < n; k++) {
      const a = r.th + k * 2 * Math.PI / n;
      const ca = Math.cos(a), sa = -Math.sin(a);
      let hitD = P.range, hit = false;
      for (let s = step; s <= P.range; s += step) {
        const c = cellAt(r.x + ca * s, r.y + sa * s);
        if (c < 0 || w.occ[c]) { hitD = s; hit = true; break; }
      }
      let m = hitD;
      if (hit) m += gauss() * P.noise;
      if (rng() < P.spurious && hitD > 0.2) { m = 0.15 + rng() * (hitD - 0.2); hit = true; }   // eco espurio (más corto que el real)
      m = clamp(m, 0.05, P.range);
      const isHit = hit && m < P.range;
      r.rays.push([a, m, isHit]);
      if (P.known) continue;
      const hc = isHit ? cellAt(r.x + ca * m, r.y + sa * m) : -2;
      let last = -3;
      for (let s = 0; s < m; s += CS * 0.4) {
        const c = cellAt(r.x + ca * s, r.y + sa * s);
        if (c >= 0 && c !== last && c !== hc) { r.grid[c] = Math.max(0, r.grid[c] - 1); last = c; }
      }
      if (hc >= 0) r.grid[hc] = Math.min(CMAX, r.grid[hc] + 3);
    }
  }

  function forWindow(r, P, fn, tgt) {
    const h = (P.Ws - 1) / 2;
    const lim = P.beyond && tgt ? (Math.hypot(tgt.x - r.x, tgt.y - r.y) + 0.3) ** 2 : Infinity;
    const ci = Math.floor(r.x / CS), cj = Math.floor(r.y / CS);
    for (let j = cj - h; j <= cj + h; j++) {
      if (j < 0 || j >= GH) continue;
      for (let i = ci - h; i <= ci + h; i++) {
        if (i < 0 || i >= GW) continue;
        const c = r.grid[idx(i, j)];
        if (c <= 0) continue;
        const x = (i + 0.5) * CS, y = (j + 0.5) * CS;
        if ((x - r.x) ** 2 + (y - r.y) ** 2 > lim) continue;
        fn(x, y, c);
      }
    }
  }

  // ---------------- VFF ----------------
  function vff(r, w, P) {
    let frx = 0, fry = 0;
    forWindow(r, P, (cx, cy, c) => {
      const dx = r.x - cx, dy = r.y - cy;
      const d = Math.max(Math.hypot(dx, dy), 0.05);
      const f = P.Fcr * c / (d * d);
      frx += f * dx / d; fry += f * dy / d;
    }, w.target);
    const tx = w.target.x - r.x, ty = w.target.y - r.y, dt = Math.max(Math.hypot(tx, ty), 1e-6);
    const ftx = P.Fct * tx / dt, fty = P.Fct * ty / dt;
    const Rx = ftx + frx, Ry = fty + fry, Rm = Math.hypot(Rx, Ry);
    r.forces = { ft: [ftx, fty], fr: [frx, fry], R: [Rx, Ry] };
    return { theta: Math.atan2(-Ry, Rx), vscale: Math.min(1, Rm / P.Fct) };
  }

  // ---------------- VFH ----------------
  const secAngle = s => (s + 0.5) * ALPHA * D2R;  // ángulo (rad) del centro del sector s (puede ser fraccionario)
  const secOf = a => mod(Math.floor(mod(a / D2R, 360) / ALPHA), NSEC);
  const cdist = (a, b) => { const d = mod(a - b, NSEC); return Math.min(d, NSEC - d); };

  function vfh(r, w, P) {
    const h = new Float64Array(NSEC), hs = new Float64Array(NSEC);
    const dmax = (P.Ws - 1) / 2 * Math.SQRT2 * CS;
    forWindow(r, P, (cx, cy, c) => {
      const dx = cx - r.x, dy = cy - r.y, d = Math.hypot(dx, dy);
      const m = c * c * (dmax - d);           // m = c² (a - b·d), con b = 1, a = dmax
      if (m <= 0) return;
      const beta = Math.atan2(-dy, dx);
      if (P.footprint) {
        // la celda ocupa un ángulo ±atan(CS/2 / d): se suma a todos los sectores que cubre
        const rad = CS * P.fp;
        const hw = d > rad ? Math.asin(rad / d) : Math.PI / 2;
        const k0 = Math.floor(mod((beta - hw) / D2R, 360) / ALPHA);
        const n = Math.max(1, Math.floor(2 * hw / D2R / ALPHA) + 1);
        for (let q = 0; q < n; q++) h[mod(k0 + q, NSEC)] += m;
      } else h[secOf(beta)] += m;
    }, w.target);
    const l = P.l;
    let wsum = 0; for (let i = -l; i <= l; i++) wsum += l + 1 - Math.abs(i);
    for (let k = 0; k < NSEC; k++) {
      let s = 0;
      for (let i = -l; i <= l; i++) s += (l + 1 - Math.abs(i)) * h[mod(k + i, NSEC)];
      hs[k] = s / wsum;
    }
    const free = Array.from(hs, v => v < P.tau);
    const tx = w.target.x - r.x, ty = w.target.y - r.y;
    const tAng = Math.atan2(-ty, tx);
    const kt = secOf(tAng);

    // valles (rachas circulares de sectores libres)
    const valleys = [];
    const b0 = free.indexOf(false);
    if (b0 >= 0) {
      let k = 0;
      while (k < NSEC) {
        const s = mod(b0 + 1 + k, NSEC);
        if (free[s]) {
          let len = 0;
          while (k < NSEC && free[mod(b0 + 1 + k, NSEC)]) { len++; k++; }
          valleys.push({ start: s, len });
        } else k++;
      }
    }

    let theta = null, sel = null, mode = '';
    if (b0 < 0) { theta = tAng; mode = 'todo libre'; }
    else if (valleys.length) {
      const inV = v => mod(kt - v.start, NSEC) < v.len;
      let V = valleys.find(inV);
      if (V) {
        const dS = mod(kt - V.start, NSEC), dE = V.len - 1 - dS;
        if (V.len > P.smax) {
          if (dS >= P.smax / 2 && dE >= P.smax / 2) { theta = tAng; mode = 'directo al objetivo'; }
          else if (dS < dE) { theta = secAngle(V.start + P.smax / 2); mode = 'valle ancho (borde)'; }
          else { theta = secAngle(V.start + V.len - 1 - P.smax / 2); mode = 'valle ancho (borde)'; }
        } else { theta = secAngle(V.start + (V.len - 1) / 2); mode = 'valle estrecho (centro)'; }
        sel = V;
      } else {
        let best = null, bd = 1e9, bside = 0;
        for (const v of valleys) {
          const e = v.start + v.len - 1;
          const d1 = cdist(kt, v.start), d2 = cdist(kt, e);
          if (d1 < bd) { bd = d1; best = v; bside = 0; }
          if (d2 < bd) { bd = d2; best = v; bside = 1; }
        }
        sel = best;
        if (best.len > P.smax) {
          theta = bside === 0 ? secAngle(best.start + P.smax / 2) : secAngle(best.start + best.len - 1 - P.smax / 2);
          mode = 'valle ancho (borde)';
        } else { theta = secAngle(best.start + (best.len - 1) / 2); mode = 'valle estrecho (centro)'; }
      }
    }
    const hc = hs[secOf(r.th)];
    r.hist = { h, hs, free, kt, theta, valleys, sel, mode, hc };
    return { theta, vscale: 1 - Math.min(hc, P.hm) / P.hm };
  }

  // ---------------- paso de simulación ----------------
  function step(r, w, P, dt) {
    if (r.state === 'goal') { r.v = r.w = 0; return; }
    const wmax = P.wmax * D2R;
    // ciclo de control a frecuencia finita (sensores + decisión)
    r.ctrlT = (r.ctrlT || 0) + dt;
    if (r.cmd === undefined || r.ctrlT >= 1 / P.hz - 1e-9) {
      r.ctrlT = 0;
      sense(r, w, P);
      const dec = r.alg === 'VFF' ? vff(r, w, P) : vfh(r, w, P);
      if (dec.theta === null) { r.cmd = { v: 0, w: wmax }; r.state = 'novalley'; }
      else {
        r.state = 'run';
        const err = wrap(dec.theta - r.th);
        r.cmd = { v: P.vmax * dec.vscale * Math.max(0, Math.cos(err)), w: clamp(P.kw * err, -wmax, wmax) };
      }
    }
    // dinámica de primer orden (inercia) en v y ω
    const a = P.lag > 0 ? Math.min(1, dt / P.lag) : 1;
    let v = r.v + (r.cmd.v - r.v) * a;
    const om = r.w + (r.cmd.w - r.w) * a;
    // contador de cambios de sentido de giro (indicador de oscilación)
    const sg = Math.abs(om) > 0.15 ? Math.sign(om) : 0;
    if (sg !== 0) { if (r.lastSign !== 0 && sg !== r.lastSign) r.flips++; r.lastSign = sg; }

    const nth = wrap(r.th + om * dt);
    const nx = r.x + v * Math.cos(nth) * dt, ny = r.y - v * Math.sin(nth) * dt;
    r.th = nth;
    r.colliding = false;
    let mx = nx, my = ny;
    if (v > 0 && collides(w, mx, my)) {
      r.collisions++; r.colliding = true;
      // deslizamiento: intenta moverse sólo en x o sólo en y
      if (!collides(w, nx, r.y)) { mx = nx; my = r.y; }
      else if (!collides(w, r.x, ny)) { mx = r.x; my = ny; }
      else { mx = r.x; my = r.y; v = 0; }
    }
    r.dist += Math.hypot(mx - r.x, my - r.y); r.x = mx; r.y = my;
    r.v = v; r.w = om; r.t += dt;

    const lt = r.trail[r.trail.length - 1];
    if (Math.hypot(r.x - lt[0], r.y - lt[1]) > 0.02) { r.trail.push([r.x, r.y]); if (r.trail.length > 6000) r.trail.shift(); }

    if (Math.hypot(w.target.x - r.x, w.target.y - r.y) < 0.2) { r.state = 'goal'; r.stuck = false; r.v = r.w = 0; return; }

    // detección de atasco: en los últimos 6 s no se ha alejado más de 0.35 m
    if (r.t - (r.posLog.length ? r.posLog[r.posLog.length - 1][0] : -1) >= 0.5) {
      r.posLog.push([r.t, r.x, r.y]);
      while (r.posLog.length && r.posLog[0][0] < r.t - 6) r.posLog.shift();
    }
    if (r.t > 6 && r.posLog.length > 8) {
      let maxd = 0;
      for (const p of r.posLog) maxd = Math.max(maxd, Math.hypot(p[1] - r.x, p[2] - r.y));
      r.stuck = maxd < 0.35;
    } else r.stuck = false;
  }

  function seed(s) { rng = mulberry(s); }

  return {
    CS, GW, GH, WW, WH, NSEC, ALPHA, RR, CMAX, D2R, defaults, presets,
    makeWorld, loadPreset, makeRobot, resetRobot, step, collides, cellAt, idx, secOf, secAngle, seed, wrap,
  };
})();
if (typeof module !== 'undefined') module.exports = Sim;
