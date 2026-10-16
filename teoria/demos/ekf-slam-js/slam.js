/*
 * EKF-SLAM didáctico. Un fotograma = 8 predicciones de control + 1 barrido.
 * Las funciones predict(), observeModel(), correct() y augment() corresponden
 * a predict.m, observe_model.m, update.m y augment.m del ejemplo de 2004.
 *
 * Estado: [robot.x, robot.y, robot.ángulo, LM1.x, LM1.y, ...]
 * P: covarianza completa. Sus términos cruzados hacen que un landmark visto
 * de nuevo pueda reducir también la incertidumbre del resto del mapa.
 */
(function () {
  "use strict";

  const LANDMARKS = [[2.9922118380062557,-25.700934579439263],[32.89875389408101,-33.17757009345797],[24.799065420560765,-68.38006230529598],[75.26635514018693,-65.57632398753896],[73.70872274143306,-35.6697819314642],[98.63084112149534,3.8940809968847105],[49.4096573208723,26.947040498442348],[80.25077881619939,59.96884735202491],[54.70560747663552,88.62928348909654],[13.27258566978196,80.84112149532709],[-16.322429906542055,49.06542056074764],[-65.85514018691589,83.64485981308408],[-96.38473520249221,60.591900311526445],[-76.1355140186916,36.29283489096571],[-87.35046728971963,-21.339563862928372],[-103.54984423676012,-32.24299065420561],[-92.95794392523365,-77.72585669781932],[-55.88629283489095,-55.919003115264815],[-35.32554517133954,-19.158878504672913],[-56.19781931464175,16.35514018691586],[-7.2881619937694495,19.781931464174434],[25.733644859813097,3.271028037383161],[-19.56098811815029,80.14441714536255],[-41.75058309797076,46.232529864432735],[25.40213855148599,26.854308561044235],[91.38698678095218,28.23846722557198],[-13.72162101819751,-79.03382927532854],[-52.845380587881024,-92.18333658834217],[-86.12977305761174,15.088959912558352],[-127.00534275728107,22.70183256746097],[-25.98429192809833,4.707769928600243],[56.35078418123564,-17.43876870384372],[51.679290501273414,-83.18630526891181],[21.314581581519036,-96.33581258192541],[48.17567024130173,57.99787851291856]];
  const WAYPOINTS = [[12.649532710280397,-41.58878504672899],[44.73676012461061,-54.98442367601248],[85.54672897196264,-45.015576323987545],[93.64641744548288,-17.28971962616825],[64.98598130841123,5.763239875389388],[71.83956386292834,31.61993769470405],[71.21651090342681,70.56074766355138],[33.521806853582575,76.47975077881617],[12.961059190031165,51.55763239875387],[-32.52180685358255,67.44548286604359],[-74.88940809968847,69.00311526479749],[-97.31931464174454,41.900311526479726],[-107.59968847352025,6.386292834890952],[-86.4158878504673,-25.700934579439263],[-83.92367601246107,-64.01869158878506],[-39.375389408099664,-81.46417445482868],[-17.568535825545155,-51.557632398753924]];
  const CFG = Object.freeze({
    speed: 3, wheelbase: 4, dt: .025, controlsPerFrame: 8,
    maxSteer: Math.PI / 6, steerRate: Math.PI / 9, waypointRadius: 1,
    maxRange: 30, sigmaV: .3, sigmaSteer: 3*Math.PI/180,
    sigmaRange: .1, sigmaBearing: Math.PI/180,
    gateAssociate: 4, gateNew: 25, closureAbsenceFrames: 50
  });
  // Variante didáctica: cuatro landmarks casi coincidentes al inicio de la ruta.
  // Sus etiquetas reales solo sirven para evaluar la asociación, nunca al EKF.
  const AMBIGUOUS_IDS = [6,21,24,30]; // índices desde cero: L7, L22, L25, L31
  const AMBIGUOUS_LANDMARKS = LANDMARKS.map(point => point.slice());
  const [clusterX,clusterY] = LANDMARKS[21];
  AMBIGUOUS_LANDMARKS[24] = [clusterX+1,clusterY+.5];
  AMBIGUOUS_LANDMARKS[30] = [clusterX-1,clusterY+1];
  AMBIGUOUS_LANDMARKS[6] = [clusterX+.3,clusterY-1];

  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  const zeros = (rows, cols = rows) => Array.from({length:rows}, () => Array(cols).fill(0));
  const cloneMatrix = m => m.map(row => row.slice());

  class Random {
    constructor(seed = 2004) { this.state = seed >>> 0; this.spare = null; }
    uniform() {
      let x = this.state;
      x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
      this.state = x >>> 0;
      return (this.state + .5) / 4294967296;
    }
    normal() {
      if (this.spare !== null) { const v = this.spare; this.spare = null; return v; }
      const radius = Math.sqrt(-2 * Math.log(this.uniform()));
      const angle = 2 * Math.PI * this.uniform();
      this.spare = radius * Math.sin(angle);
      return radius * Math.cos(angle);
    }
  }

  class EKFSLAM {
    constructor(association = "known", scenario = "classic") {
      this.association = association;
      this.scenario = scenario;
      this.landmarks = scenario === "ambiguous" ? AMBIGUOUS_LANDMARKS : LANDMARKS;
      this.cfg = scenario === "ambiguous"
        ? {...CFG,sigmaRange:.2,sigmaBearing:2*Math.PI/180}
        : CFG;
      this.random = new Random();
      this.x = [0, 0, 0];
      this.P = zeros(3);
      this.truth = [0, 0, 0];
      this.steer = 0;
      this.target = 0;
      this.lap = 1;
      this.frame = 0;
      this.time = 0;
      this.done = false;
      this.pending = null;
      this.knownMap = new Map(); // id real -> índice de landmark en x
      this.featureTrueId = []; // solo diagnóstico: origen real de cada feature creada
      this.lastSeen = new Map(); // id real -> último fotograma observado
      this.pathTrue = [[0,0]];
      this.pathEstimated = [[0,0]];
      this.lastScan = [];
      this.lastAssociated = 0;
      this.lastNew = 0;
      this.lastAssociations = [];
      this.pendingAssociation = null;
      this.associationTotals = {correct:0,wrong:0,rejected:0};
      this.firstError = null;
      this.falseClosureApplied = false;
      this.closureImpact = null;
      this.closureGhost = null;
    }

    get featureCount() { return (this.x.length - 3) / 2; }
    get robotUncertainty() { return Math.sqrt(Math.max(0, this.P[0][0] + this.P[1][1])); }
    get mapUncertainty() {
      if (!this.featureCount) return 0;
      let sum = 0;
      for (let i = 0; i < this.featureCount; i++) {
        const k = 3 + 2*i;
        sum += Math.sqrt(Math.max(0, this.P[k][k] + this.P[k+1][k+1]));
      }
      return sum / this.featureCount;
    }

    // Modelo de bicicleta: dirección limitada en ángulo y velocidad de giro.
    controlStep() {
      const target = WAYPOINTS[this.target];
      if (Math.hypot(target[0]-this.truth[0], target[1]-this.truth[1]) < this.cfg.waypointRadius) {
        this.target++;
        if (this.target === WAYPOINTS.length) {
          if (this.lap === 2) { this.done = true; return; }
          this.lap = 2;
          this.target = 0;
        }
      }
      const wp = WAYPOINTS[this.target];
      const desired = wrap(Math.atan2(wp[1]-this.truth[1], wp[0]-this.truth[0]) - this.truth[2] - this.steer);
      const maxChange = this.cfg.steerRate * this.cfg.dt;
      this.steer = Math.max(-this.cfg.maxSteer, Math.min(this.cfg.maxSteer,
        this.steer + Math.max(-maxChange, Math.min(maxChange, desired))));
      this.truth = this.motion(this.truth, this.cfg.speed, this.steer);
      const noisyV = this.cfg.speed + this.cfg.sigmaV * this.random.normal();
      const noisySteer = this.steer + this.cfg.sigmaSteer * this.random.normal();
      this.predict(noisyV, noisySteer);
      this.time += this.cfg.dt;
    }

    motion(pose, v, steer) {
      const a = steer + pose[2];
      return [pose[0] + v*this.cfg.dt*Math.cos(a),
              pose[1] + v*this.cfg.dt*Math.sin(a),
              wrap(pose[2] + v*this.cfg.dt*Math.sin(steer)/this.cfg.wheelbase)];
    }

    // P ← G P Gᵀ + Gu Q Guᵀ; se actualizan también las correlaciones robot-mapa.
    predict(v, steer) {
      const a = steer + this.x[2], c = Math.cos(a), s = Math.sin(a);
      const vdt = v * this.cfg.dt;
      const G = [[1,0,-vdt*s],[0,1,vdt*c],[0,0,1]];
      const U = [[this.cfg.dt*c,-vdt*s],[this.cfg.dt*s,vdt*c],
                 [this.cfg.dt*Math.sin(steer)/this.cfg.wheelbase,
                  v*this.cfg.dt*Math.cos(steer)/this.cfg.wheelbase]];
      const old = this.P, n = this.x.length, next = cloneMatrix(old);
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          let value = 0;
          for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) value += G[i][a]*old[a][b]*G[j][b];
          value += U[i][0]*this.cfg.sigmaV**2*U[j][0] + U[i][1]*this.cfg.sigmaSteer**2*U[j][1];
          next[i][j] = value;
        }
        for (let j = 3; j < n; j++) {
          next[i][j] = G[i][0]*old[0][j] + G[i][1]*old[1][j] + G[i][2]*old[2][j];
          next[j][i] = next[i][j];
        }
      }
      this.P = next;
      this.x[0] += vdt*c;
      this.x[1] += vdt*s;
      this.x[2] = wrap(this.x[2] + vdt*Math.sin(steer)/this.cfg.wheelbase);
    }

    // Medición real simulada: distancia + ángulo relativo, solo en el frente.
    scan() {
      const [rx, ry, heading] = this.truth;
      const result = [];
      this.landmarks.forEach(([lx,ly], id) => {
        const dx = lx-rx, dy = ly-ry, range = Math.hypot(dx,dy);
        if (range < this.cfg.maxRange && dx*Math.cos(heading)+dy*Math.sin(heading) > 0) {
          result.push({id, range: range + this.cfg.sigmaRange*this.random.normal(),
            bearing: wrap(Math.atan2(dy,dx)-heading + this.cfg.sigmaBearing*this.random.normal())});
        }
      });
      return result;
    }

    // h(x) y H para un landmark ya presente en el vector de estado.
    observeModel(feature) {
      const k = 3+2*feature, dx = this.x[k]-this.x[0], dy = this.x[k+1]-this.x[1];
      const d2 = Math.max(1e-12, dx*dx+dy*dy), d = Math.sqrt(d2), n = this.x.length;
      const H = zeros(2,n);
      H[0][0] = -dx/d; H[0][1] = -dy/d;
      H[1][0] = dy/d2; H[1][1] = -dx/d2; H[1][2] = -1;
      H[0][k] = dx/d; H[0][k+1] = dy/d;
      H[1][k] = -dy/d2; H[1][k+1] = dx/d2;
      return {range:d, bearing:wrap(Math.atan2(dy,dx)-this.x[2]), H};
    }

    innovation(measurement, feature) {
      const predicted = this.observeModel(feature), H = predicted.H, n = this.x.length;
      const PHt = zeros(n,2);
      for (let i=0; i<n; i++) for (let j=0; j<n; j++) {
        PHt[i][0] += this.P[i][j]*H[0][j];
        PHt[i][1] += this.P[i][j]*H[1][j];
      }
      const S = [[this.cfg.sigmaRange**2,0],[0,this.cfg.sigmaBearing**2]];
      for (let i=0; i<n; i++) {
        S[0][0] += H[0][i]*PHt[i][0]; S[0][1] += H[0][i]*PHt[i][1];
        S[1][0] += H[1][i]*PHt[i][0]; S[1][1] += H[1][i]*PHt[i][1];
      }
      const det = Math.max(1e-18, S[0][0]*S[1][1]-S[0][1]*S[1][0]);
      const invS = [[S[1][1]/det,-S[0][1]/det],[-S[1][0]/det,S[0][0]/det]];
      const residual = [measurement.range-predicted.range,
                        wrap(measurement.bearing-predicted.bearing)];
      const nis = residual[0]*(invS[0][0]*residual[0]+invS[0][1]*residual[1])+
                  residual[1]*(invS[1][0]*residual[0]+invS[1][1]*residual[1]);
      return {H,PHt,invS,residual,nis,score:nis+Math.log(det)};
    }

    // Mismo criterio de puertas de Mahalanobis que data_associate.m.
    associate(scan) {
      if (this.association === "known") {
        return scan.map(z => ({z, feature:this.knownMap.get(z.id) ?? null}));
      }
      const matches = scan.map(z => {
        let best = null, bestScore = Infinity, closestNis = Infinity;
        for (let j=0; j<this.featureCount; j++) {
          const {nis,score} = this.innovation(z,j);
          closestNis = Math.min(closestNis,nis);
          if (nis < this.cfg.gateAssociate && score < bestScore) { best=j; bestScore=score; }
        }
        return {z, feature:best, discard:best===null && closestNis<=this.cfg.gateNew};
      });
      // Prueba de estrés explícita: imponemos UNA correspondencia falsa en
      // el cierre. La puerta de Mahalanobis normal la habría rechazado.
      if (this.scenario === "falseLoop" && !this.falseClosureApplied &&
          this.lap === 2 && this.isClosure(scan)) {
        const measurement = matches.find(item => item.z.id === 0); // L1
        const wrongFeature = this.featureTrueId.indexOf(21); // mapa de L22
        if (measurement && wrongFeature >= 0) {
          measurement.feature = wrongFeature;
          measurement.discard = false;
          measurement.forced = true;
          measurement.nis = this.innovation(measurement.z,wrongFeature).nis;
        }
      }
      return matches;
    }

    // Actualización EKF secuencial. Se preserva la covarianza completa.
    correct(z, feature) {
      const {PHt,invS,residual} = this.innovation(z,feature), n=this.x.length;
      const K = PHt.map(([a,b]) => [a*invS[0][0]+b*invS[1][0],
                                     a*invS[0][1]+b*invS[1][1]]);
      for (let i=0; i<n; i++) this.x[i] += K[i][0]*residual[0]+K[i][1]*residual[1];
      this.x[2] = wrap(this.x[2]);
      for (let i=0; i<n; i++) for (let j=i; j<n; j++) {
        const value = this.P[i][j]-K[i][0]*PHt[j][0]-K[i][1]*PHt[j][1];
        this.P[i][j] = this.P[j][i] = value;
      }
    }

    // Inversa de la observación: añade (x,y) y sus correlaciones con el mapa.
    augment(z) {
      const oldN = this.x.length, a=this.x[2]+z.bearing, c=Math.cos(a), s=Math.sin(a);
      const Gv = [[1,0,-z.range*s],[0,1,z.range*c]];
      const Gz = [[c,-z.range*s],[s,z.range*c]];
      const cross = zeros(2,oldN);
      for (let r=0; r<2; r++) for (let j=0; j<oldN; j++)
        for (let k=0; k<3; k++) cross[r][j] += Gv[r][k]*this.P[k][j];
      const own = zeros(2);
      for (let r=0; r<2; r++) for (let t=0; t<2; t++) {
        for (let i=0; i<3; i++) for (let j=0; j<3; j++) own[r][t] += Gv[r][i]*this.P[i][j]*Gv[t][j];
        own[r][t] += Gz[r][0]*this.cfg.sigmaRange**2*Gz[t][0]
                   + Gz[r][1]*this.cfg.sigmaBearing**2*Gz[t][1];
      }
      this.x.push(this.x[0]+z.range*c, this.x[1]+z.range*s);
      for (let j=0; j<oldN; j++) this.P[j].push(cross[0][j],cross[1][j]);
      this.P.push([...cross[0],...own[0]], [...cross[1],...own[1]]);
    }

    // Diagnóstico de la simulación; la identidad real no entra en el filtro.
    associationStatus(item) {
      if (item.feature === null) return item.discard ? "rejected" : "new";
      return this.featureTrueId[item.feature] === item.z.id ? "correct" : "wrong";
    }

    isClosure(scan) {
      return this.lap === 2 && scan.some(z => {
        const last = this.lastSeen.get(z.id);
        return last !== undefined && this.frame-last > this.cfg.closureAbsenceFrames &&
               (this.association !== "known" || this.knownMap.has(z.id));
      });
    }

    // Detener en pending deja visible P ANTES de la corrección.
    advanceFrame(stopBeforeClosure=false, stopBeforeError=false) {
      if (this.done) return "done";
      if (this.pending) return this.applyPending();
      for (let i=0; i<this.cfg.controlsPerFrame && !this.done; i++) this.controlStep();
      if (this.done) return "done";
      const scan = this.scan();
      const closure = stopBeforeClosure && !this.closureImpact && this.isClosure(scan);
      const preview = stopBeforeError || closure ? this.associate(scan) : null;
      const error = preview?.some(item => this.associationStatus(item) === "wrong");
      if (error || closure) {
        this.pending = scan;
        this.pendingAssociation = preview || this.associate(scan);
        this.lastScan = scan;
        return error ? "before-error" : "before-closure";
      }
      this.pending = scan;
      this.pendingAssociation = preview;
      return this.applyPending();
    }

    applyPending() {
      const scan = this.pending;
      if (!scan) return "done";
      const closing = this.isClosure(scan), beforeRobot = this.robotUncertainty,
            beforeMap = this.mapUncertainty;
      if (closing && !this.closureImpact) this.closureGhost = {x:this.x.slice(),P:cloneMatrix(this.P)};
      const matches = this.pendingAssociation || this.associate(scan); // mismo prior
      const forced = matches.some(item => item.forced);
      this.lastAssociations = matches.map(item => ({
        id:item.z.id,feature:item.feature,status:this.associationStatus(item),
        mappedId:item.feature === null ? null : this.featureTrueId[item.feature],
        forced:!!item.forced,nis:item.nis ?? null
      }));
      let associated=0, added=0, wrong=0;
      for (const item of this.lastAssociations) {
        if (item.status === "correct") this.associationTotals.correct++;
        if (item.status === "rejected") this.associationTotals.rejected++;
        if (item.status === "wrong") {
          this.associationTotals.wrong++; wrong++;
          if (!this.firstError) this.firstError = {
            frame:this.frame+1,id:item.id,mappedId:item.mappedId,feature:item.feature,
            forced:item.forced,nis:item.nis,
            beforeError:Math.hypot(this.x[0]-this.truth[0],this.x[1]-this.truth[1]),
            beforeSigma:this.robotUncertainty
          };
        }
      }
      for (const item of matches) if (item.feature !== null) { this.correct(item.z,item.feature); associated++; }
      for (const item of matches) if (item.feature === null && !item.discard) {
        const index = this.featureCount;
        this.augment(item.z);
        this.featureTrueId[index] = item.z.id;
        if (this.association === "known") this.knownMap.set(item.z.id,index);
        added++;
      }
      for (const z of scan) this.lastSeen.set(z.id,this.frame);
      this.lastScan = scan;
      this.lastAssociated = associated;
      this.lastNew = added;
      if (forced) this.falseClosureApplied = true;
      this.pending = null;
      this.pendingAssociation = null;
      this.frame++;
      this.pathTrue.push(this.truth.slice(0,2));
      this.pathEstimated.push(this.x.slice(0,2));
      if (this.firstError?.frame === this.frame && this.firstError.afterError === undefined) {
        this.firstError.afterError = Math.hypot(this.x[0]-this.truth[0],this.x[1]-this.truth[1]);
        this.firstError.afterSigma = this.robotUncertainty;
      }
      if (closing && !this.closureImpact) this.closureImpact = {
        beforeRobot, afterRobot:this.robotUncertainty,
        beforeMap, afterMap:this.mapUncertainty,
        observed:scan.length, associated, frame:this.frame
      };
      return wrong ? "association-error" : closing ? "closure-applied" : "advanced";
    }

    // Historial corto para el botón «Anterior». Los caminos se restauran por longitud.
    snapshot() {
      return {x:this.x.slice(),P:cloneMatrix(this.P),truth:this.truth.slice(),
        steer:this.steer,target:this.target,lap:this.lap,frame:this.frame,time:this.time,
        done:this.done,pending:this.pending ? this.pending.map(z=>({...z})) : null,
        knownMap:[...this.knownMap],featureTrueId:this.featureTrueId.slice(),
        lastSeen:[...this.lastSeen],
        randomState:this.random.state,randomSpare:this.random.spare,
        trueLength:this.pathTrue.length,estimateLength:this.pathEstimated.length,
        lastScan:this.lastScan.map(z=>({...z})),lastAssociated:this.lastAssociated,
        pendingAssociation:this.pendingAssociation?.map(item=>({...item,z:{...item.z}})) || null,
        lastAssociations:this.lastAssociations.map(item=>({...item})),
        associationTotals:{...this.associationTotals},firstError:this.firstError ? {...this.firstError} : null,
        falseClosureApplied:this.falseClosureApplied,
        lastNew:this.lastNew,closureImpact:this.closureImpact ? {...this.closureImpact} : null,
        closureGhost:this.closureGhost ? {x:this.closureGhost.x.slice(),P:cloneMatrix(this.closureGhost.P)} : null};
    }
    restore(s) {
      this.x=s.x;this.P=s.P;this.truth=s.truth;this.steer=s.steer;this.target=s.target;
      this.lap=s.lap;this.frame=s.frame;this.time=s.time;this.done=s.done;this.pending=s.pending;
      this.knownMap=new Map(s.knownMap);this.featureTrueId=s.featureTrueId;
      this.lastSeen=new Map(s.lastSeen);
      this.random.state=s.randomState;this.random.spare=s.randomSpare;
      this.pathTrue.length=s.trueLength;this.pathEstimated.length=s.estimateLength;
      this.lastScan=s.lastScan;this.lastAssociated=s.lastAssociated;this.lastNew=s.lastNew;
      this.pendingAssociation=s.pendingAssociation;this.lastAssociations=s.lastAssociations;
      this.associationTotals=s.associationTotals;this.firstError=s.firstError;
      this.falseClosureApplied=s.falseClosureApplied;
      this.closureImpact=s.closureImpact;this.closureGhost=s.closureGhost;
    }
  }

  window.SLAM = {EKFSLAM, LANDMARKS, AMBIGUOUS_IDS, WAYPOINTS, CFG};
})();
