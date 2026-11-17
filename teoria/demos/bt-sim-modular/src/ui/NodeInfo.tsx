import { useEffect, useRef } from 'react';
import type { NodeDef, NodeRuntime } from '../core/model';
import type { NodeTickInfo } from '../core/trace';
import { typeOf } from '../core/tree';
import { NODE_TEXTS } from '../content/nodeTexts.es';
import { glyphOf, nodeLabel } from './format';

interface NodeInfoProps {
  node: NodeDef;
  runtime: NodeRuntime | undefined;
  info: NodeTickInfo | undefined;
  onClose: () => void;
}

const CATEGORY: Record<string, string> = {
  leaf: 'Hoja',
  control: 'Control',
  decorator: 'Decorador',
};

export function NodeInfo({ node, runtime, info, onClose }: NodeInfoProps) {
  const type = typeOf(node);
  const text = NODE_TEXTS[node.type];
  const glyph = glyphOf(node);
  const memory = runtime ? type.describe?.(node, runtime.data) : null;
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [node.id, onClose]);

  const thisTick = info?.returns.length
    ? `Devolvió ${info.returns.join(', ')}${info.halted ? ' y se interrumpió' : ''}.`
    : info?.halted
      ? 'Se interrumpió (halt).'
      : info?.visited
        ? 'Está en evaluación.'
        : 'No se visitó.';

  return (
    <aside className="info" aria-labelledby="info-title">
      <header className="info__head">
        <div>
          <p className="info__category">
            {CATEGORY[type.category]}
            {glyph && <span className="info__glyph"> · notación de clase {glyph}</span>}
          </p>
          <h2 id="info-title" className="info__title">
            {node.type}
          </h2>
          {node.name !== node.type && <p className="info__name">{nodeLabel(node)}</p>}
        </div>
        <button ref={closeRef} type="button" className="btn btn--ghost" onClick={onClose} aria-label="Cerrar panel">
          ✕
        </button>
      </header>

      {text && (
        <section className="info__section">
          <p className="info__summary">{text.summary}</p>
          <ul className="info__rules">
            {text.rules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="info__section">
        <h3>En este nodo</h3>
        <dl className="info__facts">
          <div className="info__fact">
            <dt>Id</dt>
            <dd><code>{node.id}</code></dd>
          </div>
          {Object.entries(node.params).map(([k, v]) => (
            <div key={k} className="info__fact">
              <dt><code>{k}</code></dt>
              <dd><code>{String(v)}</code></dd>
            </div>
          ))}
          <div className="info__fact">
            <dt>En el tick mostrado</dt>
            <dd>{thisTick}</dd>
          </div>
          <div className="info__fact">
            <dt>Estado guardado</dt>
            <dd>
              <code>{runtime?.status ?? 'IDLE'}</code>
              {memory && <> · {memory}</>}
            </dd>
          </div>
        </dl>
      </section>

      <a className="info__doc" href={type.docUrl} target="_blank" rel="noreferrer">
        Documentación de {node.type} en BehaviorTree.CPP
      </a>
    </aside>
  );
}
