// One act's branching map (docs/run-loop.md). A run chains TOTAL_ACTS of
// these (App.tsx advanceToNextAct) — each act generates its own map from a
// fresh seed once its boss falls. Uniform per-act shape (2026-08-17 revision,
// per user direction): every act is exactly
// Fight -> pick 1 of 3 -> Skirmish -> pick 1 of 3 -> (Elite or Battle) ->
// Guild Hall -> Ancient — no path ever skips straight from the opening fight
// to the boss without passing through the forced mid-act fights, and
// reward-pick rows are pure reward choices (no fight/shop mixed into them).
// Pure data + a seeded generator; no view or engine concerns here.
//
// `fight` vs `skirmish` vs `battle` (2026-08-17, per user direction): all
// three are plain (no-bonus) 4-hero encounters mechanically — the split is
// which pool they draw from and where/how they're presented, not difficulty.
// `fight` is always the act's row-0 opener against the weaker non-recruitable
// mob pool (App.tsx's Goblins); `skirmish` is the row-2 encounter against the
// recruitable hero pool, named differently so the map itself telegraphs
// "beating this one is a shot at a Recruit Contract" before the player
// commits a squad. `battle` is `skirmish`'s late-act sibling — row 4's
// non-Elite alternative (see ELITE_ROW below) — kept as its own named type
// rather than reusing `skirmish` so its specific encounter pool can be
// authored separately later ("the actual possible battles" — user direction,
// deferred) without disturbing the early-act `skirmish` pool. `elite`/`boss`
// also draw from the recruitable pool but keep their own names since they're
// already distinguished by their stat bonus.
//
// Determinism: reuses the engine's seeded PRNG (engine/rng/seededRng.ts) so a
// map is reproducible from its seed, same spirit as combat's seeded RNG
// (docs/architecture.md "Determinism & RNG") — that rule is about /engine
// purity specifically, but the discipline is worth keeping here too.

import { createRng, nextFloat, type RngState } from '../engine/rng/seededRng';

export type MapNodeType =
  | 'fight'
  | 'skirmish'
  | 'battle'
  | 'elite'
  | 'boss'
  | 'shop'
  | 'equipmentReward'
  | 'relicReward'
  | 'currencyReward'
  | 'upgradeReward'
  | 'weaponReward'
  | 'armorReward'
  | 'accessoryReward'
  | 'hpBoostReward'
  | 'manaBoostReward'
  | 'event';

export interface MapNode {
  id: string;
  type: MapNodeType;
  row: number;
  col: number;
  /** Ids of nodes reachable from this one, in the next row. Empty only for the boss node. */
  nextIds: string[];
}

export interface RunMap {
  seed: number;
  nodes: Record<string, MapNode>;
  /** Node ids grouped by row; row 0 = the single entry node, last row = the single boss node. */
  rows: string[][];
  startNodeIds: string[];
  bossNodeId: string;
}

// row 0 = the act's opening mob `fight`, row 1/3 = pick-1-of-3 reward rows,
// row 2 = the forced `skirmish` against a recruitable hero squad, row 4 =
// pick 1 of 2 — `elite` (the act's difficulty spike) or `battle` (its
// plain-difficulty alternative) — before the shop funnel, row 5 = the
// pre-boss Guild Hall funnel, row 6 = the Ancient.
const ROW_WIDTHS = [1, 3, 1, 3, 2, 1, 1] as const;
const BOSS_ROW = ROW_WIDTHS.length - 1;
const FUNNEL_ROW = BOSS_ROW - 1;
const ELITE_ROW = FUNNEL_ROW - 1;
const SKIRMISH_ROW = 2;

/**
 * The two pick-1-of-3 rows draw from reward types only — fight/shop/elite are
 * forced elsewhere in the row layout, never mixed into a choice row.
 * `weaponReward`/`armorReward`/`accessoryReward` are single-item guaranteed
 * grants (no 3-choice picker, unlike `equipmentReward`'s mixed-slot pick),
 * `hpBoostReward`/`manaBoostReward` grant a flat permanent stat bonus to one
 * chosen hero, and `event` is a placeholder node with no content yet (user
 * direction — "don't create any yet, we will design these when it's time").
 * Weights are a first-pass balance, easily retuned since this is plain data.
 */
const REWARD_WEIGHTS: readonly [MapNodeType, number][] = [
  ['equipmentReward', 20],
  ['relicReward', 18],
  ['currencyReward', 16],
  ['upgradeReward', 14],
  ['weaponReward', 12],
  ['armorReward', 12],
  ['accessoryReward', 12],
  ['hpBoostReward', 10],
  ['manaBoostReward', 10],
  ['event', 8],
];

/**
 * Weighted sample of `count` DISTINCT types from `weights`, without
 * replacement — used to fill a whole reward row at once so the same node
 * type never appears twice in one pick-1-of-3 row (a duplicate would make
 * one of the 3 "choices" meaningless). `REWARD_WEIGHTS` has more entries
 * than any row is wide, so `count` is always satisfiable.
 */
