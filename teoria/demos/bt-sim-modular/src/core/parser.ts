// YAML → TreeDoc, con validación y número de línea en cada error.

import { isMap, isScalar, isSeq, LineCounter, parseDocument, type Node as YNode } from 'yaml';
import type { LeafValues, NodeDef, NodeResult, ParamValue, TreeDoc } from './model';
import { RESULTS } from './model';
import { findNodeType, NODE_TYPES } from './nodes/registry';
import type { NodeType } from './nodes/types';
import { indexTree } from './tree';

export interface ParseError {
  message: string;
  line?: number;
}

export interface ParseResult {
  doc: TreeDoc | null;
  errors: ParseError[];
}

const TOP_KEYS = ['title', 'description', 'tick_ms', 'tree', 'scenario'];
const NODE_KEYS = ['type', 'id', 'name', 'children', 'child'];

/** Nodo antes de asignar ids automáticos. */
interface RawNode {
  explicitId?: string;
  idLine?: number;
  type: NodeType;
  name?: string;
  params: Record<string, ParamValue>;
  children: RawNode[];
  line?: number;
}

class Parser {
  readonly errors: ParseError[] = [];
  constructor(private readonly lines: LineCounter) {}

  lineOf(node: YNode | null | undefined): number | undefined {
    const offset = node?.range?.[0];
    return offset === undefined ? undefined : this.lines.linePos(offset).line;
  }

  error(message: string, node?: YNode | null): void {
    this.errors.push({ message, line: this.lineOf(node) });
  }

  /** Pares clave → valor de un mapa YAML, avisando de claves que no son texto o repetidas. */
  entries(map: YNode): Map<string, { value: YNode | null; keyNode: YNode }> {
    const out = new Map<string, { value: YNode | null; keyNode: YNode }>();
    if (!isMap(map)) return out;
    for (const pair of map.items) {
      const keyNode = pair.key as YNode;
      if (!isScalar(keyNode) || typeof keyNode.value !== 'string') {
        this.error('Las claves deben ser texto', keyNode);
        continue;
      }
      if (out.has(keyNode.value)) this.error(`Clave repetida: ${keyNode.value}`, keyNode);
      out.set(keyNode.value, { value: (pair.value as YNode | null) ?? null, keyNode });
    }
    return out;
  }

  scalarString(node: YNode | null, what: string): string | undefined {
    if (isScalar(node) && (typeof node.value === 'string' || typeof node.value === 'number')) {
      return String(node.value);
    }
    this.error(`${what} debe ser un texto`, node);
    return undefined;
  }

  parseNode(ynode: YNode | null): RawNode | null {
    if (!isMap(ynode)) {
      this.error('Cada nodo debe ser un mapa con al menos la clave "type"', ynode);
      return null;
    }
    const e = this.entries(ynode);
    const line = this.lineOf(ynode);

    const typeEntry = e.get('type');
    if (!typeEntry) {
      this.error('Nodo sin "type"', ynode);
      return null;
    }
    const typeName = this.scalarString(typeEntry.value, '"type"');
    if (typeName === undefined) return null;
    const type = findNodeType(typeName);
    if (!type) {
      const known = NODE_TYPES.map((t) => t.type).join(', ');
      this.error(`Tipo de nodo desconocido: "${typeName}". Disponibles: ${known}`, typeEntry.value);
      return null;
    }

    const raw: RawNode = { type, params: {}, children: [], line };
    const idEntry = e.get('id');
    if (idEntry) {
      raw.explicitId = this.scalarString(idEntry.value, '"id"');
      raw.idLine = this.lineOf(idEntry.value);
    }
    const nameEntry = e.get('name');
    if (nameEntry) raw.name = this.scalarString(nameEntry.value, '"name"');

    // Parámetros.
    for (const spec of type.params) {
      const entry = e.get(spec.name);
      if (!entry) {
        if (spec.required) this.error(`${type.type}: falta el parámetro "${spec.name}"`, ynode);
        else if (spec.default !== undefined) raw.params[spec.name] = spec.default;
        continue;
      }
      const v = isScalar(entry.value) ? entry.value.value : undefined;
      if (spec.kind === 'int') {
        if (typeof v !== 'number' || !Number.isInteger(v)) {
          this.error(`${type.type}: "${spec.name}" debe ser un número entero`, entry.value);
        } else if (spec.min !== undefined && v < spec.min) {
          this.error(`${type.type}: "${spec.name}" debe ser ≥ ${spec.min}`, entry.value);
        } else raw.params[spec.name] = v;
      } else if (typeof v !== 'boolean') {
        this.error(`${type.type}: "${spec.name}" debe ser true o false`, entry.value);
      } else raw.params[spec.name] = v;
    }

    // Claves desconocidas (típicamente un parámetro mal escrito).
    const allowed = new Set([...NODE_KEYS, ...type.params.map((p) => p.name)]);
    for (const [key, { keyNode }] of e) {
      if (allowed.has(key)) continue;
      const hint = type.params.length
        ? ` Parámetros de ${type.type}: ${type.params.map((p) => p.name).join(', ')}.`
        : '';
      this.error(`${type.type}: clave desconocida "${key}".${hint}`, keyNode);
    }

    // Hijos.
    const childrenEntry = e.get('children');
    const childEntry = e.get('child');
    let childFailed = false;
    if (childrenEntry && childEntry) {
      this.error(`${type.type}: usa "children" o "child", no los dos`, ynode);
    }
    if (childrenEntry) {
      if (!isSeq(childrenEntry.value)) {
        this.error(`${type.type}: "children" debe ser una lista`, childrenEntry.value);
      } else {
        for (const item of childrenEntry.value.items) {
          const c = this.parseNode(item as YNode | null);
          if (c) raw.children.push(c);
          else childFailed = true;
        }
      }
    } else if (childEntry) {
      const c = this.parseNode(childEntry.value);
      if (c) raw.children.push(c);
      else childFailed = true;
    }

    const n = raw.children.length;
    if (type.maxChildren === 0 && (childrenEntry || childEntry)) {
      this.error(`${type.type} es una hoja: no puede tener hijos`, ynode);
    } else if (!childFailed && (n < type.minChildren || n > type.maxChildren)) {
      const expected =
        type.maxChildren === 1
          ? 'exactamente un hijo (clave "child")'
          : `al menos ${type.minChildren} hijo${type.minChildren > 1 ? 's' : ''} (clave "children")`;
      this.error(`${type.type} necesita ${expected}`, ynode);
    }
    return raw;
  }

