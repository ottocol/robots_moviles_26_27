(() => {
  const { CS, GW, GH, WW, WH, NSEC, ALPHA, RR, CMAX, D2R } = Sim;
  const $ = s => document.querySelector(s);
  const COL = { VFF: '#2563eb', VFH: '#b62fd0', goal: '#16a34a', ft: '#16a34a', fr: '#dc2626', R: '#1b1f2c' };

  const HINTS = {
    muro: ['Mínimo local frente a un muro', 'Muro simétrico entre robot y objetivo. En VFF, delante del muro la atracción y la repulsión se anulan (|R| ≈ 0): el robot frena y se queda parado en un mínimo local. VFH ve dos valles, por encima y por debajo del muro, elige uno y lo rodea.'],
    trampaU: ['Trampa en U', 'La U está abierta hacia el robot. Los dos métodos son locales: solo ven la ventana activa, así que entran en la U y quedan atrapados (VFH puede quedarse dando vueltas dentro). Aquí ni siquiera el seguimiento de paredes del artículo de 1989 basta: al salir de la U, la pared de la sala queda dentro de la ventana activa y el robot acaba siguiéndola. Prueba la «Trampa pequeña», donde sí funciona.'],
    trampaPeq: ['Recuperación de trampas (seguimiento de paredes)', 'Trampa pequeña en U. VFF básico se queda dentro. Activa «Seguimiento de paredes» en los parámetros de VFF: cuando el rumbo se desvía más de 90° del objetivo (ec. 12), el robot sustituye la atracción del objetivo por una fuerza virtual F″t girada δ = 145° respecto a Fr, bordea el obstáculo y, al volver a menos de 90°, retoma VFF. En la flecha verde discontinua se ve F″t.'],
    puerta: ['Dificultad para pasar por puertas', 'Puerta de 0,8 m para un robot de 0,4 m de diámetro. En VFF, las dos jambas empujan a la vez y la resultante aparta al robot del hueco: no consigue entrar. VFH encuentra un valle estrecho y apunta a su centro. Prueba a bajar F_cr hasta que VFF consiga pasar, o a bajar τ / subir l hasta que el hueco desaparezca del histograma de VFH.'],
    pasillo: ['Oscilaciones en un pasillo', 'Pasillo de 1,4 m. VFF entra, pero zigzaguea de pared a pared: en cuanto se desvía del centro, la fuerza lateral crece con 1/d² y lo devuelve con demasiada fuerza. Sube la velocidad máxima a ~1 m/s o la inercia (en «Robot, sensor y rejilla») y la oscilación crece. Activa el amortiguamiento de Fr (ec. 8) y compara: el zigzag casi desaparece, a costa de pasar más cerca de las paredes. VFH sigue el centro del valle con una trayectoria mucho más suave.'],
    bosque: ['Campo de obstáculos', 'Obstáculos dispersos. En VFF cada obstáculo cercano tuerce la resultante: el robot da bandazos (mira el contador de cambios de giro) y puede quedarse encajado entre dos obstáculos. VFH elige huecos entre ellos y avanza más recto. «Nuevo bosque» genera otra distribución.'],
    oficina: ['Dos salas, dos puertas', 'Una puerta ancha (arriba) y otra estrecha (abajo). Mueve el objetivo por la sala derecha y observa qué puerta intenta usar cada método… y si lo consigue.'],
    vacio: ['Mapa libre', 'Pinta tus propios obstáculos (clic derecho borra). Ideas: un muro con un hueco, un pasillo en L, una trampa en V. Prueba también a desactivar «Ignorar obstáculos más lejanos que el objetivo» y a dejar el objetivo cerca de una pared: el obstáculo de detrás impide llegar.'],
  };

  // ------------------------------------------------------------------ estado
  const world = Sim.makeWorld();
  let presetKey = 'puerta';
  const P = Object.assign({}, Sim.defaults);
  let algMode = 'Ambos';
  let robots = [];
  let running = false, simSpeed = 1, tool = 'paint', brush = 1;
  const show = { real: true, cert: true, win: true, rays: false, forces: true, polar: true, trail: true };

  function buildRobots() {
    const algs = algMode === 'Ambos' ? ['VFF', 'VFH'] : [algMode];
    robots = algs.map(a => Sim.makeRobot(a, world.start));
    Sim.seed(1);
  }
  function resetRobots() { robots.forEach(r => Sim.resetRobot(r, world.start)); Sim.seed(1); }
  function loadPreset(key) {
    presetKey = key;
    if (key === 'bosque') world.forestSeed = undefined;
    Sim.loadPreset(world, key);
    buildRobots();
    setRunning(false);
    $('#hintTitle').textContent = HINTS[key][0];
    $('#hintText').textContent = HINTS[key][1];
    $('#forestBtn').style.display = key === 'bosque' ? '' : 'none';
  }

  // ------------------------------------------------------------------ canvas mundo
  const cv = $('#world'), ctx = cv.getContext('2d');
  let S = 100, dpr = 1; // px CSS por metro
  function resize() {
    dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth || 800;
    S = w / WW;
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(w * WH / WW * dpr);
    cv.style.height = (w * WH / WW) + 'px';
    const hc = $('#histo');
    hc.width = Math.round(hc.clientWidth * dpr); hc.height = Math.round(hc.clientHeight * dpr);
  }
  window.addEventListener('resize', resize);

  const px = n => n / S; // grosor en px → metros

  function arrow(x0, y0, x1, y1, color, width, head = 0.09, dash) {
    const a = Math.atan2(y1 - y0, x1 - x0), L = Math.hypot(x1 - x0, y1 - y0);
    if (L < 0.01) return;
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = px(width);
    ctx.setLineDash(dash ? dash.map(px) : []);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - Math.cos(a) * head * 0.6, y1 - Math.sin(a) * head * 0.6); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - head * Math.cos(a - 0.4), y1 - head * Math.sin(a - 0.4));
    ctx.lineTo(x1 - head * Math.cos(a + 0.4), y1 - head * Math.sin(a + 0.4));
    ctx.closePath(); ctx.fill();
  }
  function label(t, x, y, color, size = 12, align = 'left') {
    ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = `600 ${size}px Jost, sans-serif`; ctx.textAlign = align; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.strokeText(t, x * S, y * S);
    ctx.fillStyle = color; ctx.fillText(t, x * S, y * S); ctx.restore();
  }

  function draw() {
    ctx.setTransform(dpr * S, 0, 0, dpr * S, 0, 0);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, WW, WH);
    // rejilla
    ctx.lineWidth = px(1);
    ctx.strokeStyle = '#eef1f7'; ctx.beginPath();
    for (let i = 1; i < GW; i++) { ctx.moveTo(i * CS, 0); ctx.lineTo(i * CS, WH); }
    for (let j = 1; j < GH; j++) { ctx.moveTo(0, j * CS); ctx.lineTo(WW, j * CS); }
    ctx.stroke();
    ctx.strokeStyle = '#dde2ee'; ctx.beginPath();
    for (let i = 10; i < GW; i += 10) { ctx.moveTo(i * CS, 0); ctx.lineTo(i * CS, WH); }
    for (let j = 10; j < GH; j += 10) { ctx.moveTo(0, j * CS); ctx.lineTo(WW, j * CS); }
    ctx.stroke();

    // obstáculos reales
    if (show.real) {
      ctx.fillStyle = '#a9b0bf';
      for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++)
        if (world.occ[j * GW + i]) ctx.fillRect(i * CS, j * CS, CS + 0.002, CS + 0.002);
    }
    // valores de certeza (máximo de los robots activos)
    if (show.cert) {
      const ins = 0.012;
      for (let k = 0; k < GW * GH; k++) {
        let c = 0;
        for (const r of robots) if (r.grid[k] > c) c = r.grid[k];
        if (c <= 0) continue;
        ctx.fillStyle = `rgba(234,106,12,${0.18 + 0.8 * c / CMAX})`;
        ctx.fillRect((k % GW) * CS + ins, Math.floor(k / GW) * CS + ins, CS - 2 * ins, CS - 2 * ins);
      }
    }
    // inicio
    const s = world.start;
    ctx.strokeStyle = '#9aa1b2'; ctx.lineWidth = px(1.5); ctx.setLineDash([px(4), px(3)]);
    ctx.beginPath(); ctx.arc(s.x, s.y, RR, 0, 2 * Math.PI); ctx.stroke(); ctx.setLineDash([]);
    arrow(s.x, s.y, s.x + Math.cos(s.th) * RR * 1.4, s.y - Math.sin(s.th) * RR * 1.4, '#9aa1b2', 1.5, 0.07);

    for (const r of robots) {
      const col = COL[r.alg];
      // ventana activa
      if (show.win) {
        const h = (P.Ws - 1) / 2, ci = Math.floor(r.x / CS), cj = Math.floor(r.y / CS);
        ctx.strokeStyle = col; ctx.globalAlpha = 0.55; ctx.lineWidth = px(1.3); ctx.setLineDash([px(6), px(4)]);
        ctx.strokeRect((ci - h) * CS, (cj - h) * CS, P.Ws * CS, P.Ws * CS);
        ctx.setLineDash([]); ctx.globalAlpha = 1;
      }
      // haces del sensor
      if (show.rays && r.rays.length) {
        ctx.strokeStyle = col; ctx.globalAlpha = 0.18; ctx.lineWidth = px(1);
        ctx.beginPath();
        for (const [a, m] of r.rays) { ctx.moveTo(r.x, r.y); ctx.lineTo(r.x + Math.cos(a) * m, r.y - Math.sin(a) * m); }
        ctx.stroke(); ctx.globalAlpha = 0.8; ctx.fillStyle = col;
        for (const [a, m, hit] of r.rays) if (hit) { ctx.beginPath(); ctx.arc(r.x + Math.cos(a) * m, r.y - Math.sin(a) * m, px(2), 0, 7); ctx.fill(); }
        ctx.globalAlpha = 1;
      }
      // trayectoria
      if (show.trail && r.trail.length > 1) {
        ctx.strokeStyle = col; ctx.lineWidth = px(2.2); ctx.globalAlpha = 0.85; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(r.trail[0][0], r.trail[0][1]);
        for (const p of r.trail) ctx.lineTo(p[0], p[1]);
        ctx.lineTo(r.x, r.y); ctx.stroke(); ctx.globalAlpha = 1;
      }
    }

    // histograma polar VFH alrededor del robot
    for (const r of robots) {
      if (r.alg !== 'VFH' || !show.polar || !r.hist || r.state === 'goal') continue;
      const H = r.hist, r0 = RR + 0.03, Lmax = 1.0, scale = 0.5 / P.tau;
      for (let k = 0; k < NSEC; k++) {
        const L = Math.min(H.hs[k] * scale, Lmax);
        const a0 = k * ALPHA * D2R, a1 = (k + 1) * ALPHA * D2R;
        const blocked = !H.free[k];
        ctx.fillStyle = blocked ? 'rgba(182,47,208,.33)' : 'rgba(120,130,150,.16)';
        ctx.beginPath();
        ctx.arc(r.x, r.y, r0 + Math.max(L, 0.03), -a0, -a1, true);
        ctx.arc(r.x, r.y, r0, -a1, -a0, false);
        ctx.closePath(); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(220,38,38,.75)'; ctx.lineWidth = px(1.2); ctx.setLineDash([px(4), px(3)]);
      ctx.beginPath(); ctx.arc(r.x, r.y, r0 + 0.5, 0, 2 * Math.PI); ctx.stroke(); ctx.setLineDash([]);
      const ta = Math.atan2(-(world.target.y - r.y), world.target.x - r.x);
      arrow(r.x, r.y, r.x + Math.cos(ta) * 1.0, r.y - Math.sin(ta) * 1.0, COL.goal, 1.6, 0.08, [5, 4]);
      if (H.theta !== null) arrow(r.x, r.y, r.x + Math.cos(H.theta) * 1.15, r.y - Math.sin(H.theta) * 1.15, COL.VFH, 3, 0.12);
    }

    // fuerzas VFF
    for (const r of robots) {
      if (r.alg !== 'VFF' || !show.forces || !r.forces || r.state === 'goal') continue;
      const k = 0.7 / P.Fct, cap = 2.2;
      const vec = ([fx, fy]) => { const m = Math.hypot(fx, fy), L = Math.min(m * k, cap); return m > 1e-9 ? [fx / m * L, fy / m * L] : [0, 0]; };
      const ft = vec(r.forces.ft), fr = vec(r.forces.fr), R = vec(r.forces.R);
      arrow(r.x, r.y, r.x + ft[0], r.y + ft[1], COL.ft, 2.2, 0.09, r.forces.virtual ? [6, 4] : null);
      arrow(r.x, r.y, r.x + fr[0], r.y + fr[1], COL.fr, 2.2, 0.09);
      arrow(r.x, r.y, r.x + R[0], r.y + R[1], COL.R, 3.2, 0.12);
      label(r.forces.virtual ? 'F″t' : 'Ft', r.x + ft[0] * 1.08 + 0.05, r.y + ft[1] * 1.08, COL.ft, 13);
      if (Math.hypot(...fr) > 0.08) label(P.damp ? "F'r" : 'Fr', r.x + fr[0] * 1.08 + 0.05, r.y + fr[1] * 1.08, COL.fr, 13);
      if (Math.hypot(...R) > 0.08) label('R', r.x + R[0] * 1.08 + 0.05, r.y + R[1] * 1.08, COL.R, 13);
    }

    // objetivo
    const t = world.target;
    ctx.fillStyle = 'rgba(22,163,74,.15)'; ctx.beginPath(); ctx.arc(t.x, t.y, 0.2, 0, 7); ctx.fill();
    ctx.fillStyle = COL.goal; ctx.beginPath(); ctx.arc(t.x, t.y, 0.08, 0, 7); ctx.fill();
    ctx.strokeStyle = COL.goal; ctx.lineWidth = px(2); ctx.beginPath(); ctx.arc(t.x, t.y, 0.14, 0, 7); ctx.stroke();
    label('Objetivo', t.x, t.y - 0.3, COL.goal, 13, 'center');

    // robots
    robots.forEach((r, n) => {
      const col = COL[r.alg];
      ctx.fillStyle = r.colliding ? '#f6c3c3' : '#a7cfd1';
      ctx.strokeStyle = r.colliding ? COL.fr : col; ctx.lineWidth = px(2.5);
      ctx.beginPath(); ctx.arc(r.x, r.y, RR, 0, 7); ctx.fill(); ctx.stroke();
      // ruedas
      ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(-r.th);
      ctx.fillStyle = '#3d4352';
      ctx.fillRect(-0.07, -RR - 0.015, 0.14, 0.04); ctx.fillRect(-0.07, RR - 0.025, 0.14, 0.04);
      ctx.restore();
      arrow(r.x, r.y, r.x + Math.cos(r.th) * RR * 1.05, r.y - Math.sin(r.th) * RR * 1.05, col, 2.5, 0.07);
      const ly = r.y + RR + 0.14 + (robots.length > 1 && n === 1 ? 0.0 : 0);
      label(r.alg, r.x + (robots.length > 1 ? (n === 0 ? -0.16 : 0.16) : 0), ly, col, 12, 'center');
    });
  }

  // ------------------------------------------------------------------ histograma (panel)
  const hcv = $('#histo'), hctx = hcv.getContext('2d');
  function drawHisto() {
    const W = hcv.width / dpr, H = hcv.height / dpr;
    hctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    hctx.clearRect(0, 0, W, H);
    const r = robots.find(q => q.alg === 'VFH');
    $('#histPanel').style.opacity = r ? 1 : 0.45;
    const L = 30, Rm = 8, T = 10, B = 34, pw = W - L - Rm, ph = H - T - B;
    const ymax = P.tau * 3;
    hctx.font = '11px JetBrains Mono, monospace'; hctx.fillStyle = '#646b80'; hctx.textAlign = 'center';
    for (const d of [0, 90, 180, 270, 360]) hctx.fillText(d + '°', L + pw * d / 360, H - 6);
    hctx.strokeStyle = '#c9cede'; hctx.lineWidth = 1;
    hctx.beginPath(); hctx.moveTo(L, T); hctx.lineTo(L, T + ph); hctx.lineTo(L + pw, T + ph); hctx.stroke();
    hctx.save(); hctx.translate(11, T + ph / 2); hctx.rotate(-Math.PI / 2); hctx.fillText("h'(k)", 0, 0); hctx.restore();
    if (!r || !r.hist) {
      hctx.fillStyle = '#646b80'; hctx.textAlign = 'center'; hctx.font = '13px Jost, sans-serif';
      hctx.fillText(r ? 'Inicia la simulación' : 'Selecciona VFH o «Ambos»', L + pw / 2, T + ph / 2);
      return;
    }
    const h = r.hist, bw = pw / NSEC;
    // valles
    hctx.fillStyle = 'rgba(22,163,74,.16)';
    for (let k = 0; k < NSEC; k++) if (h.free[k]) hctx.fillRect(L + k * bw, T, bw + 0.5, ph);
    for (let k = 0; k < NSEC; k++) {
      const v = Math.min(h.hs[k], ymax), bh = ph * v / ymax;
      hctx.fillStyle = h.free[k] ? '#8a93a8' : '#b62fd0';
      hctx.fillRect(L + k * bw + 0.6, T + ph - bh, bw - 1.2, bh);
      if (h.hs[k] > ymax) { hctx.fillStyle = '#b62fd0'; hctx.fillRect(L + k * bw + 0.6, T - 3, bw - 1.2, 2); }
    }
    const ty = T + ph - ph * P.tau / ymax;
    hctx.strokeStyle = '#dc2626'; hctx.setLineDash([5, 4]); hctx.lineWidth = 1.4;
    hctx.beginPath(); hctx.moveTo(L, ty); hctx.lineTo(L + pw, ty); hctx.stroke(); hctx.setLineDash([]);
    hctx.fillStyle = '#dc2626'; hctx.textAlign = 'right'; hctx.fillText('τ', L - 4, ty + 4);
    const tri = (deg, col, y, up = true) => {
      const x = L + pw * (((deg % 360) + 360) % 360) / 360;
      hctx.fillStyle = col; hctx.beginPath();
      hctx.moveTo(x, y); hctx.lineTo(x - 5, y + (up ? 9 : -9)); hctx.lineTo(x + 5, y + (up ? 9 : -9)); hctx.closePath(); hctx.fill();
    };
    const tdeg = Math.atan2(-(world.target.y - r.y), world.target.x - r.x) / D2R;
    tri(tdeg, '#16a34a', T + ph + 2);
    if (h.theta !== null) tri(h.theta / D2R, '#b62fd0', T + ph + 2);
    const hx = L + pw * ((((r.th / D2R) % 360) + 360) % 360) / 360;
    hctx.strokeStyle = '#1b1f2c'; hctx.lineWidth = 2; hctx.beginPath(); hctx.moveTo(hx, T); hctx.lineTo(hx, T + ph); hctx.stroke();
  }

  // ------------------------------------------------------------------ estado (tarjetas)
  function statusOf(r) {
    if (r.state === 'goal') return ['goal', '¡Objetivo alcanzado!'];
    if (r.state === 'novalley') return ['bad', 'Sin valle libre: gira'];
    if (r.stuck) return ['stuck', 'Atascado (¿mínimo local?)'];
    if (r.colliding) return ['bad', '¡Choque!'];
    return ['run', running ? 'Navegando' : 'En pausa'];
  }
  const fmt = (v, d = 2) => (Math.abs(v) < 1e-9 ? 0 : v).toFixed(d);
  function renderStatus() {
    const box = $('#statusBox');
    let html = '';
    for (const r of robots) {
      const [cls, txt] = statusOf(r);
      let extra = '';
      if (r.alg === 'VFF' && r.forces) {
        const m = v => Math.hypot(v[0], v[1]);
        extra = `|F<sub>t</sub>| ${fmt(m(r.forces.ft))} · |F<sub>r</sub>${P.damp ? "'" : ''}| ${fmt(m(r.forces.fr))} · |R| ${fmt(m(r.forces.R))} · cos θ ${fmt(r.forces.cosT)}`;
        if (P.wfm) extra += `<br>modo: ${r.wf.active ? `<b style="color:#16a34a">seguimiento de pared (${r.wf.mode === 'L' ? 'pared a la izquierda, L' : 'pared a la derecha, R'})</b>` : 'VFF normal'}${r.wf.count ? ` · trampas detectadas: ${r.wf.count}` : ''}`;
      }
      if (r.alg === 'VFH' && r.hist) {
        const h = r.hist;
        extra = (h.mode === 'todo libre' ? 'sin obstáculos en la ventana' : `${h.valleys.length} valle${h.valleys.length === 1 ? '' : 's'} · ${h.mode || '—'}`) + (h.theta !== null ? ` · θ=${fmt(((h.theta / D2R) % 360 + 360) % 360, 0)}°` : '');
      }
      html += `<div class="card status" style="border-left:4px solid ${COL[r.alg]}">
        <div class="head"><span class="name" style="color:${COL[r.alg]}">${r.alg}</span><span class="pill ${cls}">${txt}</span></div>
        <div class="nums">t ${fmt(r.t, 1)} s · recorrido ${fmt(r.dist, 1)} m · v ${fmt(r.v)} m/s · ω ${fmt(r.w / D2R, 0)}°/s<br>
        cambios de sentido de giro: ${r.flips}${r.collisions ? ` · contactos: ${r.collisions}` : ''}<br>${extra}</div></div>`;
    }
    if (box.innerHTML !== html) box.innerHTML = html;
  }

  // ------------------------------------------------------------------ simulación
  const DT = 0.05;
  let acc = 0, last = performance.now();
  function stepAll() { for (const r of robots) Sim.step(r, world, P, DT); }
  function setRunning(v) {
    running = v;
    $('#runBtn').textContent = running ? '❚❚ Pausa' : '▶ Iniciar';
  }
  function frame(now) {
    const el = Math.min((now - last) / 1000, 0.1); last = now;
    if (running) {
      acc += el * simSpeed;
      let n = 0;
      while (acc >= DT && n < 200) { stepAll(); acc -= DT; n++; }
      if (robots.every(r => r.state === 'goal')) setRunning(false);
    }
    draw(); drawHisto(); renderStatus();
    requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------------ ratón
  let drag = null;
  function toWorld(e) {
    const b = cv.getBoundingClientRect();
    return { x: (e.clientX - b.left) / b.width * WW, y: (e.clientY - b.top) / b.height * WH };
  }
  function paint(p, val) {
    const ci = Math.floor(p.x / CS), cj = Math.floor(p.y / CS);
    for (let j = cj - brush; j <= cj + brush; j++) for (let i = ci - brush; i <= ci + brush; i++) {
      if (i < 0 || j < 0 || i >= GW || j >= GH) continue;
      const x = (i + 0.5) * CS, y = (j + 0.5) * CS;
      if (val) {
        if (robots.some(r => Math.hypot(r.x - x, r.y - y) < RR + 0.08)) continue;
        if (Math.hypot(world.target.x - x, world.target.y - y) < 0.12) continue;
      }
      const k = j * GW + i;
      world.occ[k] = val;
      if (!val) robots.forEach(r => { r.grid[k] = 0; });
    }
  }
  function placeStart(x, y, th) {
    x = Math.min(Math.max(x, RR + 0.1), WW - RR - 0.1); y = Math.min(Math.max(y, RR + 0.1), WH - RR - 0.1);
    world.start = { x, y, th: th === undefined ? world.start.th : th };
    resetRobots();
  }
  function targetMoved() { robots.forEach(r => { if (r.state === 'goal') r.state = 'run'; r.posLog = []; r.stuck = false; }); }

  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerdown', e => {
    cv.setPointerCapture(e.pointerId);
    const p = toWorld(e);
    if (e.button === 2) { drag = { kind: 'erase' }; paint(p, 0); return; }
    if (Math.hypot(p.x - world.target.x, p.y - world.target.y) < 0.28) { drag = { kind: 'target' }; return; }
    if (robots.some(r => Math.hypot(p.x - r.x, p.y - r.y) < RR + 0.06)) { drag = { kind: 'robotMove' }; placeStart(p.x, p.y); return; }
    if (tool === 'paint') { drag = { kind: 'paint' }; paint(p, 1); }
    else if (tool === 'erase') { drag = { kind: 'erase' }; paint(p, 0); }
    else if (tool === 'target') { drag = { kind: 'target' }; world.target = p; targetMoved(); }
    else if (tool === 'robot') { drag = { kind: 'robotAim', x0: p.x, y0: p.y }; placeStart(p.x, p.y); }
  });
  cv.addEventListener('pointermove', e => {
    const p = toWorld(e);
    if (!drag) {
      const near = Math.hypot(p.x - world.target.x, p.y - world.target.y) < 0.28 || robots.some(r => Math.hypot(p.x - r.x, p.y - r.y) < RR + 0.06);
      cv.style.cursor = near ? 'grab' : 'crosshair';
      return;
    }
    if (drag.kind === 'paint') paint(p, 1);
    else if (drag.kind === 'erase') paint(p, 0);
    else if (drag.kind === 'target') { world.target = { x: Math.min(Math.max(p.x, 0.1), WW - 0.1), y: Math.min(Math.max(p.y, 0.1), WH - 0.1) }; targetMoved(); }
    else if (drag.kind === 'robotMove') placeStart(p.x, p.y);
    else if (drag.kind === 'robotAim') {
      if (Math.hypot(p.x - drag.x0, p.y - drag.y0) > 0.1) { world.start.th = Math.atan2(-(p.y - drag.y0), p.x - drag.x0); resetRobots(); }
    }
  });
  const endDrag = () => { drag = null; };
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', endDrag);

  // ------------------------------------------------------------------ controles
  const presetSel = $('#preset');
  for (const [k, v] of Object.entries(Sim.presets)) {
    const o = document.createElement('option'); o.value = k; o.textContent = v.name; presetSel.appendChild(o);
  }
  presetSel.value = presetKey;
  presetSel.onchange = () => loadPreset(presetSel.value);

  document.querySelectorAll('#algSeg button').forEach(b => b.onclick = () => {
    algMode = b.dataset.alg;
    document.querySelectorAll('#algSeg button').forEach(x => x.classList.toggle('on', x === b));
    buildRobots();
  });
  $('#runBtn').onclick = () => {
    if (!running && robots.every(r => r.state === 'goal')) resetRobots();
    setRunning(!running);
  };
  $('#stepBtn').onclick = () => {
    setRunning(false);
    const n = Math.max(1, Math.round(1 / P.hz / DT));
    for (let i = 0; i < n; i++) stepAll();
  };
  $('#resetBtn').onclick = () => { resetRobots(); setRunning(false); };
  $('#simSpeed').onchange = e => { simSpeed = +e.target.value; };
  $('#brush').onchange = e => { brush = +e.target.value; };
  document.querySelectorAll('.tool').forEach(b => b.onclick = () => {
    tool = b.dataset.tool;
    document.querySelectorAll('.tool').forEach(x => x.classList.toggle('on', x === b));
  });
  $('#clearBtn').onclick = () => {
    world.occ.fill(0);
    for (let i = 0; i < GW; i++) { world.occ[i] = 1; world.occ[(GH - 1) * GW + i] = 1; }
    for (let j = 0; j < GH; j++) { world.occ[j * GW] = 1; world.occ[j * GW + GW - 1] = 1; }
    robots.forEach(r => r.grid.fill(0));
  };
  $('#forestBtn').onclick = () => {
    world.forestSeed = 1 + Math.floor(Math.random() * 100000);
    const st = world.start, tg = world.target;
    Sim.loadPreset(world, 'bosque'); world.start = st; world.target = tg;
    resetRobots(); setRunning(false);
  };
  window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.code === 'Space') { e.preventDefault(); $('#runBtn').click(); }
    else if (e.key === 's' || e.key === 'S') $('#stepBtn').click();
    else if (e.key === 'r' || e.key === 'R') $('#resetBtn').click();
  });

  // sliders
  const sliders = [];
  function slider(box, key, name, min, max, step, show) {
    const row = document.createElement('div'); row.className = 'row';
    row.innerHTML = `<span>${name}</span><input type="range" min="${min}" max="${max}" step="${step}"><span class="val"></span>`;
    const inp = row.querySelector('input'), val = row.querySelector('.val');
    const upd = () => { val.textContent = show(P[key]); };
    inp.value = P[key]; upd();
    inp.oninput = () => { P[key] = +inp.value; upd(); };
    $(box).appendChild(row);
    sliders.push(() => { inp.value = P[key]; upd(); });
  }
  function check(box, key, name, obj = P, onchange) {
    const l = document.createElement('label'); l.className = 'chk';
    l.innerHTML = `<input type="checkbox"> ${name}`;
    const c = l.querySelector('input'); c.checked = obj[key];
    c.onchange = () => { obj[key] = c.checked; onchange && onchange(); };
    $(box).appendChild(l);
    if (obj === P) sliders.push(() => { c.checked = P[key]; });
  }
  function note(box, html) { const p = document.createElement('p'); p.className = 'small'; p.innerHTML = html; $(box).appendChild(p); }

  check('#visBox', 'real', 'Obstáculos reales', show);
  check('#visBox', 'cert', 'Rejilla de certeza (lo que ha visto el robot)', show);
  check('#visBox', 'win', 'Ventana activa', show);
  check('#visBox', 'rays', 'Haces del sensor', show);
  check('#visBox', 'forces', 'Fuerzas VFF (F<sub>t</sub>, F<sub>r</sub>, R)', show);
  check('#visBox', 'polar', 'Histograma polar VFH sobre el robot', show);
  check('#visBox', 'trail', 'Trayectorias', show);

  slider('#vffBox', 'Fcr', 'F<sub>cr</sub> repulsión', 0.0005, 0.012, 0.0005, v => v.toFixed(4));
  slider('#vffBox', 'Fct', 'F<sub>ct</sub> atracción', 0.2, 3, 0.1, v => v.toFixed(1));
  note('#vffBox', 'Al subir F<sub>cr</sub> el robot se separa más de los obstáculos, pero entra peor por los huecos.');
  const sub = (box, html) => { const h = document.createElement('div'); h.className = 'subhead'; h.innerHTML = html; $(box).appendChild(h); };
  sub('#vffBox', 'Mejoras del artículo de 1989 <span class="lbl">(Borenstein y Koren, secc. III–IV)</span>');
  const presetRow = document.createElement('div'); presetRow.className = 'bar'; presetRow.style.margin = '4px 0 2px';
  presetRow.innerHTML = '<button class="btn mini" id="vffBasic">VFF básico</button><button class="btn mini" id="vffFull">Todas las mejoras</button>';
  $('#vffBox').appendChild(presetRow);
  check('#vffBox', 'lpf', 'Filtro paso bajo en el giro (ec. 7)', P, () => robots.forEach(r => { r.wcmd = r.w; }));
  slider('#vffBox', 'tf', '&nbsp;&nbsp;constante τ del filtro', 0.1, 1.5, 0.05, v => v.toFixed(2) + ' s');
  check('#vffBox', 'damp', 'Amortiguamiento de F<sub>r</sub> (ec. 8)', P);
  slider('#vffBox', 'wd', '&nbsp;&nbsp;peso w', 0, 1, 0.05, v => v.toFixed(2));
  check('#vffBox', 'vlaw', 'Velocidad ∝ 1 − |cos θ| (ec. 10)', P);
  check('#vffBox', 'wfm', 'Recuperación de trampas: seguimiento de paredes (ec. 12)', P, () => robots.forEach(r => { r.wf = { active: false, mode: null, count: 0, off: 0, loop: 0, forced: false }; }));
  slider('#vffBox', 'delta', '&nbsp;&nbsp;ángulo δ', 90, 180, 5, v => v.toFixed(0) + '°');
  note('#vffBox', "F'<sub>r</sub> = w·F<sub>r</sub> + (1−w)·F<sub>r</sub>·(−cos θ), con θ el ángulo entre F<sub>r</sub> y la velocidad. La ley de velocidad pondera |cos θ| con |F<sub>r</sub>|/F<sub>ct</sub> (en el artículo no): sin eso, cualquier obstáculo justo detrás o delante dentro de la ventana para al robot.");
  const setVff = on => { ['lpf', 'damp', 'vlaw', 'wfm'].forEach(k => { P[k] = on; }); robots.forEach(r => { r.wcmd = r.w; r.wf = { active: false, mode: null, count: 0, off: 0, loop: 0, forced: false }; }); sliders.forEach(f => f()); };
  $('#vffBasic').onclick = () => setVff(false);
  $('#vffFull').onclick = () => setVff(true);

  slider('#vfhBox', 'tau', 'Umbral τ', 40, 800, 10, v => v.toFixed(0));
  slider('#vfhBox', 'l', 'Suavizado l', 0, 10, 1, v => v.toFixed(0) + ' sect.');
  slider('#vfhBox', 'smax', 's<sub>max</sub> valle ancho', 4, 30, 1, v => `${v} (${v * ALPHA}°)`);
  slider('#vfhBox', 'hm', 'h<sub>m</sub> frenado', 200, 3000, 50, v => v.toFixed(0));
  slider('#vfhBox', 'vmin', 'V<sub>min</sub>', 0, 0.15, 0.01, v => (v * 100).toFixed(0) + ' cm/s');
  note('#vfhBox', 'Con τ alto el robot ve más huecos y se acerca más a los obstáculos; con τ bajo, las puertas desaparecen del histograma. Velocidad: V = V′·(1 − |Ω|/Ω<sub>max</sub>) + V<sub>min</sub>, con V′ = V<sub>max</sub>·(1 − h″<sub>c</sub>/h<sub>m</sub>).');

  slider('#robBox', 'vmax', 'Velocidad máx.', 0.2, 1.2, 0.05, v => v.toFixed(2) + ' m/s');
  slider('#robBox', 'wmax', 'Giro máx.', 30, 180, 5, v => v.toFixed(0) + '°/s');
  slider('#robBox', 'kw', 'Ganancia de giro', 0.5, 6, 0.1, v => v.toFixed(1));
  slider('#robBox', 'lag', 'Inercia (const. de tiempo)', 0, 1, 0.05, v => v.toFixed(2) + ' s');
  slider('#robBox', 'hz', 'Frecuencia de control', 2, 20, 1, v => v.toFixed(0) + ' Hz');
  slider('#robBox', 'Ws', 'Ventana activa', 11, 51, 2, v => `${v} celdas`);
  slider('#robBox', 'range', 'Alcance del sensor', 0.8, 3, 0.1, v => v.toFixed(1) + ' m');
  slider('#robBox', 'nrays', 'Nº de haces', 8, 120, 4, v => v.toFixed(0));
  slider('#robBox', 'noise', 'Ruido de rango σ', 0, 0.15, 0.01, v => v.toFixed(2) + ' m');
  slider('#robBox', 'spurious', 'Lecturas espurias', 0, 0.3, 0.01, v => (v * 100).toFixed(0) + ' %');
  check('#robBox', 'known', 'Mapa conocido (sin sensores: C = 15 en todo obstáculo)', P, () => robots.forEach(r => r.grid.fill(0)));
  check('#robBox', 'beyond', 'Ignorar obstáculos más lejanos que el objetivo', P);
  note('#robBox', 'Celdas de 10 cm. Rejilla de certeza HIMM: cada lectura suma +3 a la celda del impacto y resta −1 a las celdas que atraviesa el haz (C entre 0 y 15).');

  $('#defaultsBtn').onclick = () => { Object.assign(P, Sim.defaults); sliders.forEach(f => f()); };

  // paneles de explicación plegables (se recuerda el estado en este navegador)
  document.querySelectorAll('.foldable').forEach(card => {
    const key = 'vffvfh-fold-' + card.dataset.fold, btn = card.querySelector('.fold-btn');
    const set = f => { card.classList.toggle('folded', f); btn.textContent = f ? '+' : '−'; };
    let f = false; try { f = localStorage.getItem(key) === '1'; } catch (e) {}
    set(f);
    btn.onclick = () => { const n = !card.classList.contains('folded'); set(n); try { localStorage.setItem(key, n ? '1' : '0'); } catch (e) {} };
  });

  // ------------------------------------------------------------------ inicio
  loadPreset(presetKey);
  resize();
  requestAnimationFrame(frame);
})();
