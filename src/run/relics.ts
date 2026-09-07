// Relics: team-wide grants, a separate axis from per-hero equipment. The shipped catalog is
// Gems and Banners, both flat stats (src/data/relics.ts). grantsPassiveIds/grantsStatusIds are
// the other two team-wide grant shapes the pipeline carries, kept for whatever wants them next.

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
  /** One of the five fixed post-Guardian Banners. Display grouping only — nothing in the engine reads it. */
  guardianBanner?: true;
  /** One of the seven Gems. Display grouping only — nothing in the engine reads it. */
  gem?: true;
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
