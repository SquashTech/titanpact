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
): { ordered: Action[]; keys: OrderedAction[]; reversedSpeed: boolean; nextRngState: RngState } {
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

  return { ordered: withKeys.map((w) => w.action), keys: withKeys, reversedSpeed: speedDirection === 1, nextRngState: cursor };
}

/**
 * Whether a bracket put entry `i` somewhere Speed alone would not have: a cut ahead of someone
 * Speed would have sent first, or a hold behind someone it would have sent later. Read against the
 * order's own entries, so a +1 on the hero Speed already favoured — which changes nothing — is not
 * an effect. Under Stasis Bubble (`reversedSpeed`) the favoured one is the slower, so the
 * comparison flips with it. A rolled bracket (null) sits at 0.
 */
export function bracketEffect(
  entries: readonly { priority: number | null; speed: number }[],
  i: number,
  reversedSpeed: boolean
): 'cut' | 'held' | null {
  const p = entries[i].priority ?? 0;
  if (p === 0) return null;
  const outpaces = (a: { speed: number }, b: { speed: number }) => (reversedSpeed ? a.speed < b.speed : a.speed > b.speed);
  if (p > 0) return entries.slice(i + 1).some((e) => outpaces(e, entries[i])) ? 'cut' : null;
  return entries.slice(0, i).some((e) => outpaces(entries[i], e)) ? 'held' : null;
}

export interface OrderPreview {
  entries: OrderPreviewEntry[];
  /** Stasis Bubble: the slower combatant resolves first within a bracket. */
  reversedSpeed: boolean;
}

export interface OrderPreviewEntry {
  combatantId: string;
  /** The bracket the entry is placed in — `null` for a move whose bracket is rolled at resolution. */
  priority: number | null;
  speed: number;
  /** Same bracket and same Speed as the entry before it: the RNG decides between them. */
  tiedWithPrevious: boolean;
}

/**
 * The order the field would resolve in if every undeclared combatant swung a priority-0 move —
 * the view's readout while the player is still commanding. Sorts on the same keys as
 * orderActions and spins no RNG: a collision is flagged rather than shuffled, and a random
 * bracket sits at 0 with its priority left null. Declared actions (the player's so far) carry
 * their real bracket, so a switch, a Rest or a priority move moves its hero in the readout.
 */
export function previewOrder(
  state: CombatState,
  heroes: HeroLookup,
  combatantIds: readonly string[],
  declared: readonly Action[],
  moves: Record<string, MoveDefinition>,
  fieldEffects: Record<string, FieldEffectDefinition> = {},
  passives: Record<string, PassiveDefinition> = {}
): OrderPreview {
  const activeFieldEffectId = state.activeFieldEffect?.fieldEffectId;
  const activeFieldEffectDef = activeFieldEffectId ? fieldEffects[activeFieldEffectId] : undefined;
  const speedDirection = activeFieldEffectDef?.reversesSpeedOrder ? 1 : -1;
  const statCtx = { active: state.activeFieldEffect, defs: fieldEffects, board: { state, passives } };
  const byId = new Map(declared.map((a) => [a.combatantId, a]));

  const keyed = combatantIds.map((combatantId) => {
    const combatant = state.combatants[combatantId];
    const action = byId.get(combatantId);
    const random = action?.kind === 'move' && (moves[action.moveId]?.randomPriority?.length ?? 0) > 0;
    return {
      combatantId,
      priority: random ? null : action ? actionPriority(state, action, moves, activeFieldEffectDef) : 0,
      speed: getEffectiveStat(heroes[combatant.heroId], combatant, 'speed', statCtx),
    };
  });
  keyed.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || (a.speed - b.speed) * speedDirection);
  return {
    entries: keyed.map((entry, i) => ({
      ...entry,
      tiedWithPrevious: i > 0 && (keyed[i - 1].priority ?? 0) === (entry.priority ?? 0) && keyed[i - 1].speed === entry.speed,
    })),
    reversedSpeed: speedDirection === 1,
  };
}
