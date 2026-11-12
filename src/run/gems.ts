// Gems — how Mastery is earned (docs/gems.md). A Gem is one stat grant and one Mastery pip at
// once: placed on a hero it raises that stat for the run and lights a pip toward the Evolution (5)
// and the mastered innate (10). Placement is permanent and never re-allocated. A hero at the
// Mastery cap cannot take one.

import type { GrowthStatKey, HeroDefinition, StatKey } from '../engine/content';
import type { EncounterNodeKind } from './difficulty';
import { entryGradesFor, GRADE_COST } from './growth';
import { anyMasteryEligible, canTakeMastery, grantMastery, MasteryError } from './mastery';
import type { RosterEntry, RunState } from './state';

export interface Gem {
  stat: GrowthStatKey;
  /** Points, priced as an item's are: a point is +1, or +3 HP. */
  points: number;
}

/** Placement order on every screen that hands out more than one — fixed, never the player's to sort. */
export const GEM_ORDER: readonly GrowthStatKey[] = ['hp', 'manaPool', 'attack', 'defense', 'intelligence', 'wisdom', 'speed'];

/** A Gem's points by the act it is found in: small through Act 2, large from Act 3. */
export function gemPointsForAct(actNumber: number): number {
  return actNumber >= 3 ? 10 : 5;
}

/** What a point buys on the stat line — HP at the item rate (equipment.ts HP_PER_POINT). */
export function gemUnitFor(stat: StatKey): number {
  return stat === 'hp' ? 3 : 1;
}

/** The stat line the Gem adds, at face value. */
export function gemAmount(gem: Gem): number {
  return gem.points * gemUnitFor(gem.stat);
}

/** The Lapidary's forced row: this many Gems, every act. */
export const SCRIBE_GEMS = 3;
/** The Gem Cache, a reward-row seat. */
export const GEM_CACHE_COUNT = 3;

/**
 * A won fight's Gem drop: `count` Gems at `chance`. Both sides of the fork and the Guardian always
 * pay; the opener sometimes does; the finale pays nothing, the run being over (docs/gems.md §4).
 */
export const GEM_DROP: Record<EncounterNodeKind, { chance: number; count: number }> = {
  fight: { chance: 0.2, count: 1 },
  battle: { chance: 0.2, count: 1 },
  skirmish: { chance: 1, count: 2 },
  elite: { chance: 1, count: 3 },
  boss: { chance: 1, count: 3 },
  finale: { chance: 0, count: 0 },
};

/** Rolled at fight start with the fight's other drops, so a resumed fight keeps it. */
export function rollGemDrop(nodeKind: EncounterNodeKind, actNumber: number, random: () => number = Math.random): Gem[] {
  const drop = GEM_DROP[nodeKind];
  return random() < drop.chance ? rollGems(drop.count, actNumber, random) : [];
}

/** What a Gem screen hands out, already rolled and in `GEM_ORDER`. */
export interface GemPlan {
  source: 'scribe' | 'cache' | 'camp' | 'drop';
  gems: Gem[];
}

/** `count` Gems of the act's size, each stat uniform, handed out in `GEM_ORDER`. */
export function rollGems(count: number, actNumber: number, random: () => number = Math.random): Gem[] {
  const points = gemPointsForAct(actNumber);
  const gems = Array.from({ length: count }, () => ({ stat: GEM_ORDER[Math.floor(random() * GEM_ORDER.length)], points }));
  return sortGems(gems);
}

export function sortGems(gems: readonly Gem[]): Gem[] {
  return [...gems].sort((a, b) => GEM_ORDER.indexOf(a.stat) - GEM_ORDER.indexOf(b.stat));
}

/** The Gem placed: its stat for the run, and its pip. */
export function placeGem(run: RunState, rosterId: string, gem: Gem): RunState {
  const entry = run.roster.find((r) => r.rosterId === rosterId);
  if (!entry) throw new MasteryError(`${rosterId} is not on the roster`);
  if (!canTakeMastery(entry)) throw new MasteryError(`${rosterId} is already mastered`);
  const pipped = grantMastery(run, rosterId, 1);
  return { ...pipped, roster: pipped.roster.map((r) => (r.rosterId === rosterId ? { ...r, gems: [...r.gems, gem] } : r)) };
}

/**
 * The stats a hero's Gems add. A pip with no Gem behind it — an enemy's, a contract's, a hire's,
 * a save from before Gems — is filled by fit: the act it would have been found in, on the hero's
 * best-graded stats in turn, so every hero holding Mastery holds the stats that come with it.
 */
export function gemStatModifiers(entry: Pick<RosterEntry, 'gems' | 'mastery' | 'offenseSwapped'>, hero: HeroDefinition | undefined): Partial<Record<StatKey, number>> {
  const out: Partial<Record<StatKey, number>> = {};
  const add = (gem: Gem) => (out[gem.stat] = (out[gem.stat] ?? 0) + gemAmount(gem));
  for (const gem of entry.gems) add(gem);
  for (let i = entry.gems.length; i < entry.mastery; i++) add(fittedGem(hero, entry, i));
  return out;
}

/** The size of a hero's `index`th Gem: the act it would have been found in, two an act. */
export function gemPointsForPip(index: number): number {
  return gemPointsForAct(Math.floor(index / 2) + 1);
}

/** What a pip with no Gem placed behind it is filled with. */
export function fittedGem(hero: HeroDefinition | undefined, entry: Pick<RosterEntry, 'offenseSwapped'>, index: number): Gem {
  const fit = fittedStats(hero, entry);
  return { stat: fit[index % fit.length], points: gemPointsForPip(index) };
}

/** The three stats a fitted Gem lands on: the hero's best grades, ties in `GEM_ORDER`. */
function fittedStats(hero: HeroDefinition | undefined, entry: Pick<RosterEntry, 'offenseSwapped'>): GrowthStatKey[] {
  const grades = entryGradesFor(hero, entry);
  return [...GEM_ORDER].sort((a, b) => GRADE_COST[grades[b]] - GRADE_COST[grades[a]] || GEM_ORDER.indexOf(a) - GEM_ORDER.indexOf(b)).slice(0, 3);
}
