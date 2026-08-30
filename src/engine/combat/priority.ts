// Priority & speed resolution (docs/combat.md "Priority & speed resolution").
// Integer priority brackets resolve first; Speed is the tiebreaker within a
// bracket; equal priority AND equal speed draws a deterministic tiebreak from
// the seeded RNG, in fixed order (never insertion order).

import type { Action } from './actions';
import type { CombatState } from '../state';
import type { HeroLookup } from '../state';
import { getEffectiveStat, hasStatus } from '../state';
import type { FieldEffectDefinition, MoveDefinition } from '../content';
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

/**
 * Sanctuary's hook (docs/field-effects.md): a heal-kind move's priority
 * bracket gets `healPriorityBonus` added while the effect is active. Read
 * generically off the move's own `kind`, same discipline as every other
 * Field Effect flag — no hardcoded move/status id check.
 *
 * MoveDefinition.conditionalPriority (Storm's Electric Burst, "+1 if the
 * target has Conduct") is the second bonus term, and it is resolved HERE, off
 * `state`, for a structural reason worth stating: a bracket has to be known
 * before any action resolves, so the only board this can read is the
 * pre-resolution one. A mark planted earlier in the same round does not count;
 * the mark has to already be standing when the round is ordered. Read off the
 * DECLARED target alone — a fixed-group move has none, and never gets it.
 */
function actionPriority(
  state: CombatState,
  action: Action,
  moves: Record<string, MoveDefinition>,
  activeFieldEffectDef: FieldEffectDefinition | undefined
): number {
  if (action.kind === 'switch') return SWITCH_PRIORITY_BRACKET;
  if (action.kind === 'rest') return REST_PRIORITY_BRACKET;
  const move = moves[action.moveId];
  const healBonus = move.kind === 'heal' ? (activeFieldEffectDef?.healPriorityBonus ?? 0) : 0;
  const conditional = move.conditionalPriority;
  const declared = action.declaredTarget ? state.combatants[action.declaredTarget] : undefined;
  const conditionalBonus =
    conditional && declared && !declared.fainted && hasStatus(declared, conditional.requiresTargetStatus) ? conditional.bonus : 0;
  return move.priority + healBonus + conditionalBonus;
}

/**
 * What bracket `action` will actually resolve in — the same number
 * orderActions sorts on, exported so the view can print the LIVE priority of a
 * conditional-priority move (the button and the dossier both claim to show
 * "strikes first", and a move whose bracket depends on the board makes that
 * claim wrong the moment it is only ever read off `move.priority`).
 */
export function effectivePriority(
  state: CombatState,
  action: Action,
  moves: Record<string, MoveDefinition>,
  activeFieldEffectDef?: FieldEffectDefinition
): number {
  return actionPriority(state, action, moves, activeFieldEffectDef);
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
 *
 * Stasis Bubble (docs/field-effects.md) flips the Speed tiebreaker to
 * ascending (slowest-first) via `reversesSpeedOrder` — priority BRACKETS are
 * untouched (still sorted descending, higher-priority first), so a move with
 * nonzero authored priority "still functions as intended" and resolves in its
 * own bracket regardless of the flip; only which end of a shared bracket goes
 * first changes.
 */
export function orderActions(
  state: CombatState,
  heroes: HeroLookup,
  actions: readonly Action[],
  moves: Record<string, MoveDefinition>,
  rngState: RngState,
  fieldEffects: Record<string, FieldEffectDefinition> = {}
): { ordered: Action[]; nextRngState: RngState } {
  const activeFieldEffectId = state.activeFieldEffect?.fieldEffectId;
  const activeFieldEffectDef = activeFieldEffectId ? fieldEffects[activeFieldEffectId] : undefined;
  const speedDirection = activeFieldEffectDef?.reversesSpeedOrder ? 1 : -1;

  const withKeys: OrderedAction[] = actions.map((action) => {
    const combatant = state.combatants[action.combatantId];
    const hero = heroes[combatant.heroId];
    return {
      action,
      priority: actionPriority(state, action, moves, activeFieldEffectDef),
      speed: getEffectiveStat(hero, combatant, 'speed'),
    };
  });

  withKeys.sort((a, b) => b.priority - a.priority || (a.speed - b.speed) * speedDirection);

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
