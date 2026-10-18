(function () {
  "use strict";
  const {EKFSLAM,AMBIGUOUS_IDS,WAYPOINTS} = window.SLAM;
  const $ = id => document.getElementById(id);
  const canvas = $("map"), ctx = canvas.getContext("2d");
  const matrixView = new window.MatrixView();
  let sim = new EKFSLAM(), history = [], playing = false, jumping = false;
  let lastTick = 0, accumulator = 0, message = "";

  function reset() {
    playing = false; jumping = false; history = []; message = "";
    sim = new EKFSLAM($("association").value,$("scenario").value);
    update();
  }
  function saveHistory() {
    history.push(sim.snapshot());
    if (history.length > 100) history.shift();
  }
  function step() {
    if (sim.done || jumping) return;
    saveHistory();
    const watchError=sim.scenario!=="classic" && sim.association==="gated" && !sim.firstError;
    const result = sim.advanceFrame(true,watchError);
    if (result === "before-error") { playing = false; message = "Antes de una asociación errónea: pulsa «Siguiente» para ver su efecto."; }
    else if (result === "association-error") { playing = false; message = "Se aplicó una medida al landmark equivocado. Mira el diagnóstico y el rayo rojo."; }
    else if (result === "before-closure") { playing = false; message = "Pausa: predicción terminada. Pulsa «Siguiente» para aplicar la corrección."; }
    else if (result === "closure-applied") { playing = false; message = "Cierre aplicado: compara las elipses grises previas con las rojas actuales."; }
    else message = "";
    update();
  }
  function back() {
    if (!history.length || jumping) return;
    playing = false;
    sim.restore(history.pop());
    message = sim.pending ? "Antes de la corrección: pulsa «Siguiente» para aplicar la medida." : "Fotograma anterior.";
    update();
  }
  function togglePlay() {
    if (sim.done || jumping) return;
    playing = !playing;
    lastTick = performance.now(); accumulator = 0;
    update();
  }
  async function jumpToClosure() {
    if (jumping) return;
    playing = false;
    if (sim.closureImpact || sim.done || sim.pending) sim = new EKFSLAM($("association").value,$("scenario").value);
    history = [];
    jumping = true; message = "Buscando la primera reobservación tras completar la vuelta…";
    update();
    // Lotes pequeños mantienen la interfaz viva durante el cálculo.
    let beforeCandidate = null;
    while (jumping && !sim.done && !sim.pending) {
      for (let i=0; i<24 && !sim.done && !sim.pending; i++) {
        beforeCandidate = sim.snapshot();
        sim.advanceFrame(true);
      }
      update();
      await new Promise(requestAnimationFrame);
    }
    if (!jumping) return;
    jumping = false;
    if (sim.pending) {
      message = sim.pendingAssociation?.some(item=>item.forced)
        ? "Justo antes del cierre falso: pulsa «Siguiente» para aplicar la correspondencia impuesta."
        : "Justo antes del cierre: pulsa «Siguiente» para aplicar la observación.";
      if (beforeCandidate) history.push(beforeCandidate);
    } else message = "La ruta terminó sin detectar una reobservación apta para el cierre.";
    update();
  }

  async function jumpToError() {
    if (jumping || sim.scenario==="classic" || sim.association!=="gated") return;
    playing=false;
    if (sim.done || sim.pending || sim.firstError) sim=new EKFSLAM("gated",sim.scenario);
    history=[];jumping=true;message="Buscando una asociación incorrecta…";update();
    let beforeCandidate=null;
    while(jumping && !sim.done && !sim.pending) {
      for(let i=0;i<24 && !sim.done && !sim.pending;i++) {
        beforeCandidate=sim.snapshot();
        sim.advanceFrame(false,true);
      }
      update();
      await new Promise(requestAnimationFrame);
    }
    if(!jumping)return;
    jumping=false;
    if(sim.pending) {
      message="Primera asociación incorrecta preparada. Pulsa «Siguiente» para aplicarla.";
      if(beforeCandidate)history.push(beforeCandidate);
    } else message="No apareció ninguna asociación incorrecta durante la ruta.";
    update();
  }

  function fmt(n, digits=1) { return n.toLocaleString("es-ES",{minimumFractionDigits:digits,maximumFractionDigits:digits}); }
  function update() {
    $("play").textContent = playing ? "Ⅱ Pausar" : "▶ Reproducir";
    $("play").disabled = sim.done || jumping;
    $("back").disabled = !history.length || jumping;
    $("step").disabled = sim.done || jumping;
    $("jump").disabled = jumping;
    $("jumpError").disabled = jumping || sim.scenario==="classic" || sim.association!=="gated";
    $("scenario").disabled = jumping;
    $("association").disabled = jumping;
    $("frame").textContent = sim.frame.toLocaleString("es-ES");
    $("time").textContent = `${fmt(sim.time)} s`;
    $("lap").textContent = `${sim.lap} / 2`;
    $("features").textContent = `${sim.featureCount} / ${sim.landmarks.length}`;
    $("observed").textContent = sim.pending ? `${sim.pending.length} · pendientes` :
      `${sim.lastScan.length} · ${sim.lastAssociated} conocidas, ${sim.lastNew} nuevas`;
    $("robotSigma").textContent = `${fmt(sim.robotUncertainty,2)} m`;
    $("wrongCount").textContent = sim.associationTotals.wrong;
    $("rejectedCount").textContent = sim.associationTotals.rejected;
    $("positionError").textContent = `${fmt(Math.hypot(sim.x[0]-sim.truth[0],sim.x[1]-sim.truth[1]),2)} m`;
    $("correctCount").textContent = sim.associationTotals.correct;
    $("scenarioInfo").textContent = sim.scenario==="ambiguous"
      ? "Cuatro landmarks en un grupo de ~2,5 m y ruido de medida ×2. Muestra errores locales."
      : sim.scenario==="falseLoop"
        ? "Prueba de estrés: se impone una correspondencia falsa al cerrar el ciclo. La puerta normal la rechazaría."
        : "Mapa y ruido de medida originales.";
    const pendingWrong=sim.pendingAssociation?.find(item=>sim.associationStatus(item)==="wrong");
    const lastWrong=sim.pending ? null : sim.lastAssociations.find(item=>item.status==="wrong");
    const associationCard=document.querySelector(".association-card");
    associationCard.classList.toggle("has-error",!!(pendingWrong||lastWrong));
    const assocText=$("associationText");
    if(pendingWrong?.forced) assocText.textContent=`Cierre falso impuesto: la medida de L${pendingWrong.z.id+1} se enviará a L${sim.featureTrueId[pendingWrong.feature]+1}, separados unos 37 m. Su NIS es ${fmt(pendingWrong.nis,1)}, muy por encima de la puerta 4: el vecino más cercano normal la rechazaría. Pulsa «Siguiente».`;
    else if(pendingWrong) assocText.textContent=`La medida de L${pendingWrong.z.id+1} se asignaría al landmark del mapa creado por L${sim.featureTrueId[pendingWrong.feature]+1}. El rayo rojo señala la observación incorrecta antes de corregir.`;
    else if(lastWrong?.forced) assocText.textContent=`Cierre falso aplicado: el error real de posición saltó de ${fmt(sim.firstError.beforeError,2)} a ${fmt(sim.firstError.afterError,2)} m, mientras la incertidumbre calculada bajó de ${fmt(sim.firstError.beforeSigma,2)} a ${fmt(sim.firstError.afterSigma,2)} m. El filtro quedó sobreconfiado.`;
    else if(lastWrong) assocText.textContent=`Error aplicado: la medida de L${lastWrong.id+1} corrigió la feature creada por L${lastWrong.mappedId+1}. El filtro trata ambas como si fueran el mismo punto.`;
    else if(sim.scenario==="falseLoop" && sim.firstError?.forced) assocText.textContent=`Tras el cierre falso, el primer salto fue de ${fmt(sim.firstError.beforeError,2)} a ${fmt(sim.firstError.afterError,2)} m de error real. La identidad falsa se impuso deliberadamente para mostrar el efecto; la asociación normal la habría rechazado.`;
    else if(sim.scenario==="falseLoop" && sim.association==="gated") assocText.textContent="El algoritmo conserva sus puertas normales hasta el cierre. En ese instante, esta prueba de estrés impondrá una asociación distante y mostrará su efecto.";
    else if(sim.scenario==="ambiguous" && sim.association==="gated") assocText.textContent=sim.firstError
      ? `Ya se han cometido ${sim.associationTotals.wrong} asociaciones erróneas. Retrocede o usa «Ir al primer error» para examinar la primera.`
      : "Los puntos cercanos pueden generar medidas casi indistinguibles. La demo se pausará antes del primer error.";
    else if(sim.scenario!=="classic") assocText.textContent="Con asociación conocida se evita esta confusión. Cambia a «vecino más cercano» para examinar el caso.";
    else assocText.textContent="En el escenario clásico, los landmarks están separados y el vecino más cercano suele acertar.";
    const phase = $("phase");
    phase.className = "phase";
    if (jumping) phase.textContent = `Buscando… vuelta ${sim.lap}, fotograma ${sim.frame}`;
    else if (sim.pending) { phase.classList.add(pendingWrong?"error":"closure"); phase.textContent = message || "Antes de corregir con un landmark conocido"; }
    else if (lastWrong) { phase.classList.add("error"); phase.textContent = message || "Asociación errónea aplicada"; }
    else if (sim.closureImpact && sim.frame === sim.closureImpact.frame) { phase.classList.add("complete"); phase.textContent = message || "Cierre del ciclo aplicado"; }
    else if (sim.done) phase.textContent = "Simulación terminada · dos vueltas completas";
    else if (playing) phase.textContent = "Reproduciendo · predicción y corrección";
    else phase.textContent = message || (sim.frame ? "En pausa · usa las flechas para avanzar" : "Preparado para iniciar");

    const text = $("closureText"), comparison = $("comparison");
    if (sim.pending && sim.isClosure(sim.pending)) {
      if(sim.pendingAssociation?.some(item=>item.forced)) text.textContent="El sensor vuelve a ver L1, pero la prueba de estrés impondrá L22 como correspondencia. La matriz muestra la covarianza anterior a esa corrección falsa.";
      else {
        const repeated = sim.pending.filter(z => sim.lastSeen.has(z.id));
        text.textContent = `El sensor vuelve a ver ${repeated.length} landmark${repeated.length===1?"":"s"} conocido${repeated.length===1?"":"s"} tras recorrer el mapa. La posición y las elipses muestran el estado antes de incorporar esta medida.`;
      }
      comparison.hidden = true;
    } else if (sim.closureImpact) {
      const c = sim.closureImpact;
      text.textContent = sim.scenario==="falseLoop" && sim.firstError?.forced
        ? `En el fotograma ${c.frame} se aplicó una correspondencia falsa. La covarianza se redujo aunque la posición estimada se alejó mucho de la real.`
        : `En el fotograma ${c.frame} se asociaron ${c.associated} observaciones conocidas. Las correlaciones del EKF transmiten la corrección al robot y a los landmarks.`;
      comparison.hidden = false;
      $("robotBefore").textContent = `${fmt(c.beforeRobot,2)} m`;
      $("robotAfter").textContent = `${fmt(c.afterRobot,2)} m`;
      $("mapBefore").textContent = `${fmt(c.beforeMap,2)} m`;
      $("mapAfter").textContent = `${fmt(c.afterMap,2)} m`;
    } else {
      text.textContent = "Pulsa «Ir al cierre del ciclo». La simulación se detendrá después de la predicción y antes de la corrección con un landmark visto en la primera vuelta.";
      comparison.hidden = true;
    }
    draw();
    const atClosure=sim.closureImpact && sim.frame===sim.closureImpact.frame;
    matrixView.render({current:sim.P,before:atClosure?sim.closureGhost.P:null,frame:sim.frame});
  }

  function mapBounds() {
    let left=Infinity,right=-Infinity,bottom=Infinity,top=-Infinity;
    const include = (x,y) => {
      left=Math.min(left,x);right=Math.max(right,x);
      bottom=Math.min(bottom,y);top=Math.max(top,y);
    };
    // El mapa completo fija el encuadre; las estimaciones solo lo amplían si se salen.
    for (const [x,y] of sim.landmarks) include(x,y);
    for (const [x,y] of WAYPOINTS) include(x,y);
    for (const [x,y] of sim.pathEstimated) include(x,y);
    include(sim.x[0],sim.x[1]);
    for (let k=3;k<sim.x.length;k+=2) include(sim.x[k],sim.x[k+1]);
    const margin=7;
    return {left:left-margin,right:right+margin,bottom:bottom-margin,top:top+margin};
  }
  function transform() {
    const w = canvas.clientWidth, h = canvas.clientHeight, pad = 18;
    const bounds=mapBounds();
    const scale = Math.min((w-2*pad)/(bounds.right-bounds.left),(h-2*pad)/(bounds.top-bounds.bottom));
    const cx = w/2 - scale*(bounds.left+bounds.right)/2;
    const cy = h/2 + scale*(bounds.bottom+bounds.top)/2;
    return {w,h,scale,bounds,xy:(x,y)=>[cx+x*scale,cy-y*scale]};
  }
  function polyline(points,T,color,width=1.5,dash=[]) {
    if (points.length<2) return;
    ctx.beginPath();ctx.setLineDash(dash);ctx.lineWidth=width;ctx.strokeStyle=color;
    points.forEach(([x,y],i)=>{const [px,py]=T.xy(x,y);if(i)ctx.lineTo(px,py);else ctx.moveTo(px,py);});
    ctx.stroke();ctx.setLineDash([]);
  }
  function dot(x,y,T,color,r=3.5) {
    const [px,py]=T.xy(x,y);ctx.beginPath();ctx.arc(px,py,r,0,2*Math.PI);ctx.fillStyle=color;ctx.fill();
  }
  function cross(x,y,T,color,size=5) {
    const [px,py]=T.xy(x,y);ctx.beginPath();ctx.lineWidth=1.8;ctx.strokeStyle=color;
    ctx.moveTo(px-size,py);ctx.lineTo(px+size,py);ctx.moveTo(px,py-size);ctx.lineTo(px,py+size);ctx.stroke();
  }
  function star(x,y,T) {
    const [px,py]=T.xy(x,y);ctx.beginPath();ctx.lineWidth=1.8;ctx.strokeStyle="#206bc0";
    for (const a of [0,Math.PI/2,Math.PI/4,-Math.PI/4]) {
      ctx.moveTo(px-5*Math.cos(a),py-5*Math.sin(a));ctx.lineTo(px+5*Math.cos(a),py+5*Math.sin(a));
    }ctx.stroke();
  }
  // Autovalores de la submatriz 2×2: elipse de confianza de 2σ.
  function ellipse(x,y,p00,p01,p11,T,color,dash=[]) {
    const mean=(p00+p11)/2, half=Math.hypot((p00-p11)/2,p01);
    const a=2*Math.sqrt(Math.max(0,mean+half))*T.scale;
    const b=2*Math.sqrt(Math.max(0,mean-half))*T.scale;
    if (!Number.isFinite(a+b) || a<.3 && b<.3) return;
    const angle=-.5*Math.atan2(2*p01,p00-p11), [px,py]=T.xy(x,y);
    ctx.beginPath();ctx.ellipse(px,py,Math.max(.2,a),Math.max(.2,b),angle,0,2*Math.PI);
    ctx.strokeStyle=color;ctx.lineWidth=1.1;ctx.setLineDash(dash);ctx.stroke();ctx.setLineDash([]);
  }
  function drawCovariances(state,P,T,color,dash=[]) {
    ellipse(state[0],state[1],P[0][0],P[0][1],P[1][1],T,color,dash);
    for (let f=0;f<(state.length-3)/2;f++) {
      const k=3+2*f;
      ellipse(state[k],state[k+1],P[k][k],P[k][k+1],P[k+1][k+1],T,color,dash);
    }
  }
  function robot(pose,T,color,fill=true) {
    const [px,py]=T.xy(pose[0],pose[1]), a=-pose[2], size=9;
    ctx.beginPath();
    ctx.moveTo(px+size*Math.cos(a),py+size*Math.sin(a));
    ctx.lineTo(px+size*.75*Math.cos(a+2.55),py+size*.75*Math.sin(a+2.55));
    ctx.lineTo(px+size*.75*Math.cos(a-2.55),py+size*.75*Math.sin(a-2.55));
    ctx.closePath();ctx.strokeStyle=color;ctx.lineWidth=2;ctx.fillStyle=fill?color:"white";
    ctx.fill();ctx.stroke();
  }
  function currentWrongDecision() {
    if (sim.pendingAssociation) {
      const item=sim.pendingAssociation.find(match=>sim.associationStatus(match)==="wrong");
      if (item) return {id:item.z.id,feature:item.feature,mappedId:sim.featureTrueId[item.feature],forced:!!item.forced};
      return null;
    }
    return sim.lastAssociations.find(item=>item.status==="wrong") || null;
  }
  function drawAmbiguityInset(T,wrong) {
    if (sim.scenario!=="ambiguous") return;
    const center=sim.landmarks[21], width=185, height=174, left=T.w-width-14, top=14;
    const zoom={scale:23,xy:(x,y)=>[left+width/2+(x-center[0])*23,top+height/2-(y-center[1])*23]};
    ctx.save();ctx.fillStyle="#fff";ctx.strokeStyle="#b9cdd3";ctx.lineWidth=1;
    ctx.fillRect(left,top,width,height);ctx.strokeRect(left,top,width,height);
    ctx.beginPath();ctx.rect(left+2,top+24,width-4,height-26);ctx.clip();
    ctx.strokeStyle="#e8eff1";ctx.beginPath();ctx.moveTo(left+width/2,top+24);
    ctx.lineTo(left+width/2,top+height);ctx.moveTo(left,top+height/2);
    ctx.lineTo(left+width,top+height/2);ctx.stroke();
    for(let f=0;f<sim.featureCount;f++) {
      const x=sim.x[3+2*f],y=sim.x[4+2*f];
      if(Math.hypot(x-center[0],y-center[1])<5) cross(x,y,zoom,"#d64f5a",5);
    }
    if(wrong && wrong.feature!==null) {
      const point=sim.landmarks[wrong.id],k=3+2*wrong.feature;
      polyline([point,[sim.x[k],sim.x[k+1]]],zoom,"#d73c49",2,[4,3]);
    }
    for(const id of AMBIGUOUS_IDS) {
      const point=sim.landmarks[id], [px,py]=zoom.xy(...point);
      star(...point,zoom);ctx.fillStyle="#175fa7";ctx.font="bold 10px system-ui";
      ctx.fillText(`L${id+1}`,px+6,py-6);
    }
    ctx.restore();
    ctx.fillStyle="#31505c";ctx.font="bold 11px system-ui";
    ctx.fillText("ZOOM · GRUPO AMBIGUO",left+9,top+16);
  }
  function draw() {
    const rect=canvas.getBoundingClientRect(), dpr=window.devicePixelRatio||1;
    if (canvas.width !== Math.round(rect.width*dpr) || canvas.height !== Math.round(rect.height*dpr)) {
      canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);
    }
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,rect.width,rect.height);
    const T=transform();
    ctx.fillStyle="#fbfdfd";ctx.fillRect(0,0,T.w,T.h);
    // Cuadrícula y ejes en metros.
    ctx.lineWidth=1;ctx.strokeStyle="#ebf0f1";ctx.fillStyle="#9aadb5";ctx.font="10px system-ui";
    for(let x=Math.ceil(T.bounds.left/25)*25;x<=T.bounds.right;x+=25){const [px]=T.xy(x,0);ctx.beginPath();ctx.moveTo(px,0);ctx.lineTo(px,T.h);ctx.stroke();ctx.fillText(String(x),px+3,T.h-8);}
    for(let y=Math.ceil(T.bounds.bottom/25)*25;y<=T.bounds.top;y+=25){const [,py]=T.xy(0,y);ctx.beginPath();ctx.moveTo(0,py);ctx.lineTo(T.w,py);ctx.stroke();ctx.fillText(String(y),6,py-3);}
    polyline(WAYPOINTS,T,"#49ae78",1.7);
    WAYPOINTS.forEach(([x,y],i)=>dot(x,y,T,i===sim.target?"#149454":"#71c797",i===sim.target?4.2:2.5));
    polyline(sim.pathTrue,T,"#263e4b",2);
    polyline(sim.pathEstimated,T,"#d9757d",1.5);
    sim.landmarks.forEach(([x,y])=>star(x,y,T));
    if (sim.closureGhost) drawCovariances(sim.closureGhost.x,sim.closureGhost.P,T,"#8a9da5",[4,3]);
    drawCovariances(sim.x,sim.P,T,"#d6545e");
    for(let f=0;f<sim.featureCount;f++) cross(sim.x[3+2*f],sim.x[4+2*f],T,"#d64f5a",4);
    if ($("showRays").checked) {
      const scan=sim.pending||sim.lastScan;
      scan.forEach((z,i)=>{
        const end=[sim.x[0]+z.range*Math.cos(sim.x[2]+z.bearing),
                   sim.x[1]+z.range*Math.sin(sim.x[2]+z.bearing)];
        const status=sim.pendingAssociation
          ? sim.associationStatus(sim.pendingAssociation[i])
          : sim.lastAssociations[i]?.status;
        polyline([[sim.x[0],sim.x[1]],end],T,status==="wrong"?"#d83b46":"#eccb70a6",status==="wrong"?2.6:1.1);
      });
    }
    if (sim.pending) {
      const repeated=sim.pending.filter(z=>sim.lastSeen.has(z.id));
      repeated.forEach(z=>{const [x,y]=sim.landmarks[z.id], [px,py]=T.xy(x,y);
        ctx.beginPath();ctx.arc(px,py,10,0,2*Math.PI);ctx.strokeStyle="#f3a23f";ctx.lineWidth=2;ctx.stroke();});
    }
    const wrong=currentWrongDecision();
    if(wrong && wrong.feature!==null) {
      const point=sim.landmarks[wrong.id],k=3+2*wrong.feature;
      polyline([point,[sim.x[k],sim.x[k+1]]],T,"#d83b46",2,[4,3]);
    }
    robot(sim.truth,T,"#1766b7");robot(sim.x,T,"#cf4b58",false);
    drawAmbiguityInset(T,wrong);
    if(wrong?.forced) {
      ctx.fillStyle="#fff0ed";ctx.strokeStyle="#dc8279";ctx.lineWidth=1;
      ctx.fillRect(17,sim.pending?56:16,175,29);ctx.strokeRect(17,sim.pending?56:16,175,29);
      ctx.fillStyle="#a33d39";ctx.font="bold 12px system-ui";
      ctx.fillText("CIERRE FALSO · L1 → L22",27,sim.pending?75:35);
    }
    if (sim.pending) {
      ctx.fillStyle="#fff5e8";ctx.strokeStyle="#e9ba7d";ctx.lineWidth=1;
      ctx.fillRect(17,16,222,31);ctx.strokeRect(17,16,222,31);
      ctx.fillStyle="#9a621e";ctx.font="bold 12px system-ui";
      ctx.fillText("ANTES DE LA CORRECCIÓN",29,36);
    }
  }

  $("play").addEventListener("click",togglePlay);
  $("step").addEventListener("click",()=>{playing=false;step();});
  $("back").addEventListener("click",back);
  $("reset").addEventListener("click",reset);
  $("jump").addEventListener("click",jumpToClosure);
  $("jumpError").addEventListener("click",jumpToError);
  $("scenario").addEventListener("change",()=>{
    $("association").value=$("scenario").value==="classic"?"known":"gated";
    reset();
  });
  $("association").addEventListener("change",reset);
  $("showRays").addEventListener("change",draw);
  $("speed").addEventListener("input",()=>{$("speedValue").textContent=`${$("speed").value} fotogramas/s`;});
  document.addEventListener("keydown",e=>{
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
    if (e.code==="Space") {e.preventDefault();togglePlay();}
    if (e.code==="ArrowRight") {e.preventDefault();playing=false;step();}
    if (e.code==="ArrowLeft") {e.preventDefault();back();}
  });
  new ResizeObserver(draw).observe(canvas.parentElement);
  function tick(now) {
    if (playing && !jumping) {
      accumulator += Math.min(100,now-lastTick); lastTick=now;
      const interval=1000/Number($("speed").value);
      while (accumulator>=interval && playing) {
        accumulator-=interval;
        step();
        if (sim.done || sim.pending || sim.closureImpact && sim.frame===sim.closureImpact.frame) playing=false;
      }
    } else lastTick=now;
    requestAnimationFrame(tick);
  }
  update();requestAnimationFrame(tick);
})();
