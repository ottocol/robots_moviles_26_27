import type { NodeType } from './types';
import { DOCS } from './docs';

// include/behaviortree_cpp/decorators/force_failure_node.h
export const ForceFailure: NodeType = {
  type: 'ForceFailure',
  category: 'decorator',
  minChildren: 1,
  maxChildren: 1,
  params: [],
  docUrl: DOCS.decorator('forcefailure'),
  *tick(api) {
    const result = yield* api.tickChild(0);
    if (result === 'RUNNING') return 'RUNNING';
    yield* api.haltChild(0);
    return 'FAILURE';
  },
};