  /** Asigna ids automáticos a los nodos que no lo tienen y comprueba duplicados. */
  finalize(root: RawNode): NodeDef {
    const used = new Set<string>();
    const all: RawNode[] = [];
    const collect = (r: RawNode) => {
      all.push(r);
      r.children.forEach(collect);
    };
    collect(root);
    for (const r of all) {
      if (r.explicitId === undefined) continue;
      if (used.has(r.explicitId)) {
        this.errors.push({ message: `Id repetido: "${r.explicitId}"`, line: r.idLine });
      }
      used.add(r.explicitId);
    }
    const counters = new Map<string, number>();
    const autoId = (r: RawNode): string => {
      if (r === root && !used.has('root')) return 'root';
      let k = counters.get(r.type.type) ?? 0;
      let id: string;
      do id = `${r.type.type}${++k}`;
      while (used.has(id));
      counters.set(r.type.type, k);
      return id;
    };
    const build = (r: RawNode): NodeDef => {
      const id = r.explicitId ?? autoId(r);
      used.add(id);
      return {
        id,
        type: r.type.type,
        name: r.name ?? (r.explicitId ? r.explicitId : r.type.type),
        params: r.params,
        children: r.children.map(build),
        line: r.line,
      };
    };
    return build(root);
  }

  parseScenario(ynode: YNode | null, root: NodeDef): LeafValues[] {
    if (!isSeq(ynode)) {
      this.error('"scenario" debe ser una lista con un mapa por tick', ynode);
      return [];
    }
    const leaves = new Map(indexTree(root).userLeaves.map((n) => [n.id, n]));
    const ticks: LeafValues[] = [];
    ynode.items.forEach((item, i) => {
      const values: LeafValues = {};
      const tickNode = item as YNode | null;
      if (!isMap(tickNode)) {
        this.error(`scenario, tick ${i + 1}: debe ser un mapa hoja → valor`, tickNode);
      } else {
        for (const [id, { value, keyNode }] of this.entries(tickNode)) {
          const leaf = leaves.get(id);
          if (!leaf) {
            this.error(`scenario, tick ${i + 1}: "${id}" no es una hoja del árbol`, keyNode);
            continue;
          }
          const text = isScalar(value) ? String(value.value).toUpperCase() : '';
          const allowed = findNodeType(leaf.type)?.leafValues?.(leaf) ?? [];
          if (!(RESULTS as readonly string[]).includes(text) || !allowed.includes(text as NodeResult)) {
            this.error(
              `scenario, tick ${i + 1}: "${id}" solo admite ${allowed.join(' o ')}`,
              value,
            );
            continue;
          }
          values[id] = text as NodeResult;
        }
      }
      ticks.push(values);
    });
    return ticks;
  }
}

export function parseTreeYaml(text: string): ParseResult {
  const lines = new LineCounter();
  const ydoc = parseDocument(text, { lineCounter: lines, uniqueKeys: false });
  const p = new Parser(lines);

  if (ydoc.errors.length) {
    for (const err of ydoc.errors) {
      p.errors.push({ message: err.message.split('\n')[0] ?? err.message, line: err.linePos?.[0].line });
    }
    return { doc: null, errors: p.errors };
  }

  const top = ydoc.contents as YNode | null;
  if (!isMap(top)) {
    p.error('El fichero debe ser un mapa con al menos la clave "tree"', top);
    return { doc: null, errors: p.errors };
  }
  const e = p.entries(top);
  for (const [key, { keyNode }] of e) {
    if (!TOP_KEYS.includes(key)) {
      p.error(`Clave desconocida en el nivel superior: "${key}" (válidas: ${TOP_KEYS.join(', ')})`, keyNode);
    }
  }

  const title = e.has('title') ? p.scalarString(e.get('title')!.value, '"title"') : undefined;
  const description = e.has('description')
    ? p.scalarString(e.get('description')!.value, '"description"')
    : undefined;
  const tickMs = e.get('tick_ms');
  if (tickMs) {
    const v = isScalar(tickMs.value) ? tickMs.value.value : undefined;
    if (typeof v !== 'number' || !Number.isInteger(v) || v <= 0) {
      p.error('"tick_ms" debe ser un entero positivo', tickMs.value);
    }
  }

  const treeEntry = e.get('tree');
  if (!treeEntry) {
    p.error('Falta la clave "tree" con el nodo raíz', top);
    return { doc: null, errors: p.errors };
  }
  const raw = p.parseNode(treeEntry.value);
  if (!raw || p.errors.length) return { doc: null, errors: p.errors };

  const root = p.finalize(raw);
  const scenarioEntry = e.get('scenario');
  const scenario = scenarioEntry ? p.parseScenario(scenarioEntry.value, root) : [];
  if (p.errors.length) return { doc: null, errors: p.errors };

  return {
    doc: { title: title ?? 'Sin título', description: description ?? '', root, scenario },
    errors: [],
  };
}
