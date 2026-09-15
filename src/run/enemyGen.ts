// Seeded AI encounter generation for map fight/elite/boss nodes. An enemy is a RosterEntry
// built the way a Guild hire is: its level rolled through its growth grades (docs/enemy-levels.md),
// its pips read off the act, its kit walked off its schedule. The level comes from the caller
// (difficulty.ts ActScaling) — never derived here.

import type { PassiveId, StatKey, TypeId } from '../engine/content';
import type { HeroLookup } from '../engine/state';
import { createRng, nextFloat, type RngState } from '../engine/rng/seededRng';
import type { BrokenSeal, RunState, RosterEntry } from './state';
import { createRunState, createRosterEntry, addRosterEntry } from './state';
import { levelUpEntry, xpForLevel } from './growth';
import { MASTERY_CAP, pendingSignature } from './mastery';
import { unsealedIdFor } from '../data/enemies';
import { spawnPool, type SpawnTier } from '../data/titanspawn';
import { rollFittingGear } from '../data/equipment';
import { equipItem, type EquipmentRarity } from './equipment';
import {
  MOVE_CAP,
  availableEvolution,
  chooseEvolutionPath,
  levelMovePool,
  rosterEntryTypes,
  scheduleEntries,
  scheduleFor,
  takeScheduleEntry,
  type ProgressionTable,
} from './progression';
// Content imports: there is exactly one move table, and tier gating needs it; the spawn
// generator draws the mob layer straight from its own table, as the finale draws its champions.
import { moves } from '../data/moves';
import { NO_SCALING, championLevel, type ActScaling } from './difficulty';
import type { Squad } from './squad';
import { pickSquad } from './squad';

export type EncounterNodeType = 'fight' | 'elite' | 'boss';

function shuffledPick<T>(rng: RngState, pool: readonly T[], count: number): { picked: T[]; nextState: RngState } {
  const remaining = [...pool];
  const picked: T[] = [];
  let state = rng;
  while (picked.length < Math.min(count, pool.length)) {
    const { value, nextState } = nextFloat(state);
    state = nextState;
    const idx = Math.floor(value * remaining.length);
    picked.push(remaining.splice(idx, 1)[0]);
  }
  return { picked, nextState: state };
}

/** Fill `slots` from `preferredIds` first, then the rest from the whole pool. Generic on purpose — locations.ts turns a type affinity into one of these. */
export interface PoolBias {
  preferredIds: readonly string[];
  /** Clamped to the encounter size and to how many preferred ids exist in the pool. */
  slots: number;
}

function biasedPick(
  rng: RngState,
  heroPool: HeroLookup,
  heroCount: number,
  bias: PoolBias | undefined,
  excluded: ReadonlySet<string>
): { picked: string[]; nextState: RngState } {
  const allIds = Object.keys(heroPool).filter((id) => !excluded.has(id));
  if (!bias || bias.slots <= 0) return shuffledPick(rng, allIds, heroCount);

  const preferred = bias.preferredIds.filter((id) => id in heroPool && !excluded.has(id));
  const { picked: onTheme, nextState } = shuffledPick(rng, preferred, Math.min(bias.slots, heroCount));
  const rest = allIds.filter((id) => !onTheme.includes(id));
  const { picked: wildcards, nextState: afterWild } = shuffledPick(nextState, rest, heroCount - onTheme.length);
  return { picked: [...onTheme, ...wildcards], nextState: afterWild };
}

export interface Encounter {
  run: RunState;
  squad: Squad;
}

/** What an enemy arrives holding beyond its level: the seam enemy gear and passives hang on. */
export interface EnemyLoadout {
  /** Rarity weights for ONE item, rolled as a drop is; omitted = bare. */
  gear?: Record<EquipmentRarity, number>;
  /** Granted outright, stacking like a Boon's (RosterEntry.bonusPassiveGrants). */
  passiveIds?: readonly PassiveId[];
}

