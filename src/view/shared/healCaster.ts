// Heal inputs (caster Wisdom + types) for a RosterEntry outside combat, built through the same
// helpers buildCombatState.ts uses so the previewed heal equals the one the fight pays out.

import type { HeroDefinition } from '../../engine/content';
import type { HealCaster } from '../../engine/heal/healPipeline';
import type { RosterEntry } from '../../run/state';
import { entryStatModifiers, entryPassiveCounts } from '../../run/entryStats';
import { relicTeamStatModifiers } from '../../run/relics';
import { relicTeamPassiveGrants } from '../../run/passives';
import { rosterEntryTypes } from '../../run/progression';
import { equipment } from '../../data/equipment';
import { passives } from '../../data/passives';
import { relics } from '../../data/relics';

/** `relicIds` is the owning team's relics — omit for a hero the player doesn't own yet (draft, scouted enemy). */
export function healCasterForEntry(hero: HeroDefinition, entry: RosterEntry, relicIds: readonly string[] = []): HealCaster {
  const teamStatModifiers = relicTeamStatModifiers(relicIds, relics);
  const teamPassiveGrants = relicTeamPassiveGrants(relicIds, relics);
  const passiveCounts = entryPassiveCounts(entry, equipment, teamPassiveGrants);
  const grants = entryStatModifiers(entry, equipment, passives, passiveCounts, teamStatModifiers);
  return {
    wisdom: hero.baseStats.wisdom + (grants.wisdom ?? 0),
    types: rosterEntryTypes(hero, entry),
  };
}
