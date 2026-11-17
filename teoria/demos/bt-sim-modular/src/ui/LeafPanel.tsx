import type { LeafValues, NodeResult } from '../core/model';
import type { TreeIndex } from '../core/tree';
import { typeOf } from '../core/tree';
import { nodeLabel, RESULT_CLASS } from './format';

interface LeafPanelProps {
  index: TreeIndex;
  values: LeafValues;
  onChange: (id: string, value: NodeResult) => void;
  onSelect: (id: string) => void;
}

export function LeafPanel({ index, values, onChange, onSelect }: LeafPanelProps) {
  if (!index.userLeaves.length) {
    return <p className="muted">Este árbol no tiene hojas que elegir.</p>;
  }
  return (
    <table className="leaves">
      <thead>
        <tr>
          <th scope="col">Hoja</th>
          <th scope="col">Devuelve</th>
        </tr>
      </thead>
      <tbody>
        {index.userLeaves.map((leaf) => {
          const allowed = typeOf(leaf).leafValues!(leaf);
          return (
            <tr key={leaf.id}>
              <th scope="row">
                <button type="button" className="linklike" onClick={() => onSelect(leaf.id)}>
                  {nodeLabel(leaf)}
                </button>
                <span className="leaves__kind">
                  {leaf.type === 'Condition' ? 'condición' : leaf.params.async ? 'acción asíncrona' : 'acción'}
                </span>
              </th>
              <td>
                <div className="segmented" role="radiogroup" aria-label={`Valor de ${nodeLabel(leaf)}`}>
                  {allowed.map((v) => {
                    const id = `leaf-${leaf.id}-${v}`;
                    return (
                      <label key={v} htmlFor={id} className={`segmented__opt segmented__opt--${RESULT_CLASS[v]}`}>
                        <input
                          id={id}
                          type="radio"
                          name={`leaf-${leaf.id}`}
                          value={v}
                          checked={values[leaf.id] === v}
                          onChange={() => onChange(leaf.id, v)}
                        />
                        <span>{v}</span>
                      </label>
                    );
                  })}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
