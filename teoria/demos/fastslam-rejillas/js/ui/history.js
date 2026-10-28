// Historial de acciones para poder retroceder. No guarda copias de los mapas:
// para volver atrás se rehace la simulación desde el principio con la misma
// semilla y las mismas acciones, menos las últimas. El resultado es idéntico.
import { Simulation } from '../slam/simulation.js';

export class History {
  constructor(config) {
    this.config = config;
    this.actions = [];
  }

  get length() {
    return this.actions.length;
  }

  /** Registra un paso ya dado, con los ajustes que estaban activos. */
  recordAdvance(simulation, u, pauseBeforeLoopClosure) {
    this.actions.push({
      type: 'advance',
      u,
      pauseBeforeLoopClosure,
      improvedProposal: simulation.improvedProposal,
      motionNoise: simulation.motionNoise,
      routeIndex: simulation.route.index,
    });
  }

  recordApplyScan() {
    this.actions.push({ type: 'applyScan' });
  }

  /** Quita las `count` últimas acciones y devuelve la simulación rehecha. */
  undo(count) {
    this.actions = this.actions.slice(0, Math.max(0, this.actions.length - count));
    const simulation = new Simulation(this.config);
    for (const action of this.actions) {
      if (action.type === 'advance') {
        simulation.improvedProposal = action.improvedProposal;
        simulation.motionNoise = action.motionNoise;
        simulation.advance(action.u, { pauseBeforeLoopClosure: action.pauseBeforeLoopClosure });
        simulation.route.index = action.routeIndex;
      } else {
        simulation.applyPendingScan();
      }
    }
    return simulation;
  }
}
