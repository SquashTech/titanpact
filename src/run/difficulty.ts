// Per-act encounter scaling (docs/run-loop.md "Per-act difficulty scaling").
// Pure act -> numbers; enemyGen.ts applies the result. All figures placeholder.

import type { StatKey } from '../engine/content';
import { ENCOUNTERS_PER_ACT, MAX_LEVEL, levelAfterEncounters } from './growth';

/** `monsters` = non-recruitable pool (fight/battle); `skirmish` = hero pool (skirmish/elite/boss). Same rate, different baseline act. */
export type ScalingTrack = 'monsters' | 'skirmish';

/**
 * The act each track's authored stat lines represent (zero scaling); Act 1 clamps to zero
 * steps rather than going negative. The `monsters` default is the fallback for callers with
 * no faction in hand — a faction that authors its own line overrides it with
 * `FactionRoster.baselineAct` (enemies.ts), which is why the Cultists' 2 is a real figure
 * where the Goblins' is still a placeholder.
 */
export const BASELINE_ACT: Record<ScalingTrack, number> = {
  monsters: 2,
  skirmish: 1,
};

// One act-step: +10 to 3 distinct growth stats, drawn uniformly. An HP-heavy roll is still the
// softer fight — HP is not in the damage ratio — but it is no longer softer by an accident of
// units: HP is authored in doubled points, so a step pays it double to move the bar as far as
// +10 moves any other stat.
export const ACT_STEP_STAT_COUNT = 3;
export const ACT_STEP_AMOUNT = 10;

/** Multiplier on ACT_STEP_AMOUNT per growth stat. 1 everywhere but HP, which is authored in doubled points. */
export const ACT_STEP_STAT_WEIGHT: Record<StatKey, number> = {
  hp: 2,
  attack: 1,
  defense: 1,
  intelligence: 1,
  wisdom: 1,
  speed: 1,
  manaPool: 1,
  mpRegen: 1,
};

/** A step's total in AUTHORED points, which is what a stat-line sum measures — an HP roll lands 40, not 30. */
export function actStepStatTotal(bonus: Partial<Record<StatKey, number>>): number {
  return Object.values(bonus).reduce((sum, amount) => sum + (amount ?? 0), 0);
}

export const ACT_STEP_STAT_TOTAL = ACT_STEP_STAT_COUNT * ACT_STEP_AMOUNT;

/**
 * Enemy hero level by act (1-indexed). Both tracks.
 *
 * Re-derived 2026-09-10 (Growth Overhaul phase 6) against a 30-level player. The old
 * [1, 3, 5, 7, 10] was fitted to a 10-level cap and became meaningless the moment levelling went
 * automatic: it left an Act 5 enemy at level 10 against a roster at 28, and — because a Recruit
 * Contract claims the beaten build entire — a contract hero arriving 14 levels below a hero the
 * Guild Hall would sell you.
 *
 * The rule is **the player's act-end level, less `ENEMY_LEVEL_LAG`**: the player runs a little
 * ahead all run, which is what makes the fights winnable while the enemy still tracks.
 *
 * Level buys an enemy less than it buys the player — no growth rolls, so it is kit depth only:
 * the Evolution at `EVOLUTION_LEVEL`, and the Mastery Rank band its level falls in
 * (`enemyScrollsForLevel`). Raw stats come from `ACT_STEP_CURVE` instead.
 */
export const ENEMY_LEVEL_LAG = 2;

export const ENEMY_LEVEL_BY_ACT: readonly number[] = [1, 2, 3, 4, 5].map((act) =>
  Math.max(1, levelAfterEncounters(act * ENCOUNTERS_PER_ACT) - ENEMY_LEVEL_LAG)
);

/**
 * Level a Guild Hall hire arrives at, by act (1-indexed; later acts hold at the last entry).
 * The reference is the PLAYER's roster at that point in the run, not `ENEMY_LEVEL_BY_ACT` —
 * enemies are scaled on stats as much as on levels, so pinning a hire under their level table
 * priced the early halls at nothing. The early acts carry the biggest bump because that is
 * where the run is hardest (2026-09-06 playtest: Act 2 is the wall).
 *
 * DERIVED from the level curve since 2026-09-10 rather than authored beside it (Growth
 * Overhaul phase 5). The old table — 2/4/5/6/7 — was written against a 10-level cap; against 30
 * it would have put an Act 3 hire at level 5 with the roster at 18, which is not "underlevelled"
 * but unusable. Deriving it means phase 6 retunes `LEVEL_AFTER_ENCOUNTER` once and this follows.
 *
 * **A hire arrives one act behind**, at the level the roster held when this act began, plus one.
 * That is the whole of what "decaying runway value" means now: the gap is a fixed act, so it is
 * worth most early — when one act is most of the run — and least at the end.
 */
export const GUILD_HALL_ACT_LAG = 1;

export function guildHallLevel(actNumber: number): number {
  const act = clampAct(actNumber);
  const behind = levelAfterEncounters(Math.max(0, act - GUILD_HALL_ACT_LAG) * ENCOUNTERS_PER_ACT);
  // `clampAct` has no upper bound (the old table clamped through its own index), and the +1 can
  // reach past the cap on its own — so the cap is applied here rather than assumed.
  return Math.min(MAX_LEVEL, behind + 1);
}

