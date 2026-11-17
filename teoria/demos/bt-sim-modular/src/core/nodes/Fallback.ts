import type { NodeType } from './types';
import { DOCS } from './docs';
import { describeChildIndex } from './memory';

// src/controls/fallback_node.cpp (versión síncrona, sin SKIPPED).
export const Fallback: NodeType = {
  type: 'Fallback',
  aliases: ['Selector', 'Priority'],
  category: 'control',
  minChildren: 1,
  maxChildren: Infinity,
  params: [],
  classic: '?*',
  docUrl: DOCS.fallback('fallback'),
  initData: () => ({ idx: 0 }),
  *tick(api) {
    while (api.data.idx < api.childCount) {
      const result = yield* api.tickChild(api.data.idx);
      if (result === 'RUNNING') return 'RUNNING';
      if (result === 'SUCCESS') {
        yield* api.resetChildren();
        api.data.idx = 0;
        return 'SUCCESS';
      }
      api.data.idx++;
    }
    yield* api.resetChildren();
    api.data.idx = 0;
    return 'FAILURE';
  },
  describe: describeChildIndex,
};