/** A plain `() => number` over a seeded state, for the callers that take one. */
function drawFrom(rng: RngState): { random: () => number; state: () => RngState } {
  let state = rng;
  return {
    random: () => {
      const { value, nextState } = nextFloat(state);
      state = nextState;
      return value;
    },
    state: () => state,
  };
}

/**
 * Level 1 to `level`, every level rolled against the definition's grades — a Titanspawn line's,
 * a hero's, or DEFAULT_GRADES for a champion with none authored. The same call a hire arrives by.
 */
function growTo(entry: RosterEntry, hero: HeroLookup[string], level: number, rng: RngState): { entry: RosterEntry; nextState: RngState } {
  const draw = drawFrom(rng);
  const grown = levelUpEntry(entry, hero, level - 1, draw.random).entry;
  return { entry: grown, nextState: draw.state() };
}

function applyLoadout(entry: RosterEntry, hero: HeroLookup[string], loadout: EnemyLoadout | undefined, rng: RngState): { entry: RosterEntry; nextState: RngState } {
  if (!loadout) return { entry, nextState: rng };
  const draw = drawFrom(rng);
  let next = entry;
  if (loadout.gear) {
    // Rolled to fit the wearer — the contract keeps it (docs/gear-absorption.md §7).
    const item = rollFittingGear(hero.baseStats, rosterEntryTypes(hero, entry), loadout.gear, draw.random);
    if (item) next = { ...next, equipment: equipItem(next.equipment, item.id) };
  }
  if (loadout.passiveIds && loadout.passiveIds.length > 0) {
    next = { ...next, bonusPassiveGrants: [...next.bonusPassiveGrants, ...loadout.passiveIds] };
  }
  return { entry: next, nextState: draw.state() };
}

export interface EncounterOptions {
  /**
   * Names the enemy roster outright instead of drawing one — the scripted first act
   * (src/data/tutorial.ts). Sets the encounter size too, so `heroCount` is not also needed.
   * Ids in `excludeHeroIds` are dropped and the gap refilled from the pool, so a scripted
   * escort the player has since recruited can never be fielded against them.
   */
  forcedHeroIds?: readonly string[];
  /** Overrides the node kind's default roster size (the run's 2nd-fight 2v2 breather, the row-0 opener). */
  heroCount?: number;
  /** heroId -> full movepool; swaps the starting kit for MOVE_CAP random moves (Quick Battle). Missing heroes keep their kit. */
  movepools?: Record<string, readonly string[]>;
  /** Omitted = uniform pick over the whole pool. */
  bias?: PoolBias;
  /** Hard filter both pick stages obey — the player's roster, so a beaten enemy can never be a duplicate contract. */
  excludeHeroIds?: readonly string[];
  /**
   * A flat grant merged onto every enemy in this encounter, on top of its level — the scripted
   * first act's lever for making a fight last (src/data/tutorial.ts).
   */
  statGrants?: Partial<Record<StatKey, number>>;
  /** Omitted = NO_SCALING. */
  scaling?: ActScaling;
  /** What every enemy here arrives holding; omitted = bare. */
  loadout?: EnemyLoadout;
  /** Needed only to cash `scaling.level` and `scaling.mastery` in for move unlocks and the Evolution; the monster pool has none by design. */
  progression?: ProgressionTable;
}

/**
 * Walks the hero's schedule (progression.ts scheduleEntries) up to its level, exactly as a roster
 * hero would have: the Evolution first, when the entry's Mastery has reached the pip that opens
 * it (a path taken unweighted, so the offers that follow can draw on a graft's line), then the
 * signature at ten — into the kit ahead of the offers, in the last slot if the kit is full, since
 * a hero at ten holds it by definition — then each offer rolls one move from the band open at
 * that level and learns it if there is room (an enemy never swaps). The same schedule and the same pips a roster hero reads, so a contract hero is the
 * enemy you beat, finished (docs/xp-overhaul.md §4, docs/mastery.md §4).
 */
