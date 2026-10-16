/* Vista didáctica de P. No interviene en las ecuaciones del filtro. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const format = n => n.toLocaleString("es-ES", {maximumSignificantDigits:4});
  const variable = index => index < 3
    ? ["Robot x", "Robot y", "Robot θ"][index]
    : `L${Math.floor((index-3)/2)+1} ${index%2 ? "x" : "y"}`;
  const palette = target => Array.from({length:256}, (_,i) => {
    const t=i/255;
    return `rgb(${target.map(v=>Math.round(255+(v-255)*t)).join(",")})`;
  });
  const positive = palette([198,67,91]), negative = palette([52,117,183]);

  const positionIndices = P => Array.from({length:P.length},(_,i)=>i).filter(i=>i!==2);
  function positionTrace(P) { return positionIndices(P).reduce((sum,i)=>sum+P[i][i],0); }
  function meanCrossPosition(P) {
    let sum=0,count=0;
    const indices=positionIndices(P);
    for (let a=0;a<indices.length;a++) for (let b=a+1;b<indices.length;b++) {
      sum+=Math.abs(P[indices[a]][indices[b]]);count++;
    }
    return count ? sum/count : 0;
  }
  function correlation(P,row,col) {
    const denominator = Math.sqrt(Math.max(0,P[row][row]*P[col][col]));
    return denominator>0 ? Math.max(-1,Math.min(1,P[row][col]/denominator)) : 0;
  }

  class MatrixView {
    constructor() {
      this.last = null;
      this.meta = new Map();
      $("matrixMode").addEventListener("change",()=>this.render(this.last));
      $("matrixContrast").addEventListener("change",()=>this.render(this.last));
      for (const [canvasId,hoverId] of [["matrixCurrent","currentHover"],["matrixBefore","beforeHover"]]) {
        const canvas=$(canvasId);
        canvas.addEventListener("mousemove",event=>this.hover(event,canvas,$(hoverId)));
        canvas.addEventListener("mouseleave",()=>{$(hoverId).textContent="Pasa el cursor sobre una celda para ver su valor.";});
      }
      new ResizeObserver(()=>this.render(this.last)).observe($("matrixGrid"));
    }

    render(data) {
      if (!data) return;
      this.last=data;
      const {current,before,frame}=data, mode=$("matrixMode").value;
      const contrast=$("matrixContrast").value;
      $("matrixContrast").disabled=mode==="correlation";
      $("beforePanel").hidden=!before;
      $("matrixGrid").classList.toggle("comparison-active",!!before);
      $("currentMatrixTitle").textContent=`Estado actual · fotograma ${frame}`;
      $("currentDimensions").textContent=`${current.length} × ${current.length}`;
      if (before) $("beforeDimensions").textContent=`${before.length} × ${before.length}`;

      let maximum=1;
      if (mode==="covariance") {
        maximum=0;
        for(const P of [current,before].filter(Boolean))
          for(const row of P) for(const value of row) maximum=Math.max(maximum,Math.abs(value));
        maximum=Math.max(maximum,1e-12);
      }
      $("matrixMin").textContent=`−${mode==="correlation" ? "1" : format(maximum)}`;
      $("matrixMax").textContent=`+${mode==="correlation" ? "1" : format(maximum)}`;
      $("matrixNote").textContent=mode==="correlation"
        ? "ρij = Pij / √(Pii Pjj), entre −1 y +1. Muestra dependencias sin unidades; su magnitud no tiene por qué disminuir cuando baja la incertidumbre."
        : `Escala ${contrast==="linear"?"lineal":"de raíz cuadrada"} compartida. P mezcla m², rad² y m·rad; cambia a correlación ρ para comparar dependencias sin unidades.`;

      if (before) this.drawOne($("matrixBefore"),before,maximum,mode,contrast);
      else this.meta.delete($("matrixBefore"));
      this.drawOne($("matrixCurrent"),current,maximum,mode,contrast);
      const summary=$("matrixSummary");
      summary.hidden=!before;
      if (before) {
        const beforeTrace=positionTrace(before),afterTrace=positionTrace(current);
        const beforeCross=meanCrossPosition(before),afterCross=meanCrossPosition(current);
        const dropTrace=100*(1-afterTrace/Math.max(1e-12,beforeTrace));
        const dropCross=100*(1-afterCross/Math.max(1e-12,beforeCross));
        summary.replaceChildren();
        const a=document.createElement("span"), b=document.createElement("span");
        a.textContent=`Varianza total de posición: ${format(beforeTrace)} → ${format(afterTrace)} (${format(dropTrace)} % menos)`;
        b.textContent=`Media |covarianza cruzada de posición|: ${format(beforeCross)} → ${format(afterCross)} (${format(dropCross)} % menos)`;
        summary.append(a,b);
      }
    }

    drawOne(canvas,P,maximum,mode,contrast) {
      const width=canvas.clientWidth;
      if (!width) return;
      const dpr=window.devicePixelRatio||1;
      canvas.width=Math.round(width*dpr);
      canvas.height=Math.round(width*dpr);
      const context=canvas.getContext("2d");
      context.setTransform(dpr,0,0,dpr,0,0);
      context.fillStyle="#fff";context.fillRect(0,0,width,width);
      const left=38,top=29,size=width-47,n=P.length,cell=size/n;
      this.meta.set(canvas,{P,mode,left,top,cell,n});
      for(let row=0;row<n;row++) for(let col=0;col<n;col++) {
        const value=mode==="correlation"?correlation(P,row,col):P[row][col]/maximum;
        const magnitude=Math.min(1,Math.abs(value));
        const intensity=mode==="covariance"&&contrast==="sqrt"?Math.sqrt(magnitude):magnitude;
        context.fillStyle=(value<0?negative:positive)[Math.round(255*intensity)];
        context.fillRect(left+col*cell,top+row*cell,Math.ceil(cell+.2),Math.ceil(cell+.2));
      }
      // Límites de bloques: robot (3 variables) y landmarks (pares x,y).
      context.strokeStyle="#9db2ba";context.lineWidth=1;
      for(let index=3;index<n;index+=2) {
        const p=left+index*cell,q=top+index*cell;
        context.beginPath();context.moveTo(p,top);context.lineTo(p,top+size);
        context.moveTo(left,q);context.lineTo(left+size,q);context.stroke();
      }
      context.strokeStyle="#234653";context.lineWidth=1.5;
      context.strokeRect(left,top,size,size);
      context.beginPath();context.moveTo(left+3*cell,top);context.lineTo(left+3*cell,top+size);
      context.moveTo(left,top+3*cell);context.lineTo(left+size,top+3*cell);context.stroke();
      context.fillStyle="#6e8791";context.font="11px system-ui";
      context.fillText("R",left+2,top-9);
      context.fillText("R",8,top+Math.min(2*cell,19));
      for(let feature=0;feature<(n-3)/2;feature+=10) {
        const p=left+(3+feature*2)*cell,q=top+(3+feature*2)*cell;
        context.fillText(`L${feature+1}`,p+2,top-9);
        context.fillText(`L${feature+1}`,5,q+Math.min(cell,13));
      }
    }

    hover(event,canvas,label) {
      const info=this.meta.get(canvas);
      if(!info) return;
      const rect=canvas.getBoundingClientRect();
      const x=(event.clientX-rect.left)*canvas.clientWidth/rect.width;
      const y=(event.clientY-rect.top)*canvas.clientWidth/rect.width;
      const col=Math.floor((x-info.left)/info.cell),row=Math.floor((y-info.top)/info.cell);
      if(row<0||col<0||row>=info.n||col>=info.n) {
        label.textContent="Pasa el cursor sobre una celda para ver su valor.";return;
      }
      const value=info.mode==="correlation"?correlation(info.P,row,col):info.P[row][col];
      label.textContent=`${info.mode==="correlation"?"ρ":"P"}[${variable(row)}, ${variable(col)}] = ${format(value)}${row===col?" · varianza":" · término cruzado"}`;
    }
  }
  window.MatrixView=MatrixView;
})();
