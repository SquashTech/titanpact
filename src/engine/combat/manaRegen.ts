// Mana regen at the round boundary (docs/mana.md "Resolved", 2026-08-15):
// every round, active AND benched combatants regen mana from their own
// MP Regen stat. Unlike bench HP regen (switching.ts applyBenchHpRegen),
// this is explicitly NOT bench-only — it walks every non-fainted combatant,
// mirroring statusEngine.ts's tickEndOfRound iteration.

import type { CombatState, HeroLookup } from '../state';
import { getEffectiveStat, getMaxMana } from '../state';
import type { ManaRegenTickedEvent } from '../events';

export function applyManaRegen(
  state: CombatState,
  round: number,
  heroes: HeroLookup
): { state: CombatState; events: ManaRegenTickedEvent[] } {
  const events: ManaRegenTickedEvent[] = [];
  const combatants = { ...state.combatants };

  for (const id of Object.keys(state.combatants)) {
    const combatant = combatants[id];
    if (!combatant || combatant.fainted) continue;

    const hero = heroes[combatant.heroId];
    const maxMana = getMaxMana(hero, combatant);
    const previousMana = combatant.currentMana;
    const regen = getEffectiveStat(hero, combatant, 'mpRegen');
    const newMana = Math.min(maxMana, previousMana + regen);

    if (newMana !== previousMana) {
      combatants[id] = { ...combatant, currentMana: newMana };
      events.push({ type: 'ManaRegenTicked', round, combatantId: id, manaRegen: newMana - previousMana, newMana, maxMana });
    }
  }

  return { state: { ...state, combatants }, events };
}
