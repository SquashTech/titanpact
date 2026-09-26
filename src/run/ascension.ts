// The Ascension ladder (docs/ascension.md). A rung is a RULE the run plays under, chosen at
// run start and held on `RunState.ascension`; Base is rung 0. Ascension 1 is Permadeath: every
// hero is mortal, a knockout on a won fight is gone with its gear unless a Revive is spent on it
// at the Fallen beat, and the companion — mortal since it joined — is the one body a Revive
// never saves. Rungs above it are proposed, not built (§5), so the ladder stops at 1.

import type { Profile } from './profile';
import type { RosterEntry, RunState } from './state';
import { isCompanion } from './companion';

/** The rungs that exist. A2–A5 are proposed (docs/ascension.md §5); the picker offers up to here. */
export const MAX_ASCENSION = 1;

/** The rung Permadeath turns on at, and every rung above it. */
export const PERMADEATH_FROM_ASCENSION = 1;

export interface AscensionRung {
  rung: number;
  name: string;
  /** The one rule this rung adds, in the player's voice. */
  rule: string;
}

export const ASCENSION_RUNGS: readonly AscensionRung[] = [
  { rung: 0, name: 'Classic', rule: 'A knocked-out hero stands back up: at a Rest, a mend, a Revive, or the act’s end.' },
  {
    rung: 1,
    name: 'Ascension 1',
    rule: 'Permadeath. A hero knocked out is gone from the run with everything it carried, unless a Revive is spent on it when the fight ends. Nothing saves the companion.',
  },
];

export function isPermadeath(run: Pick<RunState, 'ascension'>): boolean {
  return run.ascension >= PERMADEATH_FROM_ASCENSION;
}

/** Mortal by the rule of the run, or by what it is: the companion always, everyone under Permadeath. */
export function isMortal(run: Pick<RunState, 'ascension'>, entry: Pick<RosterEntry, 'heroId' | 'mortal'>): boolean {
  return entry.mortal || isPermadeath(run);
}

/**
 * The highest rung a profile may start a run on: cleared at N opens N+1, a Base clear opens
 * Ascension 1, and nothing opens until something has been cleared.
 */
export function openAscension(profile: Pick<Profile, 'runsCompleted' | 'ascensionCleared'>): number {
  if (profile.runsCompleted === 0) return 0;
  return Math.min(MAX_ASCENSION, profile.ascensionCleared + 1);
}

/**
 * The Fallen (docs/ascension.md §3): the heroes a WON fight knocked out that Permadeath will take
 * unless a Revive keeps them — every KO'd hero still on the roster but the companion, whose loss
 * absorbCompanions already took, at Base and on every rung. Empty at Base. Roster order, so the
 * screen's rows sit where the player expects them.
 */
export function fallenAfterFight(run: RunState, koRosterIds: readonly string[]): RosterEntry[] {
  if (!isPermadeath(run)) return [];
  return run.roster.filter((entry) => koRosterIds.includes(entry.rosterId) && !isCompanion(entry) && entry.down);
}

/** Let go: off the roster, and what it carried goes with it — gear is absorbed, never handed on. */
export function releaseFallen(run: RunState, rosterIds: readonly string[]): RunState {
  if (rosterIds.length === 0) return run;
  return { ...run, roster: run.roster.filter((entry) => !rosterIds.includes(entry.rosterId)) };
}
