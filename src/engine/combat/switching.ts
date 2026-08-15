// Switching, bench regen, and lock-in (docs/combat.md "Switching, bench regen,
// and lock-in"). Lock-in itself is LOCKED: 2+ KOs disables voluntary switching
// for that side; forced replacement of a downed hero still happens regardless
// (CLAUDE.md "Mana & tempo").

import type { CombatState, Side } from '../state';
import { isLockedIn } from '../state';
import type { SwitchedInEvent, BenchRegenTickedEvent } from '../events';

export class SwitchBlockedError extends Error {}

function slotOf(state: CombatState, side: Side, combatantId: string): 0 | 1 {
  const slots = state.active[side];
  if (slots[0] === combatantId) return 0;
  if (slots[1] === combatantId) return 1;
  throw new Error(`${combatantId} is not active on side ${side}`);
}

/** Voluntary switch, declared as a round action. Blocked once the side is locked in. */
export function applyVoluntarySwitch(
  state: CombatState,
  round: number,
  outCombatantId: string,
  inCombatantId: string
): { state: CombatState; event: SwitchedInEvent } {
  const side = state.combatants[outCombatantId].side;
  if (isLockedIn(state, side)) {
    throw new SwitchBlockedError(`Side ${side} is locked in (2+ KOs) — voluntary switching is disabled`);
  }
  return performSwitch(state, round, side, outCombatantId, inCombatantId);
}

/** Forced replacement of a fainted active slot. Ignores lock-in by design. */
export function applyForcedReplacement(
  state: CombatState,
  round: number,
  side: Side,
  slot: 0 | 1,
  inCombatantId: string
): { state: CombatState; event: SwitchedInEvent } {
  const outCombatantId = state.active[side][slot];
  return performSwitch(state, round, side, outCombatantId, inCombatantId, slot);
}

function performSwitch(
  state: CombatState,
  round: number,
  side: Side,
  outCombatantId: string | null,
  inCombatantId: string,
  knownSlot?: 0 | 1
): { state: CombatState; event: SwitchedInEvent } {
  const slot = knownSlot ?? slotOf(state, side, outCombatantId as string);
  const bench = state.bench[side];
  if (!bench.includes(inCombatantId)) {
    throw new Error(`${inCombatantId} is not benched on side ${side}`);
  }

  const nextActive: [string | null, string | null] = [...state.active[side]] as [string | null, string | null];
  nextActive[slot] = inCombatantId;

  const nextBench = bench.filter((id) => id !== inCombatantId);
  if (outCombatantId) nextBench.push(outCombatantId);

  const nextState: CombatState = {
    ...state,
    active: { ...state.active, [side]: nextActive },
    bench: { ...state.bench, [side]: nextBench },
  };

  return {
    state: nextState,
    event: { type: 'SwitchedIn', round, side, slot, outCombatantId, inCombatantId },
  };
}

/**
 * Bench HP regen at the round boundary (docs/combat.md: "Benched heroes
 * regenerate (HP, ...), which makes switching a productive action"). The
 * concrete rate is undocumented/untuned — callers pass it as data, not an
 * engine default. Mana bench regen is deliberately NOT implemented here: how
 * (and whether) mana regenerates on the bench is 🔒 OPEN (docs/mana.md
 * "Regen mechanics") and must not be defaulted.
 */
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
