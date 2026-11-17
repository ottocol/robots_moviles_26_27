import type { NodeType } from './types';
import { DOCS } from './docs';

/**
 * Acción. Síncrona (SyncActionNode) por defecto: SUCCESS o FAILURE.
 * Con `async: true` (StatefulActionNode) también puede devolver RUNNING y ser interrumpida.
 */
export const Action: NodeType = {
  type: 'Action',
  category: 'leaf',
  minChildren: 0,
  maxChildren: 0,
  params: [
    {
      name: 'async',
      kind: 'bool',
      required: false,
      default: false,
      description: 'Acción asíncrona: puede devolver RUNNING durante varios ticks.',
    },
  ],
  docUrl: DOCS.leaves,
  leafValues: (node) =>
    node.params.async === true ? ['SUCCESS', 'FAILURE', 'RUNNING'] : ['SUCCESS', 'FAILURE'],
  *tick(api) {
    return yield* api.leafValue();
  },
};
