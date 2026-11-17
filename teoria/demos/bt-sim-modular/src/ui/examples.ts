// Ejemplos incluidos: cada fichero de src/examples/ se empaqueta como texto.
import { parseTreeYaml } from '../core/parser';

const files = import.meta.glob('../examples/*.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export interface Example {
  key: string;
  title: string;
  yaml: string;
}

export const EXAMPLES: Example[] = Object.entries(files)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, yaml]) => ({
    key: path.split('/').pop()!.replace(/\.yaml$/, ''),
    title: parseTreeYaml(yaml).doc?.title ?? path,
    yaml,
  }));
