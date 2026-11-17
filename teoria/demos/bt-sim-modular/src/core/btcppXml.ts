// NodeDef → XML de BehaviorTree.CPP (formato 4). Lo usan las pruebas contra la
// librería real; en la fase 3 servirá para exportar árboles.

import type { NodeDef } from './model';
import { typeOf } from './tree';

export interface XmlOptions {
  /** Atributo name de cada nodo (por defecto, el nombre visible). */
  nameOf?: (node: NodeDef) => string;
  /** Etiqueta XML de cada hoja de usuario (por defecto <Condition ID=...> / <Action ID=...>). */
  leafTag?: (node: NodeDef) => { tag: string; attrs?: Record<string, string> };
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const identifier = (s: string) => s.replace(/[^A-Za-z0-9_]/g, '_') || 'Leaf';

export function toBtcppXml(root: NodeDef, opts: XmlOptions = {}): string {
  const nameOf = opts.nameOf ?? ((n: NodeDef) => n.name);
  const leafTag =
    opts.leafTag ??
    ((n: NodeDef) => ({ tag: n.type, attrs: { ID: identifier(n.name) } }));

  const render = (node: NodeDef, depth: number): string => {
    const pad = '  '.repeat(depth);
    const type = typeOf(node);
    let tag = node.type;
    const attrs: Record<string, string> = {};
    if (type.leafValues) {
      const leaf = leafTag(node);
      tag = leaf.tag;
      Object.assign(attrs, leaf.attrs);
    } else {
      for (const [k, v] of Object.entries(node.params)) attrs[k] = String(v);
    }
    attrs.name = nameOf(node);
    const attrText = Object.entries(attrs)
      .map(([k, v]) => ` ${k}="${esc(v)}"`)
      .join('');
    if (!node.children.length) return `${pad}<${tag}${attrText}/>`;
    const inner = node.children.map((c) => render(c, depth + 1)).join('\n');
    return `${pad}<${tag}${attrText}>\n${inner}\n${pad}</${tag}>`;
  };

  return [
    '<root BTCPP_format="4" main_tree_to_execute="Main">',
    '  <BehaviorTree ID="Main">',
    render(root, 2),
    '  </BehaviorTree>',
    '</root>',
    '',
  ].join('\n');
}
