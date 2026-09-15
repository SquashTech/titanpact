// One node, one encounter (docs/run-loop.md). The single place a map node is turned into who
// stands on the other side of the field — App.tsx, the sim and the map's own typing preview all
// call it, so the tile cannot promise a fight the node does not deliver.
//
// DETERMINISTIC by design (2026-09-13, Titanspawn overhaul phase 3): the seed is derived from the
// map's seed and the node's id, never rolled fresh, so the preview a tile shows and the fight the
// tap starts are the same draw. Nothing new is stored on the node for it.

import type { HeroLookup } from '../engine/state';
import type { TypeId } from '../engine/content';
import { createRng, nextFloat } from '../engine/rng/seededRng';
import type { LocationDefinition } from '../data/locations';
import type { MapNode, MapNodeType, RunMap } from './map';
import type { RunState } from './state';
import type { ProgressionTable } from './progression';
import { rosterEntryTypes } from './progression';
import { encounterScaling, encounterHeroCountOverride, enemyLoadoutFor } from './difficulty';
import { appendFinalEnemy, generateEncounter, type Encounter, type EncounterNodeType } from './enemyGen';
import { locationBias } from './locations';
import { guardianEscortPool, mobEncounter } from './spawn';
import type { TutorialEncounter } from './tutorial';

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
  /** The recruitable pool — `heroes`. */
  heroes: HeroLookup;
  /** Every combatant, for a scripted roster that names its own — `allCombatants`. */
  allCombatants: HeroLookup;
  /** The authored enemies, for the Guardian's champion. */
  enemies: HeroLookup;
  progression: ProgressionTable;
  /** The scripted first act's forced roster for this node, or null (run/tutorial.ts). */
  scripted?: TutorialEncounter | null;
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
  const { run, location, heroes, allCombatants, enemies, progression, scripted } = ctx;
  const encounterKind = encounterKindOf(type);
  // The run's 2nd plain encounter is a deliberately lighter 2v2.
  const isSecondFight = encounterKind === 'fight' && run.fightsStarted === 1;
  const scaling = encounterScaling(type, run.actNumber);
  const loadout = enemyLoadoutFor(type, run.actNumber);
  // A scripted roster names its own combatants, so it draws from the WHOLE table
  // (docs/tutorial.md); a Guardian's escorts are the act's tier of the Location's spawn.
  const pool = scripted ? allCombatants : type === 'boss' ? guardianEscortPool(location, run.actNumber) : heroes;
  // A hero already on the roster is barred from the recruitable draw, so two copies can never
  // reach one roster via a contract claim (mirrors rollGuildHallOffers). Passed unconditionally:
  // enemy and hero ids never collide (test/recruitment.test.ts), so it is inert on a mob pool.
  const excludeHeroIds = run.roster.map((r) => r.heroId);
  const standardCount = encounterKind === 'boss' ? 2 : 4;
  // Act 1 caps the enemy count at the roster — the IMMORTAL roster (2026-09-13, per user
  // direction, titanspawn-overhaul.md "Phase 6 findings"): the companion is half a hero and must
  // not invite a whole enemy, so the Act 1 Skirmish is 3v2 with it on the bench.
  const immortalRoster = run.roster.filter((entry) => !entry.mortal).length;
  const heroCountOverride =
    type === 'fight' || isSecondFight ? 2 : encounterHeroCountOverride(type, run.actNumber, immortalRoster, standardCount);
  const heroCount = heroCountOverride ?? standardCount;
  // Location affinity bias applies to the recruitable pool only (docs/locations.md §2).
  const bias = pool === heroes ? locationBias(location, heroes, heroCount) : undefined;
  let encounter = generateEncounter(encounterKind, seed, pool, {
    forcedHeroIds: scripted?.heroIds,
    statGrants: scripted?.statGrants,
    heroCount: heroCountOverride,
    bias,
    excludeHeroIds,
    scaling,
    loadout,
    // A spawn has no progression data; only the hero pool cashes a level in.
    progression: pool === heroes || scripted ? progression : undefined,
  });
  // The Location's held-back champion arrives benched, so the first enemy KO brings him in.
  const finalEnemyId = type === 'boss' ? location.guardianFinalEnemyId : null;
  if (finalEnemyId) {
    encounter = appendFinalEnemy(encounter, finalEnemyId, enemies, encounterSeedFor(ctx.run.map!, `${node.id}:champion`), scaling, loadout);
  }
  return encounter;
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

/** Bounded: the pool is 36 heroes over 15 types, so two identical type sets in a row are rare and eight tries is generous. */
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
  const { location, run, scripted } = ctx;
  if ((type === 'fight' || type === 'battle') && !scripted) {
    return mobEncounter(type, location, run.actNumber, encounterSeedFor(map, node.id), encounterScaling(type, run.actNumber));
  }
  const partner = scripted ? null : forkPartner(map, node);
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
