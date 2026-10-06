// Casting a warband (data/warbands.ts, docs/cycles.md §3, Cycle IV): which bodies fill its slots,
// and the moves each is guaranteed. Seeded off the node, like every other enemy draw, so the fork's
// preview is still the fight. Two casts: a hero fight picks its heroes to fit a warband; a
// Guardian's escorts are drawn first and a warband is fitted to them.

import type { HeroDefinition } from '../engine/content';
import type { HeroLookup } from '../engine/state';
import { createRng, nextFloat, type RngState } from '../engine/rng/seededRng';
import { warbands, type WarbandDefinition } from '../data/warbands';
import { spawnPosition, SPAWN_TIERS } from '../data/titanspawn';
import type { Encounter } from './enemyGen';
import { MOVE_CAP, type ProgressionTable } from './progression';

/** bodyId -> the moves its slots guarantee it. */
export type WarbandCast = Map<string, string[]>;

/** The most slots one Guardian escort may carry: a body can hold a field and its reader, not a whole engine. */
const MAX_SLOTS_A_BODY = 2;

/**
 * Every move a body could field: a hero's kit and its level-up pool, or a Titanspawn's line at its
 * own tier and below — an Act 1 escort is never handed a Late move.
 */
export function learnableMoves(heroId: string, hero: HeroDefinition | undefined, table: ProgressionTable): ReadonlySet<string> {
  const position = spawnPosition(heroId);
  if (position) {
    const reached = SPAWN_TIERS.slice(0, SPAWN_TIERS.indexOf(position.tier) + 1);
    return new Set(reached.flatMap((tier) => position.line.moveIds[tier]));
  }
  return new Set([...(hero?.moveIds ?? []), ...(table.moveTiers[heroId] ?? [])]);
}

function shuffled<T>(items: readonly T[], rng: RngState): { items: T[]; rng: RngState } {
  const out = [...items];
  let state = rng;
  for (let i = out.length - 1; i > 0; i--) {
    const draw = nextFloat(state);
    state = draw.nextState;
    const j = Math.floor(draw.value * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return { items: out, rng: state };
}

function firstLearnable(slotMoves: readonly string[], learnable: ReadonlySet<string>): string | null {
  return slotMoves.find((id) => learnable.has(id)) ?? null;
}

/** A warband cast from candidates, one distinct body a slot, in the seeded order; null if any slot goes unfilled. */
function castFrom(warband: WarbandDefinition, candidates: readonly string[], learnable: (id: string) => ReadonlySet<string>): WarbandCast | null {
  const cast: WarbandCast = new Map();
  for (const slot of warband.slots) {
    const body = candidates.find((id) => !cast.has(id) && firstLearnable(slot.moveIds, learnable(id)) !== null);
    if (!body) return null;
    cast.set(body, [firstLearnable(slot.moveIds, learnable(body))!]);
  }
  return cast;
}

/**
 * A hero fight's warband: the first, in seeded order, whose slots `candidates` can fill — at most
 * `maxBodies` slots, so a 2v2 never draws a three-slot engine — or null, and the fight is drawn as
 * before. Candidates are the run's deck, so a recruitable fight still fields deck heroes.
 */
export function castHeroWarband(
  seed: number,
  candidates: readonly string[],
  maxBodies: number,
  learnable: (id: string) => ReadonlySet<string>
): { warband: WarbandDefinition; cast: WarbandCast } | null {
  const order = shuffled(Object.values(warbands), createRng(seed));
  const bodies = shuffled(candidates, order.rng).items;
  for (const warband of order.items) {
    if (warband.slots.length > maxBodies) continue;
    const cast = castFrom(warband, bodies, learnable);
    if (cast) return { warband, cast };
  }
  return null;
}

/**
 * A Guardian's escorts, already drawn, fitted to a warband: each slot to a body whose line can
 * field one of its moves, a body taking up to two. The warband filling the most slots wins (two at
 * least, or it is no engine); seeded order breaks ties.
 */
export function castEscortWarband(seed: number, bodies: readonly string[], learnable: (id: string) => ReadonlySet<string>): { warband: WarbandDefinition; cast: WarbandCast } | null {
  let best: { warband: WarbandDefinition; cast: WarbandCast; filled: number } | null = null;
  for (const warband of shuffled(Object.values(warbands), createRng(seed)).items) {
    const cast: WarbandCast = new Map();
    let filled = 0;
    for (const slot of warband.slots) {
      // The emptiest body that can take the slot, so the engine spreads across the escorts.
      const body = [...bodies]
        .filter((id) => (cast.get(id)?.length ?? 0) < MAX_SLOTS_A_BODY)
        .map((id) => ({ id, move: firstLearnable(slot.moveIds, learnable(id)) }))
        .filter((c) => c.move !== null && !cast.get(c.id)?.includes(c.move))
        .sort((a, b) => (cast.get(a.id)?.length ?? 0) - (cast.get(b.id)?.length ?? 0))[0];
      if (!body) continue;
      cast.set(body.id, [...(cast.get(body.id) ?? []), body.move!]);
      filled++;
    }
    if (filled >= 2 && (!best || filled > best.filled)) best = { warband, cast, filled };
  }
  return best && { warband: best.warband, cast: best.cast };
}

/**
 * The cast's moves into its bodies' kits: learned outright below MOVE_CAP, at it in place of the
 * last move the cast does not guarantee. Keyed by roster id (a hero enemy's is its hero id).
 */
export function forceWarbandMoves(encounter: Encounter, cast: WarbandCast): Encounter {
  const roster = encounter.run.roster.map((entry) => {
    const forced = cast.get(entry.rosterId);
    if (!forced) return entry;
    let kit = [...entry.unlockedMoveIds];
    for (const moveId of forced) {
      if (kit.includes(moveId)) continue;
      if (kit.length < MOVE_CAP) kit.push(moveId);
      else {
        const slot = kit.map((id, i) => ({ id, i })).reverse().find(({ id }) => !forced.includes(id));
        if (slot) kit = kit.map((id, i) => (i === slot.i ? moveId : id));
      }
    }
    return { ...entry, unlockedMoveIds: kit, offeredMoveIds: [...new Set([...entry.offeredMoveIds, ...forced])] };
  });
  return { ...encounter, run: { ...encounter.run, roster } };
}

export function learnableIn(pool: HeroLookup, table: ProgressionTable): (id: string) => ReadonlySet<string> {
  const cache = new Map<string, ReadonlySet<string>>();
  return (id) => {
    let set = cache.get(id);
    if (!set) cache.set(id, (set = learnableMoves(id, pool[id], table)));
    return set;
  };
}
