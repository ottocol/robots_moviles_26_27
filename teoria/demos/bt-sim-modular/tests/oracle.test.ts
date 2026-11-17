// Prueba diferencial contra la librería BehaviorTree.CPP real.
// Genera árboles y escenarios aleatorios, los ejecuta en el simulador y en el
// oráculo C++ (tools/oracle) y compara tick a tick. Se salta si no se indica el
// ejecutable con la variable de entorno BTCPP_ORACLE.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { LeafValues, NodeDef, ParamValue } from '../src/core/model';
import { toBtcppXml } from '../src/core/btcppXml';
import { getNodeType } from '../src/core/nodes/registry';
import { indexTree } from '../src/core/tree';
import { simulate } from './helpers';

const ORACLE = process.env.BTCPP_ORACLE;
const CASES = Number(process.env.ORACLE_CASES ?? 400);
const TICKS = 12;

/** Generador pseudoaleatorio con semilla (mulberry32), para poder reproducir un fallo. */
function rng(seed: number) {
  let a = seed;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)]!;
  return { next, pick };
}

const CONTROLS = ['Sequence', 'ReactiveSequence', 'SequenceWithMemory', 'Fallback', 'ReactiveFallback'];
const DECORATORS = ['Inverter', 'ForceSuccess', 'ForceFailure', 'Repeat', 'RetryUntilSuccessful'];
const LEAVES = ['Condition', 'Action', 'AsyncAction', 'AsyncAction', 'AlwaysSuccess', 'AlwaysFailure'];

function randomTree(seed: number): NodeDef {
  const r = rng(seed);
  let k = 0;
  const make = (depth: number): NodeDef => {
    const id = `n${k++}`;
    const roll = r.next();
    if (depth >= 3 || (depth > 0 && roll < 0.4)) {
      const leaf = r.pick(LEAVES);
      const type = leaf === 'AsyncAction' ? 'Action' : leaf;
      const params: Record<string, ParamValue> = type === 'Action' ? { async: leaf === 'AsyncAction' } : {};
      return { id, type, name: id, params, children: [] };
    }
    if (roll < 0.7) {
      const type = r.pick(CONTROLS);
      const n = 1 + Math.floor(r.next() * 3);
      return { id, type, name: id, params: {}, children: Array.from({ length: n }, () => make(depth + 1)) };
    }
    const type = r.pick(DECORATORS);
    const params: Record<string, ParamValue> = {};
    if (type === 'Repeat') params.num_cycles = r.pick([-1, 0, 1, 2, 3]);
    if (type === 'RetryUntilSuccessful') params.num_attempts = r.pick([-1, 0, 1, 2, 3]);
    return { id, type, name: id, params, children: [make(depth + 1)] };
  };
  return make(0);
}

function randomScenario(root: NodeDef, seed: number): LeafValues[] {
  const r = rng(seed * 7919 + 1);
  const leaves = indexTree(root).userLeaves;
  return Array.from({ length: TICKS }, () => {
    const values: LeafValues = {};
    for (const leaf of leaves) values[leaf.id] = r.pick(getNodeType(leaf.type).leafValues!(leaf));
    return values;
  });
}

interface OracleTick {
  root?: string;
  wakeup?: boolean;
  leaves?: [string, string][];
  halts?: string[];
  status?: Record<string, string>;
  error?: string;
}

function runOracle(root: NodeDef, scenario: LeafValues[], dir: string): OracleTick[] {
  const xml = toBtcppXml(root, {
    nameOf: (n) => n.id,
    leafTag: (n) => ({
      tag: n.type === 'Condition' ? 'TestCondition' : n.params.async ? 'TestAsyncAction' : 'TestAction',
    }),
  });
  const xmlPath = join(dir, 'tree.xml');
  const scenarioPath = join(dir, 'scenario.txt');
  writeFileSync(xmlPath, xml);
  writeFileSync(
    scenarioPath,
    scenario.map((t) => Object.entries(t).map(([k, v]) => `${k}=${v}`).join(' ')).join('\n') + '\n',
  );
  const out = execFileSync(ORACLE!, [xmlPath, scenarioPath], { encoding: 'utf8' });
  return out.trim().split('\n').map((line) => JSON.parse(line) as OracleTick);
}

describe.skipIf(!ORACLE)('comparación con BehaviorTree.CPP real', () => {
  it(`coincide en ${CASES} árboles aleatorios × ${TICKS} ticks`, () => {
    const dir = mkdtempSync(join(tmpdir(), 'bt-oracle-'));
    for (let seed = 1; seed <= CASES; seed++) {
      const root = randomTree(seed);
      const scenario = randomScenario(root, seed);
      const expected = runOracle(root, scenario, dir);
      const actual = simulate(root, scenario);
      const index = indexTree(root);
      actual.forEach((t, i) => {
        const o = expected[i]!;
        const context = `semilla ${seed}, tick ${i + 1}\n${toBtcppXml(root, { nameOf: (n) => n.id })}`;
        expect(o.error, context).toBeUndefined();
        expect(t.error, context).toBeNull();
        expect(t.result, context).toBe(o.root);
        expect(t.wakeUp, context).toBe(o.wakeup);
        expect(t.leaves, context).toEqual(o.leaves!.map(([id, v]) => `${id}:${v}`));
        expect(t.halts.filter((id) => getNodeType(index.byId.get(id)!.type).category === 'leaf'), context).toEqual(o.halts);
        const statuses = Object.fromEntries(index.nodes.map((n) => [n.id, t.rt[n.id]!.status]));
        expect(statuses, context).toEqual(o.status);
      });
    }
  }, 600_000);
});
