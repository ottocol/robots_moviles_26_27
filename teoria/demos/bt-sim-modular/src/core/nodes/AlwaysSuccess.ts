import type { NodeType } from './types';
import { DOCS } from './docs';

export const AlwaysSuccess: NodeType = {
  type: 'AlwaysSuccess',
  category: 'leaf',
  minChildren: 0,
  maxChildren: 0,
  params: [],
  docUrl: DOCS.leaves,
  // eslint-disable-next-line require-yield
  *tick() {
    return 'SUCCESS';
  },
};
