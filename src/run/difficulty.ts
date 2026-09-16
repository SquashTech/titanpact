// Per-node encounter scaling (docs/enemy-levels.md). Pure (node kind, act) -> numbers;
// enemyGen.ts applies the result. An enemy's ONE stat axis is its level, rolled through its
// growth grades exactly as a Guild hire's is — no act-steps, no node-kind stat bonus.

import type { SpawnTier } from '../data/titanspawn';
import { ENCOUNTERS_PER_ACT, MAX_LEVEL, levelAfterEncounters } from './growth';
import { masteryForAct } from './mastery';
import { LOOT_SOURCE, rarityWeightsFor } from './equipment';
import type { EnemyLoadout } from './enemyGen';

/**
 * The map node types that resolve into an encounter. `skirmish`/`battle` flatten to `fight`
 * encounters but sit in opposite reward lanes, so the loot tables key on this rather than on the
 * flattened kind (equipment.ts EQUIPMENT_DROP_CHANCE, LOOT_SOURCE).
 */
export type EncounterNodeKind = 'fight' | 'skirmish' | 'battle' | 'elite' | 'boss' | 'finale' | 'titan';

/** Encounters the player has won on reaching a node of this kind inside its act: the opener, the fork, the Guardian. */
export const ENCOUNTERS_BEFORE_NODE: Record<EncounterNodeKind, number> = {
  fight: 0,
  skirmish: 1,
  battle: 1,
  elite: 1,
  boss: 2,
  finale: 0,
  titan: 1,
};

/**
 * Where an enemy's level sits against the player's PAR entering its node — par and not the live
 * roster, so the tile can promise the level before the fight and a player ahead of par earns the
 * easier one. The opener sits under, the Skirmish a step over, the Elite two, the Guardian's
 * escorts one, and the champion `CHAMPION_LEVEL_BONUS` over those. First-pass figures, fitted
 * against the act-step curve they replaced (docs/enemy-levels.md §4).
 */
export const ENEMY_LEVEL_OFFSET: Record<EncounterNodeKind, number> = {
  fight: -3,
  skirmish: 0,
  battle: -2,
  elite: 1,
  boss: -3,
  finale: 2,
  // The Eyes' level buys them little (CHAMPION_GRADES); the number is in the line (docs/titan-eyes.md §4).
  titan: 4,
};

export const CHAMPION_LEVEL_BONUS = 2;

/**
 * The act's own term on every enemy level in it, index 0 unused (2026-09-15, per user
 * direction; docs/enemy-levels.md §4). The kind offsets shape a ROW of the map — opener under,
 * Skirmish at par, Elite over — and this shapes the RUN: Act 1 two levels lighter, because its
 * fork measured as the run's wall (Skirmish 68%, Elite 64%) with the third socket already in;
 * Acts 3 and 5 two heavier, because both measured near-clean (98 / 90% cleared) and a run that
 * never loses an act in the middle has no middle. A level is a fine dial — worth ~4 points of
 * act clear at Act 1's par and ~1 at Act 5's — and this is the measured first pass: Act 1
 * 50 → 58%, Act 3 98 → 96, Act 5 90 → 88. Acts past the table hold at its last entry.
 */
export const ACT_LEVEL_ADJUST: readonly number[] = [0, -2, 0, 2, 0, 2];

export function actLevelAdjust(actNumber: number): number {
  const act = clampAct(actNumber);
  return ACT_LEVEL_ADJUST[Math.min(act, ACT_LEVEL_ADJUST.length - 1)];
}

function clampAct(actNumber: number): number {
  if (!Number.isFinite(actNumber) || actNumber < 1) return 1;
  return Math.floor(actNumber);
}

function clampLevel(level: number): number {
  return Math.max(1, Math.min(MAX_LEVEL, Math.round(level)));
}

/** The player's par entering a node of this kind in this act. */
export function parLevelAtNode(kind: EncounterNodeKind, actNumber: number): number {
  const act = clampAct(actNumber);
  return levelAfterEncounters((act - 1) * ENCOUNTERS_PER_ACT + ENCOUNTERS_BEFORE_NODE[kind]);
}

/** The level every enemy on a node of this kind arrives at: par, the kind's offset, the act's. */
export function enemyLevelFor(kind: EncounterNodeKind, actNumber: number): number {
  return clampLevel(parLevelAtNode(kind, actNumber) + ENEMY_LEVEL_OFFSET[kind] + actLevelAdjust(actNumber));
}

/** The Guardian's held-back champion, over its escorts. */
export function championLevel(escortLevel: number): number {
  return clampLevel(escortLevel + CHAMPION_LEVEL_BONUS);
}

export interface ActScaling {
  level: number;
  /** Mastery pips (run/mastery.ts masteryForAct): whether the enemy arrives evolved, and what a contract claims. */
  mastery: number;
}

