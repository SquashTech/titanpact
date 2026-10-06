// The Wardens (docs/cycles.md §2): the heroes of an account's first Cycle I win, kept forever.
// Each is seated once, by type, on one of the six base seals, and from Cycle II stands beside
// that seal's beast in its Guardian fight — an EXTRA body, never an escort's slot. A seal with no
// Warden keeps its beast alone.
//
// A Warden is its DECISIONS, not its numbers: the path it walked, the moves and Class it held, its
// gear. Its level is the fight's, so it is grown again at every seal, and what it fields is what
// that level and act have opened — the Evolution at the pips an enemy has, the Class from Act 2,
// as many pieces of its gear as the act's enemies carry.

import type { HeroDefinition, TypeId } from '../engine/content';
import type { HeroLookup } from '../engine/state';
import { createRng } from '../engine/rng/seededRng';
import { classes } from '../data/classes';
import { equipment } from '../data/equipment';
import { ACT_ONE_LOCATION_ID, ITINERARY_POOL_IDS, locations } from '../data/locations';
import { moves } from '../data/moves';
import { growTo, type EnemyLoadout, type Encounter } from './enemyGen';
import { rosterIdOfCombatant } from './combatantIds';
import { equipItem } from './equipment';
import type { Profile, RunRecord } from './profile';
import {
  MOVE_CAP,
  availableEvolution,
  bandRank,
  chooseEvolutionPath,
  currentEvolutionPathId,
  isMoveTierReached,
  pendingSignature,
  rosterEntryTypes,
  scheduleFor,
  type ProgressionTable,
} from './progression';
import { addRosterEntry, createRosterEntry, createRunState, type RosterEntry, type RunState } from './state';

export interface Warden {
  heroId: string;
  /** The base seal it holds — a Location id. */
  sealId: string;
  /** The Evolution path it finished down, or null if it never evolved. */
  pathId: string | null;
  /** Its kit at the win, in order. */
  moveIds: readonly string[];
  classId: string | null;
  itemIds: readonly string[];
}

/** The six seals a Warden can hold: Wild's Edge and the base itinerary, never a bought Location or the Threshold. */
export const SEAL_IDS: readonly string[] = [ACT_ONE_LOCATION_ID, ...ITINERARY_POOL_IDS];

/** Levels over the Guardian's escorts a Warden stands at; the first-pass dial. */
export const WARDEN_LEVEL_BONUS = 0;

/** The line a Warden takes the field under (docs/cycles.md §2). */
export const WARDEN_ARRIVAL_LINE = 'The Titan holds them.';

/** The act a Warden first holds its Class at: a Class is the first Guardian's reward. */
export const WARDEN_CLASS_FROM_ACT = 2;

/** The roster id a Warden fields under, apart from every hero and enemy id. */
export function wardenRosterId(heroId: string): string {
  return `warden:${heroId}`;
}

/** A Warden is never offered as a contract: it is the band's, not the Titan's, and may be a hero already held. */
export function isWarden(entry: { rosterId: string }): boolean {
  return entry.rosterId.startsWith('warden:');
}

/** The same, read off a fight's combatant id (run/combatantIds.ts) — what the view draws a Warden by. */
export function isWardenCombatant(combatantId: string): boolean {
  return isWarden({ rosterId: rosterIdOfCombatant(combatantId) });
}

/** How well a hero's types fit a seal: its primary among the seal's spawn lines 2, its secondary 1. */
function seatScore(types: readonly TypeId[], sealId: string): number {
  const spawn = locations[sealId]?.spawnTypes;
  if (!spawn) return 0;
  return (spawn.includes(types[0]) ? 2 : 0) + (types[1] && spawn.includes(types[1]) ? 1 : 0);
}

/**
 * One seal each, the best fit for the band as a whole — every assignment tried (six heroes on six
 * seals is 720), the first best kept, so roster order breaks ties. Wild's Edge fields every type
 * and fits nobody, so it takes whoever fits least elsewhere.
 */
export function seatWardens(band: readonly { heroId: string; types: readonly TypeId[] }[]): Map<string, string> {
  const heroesSeated = band.slice(0, SEAL_IDS.length);
  let best: string[] = [];
  let bestScore = -1;
  const walk = (i: number, used: Set<string>, seats: string[], score: number) => {
    if (i === heroesSeated.length) {
      if (score > bestScore) {
        bestScore = score;
        best = [...seats];
      }
      return;
    }
    for (const sealId of SEAL_IDS) {
      if (used.has(sealId)) continue;
      used.add(sealId);
      seats.push(sealId);
      walk(i + 1, used, seats, score + seatScore(heroesSeated[i].types, sealId));
      seats.pop();
      used.delete(sealId);
    }
  };
  walk(0, new Set(), [], 0);
  return new Map(heroesSeated.map((h, i) => [h.heroId, best[i]]));
}

/** The band as it stood at the win: every roster hero, seated. */
export function wardensFromRun(run: RunState, heroes: HeroLookup): Warden[] {
  const band = run.roster.filter((entry) => heroes[entry.heroId]);
  const seats = seatWardens(band.map((entry) => ({ heroId: entry.heroId, types: rosterEntryTypes(heroes[entry.heroId], entry) })));
  return band.flatMap((entry) => {
    const sealId = seats.get(entry.heroId);
    if (!sealId) return [];
    return [{ heroId: entry.heroId, sealId, pathId: currentEvolutionPathId(entry), moveIds: [...entry.unlockedMoveIds], classId: entry.classId, itemIds: [...entry.equipment] }];
  });
}

/**
 * A win from before the Wardens, read off its history line: the hero and the path it finished
 * down are all a record kept, so the kit is the hero's own two moves, with no Class and no gear.
 */
