// Conductor de una pasada: consume el generador del motor de golpe o evento a evento.

import type { LeafValues, NodeDef, NodeResult, RuntimeState, TraceEvent } from './model';
import type { EngineGen, EngineYield } from './nodes/types';
import { tickTree } from './engine';

/** Devuelve el valor de una hoja cuando la pasada llega a ella. */
export type LeafSource = (id: string, invocation: number) => NodeResult | undefined;

export function tableSource(values: LeafValues): LeafSource {
  return (id) => values[id];
}

export class TickRun {
  /** Copia del estado de ejecución que esta pasada va modificando. */
  readonly rt: RuntimeState;
  readonly events: TraceEvent[] = [];
  result: NodeResult | null = null;
  error: string | null = null;
  private finished = false;
  private readonly gen: EngineGen;
  private input: NodeResult | undefined;

  constructor(
    root: NodeDef,
    rtBefore: RuntimeState,
    private readonly source: LeafSource,
  ) {
    this.rt = structuredClone(rtBefore);
    this.gen = tickTree(root, this.rt);
  }

  get done(): boolean {
    return this.finished;
  }

  /** Avanza hasta el siguiente evento visible. Devuelve null cuando la pasada termina. */
  next(): TraceEvent | null {
    while (!this.finished) {
      let step: IteratorResult<EngineYield, NodeResult>;
      try {
        step = this.gen.next(this.input);
      } catch (e) {
        this.error = e instanceof Error ? e.message : String(e);
        this.finished = true;
        return null;
      }
      this.input = undefined;
      if (step.done) {
        this.result = step.value;
        this.finished = true;
        return null;
      }
      const y = step.value;
      if (y.kind === 'leaf-request') {
        this.input = this.source(y.id, y.invocation);
        continue;
      }
      this.events.push(y);
      return y;
    }
    return null;
  }

  /** Avanza hasta un evento que cumpla `stop` (incluido) o hasta el final. */
  advanceUntil(stop: (e: TraceEvent) => boolean): TraceEvent | null {
    for (let e = this.next(); e; e = this.next()) {
      if (stop(e)) return e;
    }
    return null;
  }

  runToEnd(): void {
    while (this.next());
  }
}
