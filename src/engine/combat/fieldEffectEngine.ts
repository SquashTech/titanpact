// Field Effects (docs/field-effects.md) — a single global battlefield state,
// generalizing and resolving the former "weather subsystem" open question
// (docs/mana.md). Mirrors statusEngine.ts's discipline: pure, generic
// functions reading FieldEffectDefinition flags off CombatState.activeFieldEffect,
// no per-effect special cases.
//
// Locked shape (2026-08-21 designer sign-off): only one Field Effect active at
// a time; every Field Effect lasts a flat 5 rounds regardless of which one it
// is (not authored per-definition — see FIELD_EFFECT_DURATION_ROUNDS below);
// re-setting the CURRENTLY active effect is a no-op (does not refresh the
// clock); setting a DIFFERENT one overrides it, discarding the old clock and
// restarting a fresh one at 5.

import type { CombatState } from '../state';
import type { FieldEffectId } from '../content';
import type { CombatEvent } from '../events';

export const FIELD_EFFECT_DURATION_ROUNDS = 5;

/**
 * Sets the battlefield's Field Effect. Callers (resolveRound.ts's
 * fieldEffectApplication handling, passiveEngine.ts's setFieldEffect
 * PassiveEffect) are responsible for checking the id resolves in their
 * FieldEffectDefinition lookup before calling this — same discipline as
 * statusApplication's `def` guard in resolveRound.ts.
 */
export function setFieldEffect(
  state: CombatState,
  round: number,
  fieldEffectId: FieldEffectId
): { state: CombatState; events: CombatEvent[] } {
  const previousFieldEffectId = state.activeFieldEffect?.fieldEffectId ?? null;
  if (previousFieldEffectId === fieldEffectId) return { state, events: [] }; // no-op: re-applying the active effect never refreshes its clock

  return {
    state: { ...state, activeFieldEffect: { fieldEffectId, roundsRemaining: FIELD_EFFECT_DURATION_ROUNDS } },
    events: [{ type: 'FieldEffectSet', round, fieldEffectId, previousFieldEffectId }],
  };
}

/** End-of-round countdown (resolveRound.ts, alongside status/mana ticks). No-op if no Field Effect is active. */
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
