// Relics: the team-wide axis (docs/progression.md "Relics (team-wide)"). One family — the
// per-act Guardian's Banner, fixed and stacking. There is no random relic pool: a team-wide
// passive applied to all four heroes at once was either a bigger stat grant or an unanswerable one,
// so the axis is flat stats and the interesting grants live per-hero on equipment (2026-09-07).
//
// The per-hero stat axis left this file (2026-09-09) and was then deleted outright
// it is not a team-wide grant any more.

import type { RelicDefinition } from '../run/relics';

// --- Guardian's Banner: the fixed, stackable pick after every Guardian (docs/run-loop.md).
// Three Banners, one concept each — offense, defense, staying power — so a run's picks read as a
// team shape ("two Warcries, a Bulwark, a Wellspring"). `guardianBanner: true` is the family flag
// the run sheet groups on.
//
// Three shapes (2026-09-28, per user direction, docs/run-loop.md "The Guardian's Banner"): the
// Warcry is offense with a step of Speed, the Bulwark defense with the team's regen, the
// Wellspring the big flat pools. Regen left the pools' Banner because the two stacked on one pick
// was a cast-forever take every run. The Speed rider reverses 2026-09-14 on purpose: Swiftness
// died as a Banner of its own, and this is a rider on one that pays continuously.
const guardianBanners: Record<string, RelicDefinition> = {
  bannerOfTheWarcry: {
    id: 'bannerOfTheWarcry',
    name: 'Banner of the Warcry',
    description: 'Team-wide +30 Attack, +30 Intelligence, +10 Speed.',
    statGrants: { attack: 30, intelligence: 30, speed: 10 },
    guardianBanner: true,
  },
  bannerOfTheBulwark: {
    id: 'bannerOfTheBulwark',
    name: 'Banner of the Bulwark',
    description: 'Team-wide +15 Defense, +15 Wisdom, +5 MP Regen.',
    statGrants: { defense: 15, wisdom: 15, mpRegen: 5 },
    guardianBanner: true,
  },
  bannerOfTheWellspring: {
    id: 'bannerOfTheWellspring',
    name: 'Banner of the Wellspring',
    description: 'Team-wide +60 HP, +50 Mana Pool.',
    statGrants: { hp: 60, manaPool: 50 },
    guardianBanner: true,
  },
};

export const relics: Record<string, RelicDefinition> = { ...guardianBanners };

/** The three fixed Banners, in the order the post-Guardian screen offers them. */
export const guardianBannerRelics: RelicDefinition[] = Object.values(guardianBanners);
