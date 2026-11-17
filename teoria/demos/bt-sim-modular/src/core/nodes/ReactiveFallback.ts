import type { NodeType } from './types';
import { DOCS } from './docs';

// src/controls/reactive_fallback.cpp
export const ReactiveFallback: NodeType = {
  type: 'ReactiveFallback',
  aliases: ['ReactiveSelector'],
  category: 'control',
  minChildren: 1,
  maxChildren: Infinity,
  params: [],
  classic: '?',
  docUrl: DOCS.fallback('reactivefallback'),
  *tick(api) {
    for (let i = 0; i < api.childCount; i++) {
      const result = yield* api.tickChild(i);
      if (result === 'RUNNING') {
        for (let j = 0; j < api.childCount; j++) {
          if (j !== i) yield* api.haltChild(j);
        }
        return 'RUNNING';
      }
      if (result === 'SUCCESS') {
        yield* api.resetChildren();
        return 'SUCCESS';
      }
    }
    yield* api.resetChildren();
    return 'FAILURE';
  },
};
