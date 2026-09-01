// Mana regen at the round boundary (docs/mana.md): every non-fainted
// combatant, active AND benched. A Field Effect's mpRegenMultiplier applies
// here, never folded into the mpRegen stat (two-pipeline discipline).

import type { CombatState, HeroLookup } from '../state';
import { getEffectiveStat, getMaxMana } from '../state';
import type { FieldEffectDefinition, PassiveDefinition } from '../content';
import type { ManaRegenTickedEvent } from '../events';

export function applyManaRegen(
  state: CombatState,
  round: number,
  heroes: HeroLookup,
  fieldEffects: Record<string, FieldEffectDefinition>,
  /** A conditional passive could name mpRegen; every reader of an effective stat must agree. */
  passives: Record<string, PassiveDefinition> = {}
): { state: CombatState; events: ManaRegenTickedEvent[] } {
  const events: ManaRegenTickedEvent[] = [];
  const combatants = { ...state.combatants };
  const activeFieldEffectId = state.activeFieldEffect?.fieldEffectId;
  const mpRegenMultiplier = (activeFieldEffectId ? fieldEffects[activeFieldEffectId]?.mpRegenMultiplier : undefined) ?? 1;
  const statCtx = { active: state.activeFieldEffect, defs: fieldEffects, board: { state, passives } };

  for (const id of Object.keys(state.combatants)) {
    const combatant = combatants[id];
    if (!combatant || combatant.fainted) continue;

    const hero = heroes[combatant.heroId];
    const maxMana = getMaxMana(hero, combatant);
    const previousMana = combatant.currentMana;
    const regen = Math.round(getEffectiveStat(hero, combatant, 'mpRegen', statCtx) * mpRegenMultiplier);
    // Clamps a GAIN to the pool but never pulls an overflowed combatant back down (docs/mana.md "Overflow").
    const newMana = previousMana >= maxMana ? previousMana : Math.min(maxMana, previousMana + regen);

    if (newMana !== previousMana) {
      combatants[id] = { ...combatant, currentMana: newMana };
      events.push({ type: 'ManaRegenTicked', round, combatantId: id, manaRegen: newMana - previousMana, newMana, maxMana });
    }
  }

  return { state: { ...state, combatants }, events };
}
