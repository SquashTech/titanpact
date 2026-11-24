// Per-node encounter scaling (docs/enemy-levels.md). Pure (node kind, act) -> numbers;
// enemyGen.ts applies the result. An enemy's ONE stat axis is its level, rolled through its
// growth grades exactly as a recruit's is — no act-steps, no node-kind stat bonus.

import type { SpawnTier } from '../data/titanspawn';
import { ENCOUNTERS_PER_ACT, MAX_LEVEL, levelAfterEncounters, type GrowthGrade } from './growth';
import { masteryForAct } from './mastery';
import { LOOT_SOURCE, MAX_ITEM_SLOTS, rarityWeightsFor } from './equipment';
import type { EnemyLoadout } from './enemyGen';

/**
 * The map node types that resolve into an encounter. `skirmish`/`battle` flatten to `fight`
 * encounters but sit in opposite reward lanes, so the loot tables key on this rather than on the
 * flattened kind (equipment.ts EQUIPMENT_DROP_CHANCE, LOOT_SOURCE).
 */
export type EncounterNodeKind = 'fight' | 'skirmish' | 'battle' | 'elite' | 'boss' | 'finale';

/** Encounters won on reaching a node of this kind inside its act; a `battle` is the first hallway after the opener unless its row says otherwise (map.ts encountersBeforeRow). */
export const ENCOUNTERS_BEFORE_NODE: Record<EncounterNodeKind, number> = {
  fight: 0,
  battle: 1,
  skirmish: 2,
  elite: 2,
  boss: 4,
  finale: 0,
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
  battle: -3,
  elite: 1,
  boss: -3,
  // The Herald's, and the Eyes' behind it (CHAMPION_GRADES — the number is in the line, docs/titan-eyes.md §4).
  finale: 2,
};

export const CHAMPION_LEVEL_BONUS = 2;

/**
 * The Guardian's shape by act at Base (2026-09-30, per user direction: the Act 1 Guardian never
 * lost and took longest of any boss to beat, 9.3 rounds against a Skirmish's 5; the Act 5 one fell
 * fastest, 4.7, and could be one-shot with the finale in sight). Index 0 unused. From A1 the woken
 * Guardian reads cycles.ts instead.
 *
 * ESCORTS: two in every act, so the champion always waits on the bench for the first KO (2026-10-16,
 * per user direction: its entrance is the fight's cinematic beat, worth the length one escort saved).
 *
 * GRADE: what the champion grows on. E is front-loaded by design (enemies.ts CHAMPION_GRADES) —
 * 2.8 points a level against a hero's 9.1 — so a late champion trails the roster by ~160 points;
 * D in Act 4 and C in Act 5 give it back part of that (+40 and +109 at their levels).
 */
export const GUARDIAN_ESCORTS_BY_ACT: readonly number[] = [0, 2, 2, 2, 2, 2];
export const CHAMPION_GRADE_BY_ACT: readonly GrowthGrade[] = ['E', 'E', 'E', 'E', 'C', 'C'];

export function guardianEscortCount(actNumber: number): number {
  return GUARDIAN_ESCORTS_BY_ACT[Math.min(clampAct(actNumber), GUARDIAN_ESCORTS_BY_ACT.length - 1)];
}

export function championGradeFor(actNumber: number): GrowthGrade {
  return CHAMPION_GRADE_BY_ACT[Math.min(clampAct(actNumber), CHAMPION_GRADE_BY_ACT.length - 1)];
}

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
export const ACT_LEVEL_ADJUST: readonly number[] = [0, -2, 0, 2, 2, 0];

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
export function parLevelAtNode(kind: EncounterNodeKind, actNumber: number, encountersBefore = ENCOUNTERS_BEFORE_NODE[kind]): number {
  const act = clampAct(actNumber);
  return levelAfterEncounters((act - 1) * ENCOUNTERS_PER_ACT + encountersBefore);
}

