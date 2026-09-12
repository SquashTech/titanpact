// Seeded AI encounter generation for map fight/elite/boss nodes. Scaling reuses
// RosterEntry.evolutionStatGrants rather than a second stat-bonus mechanism.
// Two independent difficulty axes: node KIND (fixed bonuses here) and ACT
// (difficulty.ts ActScaling, passed in by the caller — never derived here).

import type { StatKey } from '../engine/content';
import type { HeroLookup } from '../engine/state';
import { createRng, nextFloat, type RngState } from '../engine/rng/seededRng';
import type { BrokenSeal, RunState, RosterEntry } from './state';
import { createRunState, createRosterEntry, addRosterEntry } from './state';
import { unsealedIdFor } from '../data/enemies';
import {
  MOVE_CAP,
  EVOLUTION_RUNG,
  RANK_THRESHOLDS,
  scrollsToReachRung,
  availableEvolution,
  chooseEvolutionPath,
  masteryMovePool,
  type ProgressionTable,
} from './progression';
// The one content import: there is exactly one move table, and tier gating needs it.
import { moves } from '../data/moves';
import { mergeStatMods } from './statMods';
import {
  NO_SCALING,
  ACT_STEP_STAT_COUNT,
  ACT_STEP_AMOUNT,
  ACT_STEP_STAT_WEIGHT,
  championSteps,
  type ActScaling,
} from './difficulty';
import type { Squad } from './squad';
import { pickSquad } from './squad';

export type EncounterNodeType = 'fight' | 'elite' | 'boss';

const GROWTH_STATS: readonly StatKey[] = ['hp', 'attack', 'defense', 'intelligence', 'wisdom', 'speed'];

/**
 * Where on the Scroll ladder a generated hero stands, read off level — the only thing it has,
 * since it holds no Scrolls. One table for rank AND Evolution (docs/growth-overhaul.md §11), in
 * RUNGS: `masteryScrollsSpent` is what both are derived from on a roster hero, so an enemy is
 * given the Scrolls that rung costs (scrollsToReachRung) and passes the same gates.
 *
 * The bands track the PLAYER's ladder position by act, not any authored gate. Re-banded
 * 2026-09-10 (phase 6) against `ENEMY_LEVEL_BY_ACT`: rank 1 through Act 1, rank 2 through Acts
 * 2-3, rank 3 from Act 4 — enemies used to out-kit the player for the whole run. Level 16 is Act
 * 3's enemy level, so Acts 1-2 field unevolved enemies and Acts 3+ evolved ones, which is what
 * keeps "a contract hero arrives evolved from Act 3" true.
 */
const ENEMY_RUNGS_BY_LEVEL: readonly [level: number, rung: number][] = [
  [10, RANK_THRESHOLDS[1]],
  [16, EVOLUTION_RUNG],
  [21, RANK_THRESHOLDS[2]],
];

function enemyScrollsForLevel(level: number): number {
  let rung = 0;
  for (const [at, to] of ENEMY_RUNGS_BY_LEVEL) if (level >= at) rung = to;
  return scrollsToReachRung(rung);
}

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

function randomStatBonus(rng: RngState, statCount: number, amountEach: number): { bonus: Partial<Record<StatKey, number>>; nextState: RngState } {
  const { picked, nextState } = shuffledPick(rng, GROWTH_STATS, statCount);
  const bonus: Partial<Record<StatKey, number>> = {};
  for (const stat of picked) bonus[stat] = amountEach * ACT_STEP_STAT_WEIGHT[stat];
  return { bonus, nextState };
}

