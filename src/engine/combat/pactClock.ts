// The Pact Clock (docs/combat.md "The Pact Clock") — the upper bracket on
// fight length, and the answer to unbounded setup.
//
// The problem it closes: mana regenerates every round, rounds are unbounded,
// and stat modifiers accumulate with no ceiling. A side whose sustain per
// round exceeds the opposing side's damage per round therefore wins by
// attrition against a clock that does not exist. `docs/mana.md`'s tuning
// invariant — "mana investment must pay out later than the point at which a
// weak team dies" — has always had a lower bracket and never an upper one.
// This is the upper one.
//
// Shape: from PACT_START_ROUND onward, EVERY combatant on the field — both
// sides, active and benched alike — loses a fraction of its max HP at the
// round boundary, and that fraction grows every round. It is direct HP loss,
// not a damage-pipeline hit: no Defense, no type chart, no variance, nothing
// to buff against. That is the point. A stall is not supposed to be
// survivable by playing the stall better.
//
// Deliberately NOT instant death. Escalating chip lets the side that is
// actually ahead still win — the fight ends decisively rather than as a coin
// flip, and the stall is what loses. With the defaults below a full-HP
// combatant is dead five rounds after the clock starts (10/15/20/25/30 = 100%),
// so the wrap-up is fast enough to be a real terminator and slow enough that
// the round it starts is a warning rather than a verdict.

import type { CombatState } from '../state';
import type { CombatEvent } from '../events';
import { applyHpDelta } from './faintHandling';

export interface PactClockConfig {
  /** First round at which the pact takes its due. Rounds before this are untouched. */
  startRound: number;
  /** Fraction of max HP lost on the very first tick. */
  baseFraction: number;
  /** Added to the fraction for each round past `startRound`. */
  stepFraction: number;
}

/**
 * Playtest first-pass figures (2026-09-01, designer call: "escalating
 * end-of-round chip damage to everyone after a certain point, something like
 * round 30"). Only `startRound` was specified; the two fractions are chosen so
 * the clock resolves the fight within five rounds of starting.
 *
 * `startRound` has to sit well past a normal fight, because the switching game
 * is SUPPOSED to be slow — bench mana regen is the resource-cycling engine
 * (docs/mana.md), and the lock-in rule already turns a 2-KO fight into a grind
 * on purpose. 30 is the designer's number, not a measured one; the number to
 * replace it with is the 95th percentile of real Act 3-5 fight lengths.
 */
export const DEFAULT_PACT_CLOCK: PactClockConfig = {
  startRound: 30,
  baseFraction: 0.1,
  stepFraction: 0.05,
};

/**
 * How many rounds before `startRound` the view should begin warning. Purely a
 * presentation figure — the engine never reads it — but it lives here so the
 * warning and the thing it warns about cannot drift apart.
 */
export const PACT_WARNING_ROUNDS = 5;

/** The fraction of max HP the pact takes on `round`, or 0 if the clock has not started. */
export function pactFractionFor(round: number, config: PactClockConfig): number {
  if (round < config.startRound) return 0;
  return config.baseFraction + config.stepFraction * (round - config.startRound);
}

/**
 * The round-boundary tick. Emits one PactTicked for the whole board (the view
 * needs a single beat to announce, not one per combatant) followed by the
 * ordinary HpChanged/Fainted stream from `applyHpDelta`, so every downstream
 * reader handles a pact death byte-for-byte the way it handles a Bleed death.
 *
 * Hits the BENCH as well as the active pair, which is the one thing that makes
 * it airtight: a stalling side with two healthy heroes in reserve could
 * otherwise cycle fresh bodies in and outlast a clock that only touched the
 * field. It also matches the fiction — the pact comes due on everyone who
 * showed up.
 *
 * Deliberately NOT followed by a passive-reaction pass (unlike the status
 * ticks it sits beside in resolveRound). A passive that healed off the pact
 * would blunt the exact thing that must not be blunted, and "the terminator is
 * not a trigger source" is a cheaper rule to hold than auditing every future
 * passive against it.
 *
 * If both sides wipe on the same tick the fight reads as a LOSS for the player
 * — FightScreen's winner check tests the player side first (`sideDefeated(
 * combat, PLAYER_SIDE) ? AI_SIDE : ...`). That is the correct fail-safe: a
 * player who let the clock run out does not get to take the enemy with them.
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
    // Active first, then bench, and each in slot order — a fixed traversal so
    // a replay of the same fight produces the same event ordering.
    const ids = [...working.active[side].filter((id): id is string => id !== null), ...working.bench[side]];
    for (const id of ids) {
      const combatant = working.combatants[id];
      if (!combatant || combatant.fainted) continue;
      // At least 1, so a low-HP-pool hero is never quietly exempt from a
      // fraction that rounds to nothing.
      const amount = Math.max(1, Math.ceil(maxHpOf(id) * fraction));
      const hit = applyHpDelta(working, round, id, -amount, maxHpOf(id));
      working = hit.state;
      events.push(...hit.events);
    }
  }

  return { state: working, events };
}