/**
 * What Act 1's Elite fielded before `encounterHeroCountOverride` became a rule rather than a
 * special case (2026-09-10). Kept as the documented figure the rule has to keep reproducing:
 * three bodies against the roster of three the player holds at that node.
 *
 * Measured when it was introduced (2026-09-06): 2.9 player bodies against 3.7, a 0.78 fielded
 * stat ratio and an 81.8% win rate, where Act 2's identical node kind sat at 99.6%.
 */
export const ACT_ONE_ELITE_HERO_COUNT = 3;

/**
 * Encounter size where it differs from generateEncounter's own default (boss 2, else 4), or
 * undefined where that default is right. Shared so App.tsx and scripts/sim/run.ts cannot drift
 * — they already each carried their own copy of the fight-is-2 rule.
 */
/**
 * Act 1 never fields more bodies than the player has (2026-09-10, Growth Overhaul phase 6).
 *
 * The player's roster RAMPS across Act 1 — two drafted starters, a third off the Skirmish's
 * Recruit Contract, a fourth later — while the encounter size never did. That was patched for the
 * Elite alone in 2026-09-06 with a hand-tuned `ACT_ONE_ELITE_HERO_COUNT` = 3, which is exactly the
 * roster size at that node; the SKIRMISH, one row earlier, kept fielding four against a roster of
 * **two** and was measurably the act's biggest killer (80.5% win, the lowest non-boss figure
 * anywhere on the map).
 *
 * So the rule replaces the constant: cap at the roster. It reproduces the Elite's 3 exactly, and
 * it cannot go stale the way a hand-tuned number does if the draft size or the contract schedule
 * moves. Acts 2+ are untouched — the roster is full by then, and being outnumbered is the Elite's
 * job from there on.
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

export interface ActScaling {
  /** Act-steps of stats on top of the node kind's own bonus — two independent axes. */
  statSteps: number;
  level: number;
}

function clampAct(actNumber: number): number {
  if (!Number.isFinite(actNumber) || actNumber < 1) return 1;
  return Math.floor(actNumber);
}

/**
 * Cumulative act-steps, indexed by how many acts past the track's baseline. This replaces a
 * linear `act - baselineAct`, and it ACCELERATES on purpose.
 *
 * Measured (`scripts/sim`): under the linear curve the enemy's fielded stat total grew by
 * +239, +161, +90, +87 across the run while the player's grew by +254, +192, +364, +399.
 * The two cross at act 4, which is exactly where Guardian win rates ran away (57% -> 89% ->
 * 99%). Two things caused the enemy side to decelerate:
 *
 *  - the step was a flat +30 an act, so it never compounded the way the player's stacking
 *    Banners and opening gear-rarity window do; and
 *  - `ENEMY_LEVEL_BY_ACT` is INERT for a Guardian's champion — every champion ships a full
 *    4-move kit, so `MOVE_CAP` leaves no room for level-up moves, and `appendFinalEnemy`
 *    never runs level progression at all. Levels 7 and 10 buy a champion nothing.
 *
 * So the stat curve is the only live lever on a champion, and it has to bend rather than
 * climb. Index 1 is left at 1 step deliberately: act 2 is already the hardest Guardian in
 * the run and does not need help.
 */
export const ACT_STEP_CURVE: readonly number[] = [0, 0, 4, 9, 15];

/**
 * Extra act-steps a Guardian's held-back champion takes on top of its escort's
 * (2026-09-10, Growth Overhaul phase 6). It is the ONE lever a champion has.
 *
 * Level buys a champion nothing: it ships a full four-move kit, so `MOVE_CAP` leaves no room for
 * the move a level would pay, and its Evolution never fires because an enemy definition carries no
 * progression nodes. Every other enemy on the map gained depth as the run went on — deeper move
 * bands with rank, an Evolution from Act 3 — and the champion, which is meant to be the act's
 * apex, gained only what its escort did.
 *
 * A multiplier rather than a flat add, so it stays proportional when the curve is retuned.
 */
export const CHAMPION_STEP_MULTIPLIER = 1.3;

export function championSteps(statSteps: number): number {
  return Math.round(statSteps * CHAMPION_STEP_MULTIPLIER);
}

/** Acts past the level table hold at its last entry. `baselineAct` overrides the track default — a faction authored for a later act. */
export function actScaling(track: ScalingTrack, actNumber: number, baselineAct: number = BASELINE_ACT[track]): ActScaling {
  const act = clampAct(actNumber);
  const stepsPastBaseline = Math.max(0, act - baselineAct);
  return {
    statSteps: ACT_STEP_CURVE[Math.min(stepsPastBaseline, ACT_STEP_CURVE.length - 1)],
    level: ENEMY_LEVEL_BY_ACT[Math.min(act, ENEMY_LEVEL_BY_ACT.length) - 1],
  };
}

/** Authored content as written, level 1 — the default for Quick Battle, Sandbox and tests. */
export const NO_SCALING: ActScaling = { statSteps: 0, level: 1 };

// --- Encounter node types ---

/**
 * The map node types that resolve into an encounter. `skirmish`/`battle` flatten to `fight`
 * encounters but sit in opposite reward lanes, so the loot tables key on this rather than on the
 * flattened kind (equipment.ts EQUIPMENT_DROP_CHANCE, LOOT_SOURCE).
 *
 * It carried the Training Point income table until 2026-09-10, when levels went automatic and
 * roster-wide (run/growth.ts) and there was no longer a pool to pay into.
 */
export type EncounterNodeKind = 'fight' | 'skirmish' | 'battle' | 'elite' | 'boss' | 'finale';
