// Switching, bench regen, and lock-in (docs/combat.md). Lock-in is locked:
// 2+ KOs disables voluntary switching; forced replacement still happens.

import type { CombatState, Side } from '../state';
import { canSwitchOut, isLockedIn, phaseOf } from '../state';
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
  if (!canSwitchOut(state, outCombatantId)) {
    throw new SwitchBlockedError(`${outCombatantId} is Ironbound — it never switches out on its own`);
  }
  return performSwitch(state, round, side, outCombatantId, inCombatantId, statusDefs);
}

/**
 * The bench members that may fill an open slot on this side right now: standing, and of a phase
 * no later than anything still on the field. A reserve (Squad.reserves — the Titan's Eyes,
 * docs/titan-eyes.md §6, §10) waits for the field to empty of every earlier phase, so a phase
 * begins only when the phase before it has ended — and a phase's reserves enter TOGETHER, since
 * the first one in is of their own phase and does not close the door on the second. Every
 * replacement site reads this, the player's picker included.
 */
export function replacementCandidates(state: CombatState, side: Side): string[] {
  const fieldPhase = Math.min(
    ...state.active[side].map((id) => (id === null || state.combatants[id]?.fainted ? Infinity : phaseOf(state.combatants[id])))
  );
  const standing = state.bench[side].filter((id) => {
    const c = state.combatants[id];
    return c !== undefined && !c.fainted && phaseOf(c) <= fieldPhase;
  });
  // An empty field opens to the NEXT phase alone, never to every phase at once.
  const nextPhase = Math.min(...standing.map((id) => phaseOf(state.combatants[id])));
  return standing.filter((id) => phaseOf(state.combatants[id]) === nextPhase);
}

/** The latest phase with a body on either field. */
export function currentPhase(state: CombatState): number {
  let phase = 0;
  for (const side of ['A', 'B'] as const) {
    for (const id of state.active[side]) if (id !== null) phase = Math.max(phase, phaseOf(state.combatants[id]));
  }
  return phase;
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

  const incoming = state.combatants[inCombatantId];
  let nextState: CombatState = {
    ...state,
    active: { ...state.active, [side]: nextActive },
    bench: { ...state.bench, [side]: nextBench },
    // It arrived this round, so its first action is the next one (a firstTurnOnly move's window).
    combatants: { ...state.combatants, [inCombatantId]: { ...incoming, firstActionRound: round + 1 } },
  };
  // A later phase's first body on the field begins the phase: the Pact Clock counts from here.
  const incomingPhase = phaseOf(state.combatants[inCombatantId]);
  if (incomingPhase > currentPhase(state)) nextState = { ...nextState, phaseStartedRound: round };

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
