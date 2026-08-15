// Replays a single engine event onto a CombatState for sequenced playback
// (docs/architecture.md "engine / presentation separation"). This does no
// game logic of its own — no damage math, no RNG, no targeting — it only
// copies the values each event already carries (newHp, newMana, ...) onto
// the corresponding field. That's what keeps it presentation-layer: the
// engine computed the round in one synchronous pass, and this just lets the
// view reveal that already-decided outcome one beat at a time.

import type { CombatEvent } from '../../engine/events';
import type { CombatState } from '../../engine/state';

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

    // Mirrors switching.ts performSwitch exactly, using the event's own
    // recorded outcome rather than recomputing it.
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

    // RoundStarted / TurnStarted / MoveDeclared / MoveUsed / DamageDealt /
    // StatChanged / RoundEnded: no CombatState field this view reads changes
    // from these directly (DamageDealt is always paired with a HpChanged that
    // carries the actual new value).
    default:
      return state;
  }
}
