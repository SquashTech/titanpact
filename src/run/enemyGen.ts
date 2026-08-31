// Seeded AI encounter generation for map fight/elite/boss nodes
// (docs/run-loop.md). Replaces the single fixed AI roster the pre-map
// playable slice used (FightScreen.tsx's old AI_RUN/AI_SQUAD constants) with
// a per-node roster drawn from the same fixture hero pool.
//
// Difficulty scaling reuses RosterEntry.evolutionStatGrants (src/run/state.ts) —
// the exact field Evolution paths already write to — rather than inventing
// a second stat-bonus mechanism. "Boss = existing fixture heroes, scaled up"
// per docs/run-loop.md's boss-content decision: no new Ancient content here,
// just 2 heroes (no bench — a real no-cycling fight) with a bigger bonus.
//
// TWO INDEPENDENT DIFFICULTY AXES, as of the per-act curve (2026-08-30):
//   1. Node KIND — fight/elite/boss, the fixed bonuses below. "How hard is
//      this fight relative to the others in its act."
//   2. ACT — src/run/difficulty.ts's `ActScaling`, applied on top. "How deep
//      in the run is this act." Passed in by the caller, never derived here;
//      this module knows how to APPLY a scaling, not which one an encounter
//      deserves. That's what keeps a later hand-authored encounter able to
//      hand over its own numbers through the same seam.

import type { StatKey } from '../engine/content';
import type { HeroLookup } from '../engine/state';
import { createRng, nextFloat, type RngState } from '../engine/rng/seededRng';
import type { RunState, RosterEntry } from './state';
import { createRunState, createRosterEntry, addRosterEntry } from './state';
import { MOVE_CAP, availableEvolution, chooseEvolutionPath, levelUpMovePool, type ProgressionTable } from './progression';
// The one place this module reaches for content rather than taking it as a
// parameter (`heroPool`, `table`): levelUpMovePool now gates by a move's
// authored tier, and unlike the hero pool there is exactly one move table in
// the game — nothing substitutes it, including the tests. Same precedent as
// src/run/statusTestFight.ts.
import { moves } from '../data/moves';
import { mergeStatMods } from './statMods';
import { NO_SCALING, ACT_STEP_STAT_COUNT, ACT_STEP_AMOUNT, type ActScaling } from './difficulty';
import type { Squad } from './squad';
import { pickSquad } from './squad';

export type EncounterNodeType = 'fight' | 'elite' | 'boss';

const GROWTH_STATS: readonly StatKey[] = ['hp', 'attack', 'defense', 'intelligence', 'wisdom', 'speed'];

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

/** Picks `statCount` distinct growth stats and grants `amountEach` to each — always a multiple of 5/10 (CLAUDE.md "Stat modifiers"). */
function randomStatBonus(rng: RngState, statCount: number, amountEach: number): { bonus: Partial<Record<StatKey, number>>; nextState: RngState } {
  const { picked, nextState } = shuffledPick(rng, GROWTH_STATS, statCount);
  const bonus: Partial<Record<StatKey, number>> = {};
  for (const stat of picked) bonus[stat] = amountEach;
  return { bonus, nextState };
}

/**
 * The act curve's contribution: `statSteps` INDEPENDENT rolls of
 * (ACT_STEP_STAT_COUNT stats at +ACT_STEP_AMOUNT), merged. Rolling each step
 * separately rather than multiplying one roll's amounts is what keeps a
 * 4-step Act 5 enemy's line broad instead of dumping +40 into a single stat
 * (see difficulty.ts's note on the same).
 */
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

/**
 * A weighting over an encounter's hero pool: fill `slots` of the encounter
 * from `preferredIds` first, then draw whatever is left from the whole pool.
 *
 * Deliberately generic. This module knows "prefer these ids for this many
 * slots" and nothing else — it is src/run/locations.ts that knows a Location
 * has a type affinity and turns it into one of these (docs/locations.md
 * "Weighting, not filtering"). Keeping the vocabulary generic here is what
 * lets a later biaser (a relic that seeds the enemy pool, an authored
 * encounter's fixed cast) reuse the same seam without enemyGen growing a
 * second concept.
 */
