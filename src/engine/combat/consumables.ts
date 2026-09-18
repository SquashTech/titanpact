// Consumables in a fight (docs/run-loop.md "Consumables"): a FREE action, applied to state during
// the command phase rather than declared into the round. actions.ts forbids an action seeing
// another's outcome; a potion's whole point is that the player sees its outcome before declaring
// — drink, then pick the move the Mana now affords. So it is not an Action. Like the Pact Clock
// it is a direct HP/Mana change: no formula, no variance, and no passive reaction pass. The
// Revive (2026-09-18, per user direction) is the same verb aimed the other way: at a FALLEN
// hero, who stands onto the bench at half — the map's Revive brought into the fight, so one
// saved for the final battle is a layer of safety in a fight nothing mends inside.

import type { CombatState } from '../state';
import type { CombatEvent } from '../events';
import { applyHpDelta } from './faintHandling';

export type PotionKind = 'hpPotion' | 'mpPotion';
/** Everything the Bag can use on the field. */
export type FightConsumableKind = PotionKind | 'revive';

/** Half of the stat's max, all three kinds — a Revive stands a hero up at half. Flat: a consumable is a run resource, not a heal move. */
export const CONSUMABLE_RESTORE_FRACTION = 0.5;

export class ConsumableUseError extends Error {}

/** Why a consumable cannot be used on this combatant right now, or null when it can. */
export function consumableRefusal(
  state: CombatState,
  combatantId: string,
  kind: FightConsumableKind,
  maxHpOf: (combatantId: string) => number,
  maxManaOf: (combatantId: string) => number
): string | null {
  const combatant = state.combatants[combatantId];
  if (!combatant) return 'no such combatant';
  // A Revive is for the fallen and nobody else; a potion is for anyone but them.
  if (kind === 'revive') return combatant.fainted ? null : 'Standing';
  if (combatant.fainted) return 'Down';
  // Active only: the bench regenerates on its own, and a KO'd hero is a different item's business.
  if (!state.active[combatant.side].includes(combatantId)) return 'Not on the field';
  if (kind === 'hpPotion' && combatant.currentHp >= maxHpOf(combatantId)) return 'Full HP';
  // Overflow (docs/mana.md) reads as full: a restore never stacks on a grant.
  if (kind === 'mpPotion' && combatant.currentMana >= maxManaOf(combatantId)) return 'Full Mana';
  return null;
}

/**
 * One ConsumableUsed, then the ordinary HpChanged or ManaChanged. A RESTORE, never a grant: HP
 * caps at max through applyHpDelta, Mana at max here — the potion is not a second faucet for
 * overflow. Throws rather than no-ops on a refusal so a caller cannot spend a potion for nothing.
 */
export function useConsumable(
  state: CombatState,
  round: number,
  combatantId: string,
  kind: FightConsumableKind,
  maxHpOf: (combatantId: string) => number,
  maxManaOf: (combatantId: string) => number
): { state: CombatState; events: CombatEvent[] } {
  const refusal = consumableRefusal(state, combatantId, kind, maxHpOf, maxManaOf);
  if (refusal) throw new ConsumableUseError(`${combatantId} ${refusal}`);
  const combatant = state.combatants[combatantId];

  if (kind === 'revive') {
    // Stands, onto the bench at the back, and the side's knockouts count one fewer for lock-in —
    // half a side down is what locks it, and this hero is no longer down. Statuses and modifiers
    // are whatever the KO left (a KO clears nothing of its own; switching does).
    const maxHp = maxHpOf(combatantId);
    const amount = Math.max(1, Math.round(maxHp * CONSUMABLE_RESTORE_FRACTION));
    const standing: CombatState = {
      ...state,
      combatants: { ...state.combatants, [combatantId]: { ...combatant, fainted: false, currentHp: 0 } },
      bench: { ...state.bench, [combatant.side]: [...state.bench[combatant.side], combatantId] },
      koCount: { ...state.koCount, [combatant.side]: Math.max(0, state.koCount[combatant.side] - 1) },
    };
    const up = applyHpDelta(standing, round, combatantId, amount, maxHp);
    return {
      state: up.state,
      events: [{ type: 'ConsumableUsed', round, combatantId, kind, amount }, ...up.events],
    };
  }

  if (kind === 'hpPotion') {
    const maxHp = maxHpOf(combatantId);
    const amount = Math.min(maxHp - combatant.currentHp, Math.max(1, Math.round(maxHp * CONSUMABLE_RESTORE_FRACTION)));
    const hit = applyHpDelta(state, round, combatantId, amount, maxHp);
    return {
      state: hit.state,
      events: [{ type: 'ConsumableUsed', round, combatantId, kind, amount }, ...hit.events],
    };
  }

  const maxMana = maxManaOf(combatantId);
  const previousMana = combatant.currentMana;
  const newMana = Math.min(maxMana, previousMana + Math.max(1, Math.round(maxMana * CONSUMABLE_RESTORE_FRACTION)));
  return {
    state: { ...state, combatants: { ...state.combatants, [combatantId]: { ...combatant, currentMana: newMana } } },
    events: [
      { type: 'ConsumableUsed', round, combatantId, kind, amount: newMana - previousMana },
      { type: 'ManaChanged', round, combatantId, previousMana, newMana, maxMana },
    ],
  };
}
