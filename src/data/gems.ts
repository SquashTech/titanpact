// The Gem catalog (docs/run-loop.md "Gems"). A Gem is per-hero stat investment, not a relic:
// the run collects them and the player pours them into whichever heroes they want, against the
// caps in src/run/gems.ts. Seven stones, one per stat but MP Regen, each named for the colour
// its stat already wears.
//
// MP Regen has no Gem (2026-09-07): at a flat base 10 across the whole roster it was +50% of a
// throughput stat and read as the correct pick from every offer. It lives on the Wellspring
// Banner instead. Worth re-asking now that a Gem competes against a per-hero cap.

import type { StatKey } from '../engine/content';

export const GEM_STAT_GRANT = 5;

/** The Emerald carries HP, authored in the units the HP bar draws — twice the figure for the same worth. */
export const GEM_HP_GRANT = GEM_STAT_GRANT * 2;

export interface GemDefinition {
  id: string;
  name: string;
  /** The one stat this Gem pumps. */
  stat: StatKey;
  /** How that stat is written on a hero sheet. */
  label: string;
  /** What one Gem is worth, socketed. */
  grant: number;
}

/** In STAT_ORDER — the order every Gem surface lists them in. */
const GEM_TABLE: readonly { stat: StatKey; id: string; name: string; label: string }[] = [
  { stat: 'hp', id: 'emeraldGem', name: 'Emerald', label: 'HP' },
  { stat: 'attack', id: 'rubyGem', name: 'Ruby', label: 'Attack' },
  { stat: 'defense', id: 'onyxGem', name: 'Onyx', label: 'Defense' },
  { stat: 'intelligence', id: 'amethystGem', name: 'Amethyst', label: 'Intelligence' },
  { stat: 'wisdom', id: 'aquamarineGem', name: 'Aquamarine', label: 'Wisdom' },
  { stat: 'speed', id: 'citrineGem', name: 'Citrine', label: 'Speed' },
  { stat: 'manaPool', id: 'sapphireGem', name: 'Sapphire', label: 'Mana Pool' },
];

/** The seven Gems in STAT_ORDER. */
export const gemList: readonly GemDefinition[] = GEM_TABLE.map(({ stat, id, name, label }) => ({
  id,
  name,
  stat,
  label,
  grant: stat === 'hp' ? GEM_HP_GRANT : GEM_STAT_GRANT,
}));

export const gems: Record<string, GemDefinition> = Object.fromEntries(gemList.map((gem) => [gem.id, gem]));

/** The Gem that carries each stat. Partial: MP Regen has none. */
export const gemForStat: Partial<Record<StatKey, GemDefinition>> = Object.fromEntries(
  gemList.map((gem) => [gem.stat, gem])
);

/** A Gem's grant in the shared stat-map shape, so the relic display helpers read one unchanged. */
export function gemStatGrants(gem: GemDefinition): Partial<Record<StatKey, number>> {
  return { [gem.stat]: gem.grant };
}
