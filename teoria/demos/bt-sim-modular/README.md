# Simulador de behavior trees

Simulador web para la asignatura de Robots móviles. Se carga un árbol desde YAML, se
elige a mano lo que devuelve cada hoja y se ejecutan los ticks de golpe o paso a paso.
La semántica de los nodos es la de [BehaviorTree.CPP](https://www.behaviortree.dev) 4.11
y está contrastada automáticamente con la librería real (ver «Oráculo»).

## Uso

```bash
npm install
npm run dev            # servidor de desarrollo
npm run build          # versión modular en dist/
npm run build:single   # un único HTML autocontenido en dist-single/index.html
npm test               # pruebas
```

`dist-single/index.html` se puede abrir con doble clic o subir al campus virtual tal cual.
Solo las fuentes tipográficas vienen de Google Fonts; sin conexión se usan las del sistema.

## Qué hace la fase 1

- Carga de árboles YAML: ejemplos incluidos, abrir fichero, arrastrar y soltar o editor
  con los errores marcados por línea.
- Tabla de hojas con los valores que permite cada tipo (una condición nunca devuelve RUNNING).
- Tick completo, paso a paso, deshacer y reiniciar.
- Árbol con el resultado de cada nodo en el tick, nodos no visitados atenuados,
  interrupciones (halt) y re-ticks visibles, y el estado interno de los nodos con memoria.
- Traza ordenada del tick e historial; al pulsar un tick del historial el árbol muestra ese tick.
- Al pulsar un nodo, panel con qué hace ese tipo de nodo, su estado y el enlace a la
  documentación de BT.CPP.
- Escenarios: si el YAML trae `scenario`, sus valores se cargan en la tabla antes de cada tick.

Un tick es una pasada desde la raíz, equivalente a `Tree::tickExactlyOnce()`. Cuando un
nodo pide re-tick (wake-up), `tickOnce()` haría otra pasada enseguida; aquí la da el usuario.

## Formato YAML

```yaml
title: Recoger objeto
description: Texto que aparece bajo el título.
tree:
  type: Sequence
  id: root
  children:
    - {type: Condition, id: A, name: Detectar objeto}
    - type: Fallback
      children:
        - {type: Action, id: B1, name: Acercarse, async: true}
        - {type: Action, id: B2, name: Replanificar}
    - type: Repeat
      num_cycles: 3
      child: {type: Action, id: C, name: Recoger, async: true}
scenario:              # opcional: valores de hojas por tick
  - {A: FAILURE}
  - {A: SUCCESS, B1: RUNNING}
```

- `type` es obligatorio; se aceptan los nombres de BT.CPP sin distinguir mayúsculas y
  los alias `Selector`/`Priority` (Fallback) y `ReactiveSelector`.
- `id` es opcional (se genera solo); `name` es el texto que se muestra.
- Los parámetros usan los nombres de puerto de BT.CPP (`num_cycles`, `num_attempts`).
- `children` para controles, `child` para decoradores.
- En el escenario, una hoja que no aparece en un tick conserva su valor.

Tipos disponibles: `Condition`, `Action` (`async: true` para que pueda devolver RUNNING),
`AlwaysSuccess`, `AlwaysFailure`, `Sequence`, `ReactiveSequence`, `SequenceWithMemory`,
`Fallback`, `ReactiveFallback`, `Inverter`, `ForceSuccess`, `ForceFailure`, `Repeat`,
`RetryUntilSuccessful`.

## Estructura

```
src/core/            lógica sin React
  model.ts           tipos básicos
  nodes/             un fichero por tipo de nodo + registry.ts
  engine.ts          motor con generadores: tick, halt, reinicio
  run.ts             conductor de una pasada (de golpe o evento a evento)
  session.ts         sesión: valores de hojas, historial, paso a paso
  parser.ts          YAML → árbol, con validación
  trace.ts           resumen de la traza por nodo
  btcppXml.ts        árbol → XML de BT.CPP
src/content/         textos del panel de cada nodo (editables sin tocar código)
src/examples/        árboles de ejemplo (se incluyen solos en el desplegable)
src/ui/              componentes React
tests/               pruebas (Vitest)
tools/oracle/        oráculo C++ con BehaviorTree.CPP real
```

### Añadir un tipo de nodo

1. Crear `src/core/nodes/MiNodo.ts` exportando un `NodeType` (ver `types.ts`; `Repeat.ts`
   es un buen modelo).
2. Añadirlo a la lista de `registry.ts`.
3. Añadir su texto en `src/content/nodeTexts.es.ts`.

## Oráculo: comparación con BehaviorTree.CPP real

`tests/oracle.test.ts` genera árboles y escenarios aleatorios, los ejecuta en el simulador
y en un pequeño programa C++ enlazado con BT.CPP, y compara tick a tick el resultado de la
raíz, las hojas invocadas y su orden, las acciones interrumpidas, el wake-up y el estado
final de cada nodo. Sin el oráculo, esa prueba se salta.

```bash
tools/oracle/build.sh                    # clona y compila BT.CPP + el oráculo en .oracle/
BTCPP_ORACLE=.oracle/bt_oracle npm test  # ORACLE_CASES=3000 para más casos (400 por defecto)
```
