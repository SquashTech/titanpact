// Switching, bench regen, and lock-in (docs/combat.md "Switching, bench regen,
// and lock-in"). Lock-in itself is LOCKED: 2+ KOs disables voluntary switching
// for that side; forced replacement of a downed hero still happens regardless
// (CLAUDE.md "Mana & tempo").

import type { CombatState, Side } from '../state';
import { hasStatus, isLockedIn } from '../state';
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

/**
 * Voluntary switch, declared as a round action. Blocked once the side is
 * locked in, or if the outgoing combatant is Bound (docs/conditions.md Bind:
 * "cannot switch" — the whole point is it can't be escaped by switching).
 */
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
  if (hasStatus(state.combatants[outCombatantId], 'Bind')) {
    throw new SwitchBlockedError(`${outCombatantId} is Bound — cannot switch`);
  }
  return performSwitch(state, round, side, outCombatantId, inCombatantId, statusDefs);
}

/**
 * Forced replacement of a fainted active slot. Ignores lock-in AND Bind by
 * design — a fainted combatant isn't voluntarily leaving (same precedent as
 * lock-in exemption below).
 */
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

  // docs/conditions.md §4: switching to bench clears Burn/Freeze/Daze on the outgoing combatant.
  if (outCombatantId) {
    const cleared = clearOnSwitch(nextState, round, outCombatantId, statusDefs);
    nextState = cleared.state;
    events.push(...cleared.events);
  }

  return { state: nextState, events };
}

/**
 * Bench HP regen at the round boundary (docs/combat.md: "Benched heroes
 * regenerate (HP, ...), which makes switching a productive action"). The
 * concrete rate is undocumented/untuned — callers pass it as data, not an
 * engine default. HP regen is bench-only, unlike mana regen (docs/mana.md
 * "every round, active + bench") — see engine/combat/manaRegen.ts, a
 * separate tick covering both active and bench.
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
