import type { NodeDef, NodeResult, TraceEvent } from '../core/model';
import type { TreeIndex } from '../core/tree';
import { typeOf } from '../core/tree';

export const RESULT_CLASS: Record<NodeResult, string> = {
  SUCCESS: 'ok',
  FAILURE: 'fail',
  RUNNING: 'run',
};

/** "Detectar objeto (A)", o solo el nombre si coincide con el id o con el tipo. */
export function nodeLabel(node: NodeDef): string {
  if (node.name === node.id || node.name === node.type) return node.name;
  return `${node.name} (${node.id})`;
}

/** Nombre corto para chips del historial: el id si es breve, si no el nombre. */
export function shortLabel(node: NodeDef): string {
  return node.id.length <= 10 ? node.id : node.name;
}

/** Símbolo que se muestra delante del nodo. */
export function glyphOf(node: NodeDef): string | null {
  const type = typeOf(node);
  if (type.classic) return type.classic;
  if (type.category === 'decorator') return '◇';
  return null;
}

export function describeEvent(e: TraceEvent, index: TreeIndex): string {
  const node = index.byId.get(e.id);
  const label = node ? nodeLabel(node) : e.id;
  const type = node ? node.type : '';
  switch (e.kind) {
    case 'tick':
      return `tick a ${type} ${label === type ? '' : label}`.trim();
    case 'return':
      return `${label} devuelve ${e.status}`;
    case 'halt':
      return `${label} se interrumpe (halt)`;
    case 'wakeup':
      return `${label} pide re-tick`;
  }
}
