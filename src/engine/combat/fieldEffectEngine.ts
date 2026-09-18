// Field Effects (docs/field-effects.md): one global battlefield state, flat 5
// rounds; re-setting the active effect is a no-op, a different one overrides.

import type { CombatState, HeroLookup } from '../state';
import { effectiveTypes } from '../state';
import type { FieldEffectDefinition, FieldEffectId } from '../content';
import type { CombatEvent } from '../events';
import { applyHpDelta } from './faintHandling';

export const FIELD_EFFECT_DURATION_ROUNDS = 5;

/** Callers must check the id resolves in their FieldEffectDefinition lookup first. */
export function setFieldEffect(
  state: CombatState,
  round: number,
  fieldEffectId: FieldEffectId
): { state: CombatState; events: CombatEvent[] } {
  const previousFieldEffectId = state.activeFieldEffect?.fieldEffectId ?? null;
  if (previousFieldEffectId === fieldEffectId) return { state, events: [] }; // never refreshes the clock

  return {
    state: { ...state, activeFieldEffect: { fieldEffectId, roundsRemaining: FIELD_EFFECT_DURATION_ROUNDS } },
    events: [{ type: 'FieldEffectSet', round, fieldEffectId, previousFieldEffectId }],
  };
}

/**
 * The active field's drain (FieldEffectDefinition.drainsPercentMaxHp — Withering Gaze), on the Pact
 * Clock's terms: every ACTIVE combatant not of an exempt type loses the fraction of its max HP,
 * direct, at least 1, no reaction pass. Runs before the countdown so a field's last round still
 * presses. No-op with no field, or a field that does not drain.
 */
export function tickFieldEffectDrain(
  state: CombatState,
  round: number,
  fieldEffectDefs: Record<string, FieldEffectDefinition>,
  heroes: HeroLookup,
  maxHpOf: (combatantId: string) => number
): { state: CombatState; events: CombatEvent[] } {
  const active = state.activeFieldEffect;
  const drain = active ? fieldEffectDefs[active.fieldEffectId]?.drainsPercentMaxHp : undefined;
  if (!active || !drain) return { state, events: [] };

  const events: CombatEvent[] = [{ type: 'FieldEffectDrained', round, fieldEffectId: active.fieldEffectId, fraction: drain.fraction }];
  let working = state;
  for (const side of ['A', 'B'] as const) {
    // Slot order — a fixed traversal for replay.
    for (const id of working.active[side]) {
      if (id === null) continue;
      const combatant = working.combatants[id];
      if (!combatant || combatant.fainted) continue;
      const hero = heroes[combatant.heroId];
      if (hero && drain.exemptTypes?.some((t) => effectiveTypes(hero, combatant).includes(t))) continue;
      const maxHp = maxHpOf(id);
      const hit = applyHpDelta(working, round, id, -Math.max(1, Math.ceil(maxHp * drain.fraction)), maxHp);
      working = hit.state;
      events.push(...hit.events);
    }
  }
  return { state: working, events };
}

/** End-of-round countdown. No-op if no Field Effect is active. */
export function tickFieldEffect(state: CombatState, round: number): { state: CombatState; events: CombatEvent[] } {
  const active = state.activeFieldEffect;
  if (!active) return { state, events: [] };

  const roundsRemaining = active.roundsRemaining - 1;
  if (roundsRemaining <= 0) {
    return {
      state: { ...state, activeFieldEffect: null },
      events: [{ type: 'FieldEffectExpired', round, fieldEffectId: active.fieldEffectId }],
    };
  }

  return {
    state: { ...state, activeFieldEffect: { ...active, roundsRemaining } },
    events: [{ type: 'FieldEffectTicked', round, fieldEffectId: active.fieldEffectId, roundsRemaining }],
  };
}
