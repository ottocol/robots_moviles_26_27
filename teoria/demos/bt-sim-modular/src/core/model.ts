// Tipos básicos compartidos por todo el núcleo. No dependen de React.

/** Estado de un nodo tal y como lo guarda BT.CPP (sin SKIPPED, que llega en la fase 3). */
export type Status = 'IDLE' | 'RUNNING' | 'SUCCESS' | 'FAILURE';

/** Lo que puede devolver un tick (y lo que el usuario puede asignar a una hoja). */
export type NodeResult = 'SUCCESS' | 'FAILURE' | 'RUNNING';

export const RESULTS: readonly NodeResult[] = ['SUCCESS', 'FAILURE', 'RUNNING'];

export type Category = 'leaf' | 'control' | 'decorator';

export type ParamValue = number | boolean;

/** Definición inmutable de un nodo, tal y como sale del YAML. */
export interface NodeDef {
  readonly id: string;
  /** Nombre canónico del tipo en BT.CPP (Sequence, Repeat, Condition...). */
  readonly type: string;
  /** Texto que se muestra; si el YAML no lo da, es el tipo. */
  readonly name: string;
  readonly params: Readonly<Record<string, ParamValue>>;
  readonly children: readonly NodeDef[];
  /** Línea del YAML donde empieza el nodo (para mensajes de error). */
  readonly line?: number;
}

/** Valores de las hojas para un tick: id de hoja → valor. */
export type LeafValues = Record<string, NodeResult>;

export interface TreeDoc {
  readonly title: string;
  readonly description: string;
  readonly root: NodeDef;
  /** Valores de hojas por tick (opcional). Una hoja ausente conserva su valor anterior. */
  readonly scenario: readonly LeafValues[];
}

/** Estado de ejecución de un nodo: lo que BT.CPP guarda entre ticks. */
export interface NodeRuntime {
  status: Status;
  /** Memoria propia del tipo de nodo (índice del hijo en curso, contador...). */
  data: Record<string, number>;
}

export type RuntimeState = Record<string, NodeRuntime>;

/** Eventos visibles de una pasada por el árbol. */
export type TraceEvent =
  /** Se empieza a hacer tick al nodo. */
  | { kind: 'tick'; id: string }
  /** El nodo devuelve un resultado. */
  | { kind: 'return'; id: string; status: NodeResult }
  /** El nodo estaba en RUNNING y se interrumpe (halt). */
  | { kind: 'halt'; id: string }
  /** El nodo pide que el árbol se vuelva a recorrer enseguida (wake-up de BT.CPP). */
  | { kind: 'wakeup'; id: string };
