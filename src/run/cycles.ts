// The Cycles (docs/cycles.md). A Cycle is the Titan's next rising, chosen at run start and held
// on `RunState.cycle`, 1-based. Cycle I is the base game. In Cycle II the Wardens hold the seals
// (run/wardens.ts) and the Guardians wake (docs/ascension.md §2a): the champion leads its fight,
// wears its type's Mark and grows on hero grades, and the escorts rise to three from Act 3. Cycle III, the Long Winter, wards every
// Guardian while its company stands, frays the Banners to half, prices the Smithy half again and
// loses Wild's Edge (docs/cycles.md §3). Cycle IV, the Gathering, casts the enemy as warbands
// (run/warbands.ts) and trains the companion and the Guild. Cycle V is not built; the picker greys it.

import type { HeroDefinition } from '../engine/content';
import { titansMarkFor } from '../data/passives';
import type { TitanpactType } from '../data/typechart';
import type { Profile } from './profile';
import type { RunState } from './state';
import { DEFAULT_GRADES } from './growth';
import { shortTypes } from './deck';
import { heroes } from '../data/heroes';

export const FIRST_CYCLE = 1;

/** The Cycle that opens only to an account owning three heroes of every type (docs/collection.md §2). */
export const FULL_DECK_CYCLE = 5;

/** The highest Cycle with rules; the picker opens nothing past it. */
export const MAX_BUILT_CYCLE = 4;

/** The Cycle the Guardians wake at (docs/ascension.md §2a), and every Cycle after it. */
export const GUARDIANS_WAKE_FROM_CYCLE = 2;

/** The Cycle the Wardens first hold the seals (run/wardens.ts), and every Cycle after it. */
export const WARDENS_FROM_CYCLE = 2;

/** The Long Winter (docs/cycles.md §3): from here the Guardians are warded, the Banners fray and the Smithy costs more. */
export const LONG_WINTER_FROM_CYCLE = 3;

/** What the Smithy charges in a Long Winter, on its Cycle I price, rounded to 5 gold. */
export const LONG_WINTER_SMITHY_MULTIPLIER = 1.5;

/** The Gathering (docs/cycles.md §3): from here the enemy fields warbands, and the survivors have prepared. */
export const GATHERING_FROM_CYCLE = 4;

/** Levels over the run's par the companion's Call is cast at in a Gathering — the survivors trained it. */
export const GATHERING_COMPANION_LEVEL_BONUS = 5;

/** More hires on the Tavern's board a visit in a Gathering. */
export const GATHERING_EXTRA_HIRES = 1;

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
    line: 'The Titan’s darkness spreads. Its Guardians wake.',
    clearBonus: 6,
    lore: ['A year has passed, and the Titan wakes.', 'The heroes who sealed it stayed to guard the seals.', 'Now the Titan holds them.', 'We must seal the pact again.'],
  },
  {
    cycle: 3,
    numeral: 'III',
    name: 'The Long Winter',
    line: 'Winter has come. The Guardians hide behind their own, and the banners fray.',
    clearBonus: 30,
    lore: ['Another year, and the winter never ended.', 'Wild’s Edge is lost under the snow.', 'The Guardians have learned to hide behind their own.', 'We must seal the pact again.'],
  },
  {
    cycle: 4,
    numeral: 'IV',
    name: 'The Gathering',
    line: 'The Titan knows your shape. Its servants fight as one.',
    clearBonus: 40,
    lore: ['A fourth year, and the Titan has been watching.', 'Its servants no longer gather at random.', 'Neither do we. The Guild has grown, and our companion with it.', 'We must seal the pact again.'],
  },
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

export function guardiansWake(run: Pick<RunState, 'cycle'>): boolean {
  return run.cycle >= GUARDIANS_WAKE_FROM_CYCLE;
}

export function wardensHold(run: Pick<RunState, 'cycle'>): boolean {
  return run.cycle >= WARDENS_FROM_CYCLE;
}

export function isLongWinter(run: Pick<RunState, 'cycle'>): boolean {
  return run.cycle >= LONG_WINTER_FROM_CYCLE;
}

export function isGathering(run: Pick<RunState, 'cycle'>): boolean {
  return run.cycle >= GATHERING_FROM_CYCLE;
}

/** A Smithy price in this run's Cycle: the Long Winter's ×1.5, rounded to 5 gold. */
export function smithyPrice(run: Pick<RunState, 'cycle'>, base: number): number {
  return isLongWinter(run) ? Math.round((base * LONG_WINTER_SMITHY_MULTIPLIER) / 5) * 5 : base;
}

/**
 * The highest Cycle a profile may start a run on: a clear of N opens N+1, up to the last one
 * built. Until Cycle I is cleared this is Cycle I, and Play asks nothing.
 */
export function openCycle(profile: Pick<Profile, 'cyclesCleared' | 'purchases'>): number {
  const ceiling = shortTypes(heroes, profile.purchases).length > 0 ? Math.min(MAX_BUILT_CYCLE, FULL_DECK_CYCLE - 1) : MAX_BUILT_CYCLE;
  return Math.max(FIRST_CYCLE, Math.min(ceiling, profile.cyclesCleared + 1));
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

