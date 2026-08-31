// The pooled level-up currency (docs/progression.md "The level-up currency
// (pooled, freely distributed)"; docs/leveling-and-ranks.md is the
// authoritative spec for the mechanic below — this module implements it).
// Each Training Point spent on a hero does exactly one thing — level them up
// — and a level-up always does one of two things as a consequence: below
// EVOLUTION_LEVEL it offers a random move from the hero's remaining pool;
// AT EVOLUTION_LEVEL it instead surfaces the hero's Evolution — no move is
// rolled that level-up (docs/leveling-and-ranks.md "Evolution replaces that
// level-up's move offer"). Concrete pool/path CONTENT (which moves, which
// paths, which stat grants) is fixture data in src/data/progression.ts,
// authored for a subset of the roster only — see the SCOPE NOTE there. This
// module only implements the generic mechanism.

import type { HeroDefinition, MoveDefinition, MoveTier, PassiveId, StatKey, TypeId } from '../engine/content';
import { isValidFlatStatGrant } from '../engine/content';
import type { HeroLookup } from '../engine/state';
import type { RosterEntry, RunState } from './state';
import { mergeStatMods } from './statMods';

/** A hero holds at most 4 moves (docs/leveling-and-ranks.md "The four-move cap"). Past the cap, growth is substitution, never expansion. */
export const MOVE_CAP = 4;

/**
 * The flat, uniform hero level at which every hero's (single, for now)
 * Evolution becomes available (docs/leveling-and-ranks.md "Trigger").
 * CLAUDE.md's variable evolution depth (Capstone = 0, Single = 1, Deep line
 * = 2+) is the eventual per-hero-authored design; this constant is the
 * current scoped-down implementation of the "Single" shape applied
 * uniformly across the whole roster. A per-hero-authored trigger level (and
 * multiple ordered Evolutions for deep-line heroes) is deferred, not
 * abandoned — see leveling-and-ranks.md's scope note.
 */
export const EVOLUTION_LEVEL = 5;

/**
 * The hero level at which each move tier (engine/content.ts MoveTier, the
 * designer table's `Early / Mid / Late` column) becomes offerable on
 * level-up. 2026-08-31 designer call: "only Early moves offered from levels
 * 1-4, Mid from 4-7, Late 7+".
 *
 * Read CUMULATIVELY — reaching a tier's level ADDS it to what can be
 * offered, it does not close the tier below (see levelUpMovePool). A hero at
 * level 8 draws from all three. The alternative, exclusive windows, makes a
 * move the hero simply never rolled permanently unreachable and can leave a
 * pool empty at exactly the level the player is feeding it points.
 *
 * Placeholder numbers, in CLAUDE.md's sense: the SHAPE (three tiers, gated by
 * level, cumulative) is the decision; 1/4/7 is a first-pass curve for
 * playtest. Note it straddles EVOLUTION_LEVEL — a hero unlocks Mid one level
 * before it evolves and Late two after — so a run that spends points evenly
 * across four heroes reaches Late only in the back half.
 */
export const MOVE_TIER_LEVEL: Record<MoveTier, number> = {
  early: 1,
  mid: 4,
  late: 7,
};

/**
 * Whether a move is offerable to a hero at `level`. A move with no authored
 * `tier` counts as Early (engine/content.ts MoveDefinition.tier) — ungated,
 * which is what every move was before the field existed, so an untiered slate
 * behaves exactly as it did.
 */
export function isMoveTierUnlocked(move: MoveDefinition | undefined, level: number): boolean {
  return level >= MOVE_TIER_LEVEL[move?.tier ?? 'early'];
}

/**
 * The last level whose level-up pays out a MOVE. Past it a Training Point
 * spent on a hero buys a stat instead (grantMasteryStat below).
 *
 * This is a deliberate, designer-signed amendment (2026-08-31) to CLAUDE.md's
 * "level-ups never directly raise stats" / "no automatic stat growth from
 * leveling" — recorded there as an exemption rather than left as a silent
 * contradiction. The reason for the amendment: the pooled currency had no
 * sink once a hero's movepool ran out, so a player who wanted to hyperfocus
 * one hero was simply told no. The reason for the CAP still existing: moves
 * are the interesting payoff, so stats only take over once the authored
 * movepool has actually been spent, not as a competing choice alongside it.
 *
 * 10 is the level the move pools are authored to reach
 * (data/progression.ts FLOOR, test/moveTiers.test.ts), so the two numbers are
 * the same decision seen from both sides — move the floor and this moves with
 * it.
 */