function pickWeightedDistinct(
  rng: RngState,
  weights: readonly [MapNodeType, number][],
  count: number
): { values: MapNodeType[]; nextState: RngState } {
  const remaining = [...weights];
  const values: MapNodeType[] = [];
  let state = rng;
  while (values.length < Math.min(count, remaining.length)) {
    const total = remaining.reduce((sum, [, w]) => sum + w, 0);
    const { value: roll, nextState } = nextFloat(state);
    state = nextState;
    let threshold = roll * total;
    let index = remaining.length - 1;
    for (let i = 0; i < remaining.length; i++) {
      threshold -= remaining[i][1];
      if (threshold <= 0) {
        index = i;
        break;
      }
    }
    values.push(remaining[index][0]);
    remaining.splice(index, 1);
  }
  return { values, nextState: state };
}

/** True for the two pick-1-of-3 reward rows — every other row's type is a fixed function of (row, col), not randomly rolled. */
function isRewardRow(row: number): boolean {
  return row !== 0 && row !== SKIRMISH_ROW && row !== ELITE_ROW && row !== FUNNEL_ROW && row !== BOSS_ROW;
}

/** The fixed node type for a non-reward-row cell — never called for reward rows, which are resolved a whole row at a time (see generateMap) so duplicates within the row can be excluded. */
function fixedNodeType(row: number, col: number): MapNodeType {
  if (row === 0) return 'fight';
  if (row === SKIRMISH_ROW) return 'skirmish';
  if (row === ELITE_ROW) return col === 0 ? 'elite' : 'battle';
  if (row === FUNNEL_ROW) return 'shop';
  return 'boss';
}

function nodeId(row: number, col: number): string {
  return `r${row}-c${col}`;
}

/**
 * Generates one act's map deterministically from a seed. Builds rows
 * top-down (types first), then wires forward edges row-by-row within a
 * column window, then a repair pass guarantees every node (row 1+) has at
 * least one incoming edge — simpler than a true path-weaving algorithm, but
 * enough to prove branching choice without ever stranding a node.
 */
export function generateMap(seed: number): RunMap {
  let rng = createRng(seed);
  const nodes: Record<string, MapNode> = {};
  const rows: string[][] = [];

  for (let row = 0; row < ROW_WIDTHS.length; row++) {
    const rowIds: string[] = [];
    // Reward rows are resolved a whole row at a time (distinct sample) so
    // the pick-1-of-3 choice never repeats a type; every other row's type
    // is a fixed function of (row, col) and doesn't touch the RNG at all.
    let rewardTypes: MapNodeType[] = [];
    if (isRewardRow(row)) {
      const picked = pickWeightedDistinct(rng, REWARD_WEIGHTS, ROW_WIDTHS[row]);
      rewardTypes = picked.values;
      rng = picked.nextState;
    }
    for (let col = 0; col < ROW_WIDTHS[row]; col++) {
      const type = isRewardRow(row) ? rewardTypes[col] : fixedNodeType(row, col);
      const id = nodeId(row, col);
      nodes[id] = { id, type, row, col, nextIds: [] };
      rowIds.push(id);
    }
    rows.push(rowIds);
  }

  for (let row = 0; row < ROW_WIDTHS.length - 1; row++) {
    const from = rows[row];
    const to = rows[row + 1];

    // The row feeding into ELITE_ROW (Elite-or-Battle) always fully connects
    // — every path must present the same real choice between the two,
    // rather than one that's only sometimes available depending on which
    // reward-row node the player happened to pick (user direction: "give the
    // player the option to fight the Elite OR a regular Battle").
    if (row + 1 === ELITE_ROW) {
      for (const fromId of from) {
        nodes[fromId].nextIds = [...to];
      }
      continue;
    }

    for (const fromId of from) {
      // Clamp the source column into the TARGET row's width first (it may be
      // narrower, e.g. funneling into the single pre-boss/boss node), then
      // window around that — otherwise a high fromCol against a narrow `to`
      // can produce an inverted (empty) slice and strand the node with zero
      // outgoing edges.
      const targetCol = Math.min(nodes[fromId].col, to.length - 1);
      const windowLo = Math.max(0, targetCol - 1);
      const windowHi = Math.min(to.length - 1, targetCol + 1);
      const candidates = to.slice(windowLo, windowHi + 1);

      const { value: edgeRoll, nextState: s1 } = nextFloat(rng);
      rng = s1;
      const edgeCount = candidates.length > 1 && edgeRoll < 0.4 ? 2 : 1;

      const picked = new Set<string>();
      while (picked.size < Math.min(edgeCount, candidates.length)) {
        const { value: idx, nextState: s2 } = nextFloat(rng);
        rng = s2;
        picked.add(candidates[Math.floor(idx * candidates.length)]);
      }
      nodes[fromId].nextIds = [...picked];
    }

    // Repair pass: guarantee every node in the next row has an incoming edge.
    const reached = new Set(from.flatMap((id) => nodes[id].nextIds));
    for (const toId of to) {
      if (reached.has(toId)) continue;
      const toCol = nodes[toId].col;
      let nearest = from[0];
      let bestDist = Infinity;
      for (const fromId of from) {
        const dist = Math.abs(nodes[fromId].col - toCol);
        if (dist < bestDist) {
          bestDist = dist;
          nearest = fromId;
        }
      }
      nodes[nearest].nextIds.push(toId);
    }
  }

  return {
    seed,
    nodes,
    rows,
    startNodeIds: rows[0],
    bossNodeId: rows[BOSS_ROW][0],
  };
}
