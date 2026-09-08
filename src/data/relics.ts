// Relics: the team-wide axis (docs/progression.md "Relics (team-wide)"). Two families, both
// fixed and both stacking — the common Gem and the per-act Guardian's Banner. There is no
// random relic pool: a team-wide passive applied to all four heroes at once was either a
// bigger Gem or an unanswerable one, so the axis is flat stats now and the interesting
// grants live per-hero on equipment (2026-09-07).

import type { StatKey } from '../engine/content';
import type { RelicDefinition } from '../run/relics';

// --- Guardian's Banner: the fixed, stackable pick after every Guardian (docs/run-loop.md).
// One per axis, so five acts of Banners is a spread-or-commit decision the player can see
// coming from act 1. `guardianBanner: true` groups them apart from the Gems on the run sheet.
//
// The values are NOT symmetric, and deliberately: a hero swings with Attack or with
// Intelligence, never both, so the Warcry's two stats are worth one stat to any given hero.
// Defense and Wisdom are both live on every hero — everyone is hit by both pipelines — so the
// Bulwark's two are worth two, and are priced at +15 rather than +20 each.
const guardianBanners: Record<string, RelicDefinition> = {
  bannerOfVitality: {
    id: 'bannerOfVitality',
    name: 'Banner of Vitality',
    description: 'Team-wide +30 HP.',
    statGrants: { hp: 60 },
    guardianBanner: true,
  },
  bannerOfTheWarcry: {
    id: 'bannerOfTheWarcry',
    name: 'Banner of the Warcry',
    description: 'Team-wide +20 Attack, +20 Intelligence.',
    statGrants: { attack: 20, intelligence: 20 },
    guardianBanner: true,
  },
  bannerOfTheBulwark: {
    id: 'bannerOfTheBulwark',
    name: 'Banner of the Bulwark',
    description: 'Team-wide +15 Defense, +15 Wisdom.',
    statGrants: { defense: 15, wisdom: 15 },
    guardianBanner: true,
  },
  bannerOfSwiftness: {
    id: 'bannerOfSwiftness',
    name: 'Banner of Swiftness',
    description: 'Team-wide +20 Speed.',
    statGrants: { speed: 20 },
    guardianBanner: true,
  },
  bannerOfTheWellspring: {
    id: 'bannerOfTheWellspring',
    name: 'Banner of the Wellspring',
    // Both halves of the mana axis on one Banner, because neither carries a pick alone. Mana
    // pool SATURATES — batch simulation measures +50, +150 and +300 identically, a fight ending
    // long before a deeper reserve is reached — and MP Regen alone was the auto-take, being
    // +100% of a flat base 10. Paired, mana is one axis competing with four others.
    description: 'Team-wide +40 Mana Pool, +10 MP Regen.',
    statGrants: { manaPool: 40, mpRegen: 10 },
    guardianBanner: true,
  },
};

// --- Gems: the common, stacking drip-feed (docs/run-loop.md "Gems"). One per COMBAT stat plus
// Mana Pool, handed out often enough that a run holds several by Act 3.
//
// MP Regen has no Gem (2026-09-07): at a flat base 10 across the whole roster, +5 was +50% of
// a throughput stat and read as the correct pick from every offer, which is the opposite of
// what a 1-of-3 is for. It lives on the Wellspring Banner instead, priced against four rivals.
export const GEM_STAT_GRANT = 5;

/** The Emerald carries HP, which is authored in the same units the HP bar draws — twice the other Gems' figure for the same worth. */
export const GEM_HP_GRANT = GEM_STAT_GRANT * 2;

function gemGrant(stat: StatKey): number {
  return stat === 'hp' ? GEM_HP_GRANT : GEM_STAT_GRANT;
}

/** Stat -> the one Gem that carries it, in STAT_ORDER — the order every Gem surface lists them in. */
const GEM_TABLE: readonly { stat: StatKey; id: string; name: string; label: string }[] = [
  { stat: 'hp', id: 'emeraldGem', name: 'Emerald', label: 'HP' },
  { stat: 'attack', id: 'rubyGem', name: 'Ruby', label: 'Attack' },
  { stat: 'defense', id: 'onyxGem', name: 'Onyx', label: 'Defense' },
  { stat: 'intelligence', id: 'amethystGem', name: 'Amethyst', label: 'Intelligence' },
  { stat: 'wisdom', id: 'aquamarineGem', name: 'Aquamarine', label: 'Wisdom' },
  { stat: 'speed', id: 'citrineGem', name: 'Citrine', label: 'Speed' },
  { stat: 'manaPool', id: 'sapphireGem', name: 'Sapphire', label: 'Mana Pool' },
];

const gems: Record<string, RelicDefinition> = Object.fromEntries(
  GEM_TABLE.map(({ stat, id, name, label }) => [
    id,
    {
      id,
      name,
      description: `Team-wide +${gemGrant(stat)} ${label}.`,
      statGrants: { [stat]: gemGrant(stat) },
      gem: true,
    } satisfies RelicDefinition,
  ])
);

export const relics: Record<string, RelicDefinition> = {
  ...guardianBanners,
  ...gems,
};

/** The seven Gems in STAT_ORDER — the order every Gem surface lists them in. */
export const gemRelics: RelicDefinition[] = GEM_TABLE.map(({ id }) => gems[id]);

/** The Gem that carries each stat. Partial: MP Regen has none (see above). */
export const gemForStat: Partial<Record<StatKey, RelicDefinition>> = Object.fromEntries(
  GEM_TABLE.map(({ stat, id }) => [stat, gems[id]])
);

/** The five fixed Banners, in the order the post-Guardian screen offers them. */
export const guardianBannerRelics: RelicDefinition[] = Object.values(guardianBanners);
