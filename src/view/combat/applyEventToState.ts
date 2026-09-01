// Replays one engine event onto a CombatState for sequenced playback. No game
// logic here — it only copies the values each event already carries.

import type { CombatEvent } from '../../engine/events';
import type { CombatState } from '../../engine/state';
import { FIELD_EFFECT_DURATION_ROUNDS } from '../../engine/combat/fieldEffectEngine';

export function applyEventToState(state: CombatState, event: CombatEvent): CombatState {
  switch (event.type) {
    case 'HpChanged':
      return {
        ...state,
        combatants: { ...state.combatants, [event.combatantId]: { ...state.combatants[event.combatantId], currentHp: event.newHp } },
      };

    case 'ManaChanged':
      return {
        ...state,
        combatants: { ...state.combatants, [event.combatantId]: { ...state.combatants[event.combatantId], currentMana: event.newMana } },
      };

    case 'BenchRegenTicked':
      return {
        ...state,
        combatants: { ...state.combatants, [event.combatantId]: { ...state.combatants[event.combatantId], currentHp: event.newHp } },
      };

    case 'ManaRegenTicked':
      return {
        ...state,
        combatants: { ...state.combatants, [event.combatantId]: { ...state.combatants[event.combatantId], currentMana: event.newMana } },
      };

    // May exceed the pool — never re-clamp (docs/mana.md "Overflow"). Keyed on targetCombatantId.
    case 'ManaGranted':
      return {
        ...state,
        combatants: {
          ...state.combatants,
          [event.targetCombatantId]: { ...state.combatants[event.targetCombatantId], currentMana: event.newMana },
        },
      };

    case 'Fainted':
      return {
        ...state,
        combatants: { ...state.combatants, [event.combatantId]: { ...state.combatants[event.combatantId], fainted: true } },
        koCount: { ...state.koCount, [event.side]: event.koCount },
        active: {
          ...state.active,
          [event.side]: state.active[event.side].map((id) => (id === event.combatantId ? null : id)) as [string | null, string | null],
        },
      };

    // Mirrors switching.ts performSwitch, from the event's recorded outcome.
    case 'SwitchedIn': {
      const nextActive = [...state.active[event.side]] as [string | null, string | null];
      nextActive[event.slot] = event.inCombatantId;
      const nextBench = state.bench[event.side].filter((id) => id !== event.inCombatantId);
      if (event.outCombatantId) nextBench.push(event.outCombatantId);
      return {
        ...state,
        active: { ...state.active, [event.side]: nextActive },
        bench: { ...state.bench, [event.side]: nextBench },
      };
    }

    case 'StatChanged':
      return {
        ...state,
        combatants: {
          ...state.combatants,
          [event.combatantId]: {
            ...state.combatants[event.combatantId],
            statModifiers: { ...state.combatants[event.combatantId].statModifiers, [event.stat]: event.newValue },
          },
        },
      };

    case 'StatusApplied':
      return {
        ...state,
        combatants: {
          ...state.combatants,
          [event.combatantId]: {
            ...state.combatants[event.combatantId],
            statuses: {
              ...state.combatants[event.combatantId].statuses,
              [event.statusId]: { statusId: event.statusId, magnitude: event.magnitude, duration: event.duration },
            },
          },
        },
      };

    // Post-tick figures; a trailing StatusRemoved handles expiry.
    case 'StatusTicked': {
      const combatant = state.combatants[event.combatantId];
      const existing = combatant.statuses[event.statusId];
      if (!existing) return state;
      return {
        ...state,
        combatants: {
          ...state.combatants,
          [event.combatantId]: {
            ...combatant,
            statuses: {
              ...combatant.statuses,
              [event.statusId]: {
                ...existing,
                magnitude: event.newMagnitude ?? existing.magnitude,
                duration: event.newDuration ?? existing.duration,
              },
            },
          },
        },
      };
    }

    case 'StatusRemoved': {
      const combatant = state.combatants[event.combatantId];
      const nextStatuses = { ...combatant.statuses };
      delete nextStatuses[event.statusId];
      return { ...state, combatants: { ...state.combatants, [event.combatantId]: { ...combatant, statuses: nextStatuses } } };
    }

    case 'FieldEffectSet':
      return { ...state, activeFieldEffect: { fieldEffectId: event.fieldEffectId, roundsRemaining: FIELD_EFFECT_DURATION_ROUNDS } };

    case 'FieldEffectTicked':
      return { ...state, activeFieldEffect: { fieldEffectId: event.fieldEffectId, roundsRemaining: event.roundsRemaining } };

    case 'FieldEffectExpired':
      return { ...state, activeFieldEffect: null };

    // Everything else is always paired with an event above that carries the new value.
    default:
      return state;
  }
}
