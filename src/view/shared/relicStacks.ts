// How a relic held more than once is written down.
//
// Duplicate relic ids already stack in the stat pipeline — relicTeamStatModifiers
// (src/run/relics.ts) sums the list, so three Banners of Vitality are +90 HP on
// every hero without anything here. This module only decides how that reads:
// one card named "Banner of Vitality +2" carrying the summed total, rather
// than three identical cards or a bare "×3" the player has to multiply out.
//
// The suffix is copies-BEYOND-the-first (2 extras => "+2" => 3 copies), the
// upgrade-pip convention rather than a stack count, per user direction
// 2026-08-30 ("Banner of Vitality +2 ... gives +90 HP").

import type { StatKey } from '../../engine/content';
import type { RelicDefinition } from '../../run/relics';

/** Full-word stat names, for the places that have room for them (reward cards, relic descriptions) — StatBars' STAT_LABELS are the 3-letter forms the stat bars need. */
export const STAT_FULL_LABELS: Record<StatKey, string> = {
  hp: 'HP',
  attack: 'Attack',
  defense: 'Defense',
  intelligence: 'Intelligence',
  wisdom: 'Wisdom',
  speed: 'Speed',
  manaPool: 'Mana Pool',
  mpRegen: 'MP Regen',
};

/** "Banner of Vitality" at one copy, "Banner of Vitality +2" at three. */
export function stackedRelicName(relic: RelicDefinition, count: number): string {
  return count > 1 ? `${relic.name} +${count - 1}` : relic.name;
}

/** This relic's flat grants multiplied by how many copies are held: "+90 HP", "+40 Mana Pool, +20 MP Regen". Empty for relics whose value is all passive/status (nothing to multiply). */
export function stackedGrantSummary(relic: RelicDefinition, count: number): string {
  return Object.entries(relic.statGrants)
    .filter(([, amount]) => amount)
    .map(([stat, amount]) => {
      const total = (amount as number) * count;
      return `${total > 0 ? '+' : ''}${total} ${STAT_FULL_LABELS[stat as StatKey] ?? stat}`;
    })
    .join(', ');
}
