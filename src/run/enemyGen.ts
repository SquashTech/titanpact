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

import type { StatKey } from '../engine/content';
import type { HeroLookup } from '../engine/state';
import { createRng, nextFloat, type RngState } from '../engine/rng/seededRng';
import type { RunState, RosterEntry } from './state';
import { createRunState, createRosterEntry, addRosterEntry } from './state';
import { MOVE_CAP } from './progression';
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
 * A weighting over an encounter's hero pool: fill `slots` of the encounter
 * from `preferredIds` first, then draw whatever is left from the whole pool.
 *
 * Deliberately generic. This module knows "prefer these ids for this many
 * slots" and nothing else — it is src/run/locations.ts that knows a Location
 * has a type affinity and turns it into one of these (docs/locations.md
 * "Weighting, not filtering"). Keeping the vocabulary generic here is what
 * lets a later biaser (an act-difficulty curve, a relic that seeds the enemy
 * pool) reuse the same seam without enemyGen growing a second concept.
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

/**
 * fight: 4 heroes, no bonus — same shape as the old fixed AI.
 * elite: 4 heroes, +10 to 2 random growth stats each.
 * boss: 2 heroes, no bench (a real no-cycling fight), +20 to 3 random growth stats each.
 *
 * `heroCountOverride` lets a caller shrink a `fight` node's roster below the
 * default 4 — used for the run's 2nd fight (App.tsx), which is deliberately
 * a lighter 2v2 breather between the row-0 opener and elites kicking in.
 *
 * `movepools` (heroId -> that hero's full movepool, src/run/progression.ts
 * fullMovepool) swaps the authored 3-move starting kit for MOVE_CAP moves
 * drawn at random from the whole pool. Quick Battle passes it so a throwaway
 * fight can exercise moves a hero would otherwise only reach several
 * levels in; real map nodes omit it and keep the authored kit. Any hero
 * missing from the lookup falls back to its starting kit.
 *
 * `bias` weights which heroes get drawn (PoolBias, above) — the current act's
 * Location supplies it for the recruitable-pool node types, so a Necropolis
 * Skirmish fields Spirit/Frost/Shadow heroes plus one wildcard. Omitted, the
 * pick is uniform over the whole pool exactly as before.
 */
export function generateEncounter(
  nodeType: EncounterNodeType,
  seed: number,
  heroPool: HeroLookup,
  heroCountOverride?: number,
  movepools?: Record<string, readonly string[]>,
  bias?: PoolBias
): Encounter {
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
    if (statCount > 0) {
      const { bonus, nextState } = randomStatBonus(rng, statCount, amountEach);
      rng = nextState;
      entry = { ...entry, evolutionStatGrants: bonus };
    }
    run = addRosterEntry(run, entry);
  }

  const squad = pickSquad(run.roster, heroIds);
  return { run, squad };
}

/**
 * The "Monsters" battle node (map row 4, next to Elite — docs/run-loop.md
 * §2 "battle") — Goblin Chief plus 3 random basic Goblins, per user
 * direction: the Chief is always present (not randomly drawn like
 * `generateEncounter` picks its whole roster), backed by 3 of the 5 basic
 * types (`enemies.ts` `BASIC_GOBLIN_IDS`). No stat bonus — the Chief's own
 * base stats and War Horn are what make this node a real threat, distinct
 * from `elite`'s flat stat-bonus mechanism.
 */
export function generateGoblinChiefEncounter(
  seed: number,
  basicGoblinIds: readonly string[],
  chiefId: string,
  enemyPool: HeroLookup
): Encounter {
  let rng = createRng(seed);
  const { picked: goblinIds, nextState } = shuffledPick(rng, basicGoblinIds, 3);
  rng = nextState;
  const heroIds = [chiefId, ...goblinIds];

  let run = createRunState(0);
  for (const heroId of heroIds) {
    const entry = createRosterEntry(heroId, heroId, enemyPool[heroId].moveIds);
    run = addRosterEntry(run, entry);
  }

  const squad = pickSquad(run.roster, heroIds);
  return { run, squad };
}
