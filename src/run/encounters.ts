// One node, one encounter (docs/run-loop.md). The single place a map node is turned into who
// stands on the other side of the field — App.tsx, the sim and the map's own typing preview all
// call it, so the tile cannot promise a fight the node does not deliver.
//
// DETERMINISTIC by design (2026-09-13, Titanspawn overhaul phase 3): the seed is derived from the
// map's seed and the node's id, never rolled fresh, so the preview a tile shows and the fight the
// tap starts are the same draw. Nothing new is stored on the node for it.

import type { HeroLookup } from '../engine/state';
import type { HeroDefinition, TypeId } from '../engine/content';
import { createRng, nextFloat } from '../engine/rng/seededRng';
import type { LocationDefinition } from '../data/locations';
import type { MapNode, MapNodeType, RunMap } from './map';
import type { RunState } from './state';
import type { ProgressionTable } from './progression';
import { rosterEntryTypes } from './progression';
import { championGradeFor, encounterScaling, encounterHeroCountOverride, enemyLoadoutFor, guardianEscortCount } from './difficulty';
import { appendFinalEnemy, generateEncounter, type Encounter, type EncounterNodeType } from './enemyGen';
import { locationBias } from './locations';
import { guardiansWake, isLongWinter, wardensHold, wokenChampion, wokenChampionMark, wokenEscortCount } from './cycles';
import { TITANS_WARD_ID } from '../data/passives';
import { guardianEscortPool, mobEncounter } from './spawn';
import { DECK_HEROES_PER_FIGHT } from './deck';
import { appendWarden, buildWarden, wardenAt, type Warden } from './wardens';

export type EncounterMapNodeType = 'fight' | 'skirmish' | 'battle' | 'elite' | 'boss';

export function isEncounterNodeType(type: MapNodeType): type is EncounterMapNodeType {
  return type === 'fight' || type === 'skirmish' || type === 'battle' || type === 'elite' || type === 'boss';
}

