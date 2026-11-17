import type { NodeType } from './types';
import { DOCS } from './docs';
import { describeChildIndex } from './memory';

// src/controls/sequence_with_memory_node.cpp
export const SequenceWithMemory: NodeType = {
  type: 'SequenceWithMemory',
  category: 'control',
  minChildren: 1,
  maxChildren: Infinity,
  params: [],
  docUrl: DOCS.sequence('sequencewithmemory'),
  initData: () => ({ idx: 0 }),
  *tick(api) {
    while (api.data.idx < api.childCount) {
      const prev = api.childStatus(api.data.idx);
      const result = yield* api.tickChild(api.data.idx);
      if (result === 'RUNNING') return 'RUNNING';
      if (result === 'FAILURE') {
        // No reinicia el índice: el siguiente tick reintenta este mismo hijo.
        for (let j = api.data.idx; j < api.childCount; j++) yield* api.haltChild(j);
        return 'FAILURE';
      }
      api.data.idx++;
      // Un hijo que acaba de terminar sin haber estado en RUNNING: cede el control.
      if (prev === 'IDLE' && api.data.idx < api.childCount) {
        yield* api.wakeUp();
        return 'RUNNING';
      }
    }
    yield* api.resetChildren();
    api.data.idx = 0;
    return 'SUCCESS';
  },
  // A diferencia de Sequence, halt() no reinicia el índice.
  onHalt: () => {},
  describe: describeChildIndex,
};
