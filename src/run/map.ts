// The run's branching map (docs/run-loop.md). Slay the Spire-lite: rows of
// nodes, each connecting forward to 1-2 nodes in the next row, funneling into
// a single boss node. This is ONE ACT's shape for this pass (README "Next
// steps" #4) — multi-act sequencing is out of scope until this loop is
// validated. Pure data + a seeded generator; no view or engine concerns here.
//
// Determinism: reuses the engine's seeded PRNG (engine/rng/seededRng.ts) so a
// map is reproducible from its seed, same spirit as combat's seeded RNG
// (docs/architecture.md "Determinism & RNG") — that rule is about /engine
// purity specifically, but the discipline is worth keeping here too.

import { createRng, nextFloat, type RngState } from '../engine/rng/seededRng';

export type MapNodeType =
  | 'fight'
  | 'elite'
  | 'boss'
  | 'shop'
  | 'equipmentReward'
  | 'relicReward'
  | 'currencyReward'
  | 'upgradeReward'
  | 'contractReward';

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

const ROW_WIDTHS = [1, 3, 3, 3, 3, 1, 1] as const; // row 0 = single opening fight, row 5 = pre-boss shop funnel, row 6 = boss
const BOSS_ROW = ROW_WIDTHS.length - 1;
const FUNNEL_ROW = BOSS_ROW - 1;

/** Row 1-2 weights: mostly fights, a light spread of reward types, no elites yet. */
const EARLY_WEIGHTS: readonly [MapNodeType, number][] = [
  ['fight', 40],
  ['shop', 12],
  ['equipmentReward', 15],
  ['relicReward', 10],
  ['currencyReward', 13],
  ['upgradeReward', 10],
  ['contractReward', 6],
];

/** Row 3-4 weights: elites enter, fight share drops accordingly. */
const LATE_WEIGHTS: readonly [MapNodeType, number][] = [
  ['fight', 30],
  ['elite', 20],
  ['shop', 10],
  ['equipmentReward', 13],
  ['relicReward', 10],
  ['currencyReward', 10],
  ['upgradeReward', 7],
  ['contractReward', 6],
];

function pickWeighted(rng: RngState, weights: readonly [MapNodeType, number][]): { value: MapNodeType; nextState: RngState } {
  const total = weights.reduce((sum, [, w]) => sum + w, 0);
  const { value: roll, nextState } = nextFloat(rng);
  let threshold = roll * total;
  for (const [type, weight] of weights) {
    threshold -= weight;
    if (threshold <= 0) return { value: type, nextState };
  }
  return { value: weights[weights.length - 1][0], nextState };
}

function nodeType(row: number, rng: RngState): { value: MapNodeType; nextState: RngState } {
  if (row === 0) return { value: 'fight', nextState: rng };
  if (row === FUNNEL_ROW) return { value: 'shop', nextState: rng };
  if (row === BOSS_ROW) return { value: 'boss', nextState: rng };
  return pickWeighted(rng, row <= 2 ? EARLY_WEIGHTS : LATE_WEIGHTS);
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
    for (let col = 0; col < ROW_WIDTHS[row]; col++) {
      const { value: type, nextState } = nodeType(row, rng);
      rng = nextState;
      const id = nodeId(row, col);
      nodes[id] = { id, type, row, col, nextIds: [] };
      rowIds.push(id);
    }
    rows.push(rowIds);
  }

  for (let row = 0; row < ROW_WIDTHS.length - 1; row++) {
    const from = rows[row];
    const to = rows[row + 1];

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
