import type { TraceEvent } from '../core/model';
import type { TreeIndex } from '../core/tree';
import { describeEvent, RESULT_CLASS } from './format';

interface TracePanelProps {
  index: TreeIndex;
  events: readonly TraceEvent[];
  live: boolean;
  onSelect: (id: string) => void;
}

export function TracePanel({ index, events, live, onSelect }: TracePanelProps) {
  if (!events.length) {
    return <p className="muted">Aún no hay ticks. Pulsa Tick o Paso para empezar.</p>;
  }
  // Sangría según la profundidad de la llamada.
  let depth = 0;
  const rows = events.map((e, i) => {
    if (e.kind === 'return') depth = Math.max(0, depth - 1);
    const row = { e, depth, i };
    if (e.kind === 'tick') depth++;
    return row;
  });
  return (
    <ol className="trace" aria-live={live ? 'polite' : undefined}>
      {rows.map(({ e, depth: d, i }) => {
        const cls = ['trace__row', `trace__row--${e.kind}`];
        if (e.kind === 'return') cls.push(`trace__row--${RESULT_CLASS[e.status]}`);
        if (live && i === events.length - 1) cls.push('is-current');
        return (
          <li key={i} className={cls.join(' ')} style={{ paddingInlineStart: `${0.5 + d * 0.9}rem` }}>
            <button type="button" className="linklike" onClick={() => onSelect(e.id)}>
              {describeEvent(e, index)}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
