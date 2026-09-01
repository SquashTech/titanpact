// The Pact Clock (docs/combat.md "The Pact Clock") — the upper bracket on fight
// length. Direct HP loss to EVERY combatant, both sides, active and benched:
// no Defense, no type chart, no variance, no passive reactions.

import type { CombatState } from '../state';
import type { CombatEvent } from '../events';
import { applyHpDelta } from './faintHandling';

export interface PactClockConfig {
  /** First round at which the pact takes its due. */
  startRound: number;
  /** Fraction of max HP lost on the first tick. */
  baseFraction: number;
  /** Added to the fraction for each round past `startRound`. */
  stepFraction: number;
}

// Locked shape: round 30, 10% +5%/round (CLAUDE.md). startRound is a placeholder for a measurement.
export const DEFAULT_PACT_CLOCK: PactClockConfig = {
  startRound: 30,
  baseFraction: 0.1,
  stepFraction: 0.05,
};

/** How many rounds before `startRound` the view starts warning. Presentation only; kept here so it cannot drift. */
export const PACT_WARNING_ROUNDS = 5;

/** The fraction of max HP the pact takes on `round`, or 0 if the clock has not started. */
export function pactFractionFor(round: number, config: PactClockConfig): number {
  if (round < config.startRound) return 0;
  return config.baseFraction + config.stepFraction * (round - config.startRound);
}

/**
 * One PactTicked for the whole board, then the ordinary HpChanged/Fainted stream via
 * applyHpDelta. Not followed by a passive-reaction pass: the terminator is not a
 * trigger source. A simultaneous double wipe reads as a player loss (FightScreen
 * tests the player side first).
 */
export function tickPactClock(
  state: CombatState,
  round: number,
  config: PactClockConfig,
  maxHpOf: (combatantId: string) => number
): { state: CombatState; events: CombatEvent[] } {
  const fraction = pactFractionFor(round, config);
  if (fraction <= 0) return { state, events: [] };

  const events: CombatEvent[] = [
    { type: 'PactTicked', round, step: round - config.startRound, fraction },
  ];
  let working = state;

  for (const side of ['A', 'B'] as const) {
    // Active first, then bench, each in slot order — a fixed traversal for replay.
    const ids = [...working.active[side].filter((id): id is string => id !== null), ...working.bench[side]];
    for (const id of ids) {
      const combatant = working.combatants[id];
      if (!combatant || combatant.fainted) continue;
      const maxHp = maxHpOf(id);
      // At least 1, so a low-HP hero is never exempt.
      const amount = Math.max(1, Math.ceil(maxHp * fraction));
      const hit = applyHpDelta(working, round, id, -amount, maxHp);
      working = hit.state;
      events.push(...hit.events);
    }
  }

  return { state: working, events };
}
