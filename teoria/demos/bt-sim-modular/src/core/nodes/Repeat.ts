import type { NodeType } from './types';
import { DOCS } from './docs';

// src/decorators/repeat_node.cpp
export const Repeat: NodeType = {
  type: 'Repeat',
  category: 'decorator',
  minChildren: 1,
  maxChildren: 1,
  params: [
    {
      name: 'num_cycles',
      kind: 'int',
      required: true,
      min: -1,
      description: 'Número de repeticiones; -1 para infinitas.',
    },
  ],
  docUrl: DOCS.decorator('repeat'),
  initData: () => ({ count: 0 }),
  *tick(api) {
    const n = api.param('num_cycles') as number;
    let loop = api.data.count < n || n === -1;
    while (loop) {
      const prev = api.childStatus(0);
      const result = yield* api.tickChild(0);
      if (result === 'RUNNING') return 'RUNNING';
      if (result === 'FAILURE') {
        api.data.count = 0;
        yield* api.haltChild(0);
        return 'FAILURE';
      }
      api.data.count++;
      loop = api.data.count < n || n === -1;
      yield* api.haltChild(0);
      // El hijo terminó sin haber estado en RUNNING: cede el control entre iteraciones.
      if (prev === 'IDLE' && loop) {
        yield* api.wakeUp();
        return 'RUNNING';
      }
    }
    api.data.count = 0;
    return 'SUCCESS';
  },
  describe: (node, data) => {
    const n = node.params.num_cycles as number;
    return `${data.count ?? 0}/${n === -1 ? '∞' : n}`;
  },
};
