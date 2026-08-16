// Relics (docs/progression.md "Relics (team-wide)"): a separate progression
// axis from per-hero equipment, applying to the whole side rather than a
// slot. SCOPE NOTE, mirroring equipment.ts's own scope note exactly: this
// slice only wires the STAT-shaped half of the pipeline discipline
// (docs/architecture.md "two damage pipelines") — relics here grant flat
// team-wide stat modifiers only. Hook-triggered relics (e.g. "on faint, heal
// the team") need the trigger-hook engine contract (CLAUDE.md "Architecture"
// — README "Next steps" #3), which isn't built yet. Do not speculatively add
// a trigger/hook field here until that contract lands.

import type { StatKey } from '../engine/content';
import { isValidFlatStatGrant } from '../engine/content';
import type { StatModifiers } from '../engine/state';
import { mergeStatMods } from './statMods';

export interface RelicDefinition {
  id: string;
  name: string;
  description?: string;
  /** Flat additive grants (CLAUDE.md "Stat modifiers are flat additive integers, multiples of 5 or 10"), applied to every combatant on the owning side. */
  statGrants: Partial<Record<StatKey, number>>;
}

export function isValidRelicDefinition(relic: RelicDefinition): boolean {
  return Object.values(relic.statGrants).every((amount) => amount === undefined || isValidFlatStatGrant(amount));
}

/** Sums every owned relic's stat grants into the shape the stat pipeline consumes — same pattern as equipment.ts's equipmentStatModifiers, but keyed by relic id list rather than a per-slot loadout. */
export function relicTeamStatModifiers(relicIds: readonly string[], relicLookup: Record<string, RelicDefinition>): StatModifiers {
  const grants: StatModifiers[] = [];
  for (const id of relicIds) {
    const relic = relicLookup[id];
    if (!relic) continue;
    grants.push(relic.statGrants);
  }
  return mergeStatMods(...grants);
}
