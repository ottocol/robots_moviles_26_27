import type { NodeType } from './types';
import { DOCS } from './docs';

/** Condición: síncrona, solo SUCCESS o FAILURE. */
export const Condition: NodeType = {
  type: 'Condition',
  category: 'leaf',
  minChildren: 0,
  maxChildren: 0,
  params: [],
  docUrl: DOCS.leaves,
  leafValues: () => ['SUCCESS', 'FAILURE'],
  *tick(api) {
    return yield* api.leafValue();
  },
};
