import { useSyncExternalStore } from 'react';
import type { RuntimeState, TraceEvent } from '../core/model';
import type { Session, SessionSnapshot, TickRecord } from '../core/session';

export function useSessionSnapshot(session: Session): SessionSnapshot {
  return useSyncExternalStore(session.subscribe, session.getSnapshot);
}

/** Lo que se pinta en el árbol y la traza: el tick en curso, el que se está mirando o el último. */
export interface Displayed {
  kind: 'live' | 'record' | 'empty';
  n: number | null;
  events: readonly TraceEvent[];
  rt: RuntimeState;
  record: TickRecord | null;
  /** Nodo del último evento (paso a paso). */
  activeId: string | null;
}

export function displayed(snap: SessionSnapshot, committedRt: RuntimeState): Displayed {
  if (snap.live) {
    const last = snap.live.events.at(-1);
    return {
      kind: 'live',
      n: snap.live.n,
      events: snap.live.events,
      rt: snap.live.rt,
      record: null,
      activeId: last?.id ?? null,
    };
  }
  const record = snap.viewing ? snap.history[snap.viewing - 1] : snap.history.at(-1);
  if (record) {
    return { kind: 'record', n: record.n, events: record.events, rt: record.rtAfter, record, activeId: null };
  }
  return { kind: 'empty', n: null, events: [], rt: committedRt, record: null, activeId: null };
}
