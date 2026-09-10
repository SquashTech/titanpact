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
  'blacksmith',
  'equipmentReward',
  'passiveReward',
  'currencyReward',
  'upgradeReward',
  'forgeReward',
  'classReward',
  'tutorReward',
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

// row 0 fight, 1/3/5 pick-1-of-3 rewards, 2 skirmish, 4 elite-or-battle,
// 6 the shop funnel, 7 boss. Acts 1-4 splice in the Mentor row (below).
const BASE_ROW_WIDTHS = [1, 3, 1, 3, 2, 3, 1, 1] as const;
const SKIRMISH_ROW = 2;

/**
 * Forced single classReward row, spliced in immediately BEFORE the Skirmish — the ONLY
 * place a Class offer appears in any act. It sits ahead of the Skirmish so the Class is in
 * hand for the act's first recruitable fight rather than arriving after it, which pushes
 * the Skirmish down one row in every act that has one.
 */
const MENTOR_ROW = SKIRMISH_ROW;

/**
 * Acts 1-4 each guarantee a Mentor (2026-09-05, per user direction — it was Act 1 only).
 * Act 5 deliberately has none: a different beat is being designed for it. Act 6 never
 * reaches here at all, being the finale corridor.
 */
const LAST_MENTOR_ACT = 4;

/**
 * The Tutor (2026-09-07, per user direction): one guaranteed seat in each of acts 4 and 5,
 * taken INSIDE a pick-1-of-3 reward row rather than given a forced row of its own. It is a
 * lategame build node — by act 4 a hero has a deep pool and four slots it is stuck with — so
 * it is priced the only way a reward row can price anything: against the two rolled rewards
 * beside it. Absent from REWARD_WEIGHTS, so those two seats are its only source.
 */
const TUTOR_ACTS: readonly number[] = [4, 5];

function hasTutor(actNumber: number): boolean {
  return TUTOR_ACTS.includes(actNumber);
}

function hasMentorRow(actNumber: number): boolean {
  return actNumber >= 1 && actNumber <= LAST_MENTOR_ACT;
}

/** The Mentor row pushes the Skirmish down one wherever it appears. */
function skirmishRowFor(actNumber: number): number {
  return hasMentorRow(actNumber) ? SKIRMISH_ROW + 1 : SKIRMISH_ROW;
}

/**
 * The Blacksmith (2026-09-08, per user direction): from act 3 the funnel row widens to TWO, and
 * the act's one guaranteed spend becomes a fork — heroes and gear at the Guild Hall, or slots,
 * tiers and enchants at the Blacksmith. Acts 1-2 keep the single Guild Hall: the early roster is
 * still forming, and a fork that can cost a player their only recruit shelf wants a run with
 * some gold in it.
 */
const BLACKSMITH_FIRST_ACT = 3;

function hasBlacksmith(actNumber: number): boolean {
  return actNumber >= BLACKSMITH_FIRST_ACT;
}

function rowWidthsFor(actNumber: number): number[] {
  const widths = hasMentorRow(actNumber)
    ? [...BASE_ROW_WIDTHS.slice(0, MENTOR_ROW), 1, ...BASE_ROW_WIDTHS.slice(MENTOR_ROW)]
    : [...BASE_ROW_WIDTHS];
  // The funnel is always the row under the boss, wherever the Mentor splice left it.
  if (hasBlacksmith(actNumber)) widths[widths.length - 2] = 2;
  return widths;
}

/** The pick-1-of-3 width. The Tutor only ever seats in a reward row this wide. */
const TUTOR_ROW_WIDTH = 3;