export interface PoolBias {
  preferredIds: readonly string[];
  /** How many of the encounter's slots to fill from `preferredIds`. Clamped to the encounter size and to how many preferred ids actually exist in the pool. */
  slots: number;
}

/**
 * `shuffledPick` over the whole pool, or — with a bias — a two-stage pick:
 * the preferred ids first, then the remainder from everything not already
 * taken. Threads the RNG through both stages so the result stays a pure
 * function of the seed.
 */
function biasedPick(
  rng: RngState,
  heroPool: HeroLookup,
  heroCount: number,
  bias: PoolBias | undefined
): { picked: string[]; nextState: RngState } {
  const allIds = Object.keys(heroPool);
  if (!bias || bias.slots <= 0) return shuffledPick(rng, allIds, heroCount);

  const preferred = bias.preferredIds.filter((id) => id in heroPool);
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
   * Shrinks (or grows) the roster past the node kind's default — used for
   * the run's 2nd fight (App.tsx), a deliberately lighter 2v2 breather
   * between the row-0 opener and elites kicking in, and for the row-0
   * opener's own 2-Goblin cast.
   */
  heroCount?: number;
  /**
   * heroId -> that hero's full movepool (src/run/progression.ts
   * `fullMovepool`). Swaps the authored 3-move starting kit for MOVE_CAP
   * moves drawn at random from the whole pool. Quick Battle passes it so a
   * throwaway fight can exercise moves a hero would otherwise only reach
   * several levels in; real map nodes omit it and keep the authored kit
   * (grown by `scaling.level`'s move unlocks instead). Any hero missing from
   * the lookup falls back to its starting kit.
   */
  movepools?: Record<string, readonly string[]>;
  /**
   * Weights which heroes get drawn (`PoolBias`) — the current act's Location
   * supplies it for the recruitable-pool node types, so a Necropolis
   * Skirmish fields Spirit/Frost/Shadow heroes plus one wildcard. Omitted,
   * the pick is uniform over the whole pool.
   */
  bias?: PoolBias;
  /**
   * The act curve (src/run/difficulty.ts `actScaling`). Omitted = authored
   * content exactly as written at level 1, which is what Quick Battle and
   * the tests want.
   */
  scaling?: ActScaling;
  /**
   * Needed only to cash `scaling.level` in for the two things a level buys:
   * Evolution paths (at/above EVOLUTION_LEVEL) and move unlocks toward
   * MOVE_CAP. Omitted, or missing an entry for a given hero, and the enemy
   * simply arrives at that level with its starting kit and no Evolution —
   * which is exactly right for the non-recruitable monster pool, whose
   * content has no progression data by design.
   */
  progression?: ProgressionTable;
}

/**
 * Cashes a scaled enemy's level in for progression, in the same order a
 * player's hero would earn it: Evolutions first (the level-up that reaches
 * EVOLUTION_LEVEL surfaces the Evolution *instead of* a move — CLAUDE.md), then
 * the remaining level-ups spent on random moves from the hero's level-up pool
 * up to MOVE_CAP.
 *
 * A path is chosen at random with no weighting. Picking the path that best
 * fits the hero (or the one that most threatens the player's squad) is the
 * obvious later refinement and the natural place for authored encounters to
 * take over — deliberately not attempted here, since "which path suits which
 * hero" is authored design, not something to guess in a generator.
 */
function applyLevelProgression(
  run: RunState,
  rosterId: string,
  table: ProgressionTable,
  heroPool: HeroLookup,
  level: number,
  rng: RngState
): { run: RunState; nextState: RngState } {
  let state = rng;
  let next = run;
  let levelUpsSpent = 0;

  // Bounded by the authored node count; `availableEvolution` returns null
  // once every node has been resolved, so this is a `while` with a belt.
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
      // A path this hero can't legally take (e.g. a type-graft on a hero that
      // is already dual-typed) — skip the Evolution rather than crash an
      // encounter. Content bug, not a runtime one; the fight still fields a
      // valid enemy.
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
    levelUpMovePool(table, moves, entry),
    Math.min(moveLevelUps, room)
  );
  state = afterMoves;
  if (learned.length > 0) {
    next = {
      ...next,
      roster: next.roster.map((r) => (r.rosterId === rosterId ? { ...r, unlockedMoveIds: [...r.unlockedMoveIds, ...learned] } : r)),
    };
  }
  return { run: next, nextState: state };
}

