// The Camp (docs/guild-hall-overhaul.md §3): the forced row before the Guardian, three doors, one taken.

import { rollEquipmentDrops } from '../data/equipment';
import { rarityWeightsFor } from './equipment';
import { GEM_CACHE_COUNT } from './gems';

export type CampDoor = 'mend' | 'gems' | 'gear';

export const CAMP_DOORS: readonly CampDoor[] = ['mend', 'gems', 'gear'];

/** The Gems door pays a Gem Cache. First pass. */
export const CAMP_GEMS = GEM_CACHE_COUNT;

/** The Gear door lays out this many pieces; one is taken. */
export const CAMP_GEAR_COUNT = 3;

/** The Gear door's pieces, on the act's standard curve. */
export function rollCampGear(actNumber: number, random: () => number = Math.random): string[] {
  return rollEquipmentDrops(CAMP_GEAR_COUNT, rarityWeightsFor(actNumber, 'standard'), undefined, random).map((item) => item.id);
}
