import type { LeafValues, NodeDef, NodeResult, RuntimeState, TraceEvent } from '../src/core/model';
import { createRuntime } from '../src/core/engine';
import { parseTreeYaml } from '../src/core/parser';
import { TickRun, tableSource } from '../src/core/run';

export function parseOk(yaml: string): NodeDef {
  const { doc, errors } = parseTreeYaml(yaml);
  if (!doc) throw new Error(errors.map((e) => `${e.line}: ${e.message}`).join('\n'));
  return doc.root;
}

export interface TickOutcome {
  result: NodeResult | null;
  error: string | null;
  events: TraceEvent[];
  rt: RuntimeState;
  /** Hojas invocadas en orden: "A:SUCCESS". */
  leaves: string[];
  halts: string[];
  wakeUp: boolean;
}

/** Ejecuta varios ticks; los valores de las hojas se conservan entre ticks. */
export function simulate(root: NodeDef, ticks: LeafValues[]): TickOutcome[] {
  let rt = createRuntime(root);
  const values: LeafValues = {};
  return ticks.map((t) => {
    Object.assign(values, t);
    const run = new TickRun(root, rt, tableSource({ ...values }));
    run.runToEnd();
    rt = run.rt;
    const isLeaf = (id: string) => id in values;
    return {
      result: run.result,
      error: run.error,
      events: run.events,
      rt,
      leaves: run.events.flatMap((e) =>
        e.kind === 'return' && isLeaf(e.id) ? [`${e.id}:${e.status}`] : [],
      ),
      halts: run.events.flatMap((e) => (e.kind === 'halt' ? [e.id] : [])),
      wakeUp: run.events.some((e) => e.kind === 'wakeup'),
    };
  });
}

export const S = 'SUCCESS' as const;
export const F = 'FAILURE' as const;
export const R = 'RUNNING' as const;
