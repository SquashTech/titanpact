// Mastery — the pips a hero's Evolution and mastered innate sit behind (docs/mastery.md). Ten a
// hero, uniform: five is the Evolution, ten the innate MASTERED. A pip is one Gem (run/gems.ts),
// placed the instant it is paid. Gems come from the Lapidary, the Gem Cache, the Guild Hall shelf
// and a won fight's drop (docs/gems.md §4).

import { FINALE_ACT, type RosterEntry, type RunState } from './state';

export const MASTERY_CAP = 10;

/** The pip that raises the Evolution — the same for every hero. */
export const MASTERY_EVOLUTION = 5;

/**
 * The pip that masters the innate (docs/mastery.md §5b): the hero's born passive is replaced by
 * its authored upgrade (`HeroDefinition.masteredPassiveIds`, run/innate.ts). It was the signature
 * move's pip until 2026-09-24, per user direction; the signature is a level's now (progression.ts).
 */
export const MASTERY_INNATE = MASTERY_CAP;

export class MasteryError extends Error {}

/**
 * The pips a hero the player does not control holds in `actNumber` — an enemy, and the contract
 * hero claimed off it: the Scribe's pace for a hero it touched every act BEFORE this one (0 / 2 /
 * 4 / 6; the finale reads the cap, so its heroes hold their mastered innates). Derived, so nobody reads a private model: every hero-pool enemy
 * from Act 4 arrives evolved, the finale's with its innate mastered. It was `2N - 1` for a day (Mastery
 * phase 2), which evolved every enemy from Act 3 and measured as the whole of a five-point
 * full-clear drop (Act 4 89 -> 82%); phase 5 set it here, per user direction (docs/mastery.md §8).
 */
export function masteryForAct(actNumber: number): number {
  const act = Number.isFinite(actNumber) && actNumber >= 1 ? Math.floor(actNumber) : 1;
  return act >= FINALE_ACT ? MASTERY_CAP : Math.min(MASTERY_CAP, 2 * act - 2);
}

/** A Guild hire arrives one pip behind a contract (both raw at 0 in Act 1) — raw: its Evolution, when it has the pips for one, is still the player's to choose. */
export function guildHallMastery(actNumber: number): number {
  return Math.max(0, masteryForAct(actNumber) - 1);
}

/** A hero at the cap is refused rather than wasted. */
export function canTakeMastery(entry: Pick<RosterEntry, 'mastery'>): boolean {
  return entry.mastery < MASTERY_CAP;
}

export function anyMasteryEligible(roster: readonly RosterEntry[]): boolean {
  return roster.some(canTakeMastery);
}

/** How many of `pips` this hero can actually hold — the rest is lost, and the card says so. */
export function masteryRoom(entry: Pick<RosterEntry, 'mastery'>, pips: number): number {
  return Math.max(0, Math.min(pips, MASTERY_CAP - entry.mastery));
}

/** Whether this hero's innate has been mastered — the tenth pip landed (run/innate.ts reads it). */
export function isInnateMastered(entry: Pick<RosterEntry, 'mastery'>): boolean {
  return entry.mastery >= MASTERY_INNATE;
}

/** Whether a grant of `pips` would carry this hero across `milestone`. */
export function crossesMastery(entry: Pick<RosterEntry, 'mastery'>, pips: number, milestone: number): boolean {
  return entry.mastery < milestone && entry.mastery + masteryRoom(entry, pips) >= milestone;
}

/** The pips, landed. What a crossed milestone pays — the Evolution, the mastered innate, the companion's tier-step — is the caller's to raise. */
export function grantMastery(run: RunState, rosterId: string, pips: number): RunState {
  const entry = run.roster.find((r) => r.rosterId === rosterId);
  if (!entry) throw new MasteryError(`${rosterId} is not on the roster`);
  if (!canTakeMastery(entry)) throw new MasteryError(`${rosterId} is already at ${MASTERY_CAP} Mastery`);
  const mastery = entry.mastery + masteryRoom(entry, pips);
  return { ...run, roster: run.roster.map((r) => (r.rosterId === rosterId ? { ...r, mastery } : r)) };
}