export function wardensFromRecord(record: RunRecord, heroes: HeroLookup, table: ProgressionTable): Warden[] {
  const band = record.roster.filter((hero) => heroes[hero.heroId]);
  const seats = seatWardens(
    band.map((hero) => {
      const types = heroes[hero.heroId].types;
      const path = (table.evolutions[hero.heroId] ?? []).flatMap((node) => node.paths).find((p) => p.id === hero.evolutionPathId);
      return { heroId: hero.heroId, types: path?.typeGraft ? [types[0], path.typeGraft] : types };
    })
  );
  return band.flatMap((hero) => {
    const sealId = seats.get(hero.heroId);
    if (!sealId) return [];
    return [{ heroId: hero.heroId, sealId, pathId: hero.evolutionPathId, moveIds: [...heroes[hero.heroId].moveIds], classId: null, itemIds: [] }];
  });
}

/** The first Cycle I win is the band, once and forever: a profile that already has Wardens keeps them. */
export function recordWardens(profile: Profile, wardens: readonly Warden[]): Profile {
  if (profile.wardens.length > 0 || wardens.length === 0) return profile;
  return { ...profile, wardens: wardens.map((w) => ({ ...w })) };
}

/** A profile with no Wardens but a Cycle I win in its history takes the oldest such win's band. */
export function withBackfilledWardens(profile: Profile, heroes: HeroLookup, table: ProgressionTable): Profile {
  if (profile.wardens.length > 0) return profile;
  const firstWin = [...profile.runHistory].reverse().find((record) => record.outcome === 'win' && record.cycle === 1);
  return firstWin ? recordWardens(profile, wardensFromRecord(firstWin, heroes, table)) : profile;
}

/** The Warden holding a seal, if the band put one there. */
export function wardenAt(wardens: readonly Warden[] | undefined, sealId: string): Warden | null {
  return wardens?.find((w) => w.sealId === sealId) ?? null;
}

export interface WardenBuild {
  /** The Guardian's escorts' level; the Warden stands WARDEN_LEVEL_BONUS over it. */
  level: number;
  mastery: number;
  actNumber: number;
  loadout?: EnemyLoadout;
  seed: number;
}

/** The kit a Warden fields: its own moves the level has opened, then what the build granted it, to MOVE_CAP. */
function wardenKit(hero: HeroDefinition, warden: Warden, built: RosterEntry, level: number): string[] {
  const granted = new Set(built.unlockedMoveIds);
  const rank = bandRank(scheduleFor(hero), level);
  const open = (id: string) => {
    const move = moves[id];
    if (!move) return false;
    return move.tier ? isMoveTierReached(move, rank) : granted.has(id);
  };
  const kit = warden.moveIds.filter(open);
  for (const id of built.unlockedMoveIds) if (!kit.includes(id)) kit.push(id);
  return kit.slice(0, MOVE_CAP);
}

/** The Warden grown to this fight: its own grades to the level, then its own path, Class, kit and gear as the act allows. */
export function buildWarden(warden: Warden, heroes: HeroLookup, table: ProgressionTable, build: WardenBuild): RosterEntry | null {
  const hero = heroes[warden.heroId];
  if (!hero) return null;
  const rosterId = wardenRosterId(warden.heroId);
  const level = build.level + WARDEN_LEVEL_BONUS;
  const { entry: grown } = growTo(createRosterEntry(rosterId, warden.heroId, hero.moveIds), hero, level, createRng(build.seed));
  let run = addRosterEntry(createRunState(0), { ...grown, mastery: build.mastery });

  const entryOf = () => run.roster[0];
  if (warden.pathId && availableEvolution(table, entryOf())?.paths.some((p) => p.id === warden.pathId)) {
    try {
      run = chooseEvolutionPath(run, table, heroes, rosterId, warden.pathId);
    } catch {
      // A path this build no longer allows — the Warden fields unevolved rather than not at all.
    }
  }
  let entry = entryOf();
  const signature = pendingSignature(hero, entry, level);
  if (signature) entry = { ...entry, unlockedMoveIds: [...entry.unlockedMoveIds, signature] };
  const cls = warden.classId && build.actNumber >= WARDEN_CLASS_FROM_ACT ? classes[warden.classId] : undefined;
  if (cls) {
    entry = { ...entry, classId: cls.id, classPassiveId: cls.grantsPassiveId ?? null };
    if (cls.grantsMoveId) entry = { ...entry, unlockedMoveIds: [...entry.unlockedMoveIds, cls.grantsMoveId] };
  }

  const kit = wardenKit(hero, warden, entry, level);
  entry = { ...entry, unlockedMoveIds: kit, offeredMoveIds: [...new Set([...entry.offeredMoveIds, ...kit])] };
  const gearCount = build.loadout?.gear ? build.loadout.gearCount ?? 1 : 0;
  for (const itemId of warden.itemIds.filter((id) => equipment[id]).slice(0, gearCount)) entry = { ...entry, equipment: equipItem(entry.equipment, itemId) };
  if (build.loadout?.passiveIds?.length) entry = { ...entry, bonusPassiveGrants: [...entry.bonusPassiveGrants, ...build.loadout.passiveIds] };
  return entry;
}

/** The Warden joins the Guardian's side last on the bench — the seal held twice, the last to fall. */
export function appendWarden(encounter: Encounter, entry: RosterEntry): Encounter {
  if (encounter.run.roster.some((r) => r.rosterId === entry.rosterId)) return encounter;
  return {
    run: { ...encounter.run, roster: [...encounter.run.roster, entry] },
    squad: { ...encounter.squad, benchIds: [...encounter.squad.benchIds, entry.rosterId] },
  };
}
