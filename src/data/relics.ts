// Relics: the team-wide axis (docs/progression.md "Relics (team-wide)"). One family — the
// per-act Guardian's Banner, fixed and stacking. There is no random relic pool: a team-wide
// passive applied to all four heroes at once was either a bigger Gem or an unanswerable one,
// so the axis is flat stats and the interesting grants live per-hero on equipment (2026-09-07).
//
// Gems left this file for src/data/gems.ts (2026-09-09): a Gem is poured into ONE hero now, so
// it is not a team-wide grant any more.

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

export const relics: Record<string, RelicDefinition> = { ...guardianBanners };

/** The five fixed Banners, in the order the post-Guardian screen offers them. */
export const guardianBannerRelics: RelicDefinition[] = Object.values(guardianBanners);