export const MASTERY_LEVEL = 10;

/** Flat grant per mastery level-up. A multiple of 10, so CLAUDE.md's multiples-of-5/10 lock binds here with no exemption. */
export const MASTERY_STAT_AMOUNT = 10;

/**
 * The stats a mastery level-up can roll. The five COMBAT stats, deliberately
 * NOT all eight of StatKey — the same call, for the same reason, that
 * data/moves.ts RANDOM_STAT_POOL made on 2026-08-30: a flat +10 is worth
 * wildly different amounts across the eight. +10 MP Regen is the whole
 * Everflow banner and +10 HP on a 130-HP body is noise, so a reel including
 * them would be four fair faces, one jackpot and two blanks.
 *
 * Duplicated rather than imported from data/moves.ts on purpose: this module
 * takes its content by injection (see levelUpMovePool's `moves` parameter)
 * and never imports the content layer, and the two reels are independently
 * authorable — a later slate re-pointing the move reel should not silently
 * re-point the progression one.
 */
export const MASTERY_STAT_POOL: readonly StatKey[] = ['attack', 'defense', 'intelligence', 'wisdom', 'speed'];

/** Whether a stat may be rolled/granted by a mastery level-up. Exported so a UI can filter before offering rather than catching a throw. */
export function isValidMasteryStat(stat: StatKey): boolean {
  return MASTERY_STAT_POOL.includes(stat);
}

/**
 * What a level-up actually pays out, read off the POST-level-up entry (the
 * one `levelUpHero` returned) for the same reason `levelUpMovePool` is: the
 * level just reached is what decides the answer.
 *
 * One function so every caller agrees. The order is the precedence:
 *
 * - `evolution` — the level-up that reaches an Evolution's trigger level
 *   surfaces the choice and rolls no move (CLAUDE.md, docs/leveling-and-ranks.md).
 * - `move` — the ordinary case, all the way through MASTERY_LEVEL.
 * - `mastery` — past MASTERY_LEVEL, or (as a safety net) any level whose move
 *   pool has come up empty. That second clause is what makes "the point bought
 *   nothing" unreachable: the authored floor is supposed to keep the pool full
 *   through level 10, and this catches it if a future slate edit ever breaks
 *   that. A stat is a worse payoff than a move, not a dud.
 */
export type LevelUpPayout = 'evolution' | 'move' | 'mastery';

export function levelUpPayout(
  table: ProgressionTable,
  moves: Record<string, MoveDefinition>,
  entry: RosterEntry
): LevelUpPayout {
  if (availableEvolution(table, entry)) return 'evolution';
  if (entry.level > MASTERY_LEVEL) return 'mastery';
  return levelUpMovePool(table, moves, entry).length > 0 ? 'move' : 'mastery';
}

export interface EvolutionPath {
  id: string;
  heroId: string;
  /**
   * Paths "differ in kind, not degree" (docs/progression.md) — this label
   * is documentation of that intent, not a mechanical multiplier or type.
   */
  kind: 'defensive' | 'offensive' | 'utility';
  /** Single identifiable name (docs/leveling-and-ranks.md), e.g. "Explosive", "Ironclad", "Thunderblaze". */
  name: string;
  /** One-line flavor/mechanical summary shown on the Evolution choice screen so the player can judge the three paths on more than just their name. */
  description?: string;
  statGrants: Partial<Record<StatKey, number>>;
  unlocksMoveIds: string[];
  /**
   * Optional secondary-type grant/shift (docs/progression.md "Type-graft
   * paths"). Only legal when the hero is mono-type by design — enforced in
   * chooseEvolutionPath, not just by authoring convention. A later path's
   * typeGraft overwrites (shifts) any earlier one; it's not additive.
   */
  typeGraft?: TypeId;
  /** Passives (engine/content.ts PassiveDefinition, src/data/passives.ts) this path grants permanently once chosen — e.g. Lucius's Sanguine path. Optional/omitted for a plain stat-grant path. */
  grantsPassiveIds?: readonly PassiveId[];
}

