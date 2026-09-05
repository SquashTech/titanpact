// How a relic held more than once is written down. Stacking itself happens in the stat pipeline
// (relicTeamStatModifiers sums duplicates); this only formats. Suffix is copies BEYOND the first
// (3 copies => "+2"), the upgrade-pip convention.

import type { StatKey } from '../../engine/content';
import type { RelicDefinition } from '../../run/relics';

/** Full-word stat names for surfaces with room (reward cards, relic descriptions); StatBars has the 3-letter forms. */
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

export function stackedRelicName(relic: RelicDefinition, count: number): string {
  return count > 1 ? `${relic.name} +${count - 1}` : relic.name;
}

/**
 * Flat grants times copies held: "+90 HP", "+40 Mana Pool, +20 MP Regen". Empty for all-passive
 * relics. A count of 0 is a real case — the Relics screen lists every Gem, held or not — and
 * reads "+0 HP" rather than "0 HP", so a column of totals stays uniform.
 */
export function stackedGrantSummary(relic: RelicDefinition, count: number): string {
  return Object.entries(relic.statGrants)
    .filter(([, amount]) => amount)
    .map(([stat, amount]) => {
      const total = (amount as number) * count;
      return `${total >= 0 ? '+' : ''}${total} ${STAT_FULL_LABELS[stat as StatKey] ?? stat}`;
    })
    .join(', ');
}
