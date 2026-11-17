import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseTreeYaml } from '../src/core/parser';
import { Session } from '../src/core/session';

const dir = join(__dirname, '../src/examples');
const files = readdirSync(dir).filter((f) => f.endsWith('.yaml'));

describe('ejemplos incluidos', () => {
  it.each(files)('%s se carga y su escenario se ejecuta sin errores', (file) => {
    const { doc, errors } = parseTreeYaml(readFileSync(join(dir, file), 'utf8'));
    expect(errors).toEqual([]);
    const session = new Session(doc!);
    for (let i = 0; i < Math.max(doc!.scenario.length, 3); i++) session.tick();
    expect(session.getSnapshot().history.every((r) => r.error === null)).toBe(true);
  });

  it('reintentar y repetir: la puerta se abre al tercer intento y la raíz termina en el tick 5', () => {
    const { doc } = parseTreeYaml(readFileSync(join(dir, '5-repetir-reintentar.yaml'), 'utf8'));
    const session = new Session(doc!);
    for (let i = 0; i < 5; i++) session.tick();
    expect(session.getSnapshot().history.map((r) => r.result)).toEqual([
      'RUNNING', 'RUNNING', 'RUNNING', 'RUNNING', 'SUCCESS',
    ]);
  });

  it('patrulla: tras la interrupción no se repite el destino A', () => {
    const { doc } = parseTreeYaml(readFileSync(join(dir, '3-patrulla-memoria.yaml'), 'utf8'));
    const session = new Session(doc!);
    for (let i = 0; i < 7; i++) session.tick();
    const h = session.getSnapshot().history;
    const ticked = (n: number) => h[n - 1]!.events.flatMap((e) => (e.kind === 'tick' ? [e.id] : []));
    expect(ticked(5)).not.toContain('GA');
    expect(ticked(5)).toContain('GB');
    expect(h[6]!.result).toBe('SUCCESS');
  });
});

describe('abrir la puerta', () => {
  const load = (yaml: string) => {
    const session = new Session(parseTreeYaml(yaml).doc!);
    for (let i = 0; i < 4; i++) session.tick();
    return session.getSnapshot().history;
  };
  const original = readFileSync(join(dir, '6-abrir-puerta.yaml'), 'utf8');

  it('reactivo: al abrirse la puerta se interrumpe "Abrir puerta"; sin llave se echa abajo', () => {
    const h = load(original);
    expect(h.map((r) => r.result)).toEqual(['RUNNING', 'SUCCESS', 'RUNNING', 'SUCCESS']);
    expect(h[1]!.events.filter((e) => e.kind === 'halt').map((e) => e.id)).toEqual(['con_llave', 'abrir']);
  });

  it('con Fallback y Sequence el tick 2 no vuelve a mirar la puerta', () => {
    const h = load(
      original.replace('type: ReactiveFallback', 'type: Fallback').replace('type: ReactiveSequence', 'type: Sequence'),
    );
    const ticked = h[1]!.events.flatMap((e) => (e.kind === 'tick' ? [e.id] : []));
    expect(ticked).not.toContain('abierta');
    expect(h[1]!.result).toBe('RUNNING');
  });
});

describe('sesión', () => {
  const yaml = `
tree:
  type: Sequence
  children:
    - {type: Condition, id: A}
    - {type: Action, id: B, async: true}
`;
  it('el paso a paso llega al mismo resultado que el tick completo', () => {
    const doc = parseTreeYaml(yaml).doc!;
    const a = new Session(doc);
    a.setLeafValue('B', 'RUNNING');
    a.tick();
    const b = new Session(doc);
    b.setLeafValue('B', 'RUNNING');
    let steps = 0;
    while (b.getSnapshot().history.length === 0) {
      b.step();
      steps++;
    }
    expect(steps).toBeGreaterThan(1);
    expect(b.getSnapshot().history[0]!.events).toEqual(a.getSnapshot().history[0]!.events);
  });

  it('deshacer recupera el estado anterior', () => {
    const s = new Session(parseTreeYaml(yaml).doc!);
    s.setLeafValue('B', 'RUNNING');
    s.tick();
    s.setLeafValue('A', 'FAILURE');
    s.tick(); // Sequence retoma B: A no se evalúa
    expect(s.getSnapshot().history[1]!.leafValues).toEqual({ B: 'RUNNING' });
    s.undo();
    s.undo();
    s.tick();
    expect(s.getSnapshot().history[0]!.result).toBe('FAILURE');
  });
});