export interface EvolutionNode {
  /** Hero level at which this path choice becomes available. Currently always EVOLUTION_LEVEL for every hero. */
  level: number;
  /** Exactly three paths, differing in kind (CLAUDE.md "the player is presented with a choice of three options"). */
  paths: EvolutionPath[];
}

export interface ProgressionTable {
  /** heroId -> pool of moves that can be randomly offered on level-up, beyond the hero's starting kit. */
  moveTiers: Record<string, string[]>;
  /** heroId -> ordered Evolution nodes (docs/leveling-and-ranks.md Part 2). Currently exactly one node per hero, at EVOLUTION_LEVEL. */
  evolutions: Record<string, EvolutionNode[]>;
}

export class ProgressionError extends Error {}

function requireEntry(run: RunState, rosterId: string): RosterEntry {
  const entry = run.roster.find((r) => r.rosterId === rosterId);
  if (!entry) throw new ProgressionError(`${rosterId} is not on the roster`);
  return entry;
}

function replaceEntry(run: RunState, rosterId: string, next: RosterEntry, spend: number): RunState {
  return {
    ...run,
    levelUpPool: run.levelUpPool - spend,
    roster: run.roster.map((r) => (r.rosterId === rosterId ? next : r)),
  };
}

/**
 * A hero's ENTIRE movepool: the authored starting kit
 * (HeroDefinition.moveIds) followed by everything the level-up table can
 * ever offer them, deduped. Leveling itself never needs this — it walks the
 * two halves separately (levelUpMovePool above filters the table pool against
 * what is already unlocked AND against the hero's level). Deliberately NOT
 * tier-gated: a caller asking for the whole surface is asking past the level
 * curve, which is exactly what Quick Battle wants — a random MOVE_CAP loadout
 * so a test fight can exercise moves a hero would only reach several levels in.
 */
export function fullMovepool(table: ProgressionTable, hero: HeroDefinition): string[] {
  return [...new Set([...hero.moveIds, ...(table.moveTiers[hero.id] ?? [])])];
}

/**
 * The moves still available to offer this hero on level-up: the table's pool,
 * minus whatever is already unlocked, minus every move whose tier the hero's
 * LEVEL has not reached yet (MOVE_TIER_LEVEL above).
 *
 * The level read is `entry.level` — the level the hero currently HAS — so a
 * caller resolving a level-up's move offer must pass the entry it got back
 * from `levelUpHero`, not the one it went in with, or the level-up that
 * reaches 4 will still be offered an Early-only pool. LevelUpScreen does this;
 * so does enemyGen, which only ever calls this at an enemy's final level.
 *
 * Can return empty as a MECHANISM, and the screen renders that as the "Level
 * only" payoff — but no hero is allowed to reach it in normal play up to
 * level 10. A spent Training Point must always buy a move offer (2026-08-31
 * designer call); the pools in data/progression.ts are sized to guarantee it
 * and test/moveTiers.test.ts pins the thresholds. Treat a "Level only" card
 * on a real run as a data bug, not as the gate working.
 */
export function levelUpMovePool(
  table: ProgressionTable,
  moves: Record<string, MoveDefinition>,
  entry: RosterEntry
): string[] {
  const pool = table.moveTiers[entry.heroId] ?? [];
  return pool.filter((id) => !entry.unlockedMoveIds.includes(id) && isMoveTierUnlocked(moves[id], entry.level));
}

/**
 * Spends one pooled Training Point leveling up a hero
 * (docs/leveling-and-ranks.md, CLAUDE.md "Each Training Point levels up a
 * hero"): increments level by one. Does not touch the movepool itself — the
 * caller checks availableEvolution() against the new level first: if an
 * Evolution just became available, no move is rolled this level-up at all
 * (grantLevelUpMove is simply never called); otherwise the caller resolves
 * the random move offer (rolling from levelUpMovePool, and asking the
 * player to accept a replacement or decline if the hero is already at
 * MOVE_CAP) and applies it separately via grantLevelUpMove, since that's a
 * player decision rather than a mechanical consequence of spending the point.
 */
