// The Recruit node (docs/guild-hall-overhaul.md §2): three types on offer, one picked, a hero of
// that type rolled from the run's deck. It arrives RAW at the player's par (§2.2).

import { heroes } from '../data/heroes';
import { moves } from '../data/moves';
import { progressionTable } from '../data/progression';
import { TYPES } from '../data/typechart';
import type { HeroDefinition, TypeId } from '../engine/content';
import { GATHERING_EXTRA_RECRUIT_TYPES, isGathering } from './cycles';
import { deckRowOf } from './deck';
import { eventRecruitEntry, recruitPool } from './events';
import { MOVE_CAP, levelMovePool, pendingScheduleEntry } from './progression';
import type { RosterEntry, RunState } from './state';

export const RECRUIT_TYPE_COUNT = 3;

/** The heroes a pick of `type` can roll: the deck's, never one on the roster or one that left it this run. */
export function recruitableOfType(run: RunState, catalog: Record<string, HeroDefinition>, type: TypeId): string[] {
  const barred = new Set([...run.roster.map((entry) => entry.heroId), ...(run.departedHeroIds ?? [])]);
  return Object.values(recruitPool(run, catalog))
    .filter((hero) => deckRowOf(hero) === type && !barred.has(hero.id))
    .map((hero) => hero.id);
}

function draw<T>(from: T[], random: () => number): T {
  return from.splice(Math.floor(random() * from.length), 1)[0];
}

/**
 * The node's three types (four in a Gathering), in chart order: one of the Location's own when any
 * of them has a hero left, the rest from every type that does. Fewer only when the deck runs that dry.
 */
export function recruitTypeOffers(
  run: RunState,
  catalog: Record<string, HeroDefinition>,
  locationTypes: readonly TypeId[],
  random: () => number
): TypeId[] {
  const open = TYPES.filter((type) => recruitableOfType(run, catalog, type).length > 0);
  const count = RECRUIT_TYPE_COUNT + (isGathering(run) ? GATHERING_EXTRA_RECRUIT_TYPES : 0);
  const local = open.filter((type) => locationTypes.includes(type));
  const picked: TypeId[] = local.length > 0 ? [draw(local, random)] : [];
  const rest = open.filter((type) => !picked.includes(type));
  while (picked.length < count && rest.length > 0) picked.push(draw(rest, random));
  return TYPES.filter((type) => picked.includes(type));
}

/** Who answers a pick of `type`, or null when nobody is left to. */
export function rollRecruitHero(run: RunState, catalog: Record<string, HeroDefinition>, type: TypeId, random: () => number): string | null {
  const candidates = recruitableOfType(run, catalog, type);
  return candidates.length > 0 ? draw(candidates, random) : null;
}

/** An event recruit's terms — par, the act's pips — with its kit filled from the entries its level reached. */
export function recruitNodeEntry(run: RunState, hero: HeroDefinition, rosterId: string, random: () => number): RosterEntry {
  return withReceipts(eventRecruitEntry(run, hero, rosterId, random), random);
}

/** The owed entries that would land without a question, learned now, so a recruit is not a two-move hero on its first fight. */
export function withReceipts(entry: RosterEntry, random: () => number): RosterEntry {
  const hero = heroes[entry.heroId];
  let next = entry;
  while (next.unlockedMoveIds.length < MOVE_CAP && pendingScheduleEntry(hero, next)) {
    const pool = levelMovePool(progressionTable, moves, hero, next);
    const moveId = pool.length > 0 ? pool[Math.floor(random() * pool.length)] : null;
    next = {
      ...next,
      scheduleTaken: next.scheduleTaken + 1,
      unlockedMoveIds: moveId ? [...next.unlockedMoveIds, moveId] : next.unlockedMoveIds,
      offeredMoveIds: moveId ? [...next.offeredMoveIds, moveId] : next.offeredMoveIds,
    };
  }
  return next;
}