export function rollLevelProgression(
  run: RunState,
  rosterId: string,
  table: ProgressionTable,
  heroPool: HeroLookup,
  level: number,
  rng: RngState
): { run: RunState; nextState: RngState } {
  let state = rng;
  let next: RunState = run;
  const first = run.roster.find((r) => r.rosterId === rosterId);
  if (!first) return { run, nextState: state };
  const hero = heroPool[first.heroId];
  const node = availableEvolution(table, first);
  if (node && node.paths.length > 0) {
    const { picked, nextState } = shuffledPick(state, node.paths, 1);
    state = nextState;
    try {
      next = chooseEvolutionPath(next, table, heroPool, rosterId, picked[0].id);
    } catch {
      // Illegal path for this hero (content bug) — field the enemy un-evolved rather than crash.
    }
  }
  const signature = pendingSignature(hero, next.roster.find((r) => r.rosterId === rosterId)!);
  if (signature) {
    next = {
      ...next,
      roster: next.roster.map((r) => {
        if (r.rosterId !== rosterId) return r;
        const kit = r.unlockedMoveIds.length < MOVE_CAP ? [...r.unlockedMoveIds, signature] : [...r.unlockedMoveIds.slice(0, MOVE_CAP - 1), signature];
        return { ...r, unlockedMoveIds: kit, offeredMoveIds: [...r.offeredMoveIds, signature] };
      }),
    };
  }
  // The band an offer rolls from is the band open at the level of THAT entry, not at the level
  // the hero arrives at — a level-13 enemy's first offer was an Early move, as a roster hero's was.
  for (const step of scheduleEntries(scheduleFor(hero))) {
    if (step.level > level) break;
    const entry = next.roster.find((r) => r.rosterId === rosterId)!;
    const atLevel = { ...entry, xp: xpForLevel(step.level) };
    const { picked, nextState } = shuffledPick(state, levelMovePool(table, moves, hero, atLevel), 1);
    state = nextState;
    const moveId = picked[0];
    if (moveId && entry.unlockedMoveIds.length < MOVE_CAP) {
      next = {
        ...next,
        roster: next.roster.map((r) => (r.rosterId === rosterId ? { ...r, unlockedMoveIds: [...r.unlockedMoveIds, moveId], offeredMoveIds: [...r.offeredMoveIds, moveId] } : r)),
      };
    }
    next = takeScheduleEntry(next, rosterId);
  }
  return { run: next, nextState: state };
}

/**
 * fight/elite: 4 heroes; boss: 2, no bench. The node kind sets the SIZE; `scaling.level` is the
 * whole of the difficulty axis. Everything rolled here rides along on a Recruit Contract claim
 * (recruitment.ts deriveContractOffer) — late-act contracts are strong by design.
 */
export function generateEncounter(
  nodeType: EncounterNodeType,
  seed: number,
  heroPool: HeroLookup,
  options: EncounterOptions = {}
): Encounter {
  const {
    forcedHeroIds,
    heroCount: heroCountOverride,
    movepools,
    bias,
    excludeHeroIds,
    statGrants: flatGrants,
    scaling = NO_SCALING,
    loadout,
    progression,
  } = options;
  let rng = createRng(seed);
  const excluded = new Set(excludeHeroIds ?? []);
  const scripted = forcedHeroIds?.filter((id) => id in heroPool && !excluded.has(id)) ?? [];
  const heroCount = forcedHeroIds?.length ?? heroCountOverride ?? (nodeType === 'boss' ? 2 : 4);

  // A scripted roster short of its authored size (an id the player recruited) tops up from the
  // pool, so the fight is never smaller than the one the script was written against.
  const { picked: drawn, nextState: afterPick } = biasedPick(
    rng,
    heroPool,
    heroCount - scripted.length,
    bias,
    new Set([...excluded, ...scripted])
  );
  const heroIds = [...scripted, ...drawn];
  rng = afterPick;

  let run = createRunState(0);
  for (const heroId of heroIds) {
    let startingMoveIds: readonly string[] = heroPool[heroId].moveIds;
    const movepool = movepools?.[heroId];
    if (movepool) {
      const { picked, nextState } = shuffledPick(rng, movepool, MOVE_CAP);
      rng = nextState;
      startingMoveIds = picked;
    }
    const { entry: grown, nextState: afterGrowth } = growTo(createRosterEntry(heroId, heroId, startingMoveIds), heroPool[heroId], scaling.level, rng);
    rng = afterGrowth;
    const { entry, nextState: afterLoadout } = applyLoadout(
      { ...grown, mastery: scaling.mastery, evolutionStatGrants: flatGrants ? { ...flatGrants } : {} },
      heroPool[heroId],
      loadout,
      rng
    );
    rng = afterLoadout;
    run = addRosterEntry(run, entry);
  }

  if (progression && (scaling.level > 1 || scaling.mastery > 0)) {
    for (const heroId of heroIds) {
      const { run: next, nextState } = rollLevelProgression(run, heroId, progression, heroPool, scaling.level, rng);
      run = next;
      rng = nextState;
    }
  }

  const squad = pickSquad(run.roster, heroIds);
  return { run, squad };
}

