// How many taps a round costs to watch: the fight screen's own beats (src/view/combat/buildBeats.ts),
// counted rather than mirrored, so the sim's run-length clock can never drift from what is played.

import type { CombatEvent } from '../../src/engine/events';
import type { CombatState } from '../../src/engine/state';
import { buildBeats } from '../../src/view/combat/buildBeats';
import { allCombatants } from '../../src/data/content';
import { moves } from '../../src/data/moves';

/** `combatants` is the state the events start from — the beats read names and types off it. */
export function countBeats(events: readonly CombatEvent[], combatants: CombatState['combatants']): number {
  return buildBeats(events, allCombatants, moves, combatants, 'A').length;
}
