// Effective out-of-combat stat line for a roster entry, built from the same helpers
// buildCombatState.ts uses. Reading `hero.baseStats[stat]` directly shows a number the
// player never sees in combat.

import type { HeroDefinition, StatKey, StatLine } from '../../engine/content';
import type { RosterEntry } from '../../run/state';
import { entryStatModifiers, entryPassiveCounts } from '../../run/entryStats';
import { relicTeamStatModifiers } from '../../run/relics';
import { relicTeamPassiveGrants } from '../../run/passives';
import { equipment } from '../../data/equipment';
import { passives } from '../../data/passives';
import { relics } from '../../data/relics';

/**
 * Base plus every flat grant. `relicIds` is the owning team's relics — omit for a hero the player
 * doesn't own yet (draft, scouted enemy). Flat grants only: live statuses need a Combatant.
 */
export function entryStatTotals(
  hero: HeroDefinition,
  entry: RosterEntry,
  relicIds: readonly string[] = []
): StatLine {
  const teamStatModifiers = relicTeamStatModifiers(relicIds, relics);
  const teamPassiveGrants = relicTeamPassiveGrants(relicIds, relics);
  const passiveCounts = entryPassiveCounts(entry, equipment, teamPassiveGrants);
  const grants = entryStatModifiers(entry, equipment, passives, passiveCounts, teamStatModifiers);

  const out = { ...hero.baseStats };
  for (const key of Object.keys(out) as StatKey[]) out[key] += grants[key] ?? 0;
  return out;
}
