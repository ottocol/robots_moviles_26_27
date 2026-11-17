import { describe, expect, it } from 'vitest';
import { parseTreeYaml } from '../src/core/parser';

const errorsOf = (yaml: string) => parseTreeYaml(yaml).errors;

describe('parser YAML', () => {
  it('lee el árbol de ejemplo y asigna ids automáticos', () => {
    const { doc, errors } = parseTreeYaml(`
title: Recoger objeto
tree:
  type: Sequence
  children:
    - {type: Condition, id: A, name: Detectar objeto}
    - type: Selector
      children:
        - {type: Action, id: B1, name: Acercarse, async: true}
        - {type: Action, id: B2}
    - type: Repeat
      num_cycles: 3
      child: {type: Action, id: C, async: true}
scenario:
  - {A: failure}
  - {A: SUCCESS, B1: RUNNING}
`);
    expect(errors).toEqual([]);
    expect(doc!.title).toBe('Recoger objeto');
    const root = doc!.root;
    expect(root.id).toBe('root');
    expect(root.children.map((c) => [c.id, c.type])).toEqual([
      ['A', 'Condition'],
      ['Fallback1', 'Fallback'],
      ['Repeat1', 'Repeat'],
    ]);
    expect(root.children[0]!.name).toBe('Detectar objeto');
    expect(root.children[1]!.children[1]!.name).toBe('B2');
    expect(root.children[1]!.children[1]!.params).toEqual({ async: false });
    expect(doc!.scenario).toEqual([{ A: 'FAILURE' }, { A: 'SUCCESS', B1: 'RUNNING' }]);
  });

  it('acepta tipos sin distinguir mayúsculas', () => {
    const { doc } = parseTreeYaml('tree: {type: reactivesequence, children: [{type: condition}]}');
    expect(doc!.root.type).toBe('ReactiveSequence');
  });

  it('señala un tipo desconocido con su línea', () => {
    const errors = errorsOf(`
tree:
  type: Sequence
  children:
    - type: Paralel
`);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toMatch(/desconocido: "Paralel"/);
    expect(errors[0]!.line).toBe(5);
  });

  it('exige los parámetros obligatorios y avisa de claves mal escritas', () => {
    const errors = errorsOf(`
tree:
  type: Repeat
  num_cycle: 3
  child: {type: Condition}
`);
    expect(errors.map((e) => e.message)).toEqual([
      'Repeat: falta el parámetro "num_cycles"',
      'Repeat: clave desconocida "num_cycle". Parámetros de Repeat: num_cycles.',
    ]);
    expect(errors[1]!.line).toBe(4);
  });

  it('valida el tipo de los parámetros', () => {
    const errors = errorsOf('tree: {type: Repeat, num_cycles: -2, child: {type: Condition}}');
    expect(errors[0]!.message).toBe('Repeat: "num_cycles" debe ser ≥ -1');
  });

  it('valida el número de hijos', () => {
    expect(errorsOf('tree: {type: Inverter, children: [{type: Condition}, {type: Condition}]}')[0]!.message).toMatch(
      /exactamente un hijo/,
    );
    expect(errorsOf('tree: {type: Sequence}')[0]!.message).toMatch(/al menos 1 hijo/);
    expect(errorsOf('tree: {type: Condition, child: {type: Condition}}')[0]!.message).toMatch(/es una hoja/);
  });

  it('detecta ids repetidos', () => {
    const errors = errorsOf(`
tree:
  type: Sequence
  children:
    - {type: Condition, id: A}
    - {type: Condition, id: A}
`);
    expect(errors).toEqual([{ message: 'Id repetido: "A"', line: 6 }]);
  });

  it('valida el escenario según el tipo de hoja', () => {
    const errors = errorsOf(`
tree:
  type: Sequence
  children:
    - {type: Condition, id: A}
scenario:
  - {A: RUNNING}
  - {X: SUCCESS}
`);
    expect(errors.map((e) => [e.line, e.message])).toEqual([
      [7, 'scenario, tick 1: "A" solo admite SUCCESS o FAILURE'],
      [8, 'scenario, tick 2: "X" no es una hoja del árbol'],
    ]);
  });

  it('informa de errores de sintaxis YAML con su línea', () => {
    const errors = errorsOf('tree:\n  type: Sequence\n  children: [\n');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.line).toBeGreaterThan(0);
  });

  it('rechaza claves desconocidas en el nivel superior', () => {
    expect(errorsOf('arbol: {}\ntree: {type: Condition}')[0]!.message).toMatch(/nivel superior: "arbol"/);
  });
});
