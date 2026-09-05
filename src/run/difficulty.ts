// Per-act encounter scaling (docs/run-loop.md "Per-act difficulty scaling").
// Pure act -> numbers; enemyGen.ts applies the result. All figures placeholder.

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

// One act-step: +10 to 3 distinct growth stats. Drawn uniformly, so an HP-heavy
// roll is a softer fight; weighting by STAT_POINT_VALUE is the knob if needed.
export const ACT_STEP_STAT_COUNT = 3;
export const ACT_STEP_AMOUNT = 10;

export const ACT_STEP_STAT_TOTAL = ACT_STEP_STAT_COUNT * ACT_STEP_AMOUNT;

/** Enemy hero level by act (1-indexed). Both tracks; from Act 3 hero-pool enemies arrive evolved. */
export const ENEMY_LEVEL_BY_ACT: readonly number[] = [1, 3, 5, 7, 10];

export interface ActScaling {
  /** Act-steps of stats on top of the node kind's own bonus — two independent axes. */
  statSteps: number;
  level: number;
}

function clampAct(actNumber: number): number {
  if (!Number.isFinite(actNumber) || actNumber < 1) return 1;
  return Math.floor(actNumber);
}

/** Acts past the level table hold at its last entry. `baselineAct` overrides the track default — a faction authored for a later act. */
export function actScaling(track: ScalingTrack, actNumber: number, baselineAct: number = BASELINE_ACT[track]): ActScaling {
  const act = clampAct(actNumber);
  return {
    statSteps: Math.max(0, act - baselineAct),
    level: ENEMY_LEVEL_BY_ACT[Math.min(act, ENEMY_LEVEL_BY_ACT.length) - 1],
  };
}

/** Authored content as written, level 1 — the default for Quick Battle, Sandbox and tests. */
export const NO_SCALING: ActScaling = { statSteps: 0, level: 1 };

// --- Training Point income (docs/leveling-and-ranks.md) ---

/** The map node types that pay Training Points. `skirmish`/`battle` flatten to `fight` encounters but sit in opposite reward lanes. */
export type XpNodeType = 'fight' | 'skirmish' | 'battle' | 'elite' | 'boss' | 'finale';

/**
 * Per win, before the act step: 2 the act opener (the lightest fight on the map, and it
 * already ships a guaranteed drop), 3 Monsters, 4 Skirmish and Guardian. The finale pays
 * nothing — the run ends on it.
 */
const BASE_TRAINING_POINTS: Record<XpNodeType, number> = {
  fight: 2,
  battle: 3,
  skirmish: 4,
  elite: 4,
  boss: 4,
  finale: 0,
};

/**
 * Added to every payout per act past the first, so an Act 5 fight pays this much more than
 * the same fight in Act 1.
 *
 * REVERSES the earlier "flat across acts" decision (2026-09-01), and the reason is measured:
 * late-tier moves unlock at level 7, EVERY move costing 70+ mana is late tier, and under flat
 * income 0.0% of heroes ever reached level 7 while 99.2% of casts stayed early-tier. Reaching
 * level 7 costs 20 pooled points; flat income paid roughly 70 across a whole five-act run, so
 * a squad of four (80 points) could not get there on a perfect run. The level-price curve was
 * never the brake that mattered — total income was.
 */
export const ACT_XP_STEP = 2;

/** Training Points for winning `nodeType` in `actNumber`. */
export function trainingPointsFor(nodeType: XpNodeType, actNumber: number): number {
  const base = BASE_TRAINING_POINTS[nodeType];
  if (base === 0) return 0;
  return base + Math.max(0, clampAct(actNumber) - 1) * ACT_XP_STEP;
}