/** `statSteps` independent rolls, merged — keeps a deep-act line broad instead of dumping +40 into one stat. */
function actStatBonus(rng: RngState, statSteps: number): { bonus: Partial<Record<StatKey, number>>; nextState: RngState } {
  let state = rng;
  let bonus: Partial<Record<StatKey, number>> = {};
  for (let i = 0; i < statSteps; i++) {
    const { bonus: step, nextState } = randomStatBonus(state, ACT_STEP_STAT_COUNT, ACT_STEP_AMOUNT);
    state = nextState;
    bonus = mergeStatMods(bonus, step);
  }
  return { bonus, nextState: state };
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
   * A flat grant merged onto every enemy in this encounter, on top of the node kind's bonus and
   * the act curve — the scripted first act's lever for making a fight last (src/data/tutorial.ts).
   * The Goblin pool is authored as fodder, and fodder dies before a tutorial can say anything.
   */
  statGrants?: Partial<Record<StatKey, number>>;
  /** Omitted = NO_SCALING. */
  scaling?: ActScaling;
  /** Needed only to cash `scaling.level` in for Evolutions and move unlocks; the monster pool has none by design. */
  progression?: ProgressionTable;
}

/**
 * Places the hero on the Scroll ladder for its level, takes every Evolution that position opens
 * (path choice unweighted), then spends its remaining level-ups on random pool moves up to
 * MOVE_CAP. Exported because a Guild Hall hire arrives pre-raised the same way an enemy does
 * (`run/guildRecruit.ts`).
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
  // The spend lands FIRST, so `availableEvolution` and `masteryMovePool` gate the enemy exactly as
  // they gate a roster hero at the same position (docs/growth-overhaul.md §11).
  let next: RunState = {
    ...run,
    roster: run.roster.map((r) => (r.rosterId === rosterId ? { ...r, masteryScrollsSpent: enemyScrollsForLevel(level) } : r)),
  };
  let levelUpsSpent = 0;

  // Bounded by the authored node count; `availableEvolution` returns null once every node is resolved.
  for (let i = 0; i < 8; i++) {
    const entry = next.roster.find((r) => r.rosterId === rosterId);
    if (!entry) break;
    const node = availableEvolution(table, entry);
    if (!node || node.paths.length === 0) break;
    const { picked, nextState } = shuffledPick(state, node.paths, 1);
    state = nextState;
    try {
      next = chooseEvolutionPath(next, table, heroPool, rosterId, picked[0].id);
    } catch {
      // Illegal path for this hero (content bug) — field the enemy un-evolved rather than crash.
      break;
    }
    levelUpsSpent++;
  }

  const entry = next.roster.find((r) => r.rosterId === rosterId);
  if (!entry) return { run: next, nextState: state };

  const moveLevelUps = Math.max(0, level - 1 - levelUpsSpent);
  const room = Math.max(0, MOVE_CAP - entry.unlockedMoveIds.length);
  const { picked: learned, nextState: afterMoves } = shuffledPick(
    state,
    masteryMovePool(table, moves, entry),
    Math.min(moveLevelUps, room)
  );
  state = afterMoves;
  next = {
    ...next,
    roster: next.roster.map((r) => (r.rosterId === rosterId ? { ...r, unlockedMoveIds: [...r.unlockedMoveIds, ...learned] } : r)),
  };
  return { run: next, nextState: state };
}

/**
 * fight: 4 heroes, no kind bonus. elite: 4 heroes, +10 to 2 random stats.
 * boss: 2 heroes, no bench, +20 to 3 random stats. `scaling` layers on top.
 * Everything granted here rides along on a Recruit Contract claim
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
    progression,
  } = options;
  let rng = createRng(seed);
  const excluded = new Set(excludeHeroIds ?? []);
  const scripted = forcedHeroIds?.filter((id) => id in heroPool && !excluded.has(id)) ?? [];
  const heroCount = forcedHeroIds?.length ?? heroCountOverride ?? (nodeType === 'boss' ? 2 : 4);
  const [statCount, amountEach] = nodeType === 'boss' ? [3, 20] : nodeType === 'elite' ? [2, 10] : [0, 0];

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
    let entry: RosterEntry = createRosterEntry(heroId, heroId, startingMoveIds);

    let statGrants: Partial<Record<StatKey, number>> = flatGrants ? { ...flatGrants } : {};
    if (statCount > 0) {
      const { bonus, nextState } = randomStatBonus(rng, statCount, amountEach);
      rng = nextState;
      statGrants = mergeStatMods(statGrants, bonus);
    }
    if (scaling.statSteps > 0) {
      const { bonus, nextState } = actStatBonus(rng, scaling.statSteps);
      rng = nextState;
      statGrants = mergeStatMods(statGrants, bonus);
    }

    entry = { ...entry, level: scaling.level, evolutionStatGrants: statGrants };
    run = addRosterEntry(run, entry);
  }

  if (progression && scaling.level > 1) {
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
 * Appends one fixed enemy to an encounter's BENCH (a Location's faction champion
 * reinforcing its Guardian — it reaches the field only via forced replacement).
 * Separate from generateEncounter because it draws from a different, non-recruitable
 * pool. Unknown ids return the encounter unchanged.
 */
