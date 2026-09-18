// The mob layer (docs/titanspawn-overhaul.md §4): what a Location's Monsters nodes and its
// Guardian's escorts field, by act. Composition only — the tiers come from difficulty.ts, the
// bodies from data/titanspawn.ts, the draw from enemyGen.ts. Shared by App.tsx and the sim so
// the two cannot drift on the one rule that says who stands on the field.

import type { HeroLookup } from '../engine/state';
import type { LocationDefinition } from '../data/locations';
import { spawnPool } from '../data/titanspawn';
import { generateSpawnEncounter, type Encounter } from './enemyGen';
import { OPENER_GEAR_FROM_ACT, openerEscortTiersFor, spawnLeaderTierFor, spawnTierFor, type ActScaling } from './difficulty';
import { rarityWeightsFor } from './equipment';

/**
 * A `fight` (the forced opener) or `battle` node's encounter. Act 1's opener is two bare Earlies
 * — the on-ramp, "very weak and pretty much an automatic win"; from Act 2 the opener is a leader
 * at the act's tier over the act's escorts (difficulty.ts OPENER_ESCORT_TIERS_BY_ACT), each
 * carrying an item. The `battle` node is the leader shape in every act.
 */
export function mobEncounter(
  nodeType: 'fight' | 'battle',
  location: LocationDefinition,
  actNumber: number,
  seed: number,
  scaling: ActScaling
): Encounter {
  if (nodeType === 'fight' && actNumber <= 1) {
    return generateSpawnEncounter(seed, { types: location.spawnTypes, escortTiers: openerEscortTiersFor(1), scaling });
  }
  return generateSpawnEncounter(seed, {
    types: location.spawnTypes,
    leaderTier: spawnLeaderTierFor(actNumber),
    escortTiers: openerEscortTiersFor(actNumber),
    escortLoadout: actNumber >= OPENER_GEAR_FROM_ACT ? { gear: rarityWeightsFor(actNumber, 'standard') } : undefined,
    scaling,
  });
}

/** The Guardian's two escorts draw from here: the Location's lines at the act's tier. The champion still enters last from the bench. */
export function guardianEscortPool(location: LocationDefinition, actNumber: number): HeroLookup {
  return spawnPool(location.spawnTypes, spawnTierFor(actNumber));
}
