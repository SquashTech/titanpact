// The Camp (docs/guild-hall-overhaul.md §3, §10): the forced row before the Guardian, three doors,
// each a bundle of rewards; one is taken.

import { CAMP_BUNDLES, MEND_BUNDLES, PLAIN_MEND } from '../data/campBundles';
import { rollEquipmentDrops } from '../data/equipment';
import { canBless } from './blessings';
import { rarityWeightsFor } from './equipment';
import { GEM_ORDER, gemPointsForAct, type Gem } from './gems';
import { anyMasteryEligible } from './mastery';
import type { RunState } from './state';

export type CampPiece =
  | { kind: 'mend' }
  /** `take` Gems chosen off a shelf of `of` distinct stats, then placed one by one. */
  | { kind: 'gems'; take: number; of: number }
  /** `take` pieces chosen of `of` on the act's standard curve, each through its who-screen. */
  | { kind: 'gear'; take: number; of: number }
  | { kind: 'blessing' }
  | { kind: 'boon' };

export interface CampBundle {
  id: string;
  pieces: readonly CampPiece[];
}

export const CAMP_DOOR_COUNT = 3;

const BUNDLES_BY_ID: Readonly<Record<string, CampBundle>> = Object.fromEntries(
  [...MEND_BUNDLES, PLAIN_MEND, ...CAMP_BUNDLES].map((bundle) => [bundle.id, bundle])
);

export function campBundle(id: string): CampBundle | undefined {
  return BUNDLES_BY_ID[id];
}

/** Whether every piece of a bundle has somebody to take it: a Gem a hero below the cap, a Blessing a hero without one. */
export function bundleOpen(run: RunState, bundle: CampBundle): boolean {
  return bundle.pieces.every((piece) => {
    if (piece.kind === 'gems') return anyMasteryEligible(run.roster);
    if (piece.kind === 'blessing') return run.roster.some(canBless);
    return true;
  });
}

/** The Camp's three doors: a Mend bundle first, then two distinct others, each one somebody can take. */
export function rollCampDoors(run: RunState, random: () => number = Math.random): string[] {
  const mends = MEND_BUNDLES.filter((bundle) => bundleOpen(run, bundle));
  const mend = mends.length > 0 ? mends[Math.floor(random() * mends.length)] : PLAIN_MEND;
  const pool = CAMP_BUNDLES.filter((bundle) => bundleOpen(run, bundle));
  const others: string[] = [];
  while (others.length < CAMP_DOOR_COUNT - 1 && pool.length > 0) others.push(pool.splice(Math.floor(random() * pool.length), 1)[0].id);
  return [mend.id, ...others];
}

/** A Gem shelf of `count` distinct stats at the act's size, in `GEM_ORDER`. */
export function rollCampGemShelf(actNumber: number, count: number, random: () => number = Math.random): Gem[] {
  const points = gemPointsForAct(actNumber);
  const stats = [...GEM_ORDER];
  const picked: Gem['stat'][] = [];
  while (picked.length < count && stats.length > 0) picked.push(stats.splice(Math.floor(random() * stats.length), 1)[0]);
  return GEM_ORDER.filter((stat) => picked.includes(stat)).map((stat) => ({ stat, points }));
}

/** `count` pieces on the act's standard curve. */
export function rollCampGear(actNumber: number, count: number, random: () => number = Math.random): string[] {
  return rollEquipmentDrops(count, rarityWeightsFor(actNumber, 'standard'), undefined, random).map((item) => item.id);
}
