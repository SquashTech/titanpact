// Relics: the team-wide axis (docs/progression.md "Relics (team-wide)"). One family — the
// per-act Guardian's Banner, fixed and stacking. There is no random relic pool: a team-wide
// passive applied to all four heroes at once was either a bigger stat grant or an unanswerable one,
// so the axis is flat stats and the interesting grants live per-hero on equipment (2026-09-07).
//
// The per-hero stat axis left this file (2026-09-09) and was then deleted outright
// it is not a team-wide grant any more.

import type { RelicDefinition } from '../run/relics';

// --- Guardian's Banner: the fixed, stackable pick after every Guardian (docs/run-loop.md).
// Three Banners, one concept each — offense, defense, mana — so a run's picks read as a team
// shape ("two Warcries, a Bulwark, a Wellspring"). `guardianBanner: true` is the family flag the
// run sheet groups on.
//
// The values are NOT symmetric, and deliberately: a hero swings with Attack or with
// Intelligence, never both, so the Warcry's two stats are worth one stat to any given hero.
// Every defensive stat is live on every hero — everyone is hit by both pipelines — so the
// Bulwark's three are priced down to the same 30 points the old Defense/Wisdom pair carried.
// Speed has no Banner: a flat team-wide grant never flips an intra-team ordering and pays only
// at a threshold, and it measured dead in every batch (docs/run-loop.md "The Guardian's Banner").
const guardianBanners: Record<string, RelicDefinition> = {
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
    description: 'Team-wide +30 HP, +10 Defense, +10 Wisdom.',
    statGrants: { hp: 30, defense: 10, wisdom: 10 },
    guardianBanner: true,
  },
  bannerOfTheWellspring: {
    id: 'bannerOfTheWellspring',
    name: 'Banner of the Wellspring',
    // Both halves of the mana axis on one Banner, because neither carries a pick alone. Mana
    // pool SATURATES — batch simulation measures +50, +150 and +300 identically, a fight ending
    // long before a deeper reserve is reached — and MP Regen alone was the auto-take, being
    // +100% of a flat base 10. Paired, mana is one axis competing with two others.
    description: 'Team-wide +40 Mana Pool, +10 MP Regen.',
    statGrants: { manaPool: 40, mpRegen: 10 },
    guardianBanner: true,
  },
};

export const relics: Record<string, RelicDefinition> = { ...guardianBanners };

/** The three fixed Banners, in the order the post-Guardian screen offers them. */
export const guardianBannerRelics: RelicDefinition[] = Object.values(guardianBanners);
