// "What are this hero's stats right now" for the out-of-combat screens — the
// stat-line sibling of healCaster.ts, assembled from the same helpers
// buildCombatState.ts uses, so a number shown while the player is choosing is
// the number the fight will actually use.
//
// A RosterEntry's authored base line is never what a hero fights with: three
// independent flat-grant sources (equipment, Evolution, map-node rewards) plus
// mastery grants plus the team's relics and every passive those hand out all
// fold in first (run/entryStats.ts entryStatModifiers). Anything that reads
// `hero.baseStats[stat]` directly is showing a number the player will never
// see in combat.

import type { HeroDefinition, StatKey, StatLine } from '../../engine/content';
import type { RosterEntry } from '../../run/state';
import { entryStatModifiers, entryPassiveCounts } from '../../run/entryStats';
import { relicTeamStatModifiers } from '../../run/relics';
import { relicTeamPassiveGrants } from '../../run/passives';
import { equipment } from '../../data/equipment';
import { passives } from '../../data/passives';
import { relics } from '../../data/relics';

/**
 * Every stat's effective value for a roster entry: base plus all flat grants.
 *
 * `relicIds` is the owning team's relics (RunState.relics) — omit it for a
 * hero the player doesn't own yet (the pre-run draft, a scouted enemy squad),
 * the same caveat healCasterForEntry carries, so a preview never shows a line
 * inflated by relics that wouldn't apply to it.
 *
 * Flat grants only. Live combat statuses (Freeze halving Speed, engine/state.ts
 * getEffectiveStat) are a combat-tier concern and have no Combatant to read
 * from out here — this is the baseline a fight would be BUILT from.
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
