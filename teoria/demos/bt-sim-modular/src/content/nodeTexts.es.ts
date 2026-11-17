// Textos del panel "qué hace este nodo". Se pueden retocar sin tocar el código:
// cada entrada es un resumen y una lista de reglas. Describen el comportamiento de
// BehaviorTree.CPP 4.11 (contrastado con su código fuente).

export interface NodeText {
  summary: string;
  rules: string[];
}

export const NODE_TEXTS: Record<string, NodeText> = {
  Condition: {
    summary: 'Hoja que comprueba algo y responde en el mismo tick.',
    rules: [
      'Solo puede devolver SUCCESS o FAILURE; nunca RUNNING.',
      'Como no se queda en RUNNING, nunca se interrumpe.',
    ],
  },
  Action: {
    summary: 'Hoja que hace algo en el robot.',
    rules: [
      'Síncrona (SyncActionNode): termina en el mismo tick con SUCCESS o FAILURE.',
      'Con async: true (StatefulActionNode) puede devolver RUNNING durante varios ticks.',
      'Si su padre la interrumpe (halt) mientras está en RUNNING, vuelve a IDLE y la próxima vez empieza de cero.',
    ],
  },
  AlwaysSuccess: {
    summary: 'Hoja que siempre devuelve SUCCESS.',
    rules: ['Útil para probar un árbol o rellenar una rama.'],
  },
  AlwaysFailure: {
    summary: 'Hoja que siempre devuelve FAILURE.',
    rules: ['Útil para probar un árbol o rellenar una rama.'],
  },
  Sequence: {
    summary: 'Ejecuta los hijos en orden mientras devuelven SUCCESS.',
    rules: [
      'Si un hijo devuelve FAILURE, devuelve FAILURE y el próximo tick empieza otra vez por el primer hijo.',
      'Si un hijo devuelve RUNNING, devuelve RUNNING y el próximo tick retoma ese mismo hijo: los anteriores no se vuelven a comprobar.',
      'Si el último hijo devuelve SUCCESS, devuelve SUCCESS y todos los hijos vuelven a IDLE.',
      'En la notación de clase equivale a →* (secuencia con memoria).',
    ],
  },
  ReactiveSequence: {
    summary: 'Como Sequence, pero en cada tick empieza otra vez por el primer hijo.',
    rules: [
      'Si un hijo anterior devuelve FAILURE, devuelve FAILURE e interrumpe al hijo que estaba en RUNNING.',
      'Cuando un hijo devuelve RUNNING, deja en IDLE a todos los demás.',
      'Sirve para comprobar condiciones en cada tick mientras dura una acción larga.',
      'En la notación de clase equivale a → (secuencia sin memoria).',
    ],
  },
  SequenceWithMemory: {
    summary: 'Secuencia que no repite los hijos que ya tuvieron éxito, ni siquiera tras un FAILURE.',
    rules: [
      'Si un hijo devuelve FAILURE, devuelve FAILURE pero recuerda la posición: el próximo tick reintenta ese mismo hijo.',
      'Si un hijo termina con éxito sin haber estado en RUNNING, devuelve RUNNING y pide re-tick antes de pasar al siguiente.',
      'Si la interrumpen (halt), también conserva la posición.',
      'No tiene equivalente directo en la notación de clase.',
    ],
  },
  Fallback: {
    summary: 'Prueba los hijos en orden hasta que uno devuelve SUCCESS.',
    rules: [
      'Si un hijo devuelve FAILURE, pasa al siguiente; si fallan todos, devuelve FAILURE.',
      'Si un hijo devuelve SUCCESS, devuelve SUCCESS y todos los hijos vuelven a IDLE.',
      'Si un hijo devuelve RUNNING, el próximo tick retoma ese mismo hijo sin volver a probar los anteriores.',
      'También se llama Selector. En la notación de clase equivale a ?* (con memoria).',
    ],
  },
  ReactiveFallback: {
    summary: 'Como Fallback, pero en cada tick empieza otra vez por el primer hijo.',
    rules: [
      'Si un hijo anterior devuelve SUCCESS, devuelve SUCCESS e interrumpe al hijo que estaba en RUNNING.',
      'Cuando un hijo devuelve RUNNING, deja en IDLE a todos los demás.',
      'En la notación de clase equivale a ? (sin memoria).',
    ],
  },
  Inverter: {
    summary: 'Intercambia el SUCCESS y el FAILURE de su hijo.',
    rules: ['Si el hijo devuelve RUNNING, devuelve RUNNING.'],
  },
  ForceSuccess: {
    summary: 'Devuelve SUCCESS cuando el hijo termina, sea cual sea su resultado.',
    rules: ['Si el hijo devuelve RUNNING, devuelve RUNNING.'],
  },
  ForceFailure: {
    summary: 'Devuelve FAILURE cuando el hijo termina, sea cual sea su resultado.',
    rules: ['Si el hijo devuelve RUNNING, devuelve RUNNING.'],
  },
  Repeat: {
    summary: 'Repite el hijo mientras devuelva SUCCESS, hasta num_cycles veces (−1: sin fin).',
    rules: [
      'Si el hijo devuelve FAILURE, devuelve FAILURE y el contador vuelve a 0.',
      'Si el hijo devuelve RUNNING, devuelve RUNNING sin contar la iteración.',
      'Si el hijo termina con éxito sin haber estado en RUNNING, cuenta la iteración, devuelve RUNNING y pide re-tick: cada iteración ocupa una pasada.',
      'Si el hijo termina con éxito después de haber estado en RUNNING, no cede el control: lo vuelve a lanzar en la misma pasada.',
    ],
  },
  RetryUntilSuccessful: {
    summary: 'Reintenta el hijo mientras devuelva FAILURE, hasta num_attempts veces (−1: sin fin).',
    rules: [
      'Si el hijo devuelve SUCCESS, devuelve SUCCESS y el contador vuelve a 0.',
      'Si se agotan los intentos, devuelve FAILURE.',
      'Si el hijo devuelve RUNNING, devuelve RUNNING sin contar el intento.',
      'Si el hijo falla sin haber estado en RUNNING, devuelve RUNNING y pide re-tick antes del siguiente intento.',
    ],
  },
};

/** Explicación del re-tick (wake-up), que aparece en la leyenda y en la traza. */
export const WAKEUP_TEXT =
  'El nodo devolvió RUNNING y pidió recorrer el árbol otra vez enseguida. Con tickOnce() o tickWhileRunning(), BT.CPP lanza esa pasada sin esperar; aquí la das tú con el siguiente tick.';
