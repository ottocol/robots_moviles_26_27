// Índice de un árbol para consultas rápidas (por id, padre, hojas).

import type { NodeDef } from './model';
import type { NodeType } from './nodes/types';
import { getNodeType, isUserLeaf } from './nodes/registry';

export interface TreeIndex {
  readonly root: NodeDef;
  /** Todos los nodos en preorden. */
  readonly nodes: readonly NodeDef[];
  readonly byId: ReadonlyMap<string, NodeDef>;
  readonly parent: ReadonlyMap<string, NodeDef>;
  /** Hojas cuyo valor decide el usuario, en preorden. */
  readonly userLeaves: readonly NodeDef[];
}

export function indexTree(root: NodeDef): TreeIndex {
  const nodes: NodeDef[] = [];
  const byId = new Map<string, NodeDef>();
  const parent = new Map<string, NodeDef>();
  const visit = (node: NodeDef) => {
    nodes.push(node);
    byId.set(node.id, node);
    for (const c of node.children) {
      parent.set(c.id, node);
      visit(c);
    }
  };
  visit(root);
  const userLeaves = nodes.filter((n) => isUserLeaf(getNodeType(n.type)));
  return { root, nodes, byId, parent, userLeaves };
}

export function typeOf(node: NodeDef): NodeType {
  return getNodeType(node.type);
}