export function appendFinalEnemy(
  encounter: Encounter,
  enemyId: string,
  enemyPool: HeroLookup,
  seed: number,
  scaling: ActScaling = NO_SCALING
): Encounter {
  const definition = enemyPool[enemyId];
  if (!definition) return encounter;
  // rosterId === enemyId; a collision would mean the two pools share an id.
  if (encounter.run.roster.some((r) => r.rosterId === enemyId)) return encounter;

  // The champion's own step count: level and kit depth are both closed to it, so stats are the
  // only axis it has (difficulty.ts CHAMPION_STEP_MULTIPLIER).
  const { bonus } = actStatBonus(createRng(seed), championSteps(scaling.statSteps));
  const entry = createRosterEntry(enemyId, enemyId, definition.moveIds);
  const run = addRosterEntry(encounter.run, { ...entry, level: scaling.level, evolutionStatGrants: bonus });
  return { run, squad: { ...encounter.squad, benchIds: [...encounter.squad.benchIds, enemyId] } };
}

/**
 * The finale (docs/run-loop.md §4): the five broken seals in the order they were broken,
 * then the Endbringer. Nothing is rolled — every champion is rebuilt verbatim from the
 * snapshot taken when the player beat it, so the fight escalates across itself and ends
 * on the one thing that was never scaled at all.
 *
 * The champions field UNSEALED (`unsealedIdFor`): the Ancient half was the seal, and the
 * player already took it (docs/lore.md §6).
 */
export function generateFinaleEncounter(
  brokenSeals: readonly BrokenSeal[],
  endbringerId: string,
  enemyPool: HeroLookup,
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
    run = addRosterEntry(run, { ...entry, level: seal.level, evolutionStatGrants: seal.statGrants });
    orderedIds.push(unsealedId);
  }

  const endbringer = enemyPool[endbringerId];
  if (endbringer) {
    const entry = createRosterEntry(endbringerId, endbringerId, endbringer.moveIds);
    run = addRosterEntry(run, { ...entry, level: endbringerScaling.level });
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

/** The `battle` node: the faction's leader always present plus 3 of its basics. No node-kind bonus; takes the act curve on the monsters track. */
export function generateLeaderEncounter(
  seed: number,
  basicIds: readonly string[],
  leaderId: string,
  enemyPool: HeroLookup,
  scaling: ActScaling = NO_SCALING
): Encounter {
  let rng = createRng(seed);
  const { picked: supportIds, nextState } = shuffledPick(rng, basicIds, 3);
  rng = nextState;
  const heroIds = [leaderId, ...supportIds];

  let run = createRunState(0);
  for (const heroId of heroIds) {
    const base = createRosterEntry(heroId, heroId, enemyPool[heroId].moveIds);
    const { bonus, nextState: afterBonus } = actStatBonus(rng, scaling.statSteps);
    rng = afterBonus;
    run = addRosterEntry(run, { ...base, level: scaling.level, evolutionStatGrants: bonus });
  }

  const squad = pickSquad(run.roster, heroIds);
  return { run, squad };
}
