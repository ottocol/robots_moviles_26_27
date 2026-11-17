import type { NodeDef } from '../model';

/** Etiqueta "hijo i/n" para controles que recuerdan el hijo en curso (solo si no es el primero). */
export function describeChildIndex(node: NodeDef, data: Record<string, number>): string | null {
  const idx = data.idx ?? 0;
  return idx > 0 ? `hijo ${idx + 1}/${node.children.length}` : null;
}
