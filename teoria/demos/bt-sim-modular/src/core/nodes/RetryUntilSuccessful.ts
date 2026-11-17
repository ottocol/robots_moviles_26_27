import type { NodeType } from './types';
import { DOCS } from './docs';

// src/decorators/retry_node.cpp
export const RetryUntilSuccessful: NodeType = {
  type: 'RetryUntilSuccessful',
  aliases: ['RetryUntilSuccesful'],
  category: 'decorator',
  minChildren: 1,
  maxChildren: 1,
  params: [
    {
      name: 'num_attempts',
      kind: 'int',
      required: true,
      min: -1,
      description: 'Número máximo de intentos; -1 para infinitos.',
    },
  ],
  docUrl: DOCS.decorator('retryuntilsuccessful'),
  initData: () => ({ count: 0 }),
  *tick(api) {
    const n = api.param('num_attempts') as number;
    let loop = api.data.count < n || n === -1;
    while (loop) {
      const prev = api.childStatus(0);
      const result = yield* api.tickChild(0);
      if (result === 'RUNNING') return 'RUNNING';
      if (result === 'SUCCESS') {
        api.data.count = 0;
        yield* api.haltChild(0);
        return 'SUCCESS';
      }
      api.data.count++;
      loop = api.data.count < n || n === -1;
      yield* api.haltChild(0);
      if (prev === 'IDLE' && loop) {
        yield* api.wakeUp();
        return 'RUNNING';
      }
    }
    api.data.count = 0;
    return 'FAILURE';
  },
  describe: (node, data) => {
    const n = node.params.num_attempts as number;
    return data.count ? `fallos ${data.count}/${n === -1 ? '∞' : n}` : null;
  },
};