/** Reward-row pool. `classReward` and `tutorReward` are deliberately absent — each has its own forced seat. Weights are a first-pass balance. */
const REWARD_WEIGHTS: readonly [MapNodeType, number][] = [
  // equipmentReward absorbs most of the frequency the three slot caches used to carry.
  ['equipmentReward', 40],
  // The Boon: the part of the deleted relic pool that was actually worth having, handed to ONE
  // hero instead of all four. It is the only reward row node that changes how a hero plays
  // rather than how big its numbers are.
  //
  // 18 -> 30 (2026-09-10). The Gem Cache and the two stat shrines were deleted, and their
  // 40 weight goes to the two grants that were never a bare number. Phase 2's Mastery Scroll
  // node takes a real share back (docs/growth-overhaul.md §8).
  ['passiveReward', 30],
  ['currencyReward', 26],
  ['upgradeReward', 14],
  // The Forge (+1 item slot) is permanent, compounds with every later drop, and is the only thing
  // here a hero can be at the cap for, so it stays the scarcest of the grants.
  //
  // 10 -> 38 (2026-09-08). When the nine heroes' authored second slot was removed, the roster lost
  // capacity rather than items, and measurement said so: paying the difficulty back through drop
  // odds alone recovered 0.8pp of the 3.9pp it cost, because a hero holding one item turns every
  // further drop into a sell. Slots are what was taken and slots are what is handed back. The node
  // is also no longer half-dead on arrival — nobody starts one Forge from the cap any more.
  ['forgeReward', 38],
  // FLAGGED FOR THE DESIGNER: 16 is an inference, not a decision — how often a run meets an event is a real tuning question.
  ['event', 16],
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
 * are derived from the shape's length so the Mentor acts' extra row lands correctly.
 */
export function generateMap(seed: number, actNumber: number = 1): RunMap {
  if (actNumber >= FINALE_ACT) return finaleMap(seed);
  const rowWidths = rowWidthsFor(actNumber);
  const bossRow = rowWidths.length - 1;
  const funnelRow = bossRow - 1;
  // A pick-1-of-3 reward row sits between the Elite/Battle choice and the funnel, so the Elite
  // row is two up from the funnel rather than one.
  const eliteRow = funnelRow - 2;
  const mentorRow = hasMentorRow(actNumber) ? MENTOR_ROW : -1;
  const skirmishRow = skirmishRowFor(actNumber);

  function isRewardRow(row: number): boolean {
    return row !== 0 && row !== skirmishRow && row !== mentorRow && row !== eliteRow && row !== funnelRow && row !== bossRow;
  }

  function fixedNodeType(row: number, col: number): MapNodeType {
    if (row === 0) return 'fight';
    // Mentor first: where it exists it OWNS SKIRMISH_ROW, and the Skirmish has moved down to skirmishRow.
    if (row === mentorRow) return 'classReward';
    if (row === skirmishRow) return 'skirmish';
    if (row === eliteRow) return col === 0 ? 'elite' : 'battle';
    if (row === funnelRow) return col === 0 ? 'shop' : 'blacksmith';
    return 'boss';
  }

  let rng = createRng(seed);

  // The Tutor's seat is rolled BEFORE any row is generated, so its two draws sit at a fixed
  // point in the seeded stream — a map has to stay reproducible from its seed alone.
  let tutorRow = -1;
  let tutorCol = -1;
  if (hasTutor(actNumber)) {
    const seats: number[] = [];
    for (let row = 0; row < rowWidths.length; row++) {
      if (isRewardRow(row) && rowWidths[row] === TUTOR_ROW_WIDTH) seats.push(row);
    }
    if (seats.length > 0) {
      const { value: rowRoll, nextState: s1 } = nextFloat(rng);
      rng = s1;
      const { value: colRoll, nextState: s2 } = nextFloat(rng);
      rng = s2;
      tutorRow = seats[Math.floor(rowRoll * seats.length)];
      tutorCol = Math.floor(colRoll * rowWidths[tutorRow]);
    }
  }

  const nodes: Record<string, MapNode> = {};
  const rows: string[][] = [];

  for (let row = 0; row < rowWidths.length; row++) {
    const rowIds: string[] = [];
    // Reward rows roll a whole row at once (distinct sample); fixed rows never touch the RNG.
    const rewardRow = isRewardRow(row);
    let rewardTypes: MapNodeType[] = [];
    if (rewardRow) {
      // A Tutor row rolls one fewer reward and the Tutor takes the freed seat rather than
      // overwriting a rolled one — the row still offers three distinct things.
      const forced = row === tutorRow ? 1 : 0;
      const picked = pickWeightedDistinct(rng, REWARD_WEIGHTS, rowWidths[row] - forced);
      rewardTypes = picked.values;
      rng = picked.nextState;
      if (forced) rewardTypes.splice(tutorCol, 0, 'tutorReward');
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

    // The two forks every path arrives at holding BOTH options.
    //
    // The funnel has always been one: from act 3 it is a Guild Hall/Blacksmith choice, and it is
    // the act's ONLY guaranteed spend, so a map that decided it would be deciding the run.
    //
    // Elite-or-Battle joined it on 2026-09-08 (per user direction). It used to STEER — the reward
    // row above it sent left to the Elite, right to the Battle and middle to both — which priced
    // the choice rather than removing it, and read correctly while the whole act was on screen to
    // be read. It does not survive the map becoming a scene: with only the row in front of you
    // visible, a reward two steps back quietly closing an encounter is a rule the player is asked
    // to hold in their head rather than see. The choice is now simply always there.
    if ((row + 1 === funnelRow || row + 1 === eliteRow) && to.length > 1) {
      for (const fromId of from) nodes[fromId].nextIds = [...to];
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
