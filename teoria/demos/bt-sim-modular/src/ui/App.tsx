import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TreeDoc } from '../core/model';
import { parseTreeYaml, type ParseError } from '../core/parser';
import { Session } from '../core/session';
import { summarize } from '../core/trace';
import { WAKEUP_TEXT } from '../content/nodeTexts.es';
import { EXAMPLES } from './examples';
import { describeEvent, RESULT_CLASS } from './format';
import { HistoryPanel } from './HistoryPanel';
import { LeafPanel } from './LeafPanel';
import { NodeInfo } from './NodeInfo';
import { TracePanel } from './TracePanel';
import { TreeView } from './TreeView';
import { displayed, useSessionSnapshot } from './useSession';
import { YamlEditor } from './YamlEditor';

interface Loaded {
  yaml: string;
  session: Session;
  exampleKey: string | null;
}

function load(yaml: string, doc: TreeDoc, exampleKey: string | null): Loaded {
  return { yaml, session: new Session(doc), exampleKey };
}

function loadExample(key: string): Loaded {
  const ex = EXAMPLES.find((e) => e.key === key) ?? EXAMPLES[0]!;
  const { doc } = parseTreeYaml(ex.yaml);
  return load(ex.yaml, doc!, ex.key);
}

export function App() {
  const [loaded, setLoaded] = useState<Loaded>(() => loadExample(EXAMPLES[0]!.key));
  const [editor, setEditor] = useState<{ text: string; errors: ParseError[] } | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { session } = loaded;
  const snap = useSessionSnapshot(session);
  const view = displayed(snap, session.committedRt);
  const info = useMemo(() => summarize(view.events), [view.events]);
  const selectedNode = snap.selected ? snap.index.byId.get(snap.selected) : undefined;
  const closeInfo = useCallback(() => session.select(null), [session]);
  const closeEditor = useCallback(() => setEditor(null), []);

  const openText = useCallback((text: string) => {
    const result = parseTreeYaml(text);
    if (result.doc) {
      setLoaded(load(text, result.doc, null));
      setEditor(null);
    } else setEditor({ text, errors: result.errors });
  }, []);

  const openFile = (file: File | undefined) => {
    if (!file) return;
    file.text().then(openText, () => setEditor({ text: '', errors: [{ message: `No se pudo leer ${file.name}` }] }));
  };

  // Atajos: espacio = paso, Enter = tick completo (fuera de campos y botones).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editor) return;
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, button, a, [contenteditable]')) return;
      if (e.key === ' ') {
        e.preventDefault();
        session.step();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        session.tick();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [session, editor]);

  const lastEvent = snap.live?.events.at(-1);
  const lastRecord = snap.history.at(-1);
  const scenarioLen = snap.doc.scenario.length;
  const nextN = session.nextTickNumber;

  return (
    <div
      className={dragging ? 'app is-dragging' : 'app'}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        openFile(e.dataTransfer.files[0]);
      }}
    >
      <header className="topbar">
        <p className="topbar__brand">Simulador de behavior trees</p>
        <div className="topbar__tools">
          <label className="field">
            <span className="visually-hidden">Ejemplo</span>
            <select
              id="example-select"
              value={loaded.exampleKey ?? ''}
              onChange={(e) => e.target.value && setLoaded(loadExample(e.target.value))}
            >
              {loaded.exampleKey === null && <option value="">Árbol propio</option>}
              {EXAMPLES.map((ex) => (
                <option key={ex.key} value={ex.key}>
                  {ex.title}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            Abrir YAML
          </button>
          <input
            id="file-input"
            ref={fileRef}
            type="file"
            accept=".yaml,.yml,text/yaml,text/plain"
            hidden
            onChange={(e) => {
              openFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <button type="button" className="btn" onClick={() => setEditor({ text: loaded.yaml, errors: [] })}>
            Editar YAML
          </button>
        </div>
      </header>

      <section className="intro">
        <h1>{snap.doc.title}</h1>
        {snap.doc.description && <p>{snap.doc.description}</p>}
      </section>

      <main className={selectedNode ? 'layout has-info' : 'layout'}>
        <div className="col col--side">
          <section className="panel panel--leaves" aria-labelledby="leaves-title">
            <h2 id="leaves-title">Hojas</h2>
            {scenarioLen > 0 && (
              <label className="check">
                <input
                  id="use-scenario"
                  type="checkbox"
                  checked={snap.useScenario}
                  onChange={(e) => session.setUseScenario(e.target.checked)}
                />
                <span>
                  Aplicar el escenario del YAML ({scenarioLen} tick{scenarioLen > 1 ? 's' : ''})
                  {snap.useScenario && (
                    <span className="muted">
                      {' '}
                      · {nextN <= scenarioLen ? `tick ${nextN} cargado` : 'escenario terminado'}
                    </span>
                  )}
                </span>
              </label>
            )}
            <LeafPanel
              index={snap.index}
              values={snap.leafValues}
              onChange={(id, v) => session.setLeafValue(id, v)}
              onSelect={(id) => session.select(id)}
            />
            <p className="hint">Cada hoja devuelve el valor marcado cuando el tick llega a ella.</p>
          </section>

          <section className="panel panel--controls controls" aria-labelledby="controls-title">
            <h2 id="controls-title" className="visually-hidden">
              Ejecución
            </h2>
            <div className="controls__row">
              <button type="button" className="btn btn--primary" onClick={() => session.tick()}>
                {snap.live ? 'Terminar tick' : 'Tick'}
              </button>
              <button type="button" className="btn" onClick={() => session.step()}>
                Paso
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => session.undo()}
                disabled={!snap.live && !snap.history.length}
              >
                {snap.live ? 'Cancelar' : 'Deshacer'}
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => session.reset()}
                disabled={!snap.live && !snap.history.length}
              >
                Reiniciar
              </button>
            </div>
            <p className="controls__status" aria-live="polite">
              {snap.live ? (
                <>
                  <strong>Tick {snap.live.n} en curso.</strong>{' '}
                  {lastEvent ? describeEvent(lastEvent, snap.index) : 'Empezando por la raíz.'}
                </>
              ) : lastRecord ? (
                <>
                  Tick {lastRecord.n}: la raíz devolvió{' '}
                  {lastRecord.result ? (
                    <span className={`badge badge--${RESULT_CLASS[lastRecord.result]}`}>{lastRecord.result}</span>
                  ) : (
                    'un error'
                  )}
                  . Siguiente: tick {nextN}.
                </>
              ) : (
                <>Todo en IDLE. Siguiente: tick 1.</>
              )}
            </p>
            <p className="hint">
              Un tick es una pasada desde la raíz, como <code>tickExactlyOnce()</code>. Atajos: espacio para un paso,
              Enter para un tick.
            </p>
          </section>

          <section className="panel panel--trace" aria-labelledby="trace-title">
            <h2 id="trace-title">{view.n ? `Traza del tick ${view.n}` : 'Traza'}</h2>
            <TracePanel
              index={snap.index}
              events={view.events}
              live={view.kind === 'live'}
              onSelect={(id) => session.select(id)}
            />
          </section>
        </div>

        <div className="col col--main">
          <section className="panel panel--tree" aria-labelledby="tree-title">
            <div className="panel__head">
              <h2 id="tree-title">Árbol{view.n ? ` · tick ${view.n}` : ''}</h2>
              {snap.viewing !== null && (
                <p className="viewing">
                  Estás viendo un tick anterior.{' '}
                  <button type="button" className="linklike" onClick={() => session.view(null)}>
                    Volver al último
                  </button>
                </p>
              )}
            </div>
            <TreeView
              root={snap.doc.root}
              info={info}
              rt={view.rt}
              activeId={view.activeId}
              selectedId={snap.selected}
              onSelect={(id) => session.select(snap.selected === id ? null : id)}
            />
            <Legend />
          </section>

          <section className="panel panel--history" aria-labelledby="history-title">
            <h2 id="history-title">Historial</h2>
            <HistoryPanel
              index={snap.index}
              history={snap.history}
              shownTick={view.kind === 'record' ? view.n : null}
              onView={(n) => session.view(n)}
            />
          </section>
        </div>

        {selectedNode && (
          <NodeInfo
            node={selectedNode}
            runtime={view.rt[selectedNode.id]}
            info={info.get(selectedNode.id)}
            onClose={closeInfo}
          />
        )}
      </main>

      {editor && (
        <YamlEditor
          key={editor.text + editor.errors.length}
          initial={editor.text}
          initialErrors={editor.errors}
          onApply={(yaml, doc) => {
            setLoaded(load(yaml, doc, null));
            setEditor(null);
          }}
          onClose={closeEditor}
        />
      )}
    </div>
  );
}

function Legend() {
  return (
    <ul className="legend" aria-label="Leyenda">
      <li><span className="swatch swatch--ok" /> SUCCESS</li>
      <li><span className="swatch swatch--fail" /> FAILURE</li>
      <li><span className="swatch swatch--run" /> RUNNING</li>
      <li><span className="swatch swatch--halt" /> interrumpido</li>
      <li><span className="swatch swatch--idle" /> no visitado en este tick</li>
      <li title={WAKEUP_TEXT}><span className="badge badge--wakeup">re-tick</span> {WAKEUP_TEXT}</li>
    </ul>
  );
}
