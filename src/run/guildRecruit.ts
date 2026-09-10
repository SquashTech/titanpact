// What a Guild Hall hire arrives as: **RAW** (docs/growth-overhaul.md §6). The act's hire level
// with the growth its levels earned, and nothing else — rank 1, no Evolution, its authored
// starting kit. The player builds it.
//
// That is the whole of the flat-value / decaying-runway split, and since 2026-09-10 it is true on
// three axes instead of one. A CONTRACT hero is the enemy you beat, entire: act level, the rank
// its level bought, an Evolution already chosen, a kit already picked. You save six Scrolls and a
// Crucible, and in exchange you authored none of it. A hire costs 50 gold and arrives one act
// behind — but every decision about what it becomes is still yours.
//
// It DOES get its levels rolled. "Raw" means unbuilt, not hollow: a level-13 hire with no growth
// grants would be ~120 points behind a level-13 roster hero, which is not an archetype, it is a
// waste of 50 gold. Deterministic in the offer, the act and the act's location, so the sheet the
// player inspects is the hero they pay for.

import { heroes } from '../data/heroes';
import { createRng, nextFloat, type RngState } from '../engine/rng/seededRng';
import { guildHallLevel } from './difficulty';
import { levelUpEntry } from './growth';
import type { GuildHallOffer } from './recruitment';
import type { RosterEntry, RunState } from './state';
import { createRosterEntry } from './state';

/** FNV-1a over everything that must not shift between inspecting an offer and paying for it. */
function offerSeed(offer: GuildHallOffer, actNumber: number, locationId: string): number {
  let hash = 0x811c9dc5;
  for (const ch of `${offer.id}|${actNumber}|${locationId}`) {
    hash = Math.imul(hash ^ ch.charCodeAt(0), 0x01000193);
  }
  return hash >>> 0;
}

/** The entry `offer` would join the roster as. Pure — the preview sheet and the purchase both call it. */
export function guildHallEntry(run: RunState, offer: GuildHallOffer, rosterId: string): RosterEntry {
  const level = guildHallLevel(run.actNumber);
  const base = createRosterEntry(rosterId, offer.heroId, offer.startingMoveIds);
  if (level <= 1) return base;

  // Seeded rather than Math.random: the growth roll is part of what the player is buying, so the
  // preview and the purchase have to land on the same stat line.
  let state: RngState = createRng(offerSeed(offer, run.actNumber, run.locationIds[run.actNumber - 1] ?? ''));
  const random = () => {
    const { value, nextState } = nextFloat(state);
    state = nextState;
    return value;
  };
  return levelUpEntry(base, heroes[offer.heroId], level - 1, random).entry;
}
