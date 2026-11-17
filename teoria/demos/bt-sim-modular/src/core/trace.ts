// Resumen de una traza por nodo, para pintar el árbol y el historial.

import type { NodeResult, TraceEvent } from './model';

export interface NodeTickInfo {
  /** Se le hizo tick al menos una vez. */
  visited: boolean;
  /** Tiene un tick empezado y sin devolver (solo durante el paso a paso). */
  evaluating: boolean;
  /** Resultados devueltos, en orden (puede haber varios: Repeat, Retry...). */
  returns: NodeResult[];
  halted: boolean;
  wakeUp: boolean;
}

export function summarize(events: readonly TraceEvent[]): Map<string, NodeTickInfo> {
  const out = new Map<string, NodeTickInfo>();
  const open = new Map<string, number>();
  const get = (id: string): NodeTickInfo => {
    let info = out.get(id);
    if (!info) {
      info = { visited: false, evaluating: false, returns: [], halted: false, wakeUp: false };
      out.set(id, info);
    }
    return info;
  };
  for (const e of events) {
    const info = get(e.id);
    switch (e.kind) {
      case 'tick':
        info.visited = true;
        open.set(e.id, (open.get(e.id) ?? 0) + 1);
        break;
      case 'return':
        info.returns.push(e.status);
        open.set(e.id, (open.get(e.id) ?? 1) - 1);
        break;
      case 'halt':
        info.halted = true;
        break;
      case 'wakeup':
        info.wakeUp = true;
        break;
    }
  }
  for (const [id, n] of open) if (n > 0) get(id).evaluating = true;
  return out;
}

/** Resultados en orden de devolución (lo que muestra cada entrada del historial). */
export function returnsInOrder(events: readonly TraceEvent[]): Array<{ id: string; status: NodeResult }> {
  return events.flatMap((e) => (e.kind === 'return' ? [{ id: e.id, status: e.status }] : []));
}