/**
 * Appends one fixed enemy to an encounter's BENCH (a Location's champion
 * reinforcing its Guardian — it reaches the field only via forced replacement).
 * Separate from generateEncounter because it draws from a different, non-recruitable
 * pool. Unknown ids return the encounter unchanged.
 */
export function appendFinalEnemy(
  encounter: Encounter,
  enemyId: string,
  enemyPool: HeroLookup,
  seed: number,
  scaling: ActScaling = NO_SCALING,
  loadout?: EnemyLoadout
): Encounter {
  const definition = enemyPool[enemyId];
  if (!definition) return encounter;
  // rosterId === enemyId; a collision would mean the two pools share an id.
  if (encounter.run.roster.some((r) => r.rosterId === enemyId)) return encounter;

  // Over its escorts by CHAMPION_LEVEL_BONUS: a champion ships a full kit, so its level is stats.
  const { entry: grown, nextState } = growTo(createRosterEntry(enemyId, enemyId, definition.moveIds), definition, championLevel(scaling.level), createRng(seed));
  const { entry } = applyLoadout({ ...grown, mastery: scaling.mastery }, definition, loadout, nextState);
  const run = addRosterEntry(encounter.run, entry);
  return { run, squad: { ...encounter.squad, benchIds: [...encounter.squad.benchIds, enemyId] } };
}

/**
 * The finale (docs/run-loop.md §4): the five broken seals in the order they were broken,
 * then the Endbringer. Every champion is rebuilt verbatim from the snapshot taken when the
 * player beat it — level and growth alike — so the fight escalates across itself. Only the
 * Endbringer's own growth is rolled, at `seed`.
 *
 * The champions field UNSEALED (`unsealedIdFor`): the Ancient half was the seal, and the
 * player already took it (docs/lore.md §6).
 */
export function generateFinaleEncounter(
  brokenSeals: readonly BrokenSeal[],
  endbringerId: string,
  enemyPool: HeroLookup,
  seed: number,
  endbringerScaling: ActScaling = NO_SCALING
): Encounter {
  const ordered = [...brokenSeals].sort((a, b) => a.actNumber - b.actNumber);

  let run = createRunState(0);
  const orderedIds: string[] = [];
  for (const seal of ordered) {
    const unsealedId = unsealedIdFor(seal.championId);
    const definition = enemyPool[unsealedId];
    if (!definition || run.roster.some((r) => r.rosterId === unsealedId)) continue;
    const entry = createRosterEntry(unsealedId, unsealedId, definition.moveIds);
    run = addRosterEntry(run, { ...entry, xp: xpForLevel(seal.level), mastery: MASTERY_CAP, evolutionStatGrants: seal.statGrants, growthStatGrants: seal.growthStatGrants });
    orderedIds.push(unsealedId);
  }

  const endbringer = enemyPool[endbringerId];
  if (endbringer) {
    const { entry } = growTo(createRosterEntry(endbringerId, endbringerId, endbringer.moveIds), endbringer, endbringerScaling.level, createRng(seed));
    run = addRosterEntry(run, { ...entry, mastery: MASTERY_CAP });
    orderedIds.push(endbringerId);
  }

  // Built by hand rather than through pickSquad: bench ORDER is the design here, and
  // pickSquad's job is validating a player's pick against a required size.
  const squad: Squad = {
    activeIds: [orderedIds[0] ?? null, orderedIds[1] ?? null],
    benchIds: orderedIds.slice(2),
  };
  return { run, squad };
}

