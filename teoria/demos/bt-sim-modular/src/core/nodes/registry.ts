import type { NodeType } from './types';
import { Condition } from './Condition';
import { Action } from './Action';
import { AlwaysSuccess } from './AlwaysSuccess';
import { AlwaysFailure } from './AlwaysFailure';
import { Sequence } from './Sequence';
import { ReactiveSequence } from './ReactiveSequence';
import { SequenceWithMemory } from './SequenceWithMemory';
import { Fallback } from './Fallback';
import { ReactiveFallback } from './ReactiveFallback';
import { Inverter } from './Inverter';
import { ForceSuccess } from './ForceSuccess';
import { ForceFailure } from './ForceFailure';
import { Repeat } from './Repeat';
import { RetryUntilSuccessful } from './RetryUntilSuccessful';

export const NODE_TYPES: readonly NodeType[] = [
  Condition,
  Action,
  AlwaysSuccess,
  AlwaysFailure,
  Sequence,
  ReactiveSequence,
  SequenceWithMemory,
  Fallback,
  ReactiveFallback,
  Inverter,
  ForceSuccess,
  ForceFailure,
  Repeat,
  RetryUntilSuccessful,
];

const byName = new Map<string, NodeType>();
for (const t of NODE_TYPES) {
  for (const name of [t.type, ...(t.aliases ?? [])]) byName.set(name.toLowerCase(), t);
}

/** Busca un tipo por nombre o alias, sin distinguir mayúsculas. */
export function findNodeType(name: string): NodeType | undefined {
  return byName.get(name.toLowerCase());
}

export function getNodeType(name: string): NodeType {
  const t = findNodeType(name);
  if (!t) throw new Error(`Tipo de nodo desconocido: ${name}`);
  return t;
}

/** ¿El usuario decide lo que devuelve este nodo? */
export function isUserLeaf(type: NodeType): boolean {
  return type.leafValues !== undefined;
}
