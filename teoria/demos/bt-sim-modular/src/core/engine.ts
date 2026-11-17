// Motor de ejecución. Recorre el árbol con generadores y reproduce la semántica de
// TreeNode::executeTick(), haltNode() y resetStatus() de BT.CPP.

import type { NodeDef, NodeResult, NodeRuntime, RuntimeState } from './model';
import type { EngineGen, NodeApi } from './nodes/types';
import { getNodeType } from './nodes/registry';

/** Tope de ticks a nodos en una pasada: protege de bucles infinitos. */
export const MAX_TICKS_PER_PASS = 5000;

export class InvocationLimitError extends Error {
  constructor() {
    super(
      `La pasada superó ${MAX_TICKS_PER_PASS} ticks a nodos y se ha detenido (¿un bucle infinito?).`,
    );
  }
}

/** Estado inicial: todos los nodos en IDLE y con la memoria inicial de su tipo. */
export function createRuntime(root: NodeDef): RuntimeState {
  const rt: RuntimeState = {};
  const visit = (node: NodeDef) => {
    rt[node.id] = { status: 'IDLE', data: getNodeType(node.type).initData?.() ?? {} };
    node.children.forEach(visit);
  };
  visit(root);
  return rt;
}

/** Datos de una única pasada por el árbol (una llamada a la raíz). */
class Pass {
  ticks = 0;
  readonly leafInvocations = new Map<string, number>();
  constructor(readonly rt: RuntimeState) {}

  runtime(node: NodeDef): NodeRuntime {
    const r = this.rt[node.id];
    if (!r) throw new Error(`Nodo sin estado de ejecución: ${node.id}`);
    return r;
  }
}

function makeApi(node: NodeDef, pass: Pass): NodeApi {
  const runtime = pass.runtime(node);
  const child = (i: number): NodeDef => {
    const c = node.children[i];
    if (!c) throw new Error(`${node.id} no tiene hijo ${i}`);
    return c;
  };
  return {
    node,
    data: runtime.data,
    childCount: node.children.length,
    childStatus: (i) => pass.runtime(child(i)).status,
    tickChild: (i) => tickNode(child(i), pass),
    haltChild: (i) => resetNode(child(i), pass),
    *resetChildren() {
      for (const c of node.children) yield* resetNode(c, pass);
    },
    *wakeUp() {
      yield { kind: 'wakeup', id: node.id };
    },
    *leafValue() {
      const invocation = (pass.leafInvocations.get(node.id) ?? 0) + 1;
      pass.leafInvocations.set(node.id, invocation);
      const value = yield { kind: 'leaf-request', id: node.id, invocation };
      if (!value) throw new Error(`No hay valor para la hoja ${node.id}`);
      return value;
    },
    param: (name) => {
      const value = node.params[name];
      if (value === undefined) throw new Error(`${node.id}: falta el parámetro ${name}`);
      return value;
    },
  };
}

/** executeTick(): un tick a un nodo. */
function* tickNode(node: NodeDef, pass: Pass): EngineGen {
  const type = getNodeType(node.type);
  const runtime = pass.runtime(node);
  yield { kind: 'tick', id: node.id };
  if (++pass.ticks > MAX_TICKS_PER_PASS) throw new InvocationLimitError();
  // Todos los controles y decoradores de BT.CPP hacen setStatus(RUNNING) al empezar.
  if (type.category !== 'leaf') runtime.status = 'RUNNING';
  const result = yield* type.tick(makeApi(node, pass));
  runtime.status = result;
  yield { kind: 'return', id: node.id, status: result };
  return result;
}

/** haltChild(): interrumpe el nodo si está en RUNNING y lo deja en IDLE. */
function* resetNode(node: NodeDef, pass: Pass): EngineGen<void> {
  const runtime = pass.runtime(node);
  if (runtime.status === 'RUNNING') yield* haltNode(node, pass);
  runtime.status = 'IDLE';
}

/** Reinicia la memoria en el mismo objeto (otros pueden tener una referencia a él). */
function resetData(data: Record<string, number>, initial: Record<string, number>): void {
  for (const key of Object.keys(data)) delete data[key];
  Object.assign(data, initial);
}

/** haltNode(): interrumpe un nodo en RUNNING y, recursivamente, a sus hijos. */
function* haltNode(node: NodeDef, pass: Pass): EngineGen<void> {
  const type = getNodeType(node.type);
  const runtime = pass.runtime(node);
  yield { kind: 'halt', id: node.id };
  for (const c of node.children) yield* resetNode(c, pass);
  if (type.onHalt) type.onHalt(runtime.data);
  else resetData(runtime.data, type.initData?.() ?? {});
  runtime.status = 'IDLE';
}

/**
 * Una pasada por el árbol: equivale a Tree::tickExactlyOnce(). Modifica `rt`.
 * Si la raíz termina, vuelve a IDLE, como hace Tree::tickRoot().
 */
export function* tickTree(root: NodeDef, rt: RuntimeState): EngineGen {
  const pass = new Pass(rt);
  const result: NodeResult = yield* tickNode(root, pass);
  if (result !== 'RUNNING') pass.runtime(root).status = 'IDLE';
  return result;
}
