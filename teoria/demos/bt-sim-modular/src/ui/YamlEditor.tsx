import { useEffect, useRef, useState } from 'react';
import type { TreeDoc } from '../core/model';
import { parseTreeYaml, type ParseError } from '../core/parser';

interface YamlEditorProps {
  initial: string;
  initialErrors?: ParseError[];
  onApply: (yaml: string, doc: TreeDoc) => void;
  onClose: () => void;
}

export function YamlEditor({ initial, initialErrors = [], onApply, onClose }: YamlEditorProps) {
  const [text, setText] = useState(initial);
  const [errors, setErrors] = useState<ParseError[]>(initialErrors);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    areaRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const apply = () => {
    const result = parseTreeYaml(text);
    if (result.doc) onApply(text, result.doc);
    else setErrors(result.errors);
  };

  /** Lleva el cursor al principio de una línea del textarea. */
  const goToLine = (line: number | undefined) => {
    const area = areaRef.current;
    if (!area || !line) return;
    const offset = text.split('\n').slice(0, line - 1).reduce((n, l) => n + l.length + 1, 0);
    area.focus();
    area.setSelectionRange(offset, offset);
  };

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="editor-title">
      <div className="editor">
        <header className="editor__head">
          <h2 id="editor-title">Editar YAML</h2>
          <button type="button" className="btn btn--ghost" onClick={onClose} aria-label="Cerrar editor">
            ✕
          </button>
        </header>
        <textarea
          id="yaml-text"
          ref={areaRef}
          className="editor__text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          aria-label="Contenido YAML del árbol"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) apply();
          }}
        />
        {errors.length > 0 && (
          <ul className="editor__errors" role="alert">
            {errors.map((err, i) => (
              <li key={i}>
                {err.line ? (
                  <button type="button" className="linklike" onClick={() => goToLine(err.line)}>
                    Línea {err.line}
                  </button>
                ) : null}{' '}
                {err.message}
              </li>
            ))}
          </ul>
        )}
        <footer className="editor__foot">
          <span className="muted">Ctrl + Enter para cargar. Cargar reinicia la simulación.</span>
          <span className="editor__actions">
            <button type="button" className="btn" onClick={onClose}>
              Cancelar
            </button>
            <button type="button" className="btn btn--primary" onClick={apply}>
              Cargar árbol
            </button>
          </span>
        </footer>
      </div>
    </div>
  );
}
