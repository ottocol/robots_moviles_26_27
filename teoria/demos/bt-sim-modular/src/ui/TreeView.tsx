import type { NodeDef, RuntimeState } from '../core/model';
import type { NodeTickInfo } from '../core/trace';
import { typeOf } from '../core/tree';
import { glyphOf, nodeLabel, RESULT_CLASS } from './format';

interface TreeViewProps {
  root: NodeDef;
  info: Map<string, NodeTickInfo>;
  rt: RuntimeState;
  activeId: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function TreeView(props: TreeViewProps) {
  return (
    <div className="tree" role="tree" aria-label="Árbol de comportamiento">
      <NodeBox node={props.root} {...props} />
    </div>
  );
}

function NodeBox({ node, ...p }: TreeViewProps & { node: NodeDef }) {
  const type = typeOf(node);
  const info = p.info.get(node.id);
  const last = info?.returns.at(-1);
  const runtime = p.rt[node.id];
  const memory = runtime ? type.describe?.(node, runtime.data) : null;
  const glyph = glyphOf(node);

  const classes = ['node', `node--${type.category}`, `node--${node.type}`];
  if (last) classes.push(`is-${RESULT_CLASS[last]}`);
  else if (info?.halted) classes.push('is-halted');
  if (!info?.visited && !info?.halted) classes.push('is-unvisited');
  if (info?.evaluating) classes.push('is-evaluating');
  if (p.activeId === node.id) classes.push('is-active');
  if (p.selectedId === node.id) classes.push('is-selected');

  const stateText = last
    ? `devolvió ${last}`
    : info?.halted
      ? 'interrumpido'
      : info?.visited
        ? 'en evaluación'
        : 'no visitado en este tick';

  return (
    <div className={classes.join(' ')} role="treeitem" aria-expanded={node.children.length ? true : undefined}>
      <button
        type="button"
        className="node__head"
        onClick={() => p.onSelect(node.id)}
        aria-label={`${nodeLabel(node)}, ${node.type}, ${stateText}`}
        aria-pressed={p.selectedId === node.id}
      >
        {glyph && <span className="node__glyph" aria-hidden="true">{glyph}</span>}
        {type.category !== 'leaf' || node.name === node.type ? (
          <span className="node__type">{node.type}</span>
        ) : null}
        {node.name !== node.type && <span className="node__name">{nodeLabel(node)}</span>}
        {type.category === 'decorator' && <Params node={node} />}
        <span className="node__badges">
          {memory && <span className="badge badge--memory" title="Estado interno">{memory}</span>}
          {info?.wakeUp && <span className="badge badge--wakeup" title="Pidió re-tick">re-tick</span>}
          {info?.halted && <span className="badge badge--halt">interrumpido</span>}
          {last && (
            <span className={`badge badge--${RESULT_CLASS[last]}`}>
              {last}
              {info && info.returns.length > 1 ? ` ×${info.returns.length}` : ''}
            </span>
          )}
        </span>
      </button>
      {node.children.length > 0 && (
        <div className="node__children" role="group">
          {node.children.map((c) => (
            <NodeBox key={c.id} node={c} {...p} />
          ))}
        </div>
      )}
    </div>
  );
}

function Params({ node }: { node: NodeDef }) {
  const entries = Object.entries(node.params);
  if (!entries.length) return null;
  return (
    <span className="node__params">
      {entries.map(([k, v]) => (
        <span key={k}>
          {k}={String(v)}
        </span>
      ))}
    </span>
  );
}
