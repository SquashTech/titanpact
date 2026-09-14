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
// The values are NOT symmetric, and deliberately. They are sized to MEASURED parity, not to a
// point scale: batch simulation prices a point of Defense/Wisdom at roughly six times a point of
// Attack/Intelligence, so the Warcry carries +40 against the Bulwark's +15 and the three come
// out within one standard error of each other (docs/run-loop.md "The Guardian's Banner").
// Speed has no Banner: a flat team-wide grant never flips an intra-team ordering and pays only
// at a threshold, and it measured dead in every batch.
const guardianBanners: Record<string, RelicDefinition> = {
  bannerOfTheWarcry: {
    id: 'bannerOfTheWarcry',
    name: 'Banner of the Warcry',
    description: 'Team-wide +40 Attack, +40 Intelligence.',
    statGrants: { attack: 40, intelligence: 40 },
    guardianBanner: true,
  },
  bannerOfTheBulwark: {
    id: 'bannerOfTheBulwark',
    name: 'Banner of the Bulwark',
    description: 'Team-wide +15 Defense, +15 Wisdom.',
    statGrants: { defense: 15, wisdom: 15 },
    guardianBanner: true,
  },
  bannerOfTheWellspring: {
    id: 'bannerOfTheWellspring',
    name: 'Banner of the Wellspring',
    // HP and both halves of the mana axis: what keeps a hero on the field and casting. Mana pool
    // SATURATES — batch simulation measures +50, +150 and +300 identically, a fight ending long
    // before a deeper reserve is reached — and MP Regen alone was the auto-take, being +100% of
    // a flat base 10; HP is the half that pays when the pilot dies before mana does.
    description: 'Team-wide +40 HP, +30 Mana Pool, +10 MP Regen.',
    statGrants: { hp: 40, manaPool: 30, mpRegen: 10 },
    guardianBanner: true,
  },
};

export const relics: Record<string, RelicDefinition> = { ...guardianBanners };

/** The three fixed Banners, in the order the post-Guardian screen offers them. */
export const guardianBannerRelics: RelicDefinition[] = Object.values(guardianBanners);
