// ⚠️ TEST FIXTURE CONTENT — a Guild Hall offer pool covering the fixture
// heroes not in the default starting roster (src/app/App.tsx), at flat,
// untuned gold costs. Not authored economy content: no decaying runway
// value curve (docs/progression.md "raise-vs-recruit axis") is modeled —
// these are constant offers, not the emergent late-run value curve the doc
// describes.

import type { GuildHallOffer } from '../run/recruitment';
import { heroes } from './heroes';

export const guildHallOffers: GuildHallOffer[] = [
  { id: 'guild-ironWarden', heroId: 'ironWarden', cost: 20, startingMoveIds: heroes.ironWarden.moveIds },
  { id: 'guild-wildOracle', heroId: 'wildOracle', cost: 20, startingMoveIds: heroes.wildOracle.moveIds },
  { id: 'guild-stormRanger', heroId: 'stormRanger', cost: 20, startingMoveIds: heroes.stormRanger.moveIds },
  { id: 'guild-shadowMonk', heroId: 'shadowMonk', cost: 20, startingMoveIds: heroes.shadowMonk.moveIds },
];
