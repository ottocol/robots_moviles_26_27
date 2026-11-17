// Sesión de simulación: árbol cargado, valores de hojas, historial y tick en curso.
// No depende de React: la interfaz se suscribe con useSyncExternalStore.

import type { LeafValues, NodeResult, RuntimeState, TraceEvent, TreeDoc } from './model';
import { createRuntime } from './engine';
import { TickRun } from './run';
import { indexTree, typeOf, type TreeIndex } from './tree';

export interface TickRecord {
  /** Número de tick (1, 2, ...). */
  n: number;
  result: NodeResult | null;
  error: string | null;
  events: TraceEvent[];
  /** Valor que devolvió cada hoja visitada (el último, si se invocó varias veces). */
  leafValues: LeafValues;
  rtAfter: RuntimeState;
  /** Algún nodo pidió re-tick inmediato. */
  wakeUp: boolean;
}

export interface LiveTick {
  n: number;
  events: TraceEvent[];
  rt: RuntimeState;
}

export interface SessionSnapshot {
  readonly doc: TreeDoc;
  readonly index: TreeIndex;
  /** Valores de las hojas que se usarán cuando el tick llegue a ellas. */
  readonly leafValues: LeafValues;
  readonly history: readonly TickRecord[];
  /** Tick en curso en modo paso a paso. */
  readonly live: LiveTick | null;
  /** Tick del historial que se está mirando (null = el último / el actual). */
  readonly viewing: number | null;
  readonly selected: string | null;
  /** Aplicar el escenario del YAML antes de cada tick. */
  readonly useScenario: boolean;
}

/** Valores iniciales: el primer valor permitido de cada hoja (SUCCESS). */
function initialLeafValues(index: TreeIndex): LeafValues {
  const values: LeafValues = {};
  for (const leaf of index.userLeaves) {
    values[leaf.id] = typeOf(leaf).leafValues?.(leaf)[0] ?? 'SUCCESS';
  }
  return values;
}

/** En el paso a paso, ¿se detiene en este evento? (el tick a una hoja se junta con su resultado). */
function isStepStop(index: TreeIndex, e: TraceEvent): boolean {
  if (e.kind !== 'tick') return true;
  const node = index.byId.get(e.id);
  return node ? typeOf(node).category !== 'leaf' : true;
}

export class Session {
  private snap: SessionSnapshot;
  private run: TickRun | null = null;
  private readonly initialRt: RuntimeState;
  private readonly listeners = new Set<() => void>();

  constructor(doc: TreeDoc) {
    const index = indexTree(doc.root);
    this.initialRt = createRuntime(doc.root);
    this.snap = {
      doc,
      index,
      leafValues: initialLeafValues(index),
      history: [],
      live: null,
      viewing: null,
      selected: null,
      useScenario: doc.scenario.length > 0,
    };
    if (this.snap.useScenario) this.applyScenario(1);
  }

  // --- suscripción -------------------------------------------------------
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): SessionSnapshot => this.snap;

  private update(patch: Partial<SessionSnapshot>): void {
    this.snap = { ...this.snap, ...patch };
    for (const l of this.listeners) l();
  }

  // --- consultas ---------------------------------------------------------
  /** Estado de ejecución tras el último tick terminado. */
  get committedRt(): RuntimeState {
    return this.snap.history.at(-1)?.rtAfter ?? this.initialRt;
  }

  get nextTickNumber(): number {
    return this.snap.history.length + 1;
  }

  // --- acciones ----------------------------------------------------------
  setLeafValue(id: string, value: NodeResult): void {
    this.update({ leafValues: { ...this.snap.leafValues, [id]: value } });
  }

  setUseScenario(on: boolean): void {
    this.update({ useScenario: on });
    if (on && !this.run) this.applyScenario(this.nextTickNumber);
  }

  select(id: string | null): void {
    this.update({ selected: id });
  }

  view(n: number | null): void {
    this.update({ viewing: n === this.snap.history.length ? null : n });
  }

  /** Tick completo. Si hay un tick paso a paso en curso, lo termina. */
  tick(): void {
    const run = this.run ?? this.startRun();
    run.runToEnd();
    this.commit(run);
  }

  /** Un paso. Empieza un tick nuevo si no hay ninguno en curso. */
  step(): void {
    const run = this.run ?? this.startRun();
    run.advanceUntil((e) => isStepStop(this.snap.index, e));
    if (run.done) this.commit(run);
    else this.update({ live: { n: this.nextTickNumber, events: [...run.events], rt: structuredClone(run.rt) } });
  }

  /** Vuelve al estado anterior al último tick (o cancela el tick en curso). */
  undo(): void {
    if (this.run) {
      this.run = null;
      this.update({ live: null });
      return;
    }
    if (!this.snap.history.length) return;
    this.update({ history: this.snap.history.slice(0, -1), viewing: null });
    if (this.snap.useScenario) this.applyScenario(this.nextTickNumber);
  }

  /** Todo a IDLE y sin historial. */
  reset(): void {
    this.run = null;
    this.update({ history: [], live: null, viewing: null });
    if (this.snap.useScenario) this.applyScenario(1);
  }

  // --- internos ----------------------------------------------------------
  private startRun(): TickRun {
    // Las hojas se leen en el momento en que la pasada llega a ellas.
    const run = new TickRun(this.snap.doc.root, this.committedRt, (id) => this.snap.leafValues[id]);
    this.run = run;
    this.update({ viewing: null });
    return run;
  }

  private commit(run: TickRun): void {
    const leafValues: LeafValues = {};
    for (const e of run.events) {
      if (e.kind === 'return' && e.id in this.snap.leafValues) leafValues[e.id] = e.status;
    }
    const record: TickRecord = {
      n: this.nextTickNumber,
      result: run.result,
      error: run.error,
      events: run.events,
      leafValues,
      rtAfter: run.rt,
      wakeUp: run.events.some((e) => e.kind === 'wakeup'),
    };
    this.run = null;
    this.update({ history: [...this.snap.history, record], live: null, viewing: null });
    if (this.snap.useScenario) this.applyScenario(this.nextTickNumber);
  }

  /** Copia en la tabla los valores del escenario para el tick n (si los hay). */
  private applyScenario(n: number): void {
    const values = this.snap.doc.scenario[n - 1];
    if (values) this.update({ leafValues: { ...this.snap.leafValues, ...values } });
  }
}
