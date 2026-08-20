// Relics (docs/progression.md "Relics (team-wide)"): a separate progression
// axis from per-hero equipment, applying to the whole side rather than a
// slot. Stat grants below are the flat-additive half of the pipeline
// discipline (docs/architecture.md "two damage pipelines"). The trigger-hook
// engine contract that note was waiting on now exists (engine/content.ts
// PassiveDefinition, engine/combat/passiveEngine.ts) — `grantsPassiveIds`
// below is relics' side of that wiring, applied team-wide like statGrants.

import type { PassiveId, StatKey } from '../engine/content';
import { isValidFlatStatGrant } from '../engine/content';
import type { StatModifiers } from '../engine/state';
import { mergeStatMods } from './statMods';

export interface RelicDefinition {
  id: string;
  name: string;
  description?: string;
  /** Flat additive grants (CLAUDE.md "Stat modifiers are flat additive integers, multiples of 5 or 10"), applied to every combatant on the owning side. */
  statGrants: Partial<Record<StatKey, number>>;
  /** Passives (engine/content.ts PassiveDefinition, src/data/passives.ts) this relic grants to every combatant on the owning side while owned. Optional/omitted for plain stat-only relics. */
  grantsPassiveIds?: readonly PassiveId[];
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