export interface SpawnEncounterOptions {
  /** The Location's lines; null = every spawning type (`spawnPool`). */
  types: readonly TypeId[] | null;
  /** The body that leads, first on the field; omitted = no leader (Act 1's opener). */
  leaderTier?: SpawnTier;
  escortTier: SpawnTier;
  escortCount: number;
  /** What each escort arrives holding; omitted = bare escorts. */
  escortLoadout?: EnemyLoadout;
  /** Omitted = NO_SCALING. */
  scaling?: ActScaling;
}

/**
 * Draws `count` spawn from a pool, without replacement until the pool runs dry and then again
 * from the top — a two-type Location fielding three Earlies has to repeat one, and a repeated
 * body is what a mob layer looks like. Every roster id is unique even when the hero id is not.
 */
function drawSpawn(rng: RngState, pool: HeroLookup, count: number): { picked: string[]; nextState: RngState } {
  const ids = Object.keys(pool);
  const picked: string[] = [];
  let state = rng;
  while (picked.length < count && ids.length > 0) {
    const { picked: round, nextState } = shuffledPick(state, ids, count - picked.length);
    state = nextState;
    picked.push(...round);
  }
  return { picked, nextState: state };
}

/**
 * The mob layer's own encounter (docs/titanspawn-overhaul.md §4): a leader at one tier ahead
 * of its escorts, or bare escorts alone, drawn from the Location's lines. The tier is the BODY
 * and the level is the run-depth axis on it, as everywhere else. The escorts' gear is the third
 * axis from Act 2 (difficulty.ts OPENER_GEAR_FROM_ACT): rolled on the act's rarity curve exactly
 * as a drop is, seeded with the rest of the encounter.
 */
export function generateSpawnEncounter(seed: number, options: SpawnEncounterOptions): Encounter {
  const { types, leaderTier, escortTier, escortCount, escortLoadout, scaling = NO_SCALING } = options;
  let rng = createRng(seed);

  const leaderPool = leaderTier ? spawnPool(types, leaderTier) : {};
  const escortPool = spawnPool(types, escortTier);
  const { picked: leaderIds, nextState: afterLeader } = drawSpawn(rng, leaderPool, leaderTier ? 1 : 0);
  rng = afterLeader;
  const { picked: escortIds, nextState: afterEscorts } = drawSpawn(rng, escortPool, escortCount);
  rng = afterEscorts;
  const pool: HeroLookup = { ...leaderPool, ...escortPool };

  let run = createRunState(0);
  const rosterIds: string[] = [];
  const seen = new Map<string, number>();
  for (const [i, heroId] of [...leaderIds, ...escortIds].entries()) {
    const n = (seen.get(heroId) ?? 0) + 1;
    seen.set(heroId, n);
    const rosterId = n === 1 ? heroId : `${heroId}-${n}`;
    const { entry: grown, nextState: afterGrowth } = growTo(createRosterEntry(rosterId, heroId, pool[heroId].moveIds), pool[heroId], scaling.level, rng);
    rng = afterGrowth;
    const isEscort = i >= leaderIds.length;
    const { entry, nextState: afterLoadout } = applyLoadout(grown, pool[heroId], isEscort ? escortLoadout : undefined, rng);
    rng = afterLoadout;
    run = addRosterEntry(run, entry);
    rosterIds.push(rosterId);
  }

  const squad = pickSquad(run.roster, rosterIds);
  return { run, squad };
}
