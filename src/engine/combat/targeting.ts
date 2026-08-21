// The targeting model (docs/combat.md "Action declaration & targeting").
// Moves target a specific slot on the 2v2 grid, or a fixed group. No spread
// damage reduction exists anywhere downstream of this — a move hitting two
// targets deals full damage to each.

import type { TargetMode } from '../content';
import type { CombatState, Side } from '../state';

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

/**
 * Which (side, slot) `combatantId` occupied in `state.active` — used to find
 * a declared target's slot as of the pre-round snapshot, before any switches
 * resolved. Returns null if the combatant wasn't an active slot occupant in
 * that state at all (e.g. it was already benched).
 */
export function slotOfActiveCombatant(state: CombatState, combatantId: string): { side: Side; slot: 0 | 1 } | null {
  for (const side of ['A', 'B'] as const) {
    const idx = state.active[side].indexOf(combatantId);
    if (idx === 0 || idx === 1) return { side, slot: idx };
  }
  return null;
}

/**
 * A declared target (singleEnemy/singleAlly) is no longer legal by the time
 * this action comes up in priority/speed order, AND there's no other active
 * combatant on that side to redirect onto — e.g. two attackers both declared
 * against the same lone enemy, an earlier-resolving one already knocked it
 * out, and it was the only enemy left standing. Actions are declared against
 * a pre-round snapshot and resolved in order, so this is a normal mid-round
 * race, not a bug — callers (resolveRound.ts) catch this specifically and
 * treat the action as blocked, distinct from the plain Error thrown when a
 * target was never declared at all (an actual caller bug the view is
 * supposed to prevent).
 */
export class TargetNoLongerValidError extends Error {}

/**
 * Resolves a TargetMode into concrete combatant ids.
 * `declaredTarget` is required for singleEnemy/singleAlly (the player's choice
 * of slot) and ignored for fixed-group modes.
 *
 * `declaredTargetSlot` is the (side, slot) `declaredTarget` occupied in the
 * pre-round snapshot (before any actions resolved). Since voluntary switches
 * always resolve before moves (priority.ts SWITCH_PRIORITY_BRACKET), the
 * original target may have already been swapped out for a bench replacement
 * by the time this move comes up — 2v2 Pokemon retargets the attack onto
 * whoever now occupies that slot rather than letting the attacker waste their
 * turn, and this hint is what lets us do the same instead of always
 * fizzling. Only a genuinely empty slot (the target fainted and hasn't been
 * replaced yet — replacement happens between rounds) still fizzles.
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
    if (activeOf(state, expectedSide).includes(declaredTarget)) {
      return [declaredTarget];
    }
    if (declaredTargetSlot && declaredTargetSlot.side === expectedSide) {
      const replacement = state.active[expectedSide][declaredTargetSlot.slot];
      if (replacement && !state.combatants[replacement]?.fainted) {
        return [replacement];
      }
    }
    // The declared target fainted earlier this same round (an earlier-resolving
    // action KO'd it) and hasn't been replaced — replacement only happens
    // between rounds, so that slot is genuinely empty. Rather than waste the
    // action, retarget onto whoever else is still active on that side, the
    // same auto-redirect 2v2 Pokemon does for a single-target move whose
    // target dropped out mid-turn. Only a wholly empty side still fizzles.
    const remaining = activeOf(state, expectedSide);
    if (remaining.length > 0) {
      return [remaining[0]];
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
  }
}
