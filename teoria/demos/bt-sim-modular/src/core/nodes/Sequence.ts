import type { NodeType } from './types';
import { DOCS } from './docs';
import { describeChildIndex } from './memory';

// src/controls/sequence_node.cpp (versión síncrona, sin SKIPPED).
export const Sequence: NodeType = {
  type: 'Sequence',
  category: 'control',
  minChildren: 1,
  maxChildren: Infinity,
  params: [],
  classic: '→*',
  docUrl: DOCS.sequence('sequence'),
  initData: () => ({ idx: 0 }),
  *tick(api) {
    while (api.data.idx < api.childCount) {
      const result = yield* api.tickChild(api.data.idx);
      if (result === 'RUNNING') return 'RUNNING';
      if (result === 'FAILURE') {
        yield* api.resetChildren();
        api.data.idx = 0;
        return 'FAILURE';
      }
      api.data.idx++;
    }
    yield* api.resetChildren();
    api.data.idx = 0;
    return 'SUCCESS';
  },
  describe: describeChildIndex,
};
