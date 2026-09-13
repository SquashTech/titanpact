// The mob layer (docs/titanspawn-overhaul.md §4): what a Location's Monsters nodes and its
// Guardian's escorts field, by act. Composition only — the tiers come from difficulty.ts, the
// bodies from data/titanspawn.ts, the draw from enemyGen.ts. Shared by App.tsx and the sim so
// the two cannot drift on the one rule that says who stands on the field.

import type { HeroLookup } from '../engine/state';
import type { LocationDefinition } from '../data/locations';
import { spawnPool } from '../data/titanspawn';
import { generateSpawnEncounter, type Encounter } from './enemyGen';
import { OPENER_ESCORT_COUNT, OPENER_GEAR_FROM_ACT, spawnLeaderTierFor, spawnTierFor, type ActScaling } from './difficulty';
import { rarityWeightsFor } from './equipment';

/** Act 1's row 0: two bare Earlies from every line — "very weak and pretty much an automatic win". */
export const ACT_ONE_OPENER_COUNT = 2;

/**
 * A `fight` (the forced opener) or `battle` node's encounter. Act 1's opener is the on-ramp; from
 * Act 2 the opener is a leader at the act's tier over Earlies that carry an item each, and the
 * `battle` node is that shape in every act until phase 3 takes it off the fork.
 */
export function mobEncounter(
  nodeType: 'fight' | 'battle',
  location: LocationDefinition,
  actNumber: number,
  seed: number,
  scaling: ActScaling
): Encounter {
  if (nodeType === 'fight' && actNumber <= 1) {
    return generateSpawnEncounter(seed, { types: location.spawnTypes, escortTier: 'early', escortCount: ACT_ONE_OPENER_COUNT, scaling });
  }
  return generateSpawnEncounter(seed, {
    types: location.spawnTypes,
    leaderTier: spawnLeaderTierFor(actNumber),
    escortTier: 'early',
    escortCount: OPENER_ESCORT_COUNT,
    escortGear: actNumber >= OPENER_GEAR_FROM_ACT ? rarityWeightsFor(actNumber, 'standard') : undefined,
    scaling,
  });
}

/** The Guardian's two escorts draw from here: the Location's lines at the act's tier. The champion still enters last from the bench. */
export function guardianEscortPool(location: LocationDefinition, actNumber: number): HeroLookup {
  return spawnPool(location.spawnTypes, spawnTierFor(actNumber));
}