/** What a node of this kind fields in this act. */
export function encounterScaling(kind: EncounterNodeKind, actNumber: number): ActScaling {
  const act = clampAct(actNumber);
  return { level: enemyLevelFor(kind, act), mastery: masteryForAct(act) };
}

/** Authored content as written, level 1, no pips — the default for Quick Battle, Sandbox and tests. */
export const NO_SCALING: ActScaling = { level: 1, mastery: 0 };

/**
 * Level a Guild Hall hire arrives at, by act (1-indexed). DERIVED from the level curve rather
 * than authored beside it, so a retune of `ENCOUNTER_XP_BY_ACT` moves par once and this follows.
 *
 * **A hire arrives one act behind**, at the level the roster held when this act began, plus one.
 * That is the whole of what "decaying runway value" means: the gap is a fixed act, so it is worth
 * most early — when one act is most of the run — and least at the end.
 */
export const GUILD_HALL_ACT_LAG = 1;

export function guildHallLevel(actNumber: number): number {
  const act = clampAct(actNumber);
  const behind = levelAfterEncounters(Math.max(0, act - GUILD_HALL_ACT_LAG) * ENCOUNTERS_PER_ACT);
  // `clampAct` has no upper bound and the +1 can reach past the cap on its own.
  return Math.min(MAX_LEVEL, behind + 1);
}

/**
 * What Act 1's Elite fielded before `encounterHeroCountOverride` became a rule rather than a
 * special case (2026-09-10). Kept as the documented figure the rule has to keep reproducing:
 * three bodies against the roster of three the player holds at that node.
 */
export const ACT_ONE_ELITE_HERO_COUNT = 3;

/**
 * Act 1 never fields more bodies than the player has (2026-09-10, Growth Overhaul phase 6).
 *
 * The player's roster RAMPS across Act 1 — two drafted starters, a third off the Skirmish's
 * Recruit Contract, a fourth later — while the encounter size never did. The rule caps at the
 * roster: it reproduces the Elite's hand-tuned 3 exactly and cannot go stale if the draft size or
 * the contract schedule moves. Acts 2+ are untouched — the roster is full by then, and being
 * outnumbered is the Elite's job from there on.
 */
export function encounterHeroCountOverride(
  mapNodeType: string,
  actNumber: number,
  rosterSize: number,
  standardCount: number
): number | undefined {
  if (clampAct(actNumber) !== 1) return undefined;
  return rosterSize > 0 && rosterSize < standardCount ? rosterSize : undefined;
}

// --- The mob layer's tier by act (docs/titanspawn-overhaul.md §4) ---

/**
 * "The act's tier": what the Guardian's escorts are, and what leads the opener from Act 2. The
 * silhouette is the difficulty gauge — an Early is fodder, a Late is not — so this is the one
 * table that says which acts field which body. Acts past the table hold at its last entry.
 */
export const SPAWN_TIER_BY_ACT: readonly SpawnTier[] = ['early', 'mid', 'mid', 'late', 'late'];

export function spawnTierFor(actNumber: number): SpawnTier {
  const act = clampAct(actNumber);
  return SPAWN_TIER_BY_ACT[Math.min(act, SPAWN_TIER_BY_ACT.length) - 1];
}

/**
 * The opener's leader from Act 2 — "a Mid among Earlies" (§10, decided 2026-09-13): the act's
 * tier, floored at Mid so a leader is never just another Early.
 */
export function spawnLeaderTierFor(actNumber: number): SpawnTier {
  const tier = spawnTierFor(actNumber);
  return tier === 'early' ? 'mid' : tier;
}

/** Act 1's opener is two bare Earlies — the on-ramp. From Act 2 the opener is a leader plus this many Earlies. */
export const OPENER_ESCORT_COUNT = 3;

/**
 * The act from which the opener's Earlies carry an item each (§10, decided 2026-09-13): the
 * Earlies stay Earlies all run and equipment is what scales them, rolled on the same rarity
 * curve a drop is. Act 1's opener is bare so the first fight is the auto-win it is meant to be.
 */
export const OPENER_GEAR_FROM_ACT = 2;

/**
 * The act from which every hero-pool enemy, Guardian escort and champion carries an item, rolled
 * on its node's own rarity curve (equipment.ts LOOT_SOURCE) — the enemy loadout's first faucet.
 * Level alone falls behind a player stacking Banners and late-window gear (docs/enemy-levels.md
 * §5); gear is the axis that grows the way the player's does. Rolled to fit the wearer
 * (data/equipment.ts rollFittingGear), and a contract keeps it (docs/gear-absorption.md §7).
 */
export const ENEMY_GEAR_FROM_ACT = 4;

/** What a node's enemies arrive holding in this act; undefined below `ENEMY_GEAR_FROM_ACT`. */
export function enemyLoadoutFor(kind: EncounterNodeKind, actNumber: number): EnemyLoadout | undefined {
  return clampAct(actNumber) >= ENEMY_GEAR_FROM_ACT ? { gear: rarityWeightsFor(actNumber, LOOT_SOURCE[kind]) } : undefined;
}