export function levelUpHero(run: RunState, rosterId: string): RunState {
  const entry = requireEntry(run, rosterId);
  if (run.levelUpPool < 1) throw new ProgressionError('Not enough training points');

  return replaceEntry(run, rosterId, { ...entry, level: entry.level + 1 }, 1);
}

/**
 * Applies a level-up's move offer to a roster entry: adds `moveId` outright
 * if there's room under MOVE_CAP, or swaps it in for `replaceMoveId` if the
 * hero is already at the cap and the player accepted the replacement. Free —
 * the point was already spent via levelUpHero; this only resolves what that
 * level-up's move offer turned into (accept, swap, or the caller simply never
 * calls this at all if the player declined, or if the level-up triggered an
 * Evolution instead of a move offer).
 */
export function grantLevelUpMove(run: RunState, rosterId: string, moveId: string, replaceMoveId?: string): RunState {
  const entry = requireEntry(run, rosterId);
  if (replaceMoveId && !entry.unlockedMoveIds.includes(replaceMoveId)) {
    throw new ProgressionError(`${replaceMoveId} is not currently unlocked on ${rosterId}`);
  }
  const unlockedMoveIds = replaceMoveId
    ? entry.unlockedMoveIds.map((id) => (id === replaceMoveId ? moveId : id))
    : [...entry.unlockedMoveIds, moveId];
  return replaceEntry(run, rosterId, { ...entry, unlockedMoveIds }, 0);
}

/**
 * Applies a mastery level-up's payout: a flat +MASTERY_STAT_AMOUNT to `stat`,
 * accumulated on the entry's `masteryStatGrants` (state.ts) and permanent for
 * the rest of the run. Free, exactly like grantLevelUpMove — the Training
 * Point was already spent by levelUpHero; this only resolves what that
 * level-up turned into.
 *
 * The ROLL is the caller's, not this function's, matching how the move offer
 * already works (LevelUpScreen rolls the move id and passes it in). That keeps
 * this module pure and makes the grant replayable from a recorded choice; it
 * also means a future deterministic caller can feed it a seeded roll without
 * this module needing an RngState it has no other use for.
 *
 * Rejects a stat outside MASTERY_STAT_POOL rather than trusting the caller —
 * the whole point of the restricted reel is that +10 MP Regen is not a
 * comparable prize, and an unchecked caller would quietly reintroduce it.
 */
export function grantMasteryStat(run: RunState, rosterId: string, stat: StatKey): RunState {
  const entry = requireEntry(run, rosterId);
  if (!isValidMasteryStat(stat)) {
    throw new ProgressionError(`${stat} is not a mastery stat`);
  }
  const nextEntry: RosterEntry = {
    ...entry,
    masteryStatGrants: mergeStatMods(entry.masteryStatGrants, { [stat]: MASTERY_STAT_AMOUNT }),
  };
  return replaceEntry(run, rosterId, nextEntry, 0);
}

/**
 * The next Evolution node a roster entry is working toward — the first one
 * it has not yet chosen a path from — regardless of whether its trigger
 * level has been reached. Null once every authored node has been resolved
 * (or for a hero with no authored Evolution at all).
 *
 * Distinct from availableEvolution below, which is the *gate*: it answers
 * "may this hero evolve right now". This one answers "where is this hero
 * headed", which is what a UI showing progress toward Evolution needs —
 * LevelUpScreen's rank track draws its denominator from `node.level`.
 */
export function pendingEvolution(table: ProgressionTable, entry: RosterEntry): EvolutionNode | null {
  const nodes = table.evolutions[entry.heroId] ?? [];
  return nodes[entry.chosenPathIds.length] ?? null;
}

/** The Evolution node currently on offer for a roster entry, or null if none is available yet (or it's already been chosen). */
export function availableEvolution(table: ProgressionTable, entry: RosterEntry): EvolutionNode | null {
  const node = pendingEvolution(table, entry);
  if (!node) return null;
  return entry.level >= node.level ? node : null;
}

