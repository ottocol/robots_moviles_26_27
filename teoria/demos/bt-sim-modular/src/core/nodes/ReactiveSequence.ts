import type { NodeType } from './types';
import { DOCS } from './docs';

// src/controls/reactive_sequence.cpp
export const ReactiveSequence: NodeType = {
  type: 'ReactiveSequence',
  category: 'control',
  minChildren: 1,
  maxChildren: Infinity,
  params: [],
  classic: '→',
  docUrl: DOCS.sequence('reactivesequence'),
  *tick(api) {
    for (let i = 0; i < api.childCount; i++) {
      const result = yield* api.tickChild(i);
      if (result === 'RUNNING') {
        // Deja en IDLE (interrumpiendo si hace falta) a todos los demás hijos.
        for (let j = 0; j < api.childCount; j++) {
          if (j !== i) yield* api.haltChild(j);
        }
        return 'RUNNING';
      }
      if (result === 'FAILURE') {
        yield* api.resetChildren();
        return 'FAILURE';
      }
    }
    yield* api.resetChildren();
    return 'SUCCESS';
  },
};
