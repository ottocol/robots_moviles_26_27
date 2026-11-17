// Contrato que cumple cada tipo de nodo. Añadir un tipo = un fichero que exporta
// un NodeType + una línea en registry.ts. Ni el motor ni la interfaz cambian.

import type { Category, NodeDef, NodeResult, ParamValue, Status, TraceEvent } from '../model';

/** Petición interna del motor: "necesito el valor de esta hoja". */
export interface LeafRequest {
  kind: 'leaf-request';
  id: string;
  /** Número de invocación de la hoja dentro de esta pasada (1, 2, ...). */
  invocation: number;
}

export type EngineYield = TraceEvent | LeafRequest;

/**
 * El tick de un nodo es un generador: va emitiendo eventos y devuelve el resultado.
 * Esto permite ejecutar de golpe, paso a paso o pausar al llegar a una hoja con el
 * mismo código.
 */
export type EngineGen<T = NodeResult> = Generator<EngineYield, T, NodeResult | undefined>;

export interface ParamSpec {
  name: string;
  kind: 'int' | 'bool';
  required: boolean;
  default?: ParamValue;
  /** Valor mínimo para enteros (por ejemplo -1 para "infinito"). */
  min?: number;
  description: string;
}

/** Lo que el motor ofrece a un nodo durante su tick. Equivale a los métodos protegidos de BT.CPP. */
export interface NodeApi {
  readonly node: NodeDef;
  /** Memoria del nodo; persiste entre ticks. Se puede modificar. */
  readonly data: Record<string, number>;
  readonly childCount: number;
  /** Estado guardado del hijo i (el "prev_status" de BT.CPP). */
  childStatus(i: number): Status;
  /** executeTick() sobre el hijo i. */
  tickChild(i: number): EngineGen;
  /** haltChild(i): interrumpe si está en RUNNING y lo deja en IDLE. */
  haltChild(i: number): EngineGen<void>;
  /** resetChildren(): haltChild sobre todos los hijos. */
  resetChildren(): EngineGen<void>;
  /** emitWakeUpSignal(): pide que el árbol se recorra de nuevo enseguida. */
  wakeUp(): EngineGen<void>;
  /** Solo hojas: pide el valor que ha elegido el usuario. */
  leafValue(): EngineGen<NodeResult>;
  param(name: string): ParamValue;
}

export interface NodeType {
  /** Nombre canónico (el de BT.CPP). */
  type: string;
  /** Otros nombres aceptados en el YAML (Selector → Fallback...). */
  aliases?: string[];
  category: Category;
  minChildren: number;
  maxChildren: number;
  params: ParamSpec[];
  /** Símbolo en la notación de Colledanchise y Ögren, si existe. */
  classic?: string;
  /** Sección de la documentación de BT.CPP. */
  docUrl: string;
  /** Solo hojas controladas por el usuario: valores que puede elegir. */
  leafValues?(node: NodeDef): NodeResult[];
  /** Memoria inicial (por defecto, ninguna). */
  initData?(): Record<string, number>;
  tick(api: NodeApi): EngineGen;
  /** Qué hace halt() con la memoria. Por defecto la reinicia a initData(). */
  onHalt?(data: Record<string, number>): void;
  /** Etiqueta corta del estado interno ("hijo 2/3", "1/3"), o null si no hay nada que mostrar. */
  describe?(node: NodeDef, data: Record<string, number>): string | null;
}
