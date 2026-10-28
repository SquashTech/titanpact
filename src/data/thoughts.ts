// Blip's firsts (docs/the-sky.md §1): wordless beats, each kept once an account. The first sky plays
// the fall and starts the first lesson; a constellation's first, the first time it is seen open,
// sends Blip there to point it out.

import type { ThoughtDefinition } from '../run/thoughts';

export const THOUGHTS: readonly ThoughtDefinition[] = [
  { id: 'firstSky', moment: { kind: 'firstSky' }, showsNext: 'firstLight', plays: 'firstLight.move', scene: 'fall' },

  { id: 'revealed.firstLight', moment: { kind: 'revealed', constellationId: 'firstLight' } },
  { id: 'revealed.infinite', moment: { kind: 'revealed', constellationId: 'infinite' } },
  { id: 'revealed.trials', moment: { kind: 'revealed', constellationId: 'trials' } },
  { id: 'revealed.gauntlet', moment: { kind: 'revealed', constellationId: 'gauntlet' } },
  { id: 'revealed.strange', moment: { kind: 'revealed', constellationId: 'strange' } },
];
