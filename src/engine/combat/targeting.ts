// The targeting model (docs/combat.md "Action declaration & targeting").
// No spread damage reduction exists downstream of this.

import type { TargetMode } from '../content';
import type { CombatState, Side } from '../state';
import { nextInt, type RngState } from '../rng/seededRng';

export function oppositeSide(side: Side): Side {
  return side === 'A' ? 'B' : 'A';
}

export function findCombatantSide(state: CombatState, combatantId: string): Side {
  const combatant = state.combatants[combatantId];
  if (!combatant) throw new Error(`Unknown combatant: ${combatantId}`);
  return combatant.side;
}

function activeOf(state: CombatState, side: Side): string[] {
  return state.active[side].filter((id): id is string => id !== null && !state.combatants[id]?.fainted);
}

/** Which (side, slot) `combatantId` occupies in `state.active`, or null if not active there. */
export function slotOfActiveCombatant(state: CombatState, combatantId: string): { side: Side; slot: 0 | 1 } | null {
  for (const side of ['A', 'B'] as const) {
    const idx = state.active[side].indexOf(combatantId);
    if (idx === 0 || idx === 1) return { side, slot: idx };
  }
  return null;
}

/**
 * A declared single target is gone and nothing on that side remains to redirect
 * onto — a normal mid-round race, which resolveRound treats as a blocked action.
 * Distinct from the plain Error thrown when no target was declared at all.
 */
export class TargetNoLongerValidError extends Error {}

/**
 * Resolves a TargetMode into combatant ids. `declaredTarget` is required for
 * singleEnemy/singleAlly. `declaredTargetSlot` is the slot it held in the pre-round
 * snapshot: a target switched out retargets onto whoever now holds that slot, and a
 * target KO'd mid-round retargets onto the side's remaining active (2v2 Pokémon).
 */
export function resolveTargets(
  state: CombatState,
  actorCombatantId: string,
  targetMode: TargetMode,
  declaredTarget?: string | null,
  declaredTargetSlot?: { side: Side; slot: 0 | 1 } | null
): string[] {
  const side = findCombatantSide(state, actorCombatantId);
  const enemySide = oppositeSide(side);

  function resolveSingle(expectedSide: Side, label: string): string[] {
    if (!declaredTarget) throw new Error(`${label} move requires a declared target`);
    const active = activeOf(state, expectedSide);
    if (active.includes(declaredTarget)) {
      return [declaredTarget];
    }
    if (declaredTargetSlot && declaredTargetSlot.side === expectedSide) {
      const replacement = state.active[expectedSide][declaredTargetSlot.slot];
      if (replacement && !state.combatants[replacement]?.fainted) {
        return [replacement];
      }
    }
    if (active.length > 0) {
      return [active[0]];
    }
    throw new TargetNoLongerValidError(`Declared target ${declaredTarget} is not an active ${label === 'singleEnemy' ? 'enemy' : 'ally'}`);
  }

  switch (targetMode) {
    case 'self':
      return [actorCombatantId];

    case 'bothEnemies':
      return activeOf(state, enemySide);

    case 'bothAllies':
      return activeOf(state, side);

    case 'allOthers':
      return [...activeOf(state, enemySide), ...activeOf(state, side).filter((id) => id !== actorCombatantId)];

    case 'singleEnemy':
      return resolveSingle(enemySide, 'singleEnemy');

    case 'singleAlly':
      return resolveSingle(side, 'singleAlly');

    // Random modes return the candidate pool; resolveTargetsRolled narrows to one.
    case 'randomAlly':
      return activeOf(state, side);

    case 'randomEnemy':
      return activeOf(state, enemySide);
  }
}

/** The two TargetModes whose resolution draws from the seeded RNG. */
export function isRandomTargetMode(mode: TargetMode): boolean {
  return mode === 'randomAlly' || mode === 'randomEnemy';
}

/** resolveTargets plus the one draw a random mode needs. A non-random mode (or an empty pool) leaves rngState untouched. */
export function resolveTargetsRolled(
  state: CombatState,
  actorCombatantId: string,
  targetMode: TargetMode,
  rngState: RngState,
  declaredTarget?: string | null,
  declaredTargetSlot?: { side: Side; slot: 0 | 1 } | null
): { targetIds: string[]; nextRngState: RngState } {
  const pool = resolveTargets(state, actorCombatantId, targetMode, declaredTarget, declaredTargetSlot);
  if (!isRandomTargetMode(targetMode) || pool.length === 0) {
    return { targetIds: pool, nextRngState: rngState };
  }
  const roll = nextInt(rngState, 0, pool.length);
  return { targetIds: [pool[roll.value]], nextRngState: roll.nextState };
}

/** A rider's random target, resolved relative to the CASTER rather than to the move's own target. */
export function rollRiderTarget(
  state: CombatState,
  actorCombatantId: string,
  riderTarget: 'randomAlly' | 'randomEnemy',
  rngState: RngState
): { targetIds: string[]; nextRngState: RngState } {
  return resolveTargetsRolled(state, actorCombatantId, riderTarget, rngState);
}
