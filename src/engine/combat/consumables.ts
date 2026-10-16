// Consumables in a fight (docs/run-loop.md "Consumables"): a FREE action, applied to state during
// the command phase rather than declared into the round. actions.ts forbids an action seeing
// another's outcome; a potion's whole point is that the player sees its outcome before declaring
// — drink, then pick the move the Mana now affords. So it is not an Action. Like the Pact Clock
// it is a direct HP/Mana change: no formula, no variance, and no passive reaction pass.

import type { CombatState, HeroLookup } from '../state';
import type { CombatEvent } from '../events';
import type { FieldEffectDefinition, MoveDefinition, PassiveDefinition, StatusDefinition } from '../content';
import { applyHpDelta } from './faintHandling';
import { resolvePassiveReactions } from './passiveEngine';

export type PotionKind = 'hpPotion' | 'mpPotion';

/** Half of the stat's max. Flat: a consumable is a run resource, not a heal move. */
export const CONSUMABLE_RESTORE_FRACTION = 0.5;

export class ConsumableUseError extends Error {}

/** Why a consumable cannot be used on this combatant right now, or null when it can. */
export function consumableRefusal(
  state: CombatState,
  combatantId: string,
  kind: PotionKind,
  maxHpOf: (combatantId: string) => number,
  maxManaOf: (combatantId: string) => number
): string | null {
  const combatant = state.combatants[combatantId];
  if (!combatant) return 'no such combatant';
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
  kind: PotionKind,
  maxHpOf: (combatantId: string) => number,
  maxManaOf: (combatantId: string) => number
): { state: CombatState; events: CombatEvent[] } {
  const refusal = consumableRefusal(state, combatantId, kind, maxHpOf, maxManaOf);
  if (refusal) throw new ConsumableUseError(`${combatantId} ${refusal}`);
  const combatant = state.combatants[combatantId];

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

/**
 * useConsumable, then the ConsumableUsed hook and nothing else: Drake's Hoard is the one card that
 * answers a drink (2026-10-11, per user direction). Every other event of the drink stays out of
 * the reaction pass, so a potion is still not a heal or a mana gain to any other passive.
 */
export function useConsumableWithReactions(
  state: CombatState,
  round: number,
  combatantId: string,
  kind: PotionKind,
  maxHpOf: (combatantId: string) => number,
  maxManaOf: (combatantId: string) => number,
  defs: { heroes: HeroLookup; statuses: Record<string, StatusDefinition>; passives: Record<string, PassiveDefinition>; fieldEffects: Record<string, FieldEffectDefinition>; moves: Record<string, MoveDefinition> }
): { state: CombatState; events: CombatEvent[] } {
  const used = useConsumable(state, round, combatantId, kind, maxHpOf, maxManaOf);
  const drink = used.events.filter((e) => e.type === 'ConsumableUsed');
  const reacted = resolvePassiveReactions(used.state, round, drink, defs.heroes, defs.statuses, defs.passives, defs.fieldEffects, defs.moves);
  return { state: reacted.state, events: [...used.events, ...reacted.events] };
}
