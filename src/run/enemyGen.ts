// Seeded AI encounter generation for map fight/elite/boss nodes
// (docs/run-loop.md). Replaces the single fixed AI roster the pre-map
// playable slice used (FightScreen.tsx's old AI_RUN/AI_SQUAD constants) with
// a per-node roster drawn from the same fixture hero pool.
//
// Difficulty scaling reuses RosterEntry.rankStatGrants (src/run/state.ts) —
// the exact field rank-up branches already write to — rather than inventing
// a second stat-bonus mechanism. "Boss = existing fixture heroes, scaled up"
// per docs/run-loop.md's boss-content decision: no new Ancient content here,
// just 2 heroes (no bench — a real no-cycling fight) with a bigger bonus.

import type { StatKey } from '../engine/content';
import type { HeroLookup } from '../engine/state';
import { createRng, nextFloat, type RngState } from '../engine/rng/seededRng';
import type { RunState, RosterEntry } from './state';
import { createRunState, createRosterEntry, addRosterEntry } from './state';
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

export interface Encounter {
  run: RunState;
  squad: Squad;
}

/**
 * fight: 4 heroes, no bonus — same shape as the old fixed AI.
 * elite: 4 heroes, +10 to 2 random growth stats each.
 * boss: 2 heroes, no bench (a real no-cycling fight), +20 to 3 random growth stats each.
 */
export function generateEncounter(nodeType: EncounterNodeType, seed: number, heroPool: HeroLookup): Encounter {
  let rng = createRng(seed);
  const heroCount = nodeType === 'boss' ? 2 : 4;
  const [statCount, amountEach] = nodeType === 'boss' ? [3, 20] : nodeType === 'elite' ? [2, 10] : [0, 0];

  const { picked: heroIds, nextState: afterPick } = shuffledPick(rng, Object.keys(heroPool), heroCount);
  rng = afterPick;

  let run = createRunState(0);
  for (const heroId of heroIds) {
    let entry: RosterEntry = createRosterEntry(heroId, heroId, heroPool[heroId].moveIds);
    if (statCount > 0) {
      const { bonus, nextState } = randomStatBonus(rng, statCount, amountEach);
      rng = nextState;
      entry = { ...entry, rankStatGrants: bonus };
    }
    run = addRosterEntry(run, entry);
  }

  const squad = pickSquad(run.roster, heroIds);
  return { run, squad };
}
