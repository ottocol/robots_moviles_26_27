// Semántica de los nodos de la fase 1, caso a caso. Los casos reproducen el
// comportamiento del código fuente de BehaviorTree.CPP 4.11 (y oracle.test.ts los
// contrasta además con la librería real).

import { describe, expect, it } from 'vitest';
import { F, parseOk, R, S, simulate } from './helpers';

const condAsync = (control: string) =>
  parseOk(`
tree:
  type: ${control}
  children:
    - {type: Condition, id: A}
    - {type: Action, id: B, async: true}
`);

describe('Sequence frente a ReactiveSequence', () => {
  it('Sequence retoma el hijo en RUNNING sin volver a evaluar los anteriores', () => {
    const [t1, t2] = simulate(condAsync('Sequence'), [{ A: S, B: R }, { A: F }]);
    expect(t1!.result).toBe(R);
    expect(t1!.leaves).toEqual(['A:SUCCESS', 'B:RUNNING']);
    expect(t2!.leaves).toEqual(['B:RUNNING']);
    expect(t2!.result).toBe(R);
  });

  it('ReactiveSequence reevalúa desde el primer hijo e interrumpe al que estaba en RUNNING', () => {
    const [, t2] = simulate(condAsync('ReactiveSequence'), [{ A: S, B: R }, { A: F }]);
    expect(t2!.leaves).toEqual(['A:FAILURE']);
    expect(t2!.halts).toEqual(['B']);
    expect(t2!.result).toBe(F);
    expect(t2!.rt.B!.status).toBe('IDLE');
  });

  it('Sequence reinicia desde el primer hijo tras FAILURE', () => {
    const root = parseOk(`
tree:
  type: Sequence
  children:
    - {type: Condition, id: A}
    - {type: Condition, id: B}
`);
    const [t1, t2] = simulate(root, [{ A: S, B: F }, {}]);
    expect(t1!.result).toBe(F);
    expect(t2!.leaves).toEqual(['A:SUCCESS', 'B:FAILURE']);
  });

  it('Sequence con todos los hijos síncronos termina en una sola pasada', () => {
    const root = parseOk(`
tree:
  type: Sequence
  children:
    - {type: Action, id: A}
    - {type: Action, id: B}
`);
    const [t1] = simulate(root, [{ A: S, B: S }]);
    expect(t1!.result).toBe(S);
    expect(t1!.wakeUp).toBe(false);
    expect(t1!.rt.root!.status).toBe('IDLE'); // la raíz vuelve a IDLE al terminar
  });
});

describe('SequenceWithMemory', () => {
  const root = parseOk(`
tree:
  type: SequenceWithMemory
  children:
    - {type: Action, id: A}
    - {type: Action, id: B}
    - {type: Action, id: C}
`);

  it('cede el control (wake-up) tras cada hijo síncrono que tiene éxito', () => {
    const ticks = simulate(root, [{ A: S, B: S, C: S }, {}, {}]);
    expect(ticks.map((t) => t.result)).toEqual([R, R, S]);
    expect(ticks.map((t) => t.wakeUp)).toEqual([true, true, false]);
    expect(ticks.map((t) => t.leaves)).toEqual([['A:SUCCESS'], ['B:SUCCESS'], ['C:SUCCESS']]);
  });

  it('tras FAILURE reintenta el mismo hijo, sin repetir los anteriores', () => {
    const ticks = simulate(root, [{ A: S, B: F, C: S }, {}, { B: S }]);
    expect(ticks[1]!.result).toBe(F);
    expect(ticks[2]!.leaves).toEqual(['B:SUCCESS']);
  });
});

describe('Fallback frente a ReactiveFallback', () => {
  it('Fallback retoma el hijo en RUNNING', () => {
    const [, t2] = simulate(condAsync('Fallback'), [{ A: F, B: R }, { A: S }]);
    expect(t2!.leaves).toEqual(['B:RUNNING']);
    expect(t2!.result).toBe(R);
  });

  it('ReactiveFallback interrumpe al hijo en RUNNING si uno anterior pasa a SUCCESS', () => {
    const [, t2] = simulate(condAsync('ReactiveFallback'), [{ A: F, B: R }, { A: S }]);
    expect(t2!.leaves).toEqual(['A:SUCCESS']);
    expect(t2!.halts).toEqual(['B']);
    expect(t2!.result).toBe(S);
  });

  it('Fallback devuelve FAILURE si fallan todos', () => {
    const root = parseOk(`
tree:
  type: Selector
  children:
    - {type: Condition, id: A}
    - {type: Condition, id: B}
`);
    expect(simulate(root, [{ A: F, B: F }])[0]!.result).toBe(F);
  });
});

