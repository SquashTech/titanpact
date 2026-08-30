// Mana regen at the round boundary (docs/mana.md "Resolved", 2026-08-15):
// every round, active AND benched combatants regen mana from their own
// MP Regen stat. Unlike bench HP regen (switching.ts applyBenchHpRegen),
// this is explicitly NOT bench-only — it walks every non-fainted combatant,
// mirroring statusEngine.ts's tickEndOfRound iteration.
//
// A Field Effect's mpRegenMultiplier (docs/field-effects.md — Magical Surge's
// whole reason to exist) is applied HERE, not folded into the mpRegen stat
// itself: same discipline that keeps damage modifiers out of the stat
// pipeline (engine/content.ts StatKey doc, CLAUDE.md "Two-pipeline
// separation"), generalized to the regen pipeline.

import type { CombatState, HeroLookup } from '../state';
import { getEffectiveStat, getMaxMana } from '../state';
import type { FieldEffectDefinition } from '../content';
import type { ManaRegenTickedEvent } from '../events';

export function applyManaRegen(
  state: CombatState,
  round: number,
  heroes: HeroLookup,
  fieldEffects: Record<string, FieldEffectDefinition>
): { state: CombatState; events: ManaRegenTickedEvent[] } {
  const events: ManaRegenTickedEvent[] = [];
  const combatants = { ...state.combatants };
  const activeFieldEffectId = state.activeFieldEffect?.fieldEffectId;
  const mpRegenMultiplier = (activeFieldEffectId ? fieldEffects[activeFieldEffectId]?.mpRegenMultiplier : undefined) ?? 1;

  for (const id of Object.keys(state.combatants)) {
    const combatant = combatants[id];
    if (!combatant || combatant.fainted) continue;

    const hero = heroes[combatant.heroId];
    const maxMana = getMaxMana(hero, combatant);
    const previousMana = combatant.currentMana;
    const regen = Math.round(getEffectiveStat(hero, combatant, 'mpRegen') * mpRegenMultiplier);
    // Clamps a GAIN to the pool, but never pulls an already-overflowed
    // combatant back down to it (state.ts Combatant.currentMana, docs/mana.md
    // "Overflow"). A plain Math.min would have made every Arcane mana grant
    // (content.ts manaGrant) evaporate at the end of the round it landed in,
    // which is the exact opposite of "can exceed their max". At or above the
    // pool this is a no-op and emits nothing, same as it always did at full.
    const newMana = previousMana >= maxMana ? previousMana : Math.min(maxMana, previousMana + regen);

    if (newMana !== previousMana) {
      combatants[id] = { ...combatant, currentMana: newMana };
      events.push({ type: 'ManaRegenTicked', round, combatantId: id, manaRegen: newMana - previousMana, newMana, maxMana });
    }
  }

  return { state: { ...state, combatants }, events };
}
