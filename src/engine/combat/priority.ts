// Priority & speed resolution (docs/combat.md). Integer brackets first; Speed
// breaks ties within a bracket; exact ties draw from the seeded RNG in fixed order.

import type { Action } from './actions';
import type { CombatState, HeroLookup } from '../state';
import { getEffectiveStat, hasStatus } from '../state';
import type { FieldEffectDefinition, MoveDefinition, PassiveDefinition } from '../content';
import { nextInt, type RngState } from '../rng/seededRng';

/** Provisional convention: switches resolve before any move, regardless of speed. Not stated in docs — flag if it needs review. */
export const SWITCH_PRIORITY_BRACKET = Number.POSITIVE_INFINITY;

/** Rest resolves dead last: "everyone who did something, then whoever passed." */
export const REST_PRIORITY_BRACKET = Number.NEGATIVE_INFINITY;

// Three terms on top of the authored bracket: a heal-kind bonus while a Field Effect
// grants one, conditionalPriority read off the DECLARED target on the pre-resolution
// board (a bracket must be settled before anything resolves), and randomPriority,
// which REPLACES the authored bracket and is passed in already rolled so a view read
// never spins the reel.
function actionPriority(
  state: CombatState,
  action: Action,
  moves: Record<string, MoveDefinition>,
  activeFieldEffectDef: FieldEffectDefinition | undefined,
  rolledBracket?: number
): number {
  if (action.kind === 'switch') return SWITCH_PRIORITY_BRACKET;
  if (action.kind === 'rest') return REST_PRIORITY_BRACKET;
  const move = moves[action.moveId];
  const healBonus = move.kind === 'heal' ? (activeFieldEffectDef?.healPriorityBonus ?? 0) : 0;
  const conditional = move.conditionalPriority;
  const declared = action.declaredTarget ? state.combatants[action.declaredTarget] : undefined;
  const conditionalBonus =
    conditional && declared && !declared.fainted && hasStatus(declared, conditional.requiresTargetStatus) ? conditional.bonus : 0;
  return (rolledBracket ?? move.priority) + healBonus + conditionalBonus;
}

/** The bracket `action` will resolve in — the same number orderActions sorts on, for the view's live priority readout. */
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
 * Orders declared actions for resolution and returns the advanced RNG state. Random
 * brackets are drawn first in action order, then one tiebreak shuffle per exact
 * priority+speed collision, left to right. `reversesSpeedOrder` (Stasis Bubble) flips
 * only the Speed tiebreaker; brackets still sort descending.
 */
export function orderActions(
  state: CombatState,
  heroes: HeroLookup,
  actions: readonly Action[],
  moves: Record<string, MoveDefinition>,
  rngState: RngState,
  fieldEffects: Record<string, FieldEffectDefinition> = {},
  /** Conditional passives can grant Speed; turn order must read the same number the card shows. */
  passives: Record<string, PassiveDefinition> = {}
): { ordered: Action[]; nextRngState: RngState } {
  const activeFieldEffectId = state.activeFieldEffect?.fieldEffectId;
  const activeFieldEffectDef = activeFieldEffectId ? fieldEffects[activeFieldEffectId] : undefined;
  const speedDirection = activeFieldEffectDef?.reversesSpeedOrder ? 1 : -1;

  let rollCursor = rngState;
  const rolledBrackets = new Map<Action, number>();
  for (const action of actions) {
    if (action.kind !== 'move') continue;
    const brackets = moves[action.moveId]?.randomPriority;
    if (!brackets?.length) continue;
    const draw = nextInt(rollCursor, 0, brackets.length);
    rollCursor = draw.nextState;
    rolledBrackets.set(action, brackets[draw.value]);
  }

  const statCtx = { active: state.activeFieldEffect, defs: fieldEffects, board: { state, passives } };
  const withKeys: OrderedAction[] = actions.map((action) => {
    const combatant = state.combatants[action.combatantId];
    const hero = heroes[combatant.heroId];
    return {
      action,
      priority: actionPriority(state, action, moves, activeFieldEffectDef, rolledBrackets.get(action)),
      speed: getEffectiveStat(hero, combatant, 'speed', statCtx),
    };
  });

  withKeys.sort((a, b) => b.priority - a.priority || (a.speed - b.speed) * speedDirection);

  let cursor = rollCursor;
  let i = 0;
  while (i < withKeys.length) {
    let j = i + 1;
    while (j < withKeys.length && withKeys[j].priority === withKeys[i].priority && withKeys[j].speed === withKeys[i].speed) {
      j++;
    }
    if (j - i > 1) {
      const shuffled: OrderedAction[] = [];
      const pool = withKeys.slice(i, j);
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