/** The level every enemy on a node of this kind arrives at: par, the kind's offset, the act's. */
export function enemyLevelFor(kind: EncounterNodeKind, actNumber: number, encountersBefore?: number): number {
  return clampLevel(parLevelAtNode(kind, actNumber, encountersBefore) + ENEMY_LEVEL_OFFSET[kind] + actLevelAdjust(actNumber));
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
export function encounterScaling(kind: EncounterNodeKind, actNumber: number, encountersBefore?: number): ActScaling {
  const act = clampAct(actNumber);
  return { level: enemyLevelFor(kind, act, encountersBefore), mastery: masteryForAct(act) };
}

/** Authored content as written, level 1, no pips — the default for Quick Battle, Sandbox and tests. */
export const NO_SCALING: ActScaling = { level: 1, mastery: 0 };


/**
 * What Act 1's Elite fielded before `encounterHeroCountOverride` became a rule rather than a
 * special case (2026-09-10). Kept as the documented figure the rule has to keep reproducing:
 * three bodies against the roster of three the player holds at that node.
 */
export const ACT_ONE_ELITE_HERO_COUNT = 3;

/** The Elite fields this many more bodies than the Skirmish beside it, the roster cap included, from Act 2 (docs/run-loop.md "Two reward rows"). */
export const ELITE_EXTRA_ENEMIES = 1;
export const ELITE_EXTRA_ENEMIES_FROM_ACT = 2;

export function eliteExtraEnemiesFor(actNumber: number): number {
  return clampAct(actNumber) >= ELITE_EXTRA_ENEMIES_FROM_ACT ? ELITE_EXTRA_ENEMIES : 0;
}

/**
 * No fight fields more bodies than the player has (Act 1 since 2026-09-10; every act since
 * 2026-11-20, per user direction): only Recruit nodes grow the roster, so it is rarely full by Act 2.
 * The cap only ever shrinks a fight.
 */
export function encounterHeroCountOverride(
  mapNodeType: string,
  actNumber: number,
  rosterSize: number,
  standardCount: number
): number | undefined {
  void mapNodeType;
  void actNumber;
  return rosterSize > 0 && rosterSize < standardCount ? rosterSize : undefined;
}

// --- The mob layer's tier by act (docs/titanspawn-overhaul.md §4) ---

/**
 * "The act's tier": what the Guardian's escorts are, and what a hallway fight fields. The
 * silhouette is the difficulty gauge — an Early is fodder, a Late is not — so this is the one
 * table that says which acts field which body. Acts past the table hold at its last entry.
 */
export const SPAWN_TIER_BY_ACT: readonly SpawnTier[] = ['early', 'mid', 'mid', 'late', 'late'];

export function spawnTierFor(actNumber: number): SpawnTier {
  const act = clampAct(actNumber);
  return SPAWN_TIER_BY_ACT[Math.min(act, SPAWN_TIER_BY_ACT.length) - 1];
}

/**
 * A hallway fight (the opener and every `battle`): two of the act's tier, bare, and nothing on
 * the bench, so the fight is one exchange — two or three rounds that still cost a hit or two
 * (2026-11-24, per user direction, docs/run-loop.md "Five fights an act"; it was a leader over
 * three geared escorts from Act 2, five to six rounds).
 */
export const HALLWAY_SIZE = 2;

export function hallwayTiersFor(actNumber: number): readonly SpawnTier[] {
  return Array.from({ length: HALLWAY_SIZE }, () => spawnTierFor(actNumber));
}

/**
 * Items every hero-pool enemy, Guardian escort and champion carries, by act (index 0 unused; acts
 * past the table hold at its last entry), each rolled on its node's own rarity curve
 * (equipment.ts LOOT_SOURCE), no two of a family. Level alone falls behind a player stacking
 * Banners and late-window gear (docs/enemy-levels.md §5); gear is the axis that grows the way the
 * player's does. Rolled to fit the wearer (data/equipment.ts rollFittingGear), and a contract
 * keeps it (docs/gear-absorption.md §7).
 */
export const ENEMY_GEAR_BY_ACT: readonly number[] = [0, 0, 0, 1, 2];

export function enemyGearCountFor(actNumber: number): number {
  return ENEMY_GEAR_BY_ACT[Math.min(clampAct(actNumber), ENEMY_GEAR_BY_ACT.length - 1)];
}

/** An Elite's enemies carry one item more than the act's from Act 2 (2026-10-26, per user direction), never past the three sockets. */
export const ELITE_EXTRA_GEAR = 1;
export const ELITE_EXTRA_GEAR_FROM_ACT = 2;

/** What a node's enemies arrive holding in this act; undefined in an act that fields them bare. */
export function enemyLoadoutFor(kind: EncounterNodeKind, actNumber: number): EnemyLoadout | undefined {
  const eliteExtra = kind === 'elite' && clampAct(actNumber) >= ELITE_EXTRA_GEAR_FROM_ACT ? ELITE_EXTRA_GEAR : 0;
  const gearCount = Math.min(enemyGearCountFor(actNumber) + eliteExtra, MAX_ITEM_SLOTS);
  return gearCount > 0 ? { gear: rarityWeightsFor(actNumber, LOOT_SOURCE[kind]), gearCount } : undefined;
}
