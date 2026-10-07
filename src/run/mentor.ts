// The Mentor (docs/mentor.md): the run's Rare Candy. Pick a hero and it takes a lump of XP that
// grows by act — XP, never a level, so a hero one point short of a level gets no worse a deal than
// one that just levelled. The cube does the rest: the same grant lifts a hero behind par further.
// What the levels pay (a move offer, the signature) goes through the level-up report.

import { MAX_XP } from './growth';
import type { RosterEntry } from './state';

/**
 * XP a Mentor pays, acts 1–3 (the Tutor holds act 4's seat). Sized so a hero that takes all three,
 * every Elite and its share of MVPs can finish the run at the level cap — a committed plan, not
 * the default (test/mentor.test.ts).
 */
export const MENTOR_XP_BY_ACT: readonly number[] = [800, 3000, 6000];

export function mentorXpFor(actNumber: number): number {
  return MENTOR_XP_BY_ACT[Math.max(1, Math.min(actNumber, MENTOR_XP_BY_ACT.length)) - 1];
}

/** A hero at the cap is refused rather than wasted. */
export function canTrain(entry: Pick<RosterEntry, 'xp'>): boolean {
  return entry.xp < MAX_XP;
}
