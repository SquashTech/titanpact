// Relics (docs/progression.md "Relics (team-wide)"): a separate progression
// axis from per-hero equipment, applying to the whole side rather than a
// slot. Stat grants below are the flat-additive half of the pipeline
// discipline (docs/architecture.md "two damage pipelines"). The trigger-hook
// engine contract that note was waiting on now exists (engine/content.ts
// PassiveDefinition, engine/combat/passiveEngine.ts) — `grantsPassiveIds`
// below is relics' side of that wiring, applied team-wide like statGrants.

import type { PassiveId, StatKey, StatusGrant } from '../engine/content';
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
  /** Persistent magnitude-shape statuses (currently Elemental Force — src/data/statuses.ts) this relic grants to every combatant on the owning side for the whole fight, applied team-wide like statGrants (src/run/statusGrants.ts, buildCombatState.ts). Optional/omitted for relics that don't grant one. */
  grantsStatusIds?: readonly StatusGrant[];
  /**
   * Marks one of the three fixed Banners offered after every Guardian win
   * (docs/run-loop.md "The Guardian's Banner"). Load-bearing in one
   * direction only: a banner is EXCLUDED from every random offer pool
   * (`drawableRelics` in src/data/relics.ts — the Relic Shrine and the Guild
   * Hall both draw from it), so the post-Guardian choice stays the same
   * three every act and never dilutes an ordinary relic draw. Nothing in the
   * engine reads it; banners stack through the same duplicate-id summing as
   * any other relic.
   */
  guardianBanner?: true;
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