/**
 * fight: 4 heroes, no kind bonus — same shape as the old fixed AI.
 * elite: 4 heroes, +10 to 2 random growth stats each.
 * boss: 2 heroes, no bench (a real no-cycling fight), +20 to 3 random growth stats each.
 *
 * `options.scaling` then layers the act curve on top of all three: +30 more
 * stat total per act-step, an act-appropriate level, and — with
 * `options.progression` supplied and a level at/above EVOLUTION_LEVEL — the
 * Evolution and extra moves that level buys.
 *
 * NOTE, second-order and worth watching: everything the act curve grants
 * lands on the same `RosterEntry` fields a Recruit Contract carries over
 * (recruitment.ts `deriveContractOffer` — level, chosenPathIds,
 * evolutionStatGrants, unlockedMoveIds). So claiming a beaten Act 4 enemy
 * hands the player a level-7, already-evolved hero carrying ~90 points of act
 * scaling. That is the existing behaviour amplified, not a new rule — elite's
 * +20 already rode along the same way — and it reads as the intended shape of
 * "recruiting them gets them at the same level". But it does make late-act
 * contracts dramatically stronger than early-act ones, which is a balance
 * question for playtest, not a settled decision. If it needs undoing, the
 * knob is `deriveContractOffer`, not this module.
 */
export function generateEncounter(
  nodeType: EncounterNodeType,
  seed: number,
  heroPool: HeroLookup,
  options: EncounterOptions = {}
): Encounter {
  const { heroCount: heroCountOverride, movepools, bias, scaling = NO_SCALING, progression } = options;
  let rng = createRng(seed);
  const heroCount = heroCountOverride ?? (nodeType === 'boss' ? 2 : 4);
  const [statCount, amountEach] = nodeType === 'boss' ? [3, 20] : nodeType === 'elite' ? [2, 10] : [0, 0];

  const { picked: heroIds, nextState: afterPick } = biasedPick(rng, heroPool, heroCount, bias);
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

    let statGrants: Partial<Record<StatKey, number>> = {};
    if (statCount > 0) {
      const { bonus, nextState } = randomStatBonus(rng, statCount, amountEach);
      rng = nextState;
      statGrants = bonus;
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
      const { run: next, nextState } = applyLevelProgression(run, heroId, progression, heroPool, scaling.level, rng);
      run = next;
      rng = nextState;
    }
  }

  const squad = pickSquad(run.roster, heroIds);
  return { run, squad };
}

/**
 * The "Monsters" battle node (map row 4, next to Elite — docs/run-loop.md
 * §2 "battle") — Goblin Chief plus 3 random basic Goblins, per user
 * direction: the Chief is always present (not randomly drawn like
 * `generateEncounter` picks its whole roster), backed by 3 of the 5 basic
 * types (`enemies.ts` `BASIC_GOBLIN_IDS`). No node-kind stat bonus — the
 * Chief's own base stats and its Beast kit are what make this node a real
 * threat, distinct from `elite`'s flat stat-bonus mechanism.
 *
 * It does take the act curve, on the same `monsters` track as the row-0
 * opener: this is monster content, and the whole point of the curve is that
 * an Act 5 Goblin Chief is not an Act 2 Goblin Chief.
 */
export function generateGoblinChiefEncounter(
  seed: number,
  basicGoblinIds: readonly string[],
  chiefId: string,
  enemyPool: HeroLookup,
  scaling: ActScaling = NO_SCALING
): Encounter {
  let rng = createRng(seed);
  const { picked: goblinIds, nextState } = shuffledPick(rng, basicGoblinIds, 3);
  rng = nextState;
  const heroIds = [chiefId, ...goblinIds];

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
