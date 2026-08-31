// Per-act encounter scaling (docs/run-loop.md "Per-act difficulty scaling",
// 2026-08-30 per user direction — closes §3's open "difficulty does not yet
// scale by act number" note).
//
// This module answers ONE question and nothing else: given a map node's
// scaling track and the run's `actNumber`, how much stronger than the
// authored content should this encounter's enemies be? It returns a plain
// description of that (`ActScaling` — a stat-step count and a level), which
// `enemyGen.ts` then applies. Deliberately kept as a pure act -> numbers
// function with no knowledge of heroes, pools, RNG or map nodes, so a later
// hand-authored encounter can ignore it entirely, or pass its own `ActScaling`
// straight through the same seam without going near this table.
//
// WHY act-indexed rather than "fights cleared": Locations are drawn in
// random order (docs/locations.md), so the same act number is the only
// stable notion of run depth. Act 2 power showing up in Act 5 is exactly
// what this prevents.
//
// ⚠️ BASELINE VALUES ARE PLACEHOLDER. The curve's SHAPE (a flat per-act stat
// step, two tracks with different baseline acts, a level table) is the
// decision; the specific 30/act and the level numbers are first-pass figures
// to be tuned by playtest, per user direction "this is just a baseline to
// start getting power level curves ironed out through testing".

/**
 * Which of the map's two encounter families an encounter belongs to
 * (CLAUDE.md's two-word map vocabulary):
 *
 * - `monsters` — the non-recruitable enemy pool (`fight`, `battle` nodes;
 *   currently the Goblin roster, src/data/enemies.ts).
 * - `skirmish` — the recruitable hero pool (`skirmish`, `elite`, `boss`
 *   nodes). Guardians ride this track: they are hero-pool content too.
 *
 * The split exists because the two families have different BASELINE ACTS
 * (below), not because they scale at different rates — they don't.
 */
export type ScalingTrack = 'monsters' | 'skirmish';

/**
 * The act each track's authored stat lines are taken to represent — the act
 * at which an encounter gets zero scaling on top of its content.
 *
 * `skirmish` is 1: the hero roster is authored and already sits at the power
 * level the player starts a run at, so it "starts scaling right away" — every
 * act past the first adds a step.
 *
 * `monsters` is 2 as a PLACEHOLDER: purpose-built per-act monster content
 * does not exist yet (every act still fields Goblins — docs/locations.md §5,
 * "the five non-Act-1 factions have no enemy content"). Declaring the current
 * Goblin roster to be the Act 2 baseline is what lets the curve be written
 * now and the content be authored later without re-deriving it: whatever
 * monster roster eventually ships is tuned to feel right in Act 2, and this
 * curve carries it forward from there. Act 1 clamps to zero steps rather than
 * going NEGATIVE — the row-0 opener is deliberately the weakest fight in the
 * run and does not want a debuff on top, so Acts 1 and 2 currently field
 * identically-scaled monsters. That collision is a known consequence of the
 * placeholder, not a curve decision; it resolves itself the moment Act 1 gets
 * its own authored monster tier.
 */
export const BASELINE_ACT: Record<ScalingTrack, number> = {
  monsters: 2,
  skirmish: 1,
};

/**
 * One act-step of scaling: `ACT_STEP_STAT_COUNT` distinct growth stats at
 * `ACT_STEP_AMOUNT` each, i.e. +30 to an enemy's stat TOTAL per act (user
 * direction: "roughly everyone should get another ~25-30 stats added to their
 * stat total per act"). +10 x 3 rather than +5 x 6 so each step is felt on
 * the stats it lands on instead of being smeared invisibly across the whole
 * line, and because both figures satisfy CLAUDE.md's "flat additive integers,
 * multiples of 5 or 10".
 *
 * Each step rolls its OWN 3 stats (enemyGen.ts merges them), so a 4-step Act
 * 5 enemy ends up with a fuller, less spiky line than one stat taking +40.
 *
 * KNOWN WART, flagged rather than solved: the stats are drawn uniformly, and
 * a point of HP is worth far less than a point of Attack (the equipment
 * budget already prices HP at 1/2 — `STAT_POINT_VALUE`, src/run/equipment.ts).
 * So an enemy that rolls HP/HP-adjacent steps is a genuinely easier fight
 * than one that rolls offense. That variance is acceptable for a first curve
 * — `elite`'s existing +10-to-2-random-stats has the same property — but if
 * playtest says fights swing too hard, weighting the draw by
 * `STAT_POINT_VALUE` is the knob to reach for before changing the totals.
 */
