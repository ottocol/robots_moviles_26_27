import type { NodeType } from './types';
import { DOCS } from './docs';

// src/decorators/inverter_node.cpp
export const Inverter: NodeType = {
  type: 'Inverter',
  category: 'decorator',
  minChildren: 1,
  maxChildren: 1,
  params: [],
  docUrl: DOCS.decorator('inverter'),
  *tick(api) {
    const result = yield* api.tickChild(0);
    if (result === 'RUNNING') return 'RUNNING';
    yield* api.haltChild(0);
    return result === 'SUCCESS' ? 'FAILURE' : 'SUCCESS';
  },
};
