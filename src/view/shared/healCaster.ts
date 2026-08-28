// One place to answer "what does this hero's heal actually restore" for the
// out-of-combat screens.
//
// Healing runs a formula off the caster's Wisdom and types (docs/combat.md
// "The healing formula"), so a move's heal figure is a fact about the HERO,
// not about the move — Solace's Restore Vigor reads 60 and Cinder's reads 36.
// In a fight the view can hand the formula a live Combatant; on a level-up,
// draft, or roster sheet there isn't one, only a RosterEntry. This assembles
// the same two inputs from that entry, through the SAME helpers
// buildCombatState.ts uses to build the real combatant's baseline, so the
// number a player is shown while choosing a move is the number the fight will
// pay out.

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

/**
 * `relicIds` is the owning team's relics (RunState.relics) — omit it for a
 * hero the player doesn't own yet (the pre-run draft, a scouted enemy squad),
 * exactly as HeroPreviewOverlay does, so a preview never shows a heal inflated
 * by relics that wouldn't apply to it.
 */
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
