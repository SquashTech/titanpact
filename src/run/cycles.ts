// The Cycles (docs/cycles.md). A Cycle is the Titan's next rising, chosen at run start and held
// on `RunState.cycle`, 1-based. Cycle I is the base game. Cycle II is Permadeath — every hero is
// mortal, and a knockout on a won fight is gone with its gear unless a Revive is spent on it at
// the Fallen beat (the companion is off the roster and cannot fall) — and beside it the Guardians
// wake (docs/ascension.md §2a): the champion leads its fight, wears its type's Mark and grows on
// hero grades, and the escorts rise to three from Act 3. Cycles III–V are not built; the picker
// shows them by name, greyed.

import type { HeroDefinition } from '../engine/content';
import { titansMarkFor } from '../data/passives';
import type { TitanpactType } from '../data/typechart';
import type { Profile } from './profile';
import type { RosterEntry, RunState } from './state';
import { DEFAULT_GRADES } from './growth';

export const FIRST_CYCLE = 1;

/** The highest Cycle with rules; the picker opens nothing past it. */
export const MAX_BUILT_CYCLE = 2;

/** The Cycle Permadeath turns on at, and every Cycle after it. */
export const PERMADEATH_FROM_CYCLE = 2;

/** The Cycle the Guardians wake at (docs/ascension.md §2a), and every Cycle after it. */
export const GUARDIANS_WAKE_FROM_CYCLE = 2;

/** The Cycle the Wardens first hold the seals (run/wardens.ts), and every Cycle after it. */
export const WARDENS_FROM_CYCLE = 2;

export interface CycleDefinition {
  cycle: number;
  numeral: string;
  name: string;
  /** One short line in the player's voice; empty on a Cycle that is not built. */
  line: string;
  /** Stars a clear pays on top of its hero stars, every clear. */
  clearBonus: number;
  /** A lore card, a line a tap, ahead of the first draft of this Cycle on an account (docs/cycles.md §7). */
  lore?: readonly string[];
}

export const CYCLES: readonly CycleDefinition[] = [
  { cycle: 1, numeral: 'I', name: 'The Sealing', line: 'The Titan rises. Seal it.', clearBonus: 1 },
  {
    cycle: 2,
    numeral: 'II',
    name: 'The Remembered',
    line: 'The Titan’s darkness spreads. Fallen heroes are gone for good.',
    clearBonus: 6,
    lore: ['A year has passed, and the Titan wakes.', 'The heroes who sealed it stayed to guard the seals.', 'Now the Titan holds them.', 'We must seal the pact again.'],
  },
  { cycle: 3, numeral: 'III', name: 'The Long Winter', line: '', clearBonus: 0 },
  { cycle: 4, numeral: 'IV', name: 'The Gathering', line: '', clearBonus: 0 },
  { cycle: 5, numeral: 'V', name: 'The Last Cycle', line: '', clearBonus: 0 },
];

/** The lore card's id in `seenTipIds` for a Cycle past the first; Cycle I's is the account's own (run/tips.ts LORE_TIP_ID). */
export function cycleLoreTipId(cycle: number): string {
  return `lore.cycle${cycle}`;
}

/** The Cycle's row; an unknown Cycle reads as Cycle I. */
export function cycleOf(cycle: number): CycleDefinition {
  return CYCLES.find((c) => c.cycle === cycle) ?? CYCLES[0];
}

export function isPermadeath(run: Pick<RunState, 'cycle'>): boolean {
  return run.cycle >= PERMADEATH_FROM_CYCLE;
}

export function guardiansWake(run: Pick<RunState, 'cycle'>): boolean {
  return run.cycle >= GUARDIANS_WAKE_FROM_CYCLE;
}

export function wardensHold(run: Pick<RunState, 'cycle'>): boolean {
  return run.cycle >= WARDENS_FROM_CYCLE;
}

/**
 * The highest Cycle a profile may start a run on: a clear of N opens N+1, up to the last one
 * built. Until Cycle I is cleared this is Cycle I, and Play asks nothing.
 */
export function openCycle(profile: Pick<Profile, 'cyclesCleared'>): number {
  return Math.max(FIRST_CYCLE, Math.min(MAX_BUILT_CYCLE, profile.cyclesCleared + 1));
}

/** A woken Guardian's escorts by act. A Location has two or three spawn lines and an escort never repeats one, so three is the ceiling. */
export const WOKEN_ESCORTS_BY_ACT: readonly number[] = [2, 2, 3, 3, 3];

export function wokenEscortCount(actNumber: number): number {
  return WOKEN_ESCORTS_BY_ACT[Math.max(1, Math.min(actNumber, WOKEN_ESCORTS_BY_ACT.length)) - 1];
}

/** The champion as it wakes: its front-loaded E grades traded for a hero's, so it keeps pace with the act. */
export function wokenChampion(definition: HeroDefinition): HeroDefinition {
  return { ...definition, growthGrades: DEFAULT_GRADES };
}

/** The Mark a woken champion wears: its primary type's, the one its seal kept off in Cycle I. */
export function wokenChampionMark(definition: HeroDefinition): string | null {
  return titansMarkFor[definition.types[0] as TitanpactType] ?? null;
}

/**
 * The Fallen (docs/ascension.md §3): the heroes a WON fight knocked out that Permadeath will take
 * unless a Revive keeps them — every KO'd hero still on the roster. Empty in Cycle I. Roster order,
 * so the screen's rows sit where the player expects them.
 */
export function fallenAfterFight(run: RunState, koRosterIds: readonly string[]): RosterEntry[] {
  if (!isPermadeath(run)) return [];
  return run.roster.filter((entry) => koRosterIds.includes(entry.rosterId) && entry.down);
}

/** Let go: off the roster, and what it carried goes with it — gear is absorbed, never handed on. */
export function releaseFallen(run: RunState, rosterIds: readonly string[]): RunState {
  if (rosterIds.length === 0) return run;
  return { ...run, roster: run.roster.filter((entry) => !rosterIds.includes(entry.rosterId)) };
}
