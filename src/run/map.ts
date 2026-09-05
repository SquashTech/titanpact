// One act's branching map (docs/run-loop.md): a uniform per-act shape, seeded
// so a map is reproducible. `fight`/`battle` draw the non-recruitable pool,
// `skirmish`/`elite`/`boss` the recruitable one; all are 4-hero encounters.

import { createRng, nextFloat, type RngState } from '../engine/rng/seededRng';
// Value import, but state.ts only takes `RunMap` back as a type — no runtime cycle.
import { FINALE_ACT } from './state';

/** Listed as a value, not just a union, so a loaded save can check a node type it read back (save.ts). */
export const MAP_NODE_TYPES = [
  'fight',
  'skirmish',
  'battle',
  'elite',
  'boss',
  'shop',
  'equipmentReward',
  'relicReward',
  'currencyReward',
  'upgradeReward',
  'weaponReward',
  'armorReward',
  'accessoryReward',
  'hpBoostReward',
  'manaBoostReward',
  'manaRegenBoostReward',
  'classReward',
  'event',
  // Act 6 only (docs/run-loop.md §4). `muster` is the Vigil, `finale` the Endbringer.
  'muster',
  'finale',
] as const;

export type MapNodeType = (typeof MAP_NODE_TYPES)[number];

export interface MapNode {
  id: string;
  type: MapNodeType;
  row: number;
  col: number;
  /** Next-row nodes reachable from this one. Empty only for the boss node. */
  nextIds: string[];
}

export interface RunMap {
  seed: number;
  nodes: Record<string, MapNode>;
  /** Row 0 = the single entry node, last row = the single boss node. */
  rows: string[][];
  startNodeIds: string[];
  bossNodeId: string;
}

// row 0 fight, 1/3 pick-1-of-3 rewards, 2 skirmish, 4 elite-or-battle,
// 5 Guild Hall funnel, 6 boss. Act 1 splices in the Mentor row (below).
const BASE_ROW_WIDTHS = [1, 3, 1, 3, 2, 1, 1] as const;
const SKIRMISH_ROW = 2;

/**
 * Act-1-only forced single classReward row, spliced in immediately BEFORE the Skirmish —
 * the ONLY place a Class offer appears in any act. It sits ahead of the Skirmish so the
 * Class is in hand for the run's first recruitable fight rather than arriving after it.
 * Act 1's Skirmish therefore lands one row later than every other act's.
 */
const MENTOR_ROW = SKIRMISH_ROW;

/** Act 1's Mentor row pushes the Skirmish down one; every other act is the base shape. */
function skirmishRowFor(actNumber: number): number {
  return actNumber === 1 ? SKIRMISH_ROW + 1 : SKIRMISH_ROW;
}

function rowWidthsFor(actNumber: number): number[] {
  if (actNumber !== 1) return [...BASE_ROW_WIDTHS];
  return [...BASE_ROW_WIDTHS.slice(0, MENTOR_ROW), 1, ...BASE_ROW_WIDTHS.slice(MENTOR_ROW)];
}

/** Reward-row pool. `classReward` is deliberately absent (Mentor row only). Weights are a first-pass balance. */
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
  ['manaRegenBoostReward', 10],
  // FLAGGED FOR THE DESIGNER: 14 is an inference, not a decision — how often a run meets an event is a real tuning question.
  ['event', 14],
];

/** Weighted sample WITHOUT replacement — a reward row never repeats a type. REWARD_WEIGHTS is wider than any row, so `count` is always satisfiable. */
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

function nodeId(row: number, col: number): string {
  return `r${row}-c${col}`;
}

/**
 * Act 6 is a corridor, not a map (docs/run-loop.md §4): the Vigil, then the Endbringer.
 * No branch and no RNG — the seed is kept only so a RunMap stays reproducible from it.
 */
function finaleMap(seed: number): RunMap {
  const musterId = nodeId(0, 0);
  const finaleId = nodeId(1, 0);
  return {
    seed,
    nodes: {
      [musterId]: { id: musterId, type: 'muster', row: 0, col: 0, nextIds: [finaleId] },
      [finaleId]: { id: finaleId, type: 'finale', row: 1, col: 0, nextIds: [] },
    },
    rows: [[musterId], [finaleId]],
    startNodeIds: [musterId],
    bossNodeId: finaleId,
  };
}

/**
 * Rows top-down (types first), forward edges within a column window, then a
 * repair pass so every node has an incoming edge. eliteRow/funnelRow/bossRow
 * are derived from the shape's length so Act 1's extra row lands correctly.
 */
export function generateMap(seed: number, actNumber: number = 1): RunMap {
  if (actNumber >= FINALE_ACT) return finaleMap(seed);
  const rowWidths = rowWidthsFor(actNumber);
  const bossRow = rowWidths.length - 1;
  const funnelRow = bossRow - 1;
  const eliteRow = funnelRow - 1;
  const mentorRow = actNumber === 1 ? MENTOR_ROW : -1;
  const skirmishRow = skirmishRowFor(actNumber);

  function isRewardRow(row: number): boolean {
    return row !== 0 && row !== skirmishRow && row !== mentorRow && row !== eliteRow && row !== funnelRow && row !== bossRow;
  }

  function fixedNodeType(row: number, col: number): MapNodeType {
    if (row === 0) return 'fight';
    // Mentor first: in Act 1 it OWNS SKIRMISH_ROW and the Skirmish has moved down to skirmishRow.
    if (row === mentorRow) return 'classReward';
    if (row === skirmishRow) return 'skirmish';
    if (row === eliteRow) return col === 0 ? 'elite' : 'battle';
    if (row === funnelRow) return 'shop';
    return 'boss';
  }

  let rng = createRng(seed);
  const nodes: Record<string, MapNode> = {};
  const rows: string[][] = [];

  for (let row = 0; row < rowWidths.length; row++) {
    const rowIds: string[] = [];
    // Reward rows roll a whole row at once (distinct sample); fixed rows never touch the RNG.
    const rewardRow = isRewardRow(row);
    let rewardTypes: MapNodeType[] = [];
    if (rewardRow) {
      const picked = pickWeightedDistinct(rng, REWARD_WEIGHTS, rowWidths[row]);
      rewardTypes = picked.values;
      rng = picked.nextState;
    }
    for (let col = 0; col < rowWidths[row]; col++) {
      const type = rewardRow ? rewardTypes[col] : fixedNodeType(row, col);
      const id = nodeId(row, col);
      nodes[id] = { id, type, row, col, nextIds: [] };
      rowIds.push(id);
    }
    rows.push(rowIds);
  }

  for (let row = 0; row < rowWidths.length - 1; row++) {
    const from = rows[row];
    const to = rows[row + 1];

    // The row feeding eliteRow STEERS: left -> Elite, right -> Battle, middle
    // keeps both — so no path ever loses the choice, only prices it.
    if (row + 1 === eliteRow) {
      const eliteId = to[0];
      const battleId = to[to.length - 1];
      from.forEach((fromId, col) => {
        // A width-1 feeding row has nothing to steer with; keep the full connection.
        if (from.length === 1) nodes[fromId].nextIds = [...to];
        else if (col === 0) nodes[fromId].nextIds = [eliteId];
        else if (col === from.length - 1) nodes[fromId].nextIds = [battleId];
        else nodes[fromId].nextIds = [...to];
      });
      continue;
    }

    for (const fromId of from) {
      // Clamp into the TARGET row's width first, or a narrow `to` yields an empty window and strands the node.
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

    // Repair pass: every node in the next row gets an incoming edge.
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
    bossNodeId: rows[bossRow][0],
  };
}