/**
 * A roster entry's current types for display purposes outside combat:
 * innate hero types plus the current type-graft grant, if any (mirrors
 * engine/state.ts effectiveTypes, but works from a RosterEntry directly
 * since there's no Combatant to read from until a fight is actually built).
 * UI screens that show a roster entry's types (previews, roster management,
 * squad select, training) should call this instead of reading
 * `hero.types` directly, or a grafted secondary type silently fails to
 * appear anywhere outside combat.
 */
export function rosterEntryTypes(hero: HeroDefinition, entry: RosterEntry): readonly TypeId[] {
  return entry.evolutionTypeGraft ? [...hero.types, entry.evolutionTypeGraft] : hero.types;
}

/** The Evolution path(s) a roster entry has already chosen, resolved back to their full data (name/description/grants) — for read-only display (stat blocks) after the choice was made, as opposed to availableEvolution's still-being-offered node. */
export function chosenEvolutionPaths(table: ProgressionTable, entry: RosterEntry): EvolutionPath[] {
  const allPaths = (table.evolutions[entry.heroId] ?? []).flatMap((node) => node.paths);
  return entry.chosenPathIds
    .map((id) => allPaths.find((p) => p.id === id))
    .filter((p): p is EvolutionPath => p !== undefined);
}

/**
 * Applies a chosen Evolution path: grants permanent stats (validated as
 * multiples of 5/10, CLAUDE.md "Stat modifiers are flat additive integers,
 * multiples of 5 or 10"), unlocks its moves, and grafts/shifts the secondary
 * type slot if the path carries a typeGraft (docs/progression.md
 * "Type-graft paths") — a later graft overwrites an earlier one rather than
 * stacking. Free — spending the points to reach the trigger level already
 * cost the pool; choosing the path itself is not a second charge. Requires
 * the hero lookup solely to validate a type-graft against the hero's innate
 * types, which are never themselves modified.
 */
export function chooseEvolutionPath(
  run: RunState,
  table: ProgressionTable,
  heroes: HeroLookup,
  rosterId: string,
  pathId: string
): RunState {
  const entry = requireEntry(run, rosterId);
  const node = availableEvolution(table, entry);
  if (!node) throw new ProgressionError(`No Evolution is currently available for ${rosterId}`);
  const path = node.paths.find((p) => p.id === pathId);
  if (!path) throw new ProgressionError(`${pathId} is not one of the offered paths`);
  for (const amount of Object.values(path.statGrants)) {
    if (amount !== undefined && !isValidFlatStatGrant(amount)) {
      throw new ProgressionError(`Evolution stat grant ${amount} must be a multiple of 5 or 10`);
    }
  }

  let evolutionTypeGraft = entry.evolutionTypeGraft;
  if (path.typeGraft) {
    const hero = heroes[entry.heroId];
    if (!hero) throw new ProgressionError(`Unknown hero ${entry.heroId}`);
    if (hero.types.length !== 1) {
      throw new ProgressionError(`${entry.heroId} is already dual-typed — a type-graft path cannot be offered`);
    }
    if (hero.types.includes(path.typeGraft)) {
      throw new ProgressionError(`Type-graft ${path.typeGraft} duplicates ${entry.heroId}'s innate type`);
    }
    // A later graft path SHIFTS the secondary type slot rather than stacking
    // a third type (docs/progression.md "Type-graft paths", 2026-08-15): it
    // simply overwrites whatever was grafted before, if anything.
    evolutionTypeGraft = path.typeGraft;
  }

  const nextEntry: RosterEntry = {
    ...entry,
    chosenPathIds: [...entry.chosenPathIds, path.id],
    unlockedMoveIds: [...new Set([...entry.unlockedMoveIds, ...path.unlocksMoveIds])],
    evolutionStatGrants: mergeStatMods(entry.evolutionStatGrants, path.statGrants),
    evolutionPassiveGrants: [...new Set([...entry.evolutionPassiveGrants, ...(path.grantsPassiveIds ?? [])])],
    evolutionTypeGraft,
  };
  return replaceEntry(run, rosterId, nextEntry, 0);
}
