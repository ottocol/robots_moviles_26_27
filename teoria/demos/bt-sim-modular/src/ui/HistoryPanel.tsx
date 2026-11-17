import type { TickRecord } from '../core/session';
import { returnsInOrder } from '../core/trace';
import type { TreeIndex } from '../core/tree';
import { RESULT_CLASS, shortLabel } from './format';

interface HistoryPanelProps {
  index: TreeIndex;
  history: readonly TickRecord[];
  /** Tick que se muestra en el árbol. */
  shownTick: number | null;
  onView: (n: number) => void;
}

export function HistoryPanel({ index, history, shownTick, onView }: HistoryPanelProps) {
  if (!history.length) return <p className="muted">El historial aparecerá aquí, un tick por fila.</p>;
  return (
    <ol className="history" reversed>
      {[...history].reverse().map((rec) => {
        const halts = rec.events.flatMap((e) => (e.kind === 'halt' ? [e.id] : []));
        return (
          <li key={rec.n} className={rec.n === shownTick ? 'history__item is-shown' : 'history__item'}>
            <button
              type="button"
              className="history__btn"
              onClick={() => onView(rec.n)}
              aria-pressed={rec.n === shownTick}
            >
              <span className="history__head">
                <span className="history__n">Tick {rec.n}</span>
                {rec.result && (
                  <span className={`badge badge--${RESULT_CLASS[rec.result]}`}>raíz {rec.result}</span>
                )}
                {rec.wakeUp && <span className="badge badge--wakeup">re-tick</span>}
                {rec.error && <span className="badge badge--fail">error</span>}
              </span>
              <span className="history__chips">
                {returnsInOrder(rec.events).map((r, i) => {
                  const node = index.byId.get(r.id);
                  return (
                    <span key={i} className={`chip chip--${RESULT_CLASS[r.status]}`}>
                      {node ? shortLabel(node) : r.id}: {r.status}
                    </span>
                  );
                })}
                {halts.map((id, i) => {
                  const node = index.byId.get(id);
                  return (
                    <span key={`h${i}`} className="chip chip--halt">
                      {node ? shortLabel(node) : id}: halt
                    </span>
                  );
                })}
              </span>
              {rec.error && <span className="history__error">{rec.error}</span>}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
