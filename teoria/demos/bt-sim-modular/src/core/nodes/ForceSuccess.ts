import type { NodeType } from './types';
import { DOCS } from './docs';

// include/behaviortree_cpp/decorators/force_success_node.h
export const ForceSuccess: NodeType = {
  type: 'ForceSuccess',
  category: 'decorator',
  minChildren: 1,
  maxChildren: 1,
  params: [],
  docUrl: DOCS.decorator('forcesuccess'),
  *tick(api) {
    const result = yield* api.tickChild(0);
    if (result === 'RUNNING') return 'RUNNING';
    yield* api.haltChild(0);
    return 'SUCCESS';
  },
};
