// Priority & speed resolution (docs/combat.md "Priority & speed resolution").
// Integer priority brackets resolve first; Speed is the tiebreaker within a
// bracket; equal priority AND equal speed draws a deterministic tiebreak from
// the seeded RNG, in fixed order (never insertion order).

import type { Action } from './actions';
import type { CombatState } from '../state';
import type { HeroLookup } from '../state';
import { getEffectiveStat } from '../state';
import { nextInt, type RngState } from '../rng/seededRng';

/**
 * Provisional convention, independent of the (now LOCKED, docs/combat.md)
 * turn/round model: switches resolve before any move, regardless of speed.
 * Not stated explicitly in the docs — flag if this assumption needs designer
 * review; it just hasn't come up yet.
 */
export const SWITCH_PRIORITY_BRACKET = Number.POSITIVE_INFINITY;

/**
 * Rest (combat/actions.ts RestAction) resolves dead last, symmetric with
 * switches resolving first — it never targets anyone, so where exactly it
 * lands relative to other moves has no correctness consequence, but sorting
 * it after every authored move priority (-1..1, src/data/moves.ts) keeps the
 * turn order legible: "everyone who actually did something, then whoever
 * passed."
 */
export const REST_PRIORITY_BRACKET = Number.NEGATIVE_INFINITY;

function actionPriority(action: Action, movePriority: (moveId: string) => number): number {
  if (action.kind === 'switch') return SWITCH_PRIORITY_BRACKET;
  if (action.kind === 'rest') return REST_PRIORITY_BRACKET;
  return movePriority(action.moveId);
}

export interface OrderedAction {
  action: Action;
  priority: number;
  speed: number;
}

/**
 * Orders declared actions for resolution. Returns the order plus the advanced
 * RNG state (ties consume RNG in a fixed, documented sequence: one tiebreak
 * roll per colliding pair, processed left-to-right over the pre-sorted list).
 */
export function orderActions(
  state: CombatState,
  heroes: HeroLookup,
  actions: readonly Action[],
  movePriority: (moveId: string) => number,
  rngState: RngState
): { ordered: Action[]; nextRngState: RngState } {
  const withKeys: OrderedAction[] = actions.map((action) => {
    const combatant = state.combatants[action.combatantId];
    const hero = heroes[combatant.heroId];
    return {
      action,
      priority: actionPriority(action, movePriority),
      speed: getEffectiveStat(hero, combatant, 'speed'),
    };
  });

  withKeys.sort((a, b) => b.priority - a.priority || b.speed - a.speed);

  // Resolve exact priority+speed ties deterministically via the seeded RNG.
  let cursor = rngState;
  let i = 0;
  while (i < withKeys.length) {
    let j = i + 1;
    while (j < withKeys.length && withKeys[j].priority === withKeys[i].priority && withKeys[j].speed === withKeys[i].speed) {
      j++;
    }
    if (j - i > 1) {
      const tiedGroup = withKeys.slice(i, j);
      const shuffled: OrderedAction[] = [];
      const pool = [...tiedGroup];
      while (pool.length > 0) {
        const roll = nextInt(cursor, 0, pool.length);
        cursor = roll.nextState;
        shuffled.push(pool.splice(roll.value, 1)[0]);
      }
      for (let k = 0; k < shuffled.length; k++) withKeys[i + k] = shuffled[k];
    }
    i = j;
  }

  return { ordered: withKeys.map((w) => w.action), nextRngState: cursor };
}