export const ACT_STEP_STAT_COUNT = 3;
export const ACT_STEP_AMOUNT = 10;

/** Stat total added per act of scaling — derived, for docs and tests. */
export const ACT_STEP_STAT_TOTAL = ACT_STEP_STAT_COUNT * ACT_STEP_AMOUNT;

/**
 * Enemy hero level by act, 1-indexed (user direction: "roughly level 3 in
 * Act 2, 5 in Act 3, 7 in Act 4, and 10 in Act 5"). Act 1 is 1 — the level a
 * freshly drafted hero starts at, so the opening act is a mirror match on
 * progression.
 *
 * Level is not a stat multiplier in this game (CLAUDE.md: "no automatic stat
 * growth from leveling") — it does exactly two things, both of which are the
 * point here:
 *
 * 1. It gates Evolution (`EVOLUTION_LEVEL = 5`), so from **Act 3** onward
 *    every enemy drawn from the hero pool arrives already evolved — which is
 *    the user-stated intent, and the reason the table jumps 3 -> 5 there
 *    rather than climbing by 1s.
 * 2. It is how many move unlocks a hero has had, so a scaled enemy fills out
 *    toward the 4-move cap instead of fighting on its 3-move starting kit.
 *
 * It also rides along on a Recruit Contract claim (recruitment.ts
 * `deriveContractOffer` carries `level` and `chosenPathIds`), which is what
 * makes "recruiting them gets them at the same level" true for free.
 *
 * Applies to BOTH tracks. On the monsters track it is currently cosmetic —
 * the Goblin roster has no entries in the progression table, so there is no
 * Evolution to gate and no move pool to draw from — but it is the honest
 * label for the tier the player is fighting, and it starts working the
 * instant real monster content gets progression data.
 */
export const ENEMY_LEVEL_BY_ACT: readonly number[] = [1, 3, 5, 7, 10];

export interface ActScaling {
  /**
   * How many act-steps of stats to roll onto each enemy, on top of whatever
   * bonus its node KIND already carries (elite's +10x2, boss's +20x3 —
   * enemyGen.ts). Two independent axes on purpose: node kind says how hard
   * this fight is *for its act*, this says how deep in the run the act is.
   */
  statSteps: number;
  /** The level every enemy in the encounter arrives at. */
  level: number;
}

function clampAct(actNumber: number): number {
  if (!Number.isFinite(actNumber) || actNumber < 1) return 1;
  return Math.floor(actNumber);
}

/**
 * The scaling an encounter on `track` gets in act `actNumber`. Acts past the
 * authored level table hold at its last entry rather than falling off it —
 * `TOTAL_ACTS` could rise without this becoming an `undefined` level.
 */
export function actScaling(track: ScalingTrack, actNumber: number): ActScaling {
  const act = clampAct(actNumber);
  return {
    statSteps: Math.max(0, act - BASELINE_ACT[track]),
    level: ENEMY_LEVEL_BY_ACT[Math.min(act, ENEMY_LEVEL_BY_ACT.length) - 1],
  };
}

/** No scaling at all: authored content exactly as written, level 1. The default when a caller passes no `scaling` (Quick Battle, Sandbox, tests). */
export const NO_SCALING: ActScaling = { statSteps: 0, level: 1 };
