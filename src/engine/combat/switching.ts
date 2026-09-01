// Switching, bench regen, and lock-in (docs/combat.md). Lock-in is locked:
// 2+ KOs disables voluntary switching; forced replacement still happens.

import type { CombatState, Side } from '../state';
import { isLockedIn } from '../state';
import type { CombatEvent, BenchRegenTickedEvent } from '../events';
import type { StatusDefinition } from '../content';
import { clearOnSwitch } from './statusEngine';

export class SwitchBlockedError extends Error {}

function slotOf(state: CombatState, side: Side, combatantId: string): 0 | 1 {
  const slots = state.active[side];
  if (slots[0] === combatantId) return 0;
  if (slots[1] === combatantId) return 1;
  throw new Error(`${combatantId} is not active on side ${side}`);
}

/** Voluntary switch, declared as a round action. Throws SwitchBlockedError once the side is locked in. */
export function applyVoluntarySwitch(
  state: CombatState,
  round: number,
  outCombatantId: string,
  inCombatantId: string,
  statusDefs: Record<string, StatusDefinition>
): { state: CombatState; events: CombatEvent[] } {
  const side = state.combatants[outCombatantId].side;
  if (isLockedIn(state, side)) {
    throw new SwitchBlockedError(`Side ${side} is locked in (2+ KOs) — voluntary switching is disabled`);
  }
  return performSwitch(state, round, side, outCombatantId, inCombatantId, statusDefs);
}

/** Forced replacement of a fainted active slot. Ignores lock-in by design. */
export function applyForcedReplacement(
  state: CombatState,
  round: number,
  side: Side,
  slot: 0 | 1,
  inCombatantId: string,
  statusDefs: Record<string, StatusDefinition>
): { state: CombatState; events: CombatEvent[] } {
  const outCombatantId = state.active[side][slot];
  return performSwitch(state, round, side, outCombatantId, inCombatantId, statusDefs, slot);
}

function performSwitch(
  state: CombatState,
  round: number,
  side: Side,
  outCombatantId: string | null,
  inCombatantId: string,
  statusDefs: Record<string, StatusDefinition>,
  knownSlot?: 0 | 1
): { state: CombatState; events: CombatEvent[] } {
  const slot = knownSlot ?? slotOf(state, side, outCombatantId as string);
  const bench = state.bench[side];
  if (!bench.includes(inCombatantId)) {
    throw new Error(`${inCombatantId} is not benched on side ${side}`);
  }

  const nextActive: [string | null, string | null] = [...state.active[side]] as [string | null, string | null];
  nextActive[slot] = inCombatantId;

  const nextBench = bench.filter((id) => id !== inCombatantId);
  if (outCombatantId) nextBench.push(outCombatantId);

  let nextState: CombatState = {
    ...state,
    active: { ...state.active, [side]: nextActive },
    bench: { ...state.bench, [side]: nextBench },
  };

  const events: CombatEvent[] = [{ type: 'SwitchedIn', round, side, slot, outCombatantId, inCombatantId }];

  if (outCombatantId) {
    const cleared = clearOnSwitch(nextState, round, outCombatantId, statusDefs);
    nextState = cleared.state;
    events.push(...cleared.events);
  }

  return { state: nextState, events };
}

/** Bench-only HP regen at the round boundary. The rate is untuned and passed as data. (Mana regen covers active + bench — manaRegen.ts.) */
export function applyBenchHpRegen(
  state: CombatState,
  round: number,
  benchHpRegenFlat: number,
  maxHpOf: (combatantId: string) => number
): { state: CombatState; events: BenchRegenTickedEvent[] } {
  const events: BenchRegenTickedEvent[] = [];
  const combatants = { ...state.combatants };

  for (const side of ['A', 'B'] as const) {
    for (const id of state.bench[side]) {
      const combatant = combatants[id];
      if (!combatant || combatant.fainted) continue;
      const maxHp = maxHpOf(id);
      const previousHp = combatant.currentHp;
      const newHp = Math.min(maxHp, previousHp + benchHpRegenFlat);
      if (newHp !== previousHp) {
        combatants[id] = { ...combatant, currentHp: newHp };
        events.push({
          type: 'BenchRegenTicked',
          round,
          combatantId: id,
          hpRegen: newHp - previousHp,
          newHp,
          maxHp,
          manaRegen: 0,
        });
      }
    }
  }

  return { state: { ...state, combatants }, events };
}
