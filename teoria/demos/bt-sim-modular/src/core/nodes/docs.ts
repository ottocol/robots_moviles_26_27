// Enlaces a la documentación de BehaviorTree.CPP 4.x.
const BASE = 'https://www.behaviortree.dev/docs';

export const DOCS = {
  leaves: `${BASE}/learn-the-basics/main_concepts`,
  sequence: (anchor: string) => `${BASE}/nodes-library/SequenceNode#${anchor}`,
  fallback: (anchor: string) => `${BASE}/nodes-library/FallbackNode#${anchor}`,
  decorator: (anchor: string) => `${BASE}/nodes-library/DecoratorNode#${anchor}`,
};