/** FNV-1a over the id, folded into the map seed. `salt` is the fork's re-roll (below). */
export function encounterSeedFor(map: RunMap, nodeId: string, salt = 0): number {
  let h = 0x811c9dc5 ^ map.seed;
  for (let i = 0; i < nodeId.length; i++) {
    h ^= nodeId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h = (h + salt * 0x9e3779b1) >>> 0;
  // One draw, so a seed that happens to be 0 or tiny is as well-mixed as any other.
  return Math.floor(nextFloat(createRng(h)).value * 0x7fffffff);
}

export interface EncounterContext {
  run: RunState;
  location: LocationDefinition;
  /** The recruitable pool — the run's deck (run/deck.ts `encounterPools`). */
  heroes: HeroLookup;
  /** Heroes that may fill a recruitable party past its deck floor, never offered a contract (docs/collection.md §3). */
  strangers?: HeroLookup;
  /** Every combatant, for reading a drawn squad's types — `allCombatants`. */
  allCombatants: HeroLookup;
  /** The authored enemies, for the Guardian's champion. */
  enemies: HeroLookup;
  progression: ProgressionTable;
  /** The account's Wardens (run/wardens.ts); from Cycle II the one holding this seal joins its Guardian. */
  wardens?: readonly Warden[];
}

/** `skirmish` and `battle` are mechanically plain `fight` encounters. */
export function encounterKindOf(type: EncounterMapNodeType): EncounterNodeType {
  return type === 'skirmish' || type === 'battle' ? 'fight' : type;
}

/**
 * The bodies a hero-pool node fields, drawn at `seed`. Split from `nodeEncounter` so the fork
 * can compare two draws before committing to one.
 */
function heroPoolEncounter(node: MapNode, type: EncounterMapNodeType, ctx: EncounterContext, seed: number): Encounter {
  const { run, location, heroes, strangers, enemies, progression } = ctx;
  const encounterKind = encounterKindOf(type);
  // The run's 2nd plain encounter is a deliberately lighter 2v2.
  const isSecondFight = encounterKind === 'fight' && run.fightsStarted === 1;
  const scaling = encounterScaling(type, run.actNumber);
  const loadout = enemyLoadoutFor(type, run.actNumber);
  // A Guardian's escorts are the act's tier of the Location's spawn.
  const pool = type === 'boss' ? guardianEscortPool(location, run.actNumber) : heroes;
  // A hero already on the roster is barred from the recruitable draw, so two copies can never
  // reach one roster via a contract claim (mirrors rollGuildHallOffers). Passed unconditionally:
  // enemy and hero ids never collide (test/recruitment.test.ts), so it is inert on a mob pool.
  const excludeHeroIds = run.roster.map((r) => r.heroId);
  // From Cycle II the Guardians wake (run/cycles.ts): the escorts climb with the act, the champion leads.
  const woken = type === 'boss' && guardiansWake(run);
  const standardCount = encounterKind === 'boss' ? (woken ? wokenEscortCount(run.actNumber) : guardianEscortCount(run.actNumber)) : 4;
  // Act 1 caps the enemy count at the roster (the companion is off it — docs/companion-call.md §6).
  const heroCountOverride =
    type === 'fight' || isSecondFight ? 2 : encounterHeroCountOverride(type, run.actNumber, run.roster.length, standardCount);
  const heroCount = heroCountOverride ?? standardCount;
  // Location affinity bias applies to the recruitable pool only (docs/locations.md §2).
  const bias = pool === heroes ? locationBias(location, heroes, heroCount) : undefined;
  let encounter = generateEncounter(encounterKind, seed, pool, {
    heroCount: heroCountOverride ?? (encounterKind === 'boss' ? standardCount : undefined),
    bias,
    excludeHeroIds,
    scaling,
    loadout,
    // A spawn has no progression data; only the hero pool cashes a level in.
    progression: pool === heroes ? progression : undefined,
    strangers: pool === heroes ? strangers : undefined,
    deckFloor: DECK_HEROES_PER_FIGHT,
  });
  // The Location's held-back champion arrives benched, so the first enemy KO brings him in.
  const finalEnemyId = type === 'boss' ? location.guardianFinalEnemyId : null;
  if (finalEnemyId && enemies[finalEnemyId]) {
    const champion = woken ? wokenChampion(enemies[finalEnemyId]) : grownOnActGrade(enemies[finalEnemyId], run.actNumber);
    encounter = appendFinalEnemy(encounter, finalEnemyId, { ...enemies, [finalEnemyId]: champion }, encounterSeedFor(ctx.run.map!, `${node.id}:champion`), scaling, loadout);
    if (woken) encounter = wakeChampion(encounter, finalEnemyId, wokenChampionMark(enemies[finalEnemyId]));
    // A lone escort (difficulty.ts GUARDIAN_ESCORTS_BY_ACT) leaves a lead slot for the champion.
    else if (encounter.squad.activeIds[1] === null) encounter = wakeChampion(encounter, finalEnemyId, null);
    // A Long Winter wards the champion while its company stands — the Herald's rule (docs/cycles.md §3).
    if (isLongWinter(run)) encounter = grantPassive(encounter, finalEnemyId, TITANS_WARD_ID);
  }
  // From Cycle II the seal's Warden stands beside its beast, an extra body (docs/cycles.md §2).
  const warden = type === 'boss' && wardensHold(run) ? wardenAt(ctx.wardens, location.id) : null;
  if (warden) {
    const entry = buildWarden(warden, ctx.allCombatants, progression, {
      level: scaling.level,
      mastery: scaling.mastery,
      actNumber: run.actNumber,
      loadout,
      seed: encounterSeedFor(ctx.run.map!, `${node.id}:warden`),
    });
    if (entry) encounter = appendWarden(encounter, entry);
  }
  return encounter;
}

/** The champion on its act's grade (difficulty.ts CHAMPION_GRADE_BY_ACT) — its own E grades until Act 4. */
function grownOnActGrade(definition: HeroDefinition, actNumber: number): HeroDefinition {
  const grade = championGradeFor(actNumber);
  if (grade === 'E') return definition;
  const growthGrades = Object.fromEntries(Object.keys(definition.growthGrades ?? {}).map((stat) => [stat, grade])) as HeroDefinition['growthGrades'];
  return { ...definition, growthGrades };
}

/** One passive onto one enemy, beside whatever it already holds. */
function grantPassive(encounter: Encounter, rosterId: string, passiveId: string): Encounter {
  const roster = encounter.run.roster.map((entry) => (entry.rosterId === rosterId ? { ...entry, bonusPassiveGrants: [...entry.bonusPassiveGrants, passiveId] } : entry));
  return { ...encounter, run: { ...encounter.run, roster } };
}

/** A woken champion wears its Mark and takes the second lead slot from round one; the escort it displaces waits on the bench. */
function wakeChampion(encounter: Encounter, championId: string, markId: string | null): Encounter {
  const roster = markId
    ? encounter.run.roster.map((entry) => (entry.rosterId === championId ? { ...entry, bonusPassiveGrants: [...entry.bonusPassiveGrants, markId] } : entry))
    : encounter.run.roster;
  const { activeIds, benchIds } = encounter.squad;
  const displaced = activeIds[1];
  const squad = {
    ...encounter.squad,
    activeIds: [activeIds[0], championId] as typeof activeIds,
    benchIds: [...benchIds.filter((id) => id !== championId), ...(displaced ? [displaced] : [])],
  };
  return { run: { ...encounter.run, roster }, squad };
}

/** The types the enemy side shows, in field order (active first), each hero's effective types deduped. */
export function scoutedTypes(encounter: Encounter, combatants: HeroLookup): TypeId[] {
  const order = [...encounter.squad.activeIds.filter((id): id is string => id !== null), ...encounter.squad.benchIds];
  const seen = new Set<TypeId>();
  for (const rosterId of order) {
    const entry = encounter.run.roster.find((r) => r.rosterId === rosterId);
    const hero = entry && combatants[entry.heroId];
    if (!entry || !hero) continue;
    for (const type of rosterEntryTypes(hero, entry)) seen.add(type);
  }
  return [...seen];
}

/** The fork's other option: the `elite` on the same row as a `skirmish`, or null off the fork. */
function forkPartner(map: RunMap, node: MapNode): MapNode | null {
  if (node.type !== 'skirmish') return null;
  const partnerId = map.rows[node.row]?.find((id) => map.nodes[id]?.type === 'elite');
  return partnerId ? map.nodes[partnerId] : null;
}

/** Bounded: the pool is 42 heroes over 14 types, so two identical type sets in a row are rare and eight tries is generous. */
const FORK_REROLLS = 8;

/**
 * The encounter a node fields. The fork's Skirmish is drawn against its Elite: the generator
 * guarantees the two differ in at least one type (docs/titanspawn-overhaul.md §4), re-rolling
 * the Skirmish's seed until they do, or the choice is empty.
 */
export function nodeEncounter(node: MapNode, ctx: EncounterContext): Encounter {
  const type = node.type;
  if (!isEncounterNodeType(type)) throw new Error(`${node.id} is a ${type} node, which fields no encounter`);
  const map = ctx.run.map!;
  const { location, run } = ctx;
  if (type === 'fight' || type === 'battle') {
    return mobEncounter(type, location, run.actNumber, encounterSeedFor(map, node.id), encounterScaling(type, run.actNumber));
  }
  const partner = forkPartner(map, node);
  if (!partner) return heroPoolEncounter(node, type, ctx, encounterSeedFor(map, node.id));

  const eliteTypes = new Set(scoutedTypes(heroPoolEncounter(partner, 'elite', ctx, encounterSeedFor(map, partner.id)), ctx.allCombatants));
  let encounter = heroPoolEncounter(node, type, ctx, encounterSeedFor(map, node.id));
  for (let salt = 1; salt <= FORK_REROLLS; salt++) {
    const types = scoutedTypes(encounter, ctx.allCombatants);
    if (types.length !== eliteTypes.size || types.some((t) => !eliteTypes.has(t))) break;
    encounter = heroPoolEncounter(node, type, ctx, encounterSeedFor(map, node.id, salt));
  }
  return encounter;
}
