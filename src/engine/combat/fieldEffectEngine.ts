// Field Effects (docs/field-effects.md): one global battlefield state, flat 5
// rounds; re-setting the active effect is a no-op, a different one overrides.

import type { CombatState } from '../state';
import type { FieldEffectId } from '../content';
import type { CombatEvent } from '../events';

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
