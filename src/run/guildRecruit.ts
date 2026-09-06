// What a Guild Hall hire arrives as. A hire is bought rather than raised, so it comes in at the
// act's `GUILD_HALL_LEVEL_BY_ACT` with those level-ups already spent — Evolution path and extra
// moves rolled exactly the way an enemy's are (enemyGen.ts rollLevelProgression), never the act's
// stat scaling, which is an enemy-side axis. Deterministic in the offer, the act and the act's
// location, so the sheet the player inspects is the hero they pay for.

import { heroes } from '../data/heroes';
import { progressionTable } from '../data/progression';
import { createRng } from '../engine/rng/seededRng';
import { guildHallLevel } from './difficulty';
import { rollLevelProgression } from './enemyGen';
import type { GuildHallOffer } from './recruitment';
import type { RosterEntry, RunState } from './state';
import { addRosterEntry, createRosterEntry, createRunState } from './state';

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

  const seed = offerSeed(offer, run.actNumber, run.locationIds[run.actNumber - 1] ?? '');
  const scratch = addRosterEntry(createRunState(0), { ...base, level });
  const { run: raised } = rollLevelProgression(scratch, rosterId, progressionTable, heroes, level, createRng(seed));
  return raised.roster[0] ?? { ...base, level };
}
