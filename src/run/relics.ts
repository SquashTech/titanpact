// Relics: team-wide passives, a separate axis from per-hero equipment.

import type { PassiveId, StatKey, StatusGrant } from '../engine/content';
import { isValidFlatStatGrant } from '../engine/content';
import type { StatModifiers } from '../engine/state';
import { mergeStatMods } from './statMods';

export interface RelicDefinition {
  id: string;
  name: string;
  description?: string;
  /** Applied to every combatant on the owning side. */
  statGrants: Partial<Record<StatKey, number>>;
  grantsPassiveIds?: readonly PassiveId[];
  /** Magnitude-shape statuses (Elemental Force) granted team-wide for the whole fight. */
  grantsStatusIds?: readonly StatusGrant[];
  /** One of the three fixed post-Guardian Banners — EXCLUDED from every random offer pool (src/data/relics.ts drawableRelics). Nothing in the engine reads it. */
  guardianBanner?: true;
}

export function isValidRelicDefinition(relic: RelicDefinition): boolean {
  return Object.values(relic.statGrants).every((amount) => amount === undefined || isValidFlatStatGrant(amount));
}

export function relicTeamStatModifiers(relicIds: readonly string[], relicLookup: Record<string, RelicDefinition>): StatModifiers {
  const grants: StatModifiers[] = [];
  for (const id of relicIds) {
    const relic = relicLookup[id];
    if (!relic) continue;
    grants.push(relic.statGrants);
  }
  return mergeStatMods(...grants);
}