describe('Decoradores simples', () => {
  const deco = (type: string) =>
    parseOk(`
tree:
  type: ${type}
  child: {type: Action, id: A, async: true}
`);

  it.each([
    ['Inverter', S, F],
    ['Inverter', F, S],
    ['Inverter', R, R],
    ['ForceSuccess', F, S],
    ['ForceSuccess', R, R],
    ['ForceFailure', S, F],
    ['ForceFailure', R, R],
  ] as const)('%s: hijo %s → %s', (type, child, expected) => {
    expect(simulate(deco(type), [{ A: child }])[0]!.result).toBe(expected);
  });
});

describe('Repeat y RetryUntilSuccessful', () => {
  const repeat = (n: number, async = false) =>
    parseOk(`
tree:
  type: Repeat
  num_cycles: ${n}
  child: {type: Action, id: C, async: ${async}}
`);

  it('Repeat con hijo síncrono: una iteración por pasada, con wake-up', () => {
    const ticks = simulate(repeat(3), [{ C: S }, {}, {}]);
    expect(ticks.map((t) => t.result)).toEqual([R, R, S]);
    expect(ticks.map((t) => t.wakeUp)).toEqual([true, true, false]);
    expect(ticks.map((t) => t.rt.root!.data.count)).toEqual([1, 2, 0]);
  });

  it('Repeat: FAILURE del hijo corta y reinicia el contador', () => {
    const ticks = simulate(repeat(3), [{ C: S }, { C: F }]);
    expect(ticks[1]!.result).toBe(F);
    expect(ticks[1]!.rt.root!.data.count).toBe(0);
  });

  it('Repeat: un hijo que acaba tras estar en RUNNING no cede el control y se vuelve a lanzar', () => {
    const ticks = simulate(repeat(3, true), [{ C: R }, { C: S }]);
    expect(ticks[0]!.wakeUp).toBe(false);
    expect(ticks[0]!.rt.root!.data.count).toBe(0);
    expect(ticks[1]!.leaves).toEqual(['C:SUCCESS', 'C:SUCCESS']);
    expect(ticks[1]!.rt.root!.data.count).toBe(2);
    expect(ticks[1]!.wakeUp).toBe(true);
  });

  it('Repeat con num_cycles: 0 devuelve SUCCESS sin tocar al hijo', () => {
    const [t1] = simulate(repeat(0), [{ C: F }]);
    expect(t1!.result).toBe(S);
    expect(t1!.leaves).toEqual([]);
  });

  it('RetryUntilSuccessful: reintenta tras FAILURE y se rinde al agotar los intentos', () => {
    const root = parseOk(`
tree:
  type: RetryUntilSuccessful
  num_attempts: 2
  child: {type: Action, id: C}
`);
    const ticks = simulate(root, [{ C: F }, {}, { C: S }]);
    expect(ticks.map((t) => t.result)).toEqual([R, F, S]);
  });
});

describe('halt', () => {
  const tree = (inner: string) =>
    parseOk(`
tree:
  type: ReactiveSequence
  children:
    - {type: Condition, id: A}
    - type: ${inner}
      id: S
      children:
        - {type: Action, id: B}
        - {type: Action, id: C, async: true}
`);

  it('interrumpir una Sequence reinicia su índice', () => {
    const ticks = simulate(tree('Sequence'), [{ A: S, B: S, C: R }, { A: F }, { A: S }]);
    expect(ticks[1]!.halts).toEqual(['S', 'C']);
    expect(ticks[2]!.leaves).toEqual(['A:SUCCESS', 'B:SUCCESS', 'C:RUNNING']);
  });

  it('interrumpir una SequenceWithMemory conserva su índice', () => {
    const ticks = simulate(tree('SequenceWithMemory'), [
      { A: S, B: S, C: R },
      {},
      { A: F },
      { A: S },
    ]);
    expect(ticks[0]!.leaves).toEqual(['A:SUCCESS', 'B:SUCCESS']); // cede tras B
    expect(ticks[1]!.leaves).toEqual(['A:SUCCESS', 'C:RUNNING']);
    expect(ticks[2]!.halts).toEqual(['S', 'C']);
    expect(ticks[3]!.leaves).toEqual(['A:SUCCESS', 'C:RUNNING']); // no repite B
  });
});
