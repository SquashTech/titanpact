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
