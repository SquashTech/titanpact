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
// `fight` vs `skirmish` vs `battle` (2026-08-17, per user direction; pool
// split revised 2026-08-22): all three are plain (no-bonus) 4-hero
// encounters mechanically — the split is which pool they draw from and
// where/how they're presented, not difficulty. `fight` (map-facing name
// "Fight") is always the act's row-0 opener against the weaker
// non-recruitable mob pool (App.tsx's `enemies`, "Monsters" flavor);
// `battle` (map-facing name "Monsters") is `fight`'s later, still
// non-recruitable sibling — the non-Elite alternative in generateMap's
// Elite-or-Battle row, kept as its own named type (rather than reusing
// `fight`) so its map position/flavor can be authored separately as the
// monster pool grows (per user direction: monster variety/difficulty is
// meant to scale by act, e.g. tougher or differently-themed monsters past
// Act 1 — not yet built, docs/run-loop.md "Per-act difficulty scaling").
// `skirmish` (map-facing name "Skirmish") is the row-2 encounter against the
// recruitable hero pool, named differently so the map itself telegraphs
// "beating this one is a shot at a Recruit Contract" before the player
// commits a squad. `elite`/`boss` also draw from the recruitable pool but
// keep their own names since they're already distinguished by their stat
// bonus.
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
  | 'manaRegenBoostReward'
  | 'classReward'
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
// pre-boss Guild Hall funnel, row 6 = the Ancient. This is the shape for
// every act except Act 1, which inserts one extra standalone row — see
// rowWidthsFor/MENTOR_ROW below.
const BASE_ROW_WIDTHS = [1, 3, 1, 3, 2, 1, 1] as const;
const SKIRMISH_ROW = 2;

/**
 * Act-1-only standalone row, forced to a single classReward (Mentor's Hall,
 * ClassNodeScreen) node, immediately after the Skirmish row (2026-08-21
 * revision, per user direction: a dedicated row the player must pass
 * through — not one of three choices folded into the pick-1-of-3 reward row
 * that already sat there, which now shifts down a row unchanged and stays a
 * normal, fully random pick of 3). Every run's Act 1 sees this guaranteed
 * Class offer right after its first Skirmish. `classReward` was removed from
 * `REWARD_WEIGHTS` entirely (2026-08-22, per user direction) — this forced
 * row is now the ONLY place a Class offer can appear, in every act; later
 * acts keep the base 7-row shape with no Mentor row and no other way to roll
 * one.
 */
const MENTOR_ROW = SKIRMISH_ROW + 1;

/** The per-act row-width list — Act 1 gets an extra width-1 row spliced in at MENTOR_ROW; every other act is the unmodified base shape. */
function rowWidthsFor(actNumber: number): number[] {
  if (actNumber !== 1) return [...BASE_ROW_WIDTHS];
  return [...BASE_ROW_WIDTHS.slice(0, MENTOR_ROW), 1, ...BASE_ROW_WIDTHS.slice(MENTOR_ROW)];
}

/**
 * The two pick-1-of-3 rows draw from reward types only — fight/shop/elite are
 * forced elsewhere in the row layout, never mixed into a choice row.
 * `weaponReward`/`armorReward`/`accessoryReward` are single-item guaranteed
 * grants (no 3-choice picker, unlike `equipmentReward`'s mixed-slot pick),
 * `hpBoostReward`/`manaBoostReward`/`manaRegenBoostReward` each grant a flat
 * permanent stat bonus to one chosen hero (+20 HP / +10 Mana / +5 MP Regen),
 * and `event` rolls one of the authored map events (src/data/events.ts,
 * docs/events.md) — a move, a passive, a stat trade or a pile of gear.
 * `classReward`
 * is deliberately NOT in this pool (2026-08-22 revision, per user direction):
 * it's the Act-1-only forced Mentor row (MENTOR_ROW below) exclusively now,
 * never a random pick-1-of-3 option in any act — see that row's doc comment.
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
  ['manaRegenBoostReward', 10],
  /*
   * Raised 8 -> 14 on 2026-08-31, when `event` stopped being an empty
   * placeholder and became real content (src/data/events.ts). 8 was the
   * rarest entry in the table, which was right for a node that granted
   * nothing and is wrong for one that can hand over a move, a passive, a
   * stat trade or three pieces of gear. 14 puts it mid-pack, alongside
   * upgradeReward. FLAGGED FOR THE DESIGNER: this is an inference from why
   * the old number was low, not a decision that was made — with five events
   * in the pool, how often a run should meet one is a real tuning question.
   */
  ['event', 14],
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

function nodeId(row: number, col: number): string {
  return `r${row}-c${col}`;
}

/**
 * Generates one act's map deterministically from a seed. Builds rows
 * top-down (types first), then wires forward edges row-by-row within a
 * column window, then a repair pass guarantees every node (row 1+) has at
 * least one incoming edge — simpler than a true path-weaving algorithm, but
 * enough to prove branching choice without ever stranding a node.
 *
 * `actNumber` (default 1, matching RunState's initial act) selects the row
 * shape via rowWidthsFor — Act 1 gets the extra standalone Mentor row, every
 * other act the base 7-row shape. eliteRow/funnelRow/bossRow are derived
 * from the shape's length (not hardcoded row numbers) so they land correctly
 * either way.
 */
export function generateMap(seed: number, actNumber: number = 1): RunMap {
  const rowWidths = rowWidthsFor(actNumber);
  const bossRow = rowWidths.length - 1;
  const funnelRow = bossRow - 1;
  const eliteRow = funnelRow - 1;
  // Only a real row index for Act 1 (rowWidthsFor's inserted row) — never
  // matched otherwise, since no other act's row count reaches it meaningfully.
  const mentorRow = actNumber === 1 ? MENTOR_ROW : -1;

  /** True for the pick-1-of-3 reward rows — every other row's type (including the forced Act-1 Mentor row) is fixed by (row, col), not randomly rolled. */
  function isRewardRow(row: number): boolean {
    return row !== 0 && row !== SKIRMISH_ROW && row !== mentorRow && row !== eliteRow && row !== funnelRow && row !== bossRow;
  }

  /** The fixed node type for a non-reward-row cell — never called for reward rows, which are resolved a whole row at a time (see below) so duplicates within the row can be excluded. */
  function fixedNodeType(row: number, col: number): MapNodeType {
    if (row === 0) return 'fight';
    if (row === SKIRMISH_ROW) return 'skirmish';
    if (row === mentorRow) return 'classReward';
    if (row === eliteRow) return col === 0 ? 'elite' : 'battle';
    if (row === funnelRow) return 'shop';
    return 'boss';
  }

  let rng = createRng(seed);
  const nodes: Record<string, MapNode> = {};
  const rows: string[][] = [];

  for (let row = 0; row < rowWidths.length; row++) {
    const rowIds: string[] = [];
    // Reward rows are resolved a whole row at a time (distinct sample) so
    // the pick-1-of-3 choice never repeats a type; every other row's type
    // is a fixed function of (row, col) and doesn't touch the RNG at all.
    let rewardTypes: MapNodeType[] = [];
    if (isRewardRow(row)) {
      const picked = pickWeightedDistinct(rng, REWARD_WEIGHTS, rowWidths[row]);
      rewardTypes = picked.values;
      rng = picked.nextState;
    }
    for (let col = 0; col < rowWidths[row]; col++) {
      const type = isRewardRow(row) ? rewardTypes[col] : fixedNodeType(row, col);
      const id = nodeId(row, col);
      nodes[id] = { id, type, row, col, nextIds: [] };
      rowIds.push(id);
    }
    rows.push(rowIds);
  }

  for (let row = 0; row < rowWidths.length - 1; row++) {
    const from = rows[row];
    const to = rows[row + 1];

    // The row feeding into eliteRow STEERS rather than fully connecting
    // (2026-08-26 revision, per user direction). Left node commits to the
    // Elite, right node commits to the Battle, middle keeps both open.
    //
    // This narrows the earlier "always fully connects" rule (which existed so
    // the Elite/Battle choice could never be taken away by an earlier pick)
    // without breaking what that rule protected: the MIDDLE node always
    // reaches both, so no path ever loses the choice. What's now on the table
    // is whether the player can have a particular reward AND keep the choice
    // — a tradeoff they can see and price, not luck, since the whole map is
    // visible from the moment the act starts.
    //
    // It also removes the only place the map drew crossing edges: previously
    // the left reward ran a line all the way across to the Battle and the
    // right one back to the Elite, which read as noise rather than structure.
    if (row + 1 === eliteRow) {
      const eliteId = to[0];
      const battleId = to[to.length - 1];
      from.forEach((fromId, col) => {
        // A width-1 feeding row has nothing to steer WITH, so it keeps the
        // old full connection — the choice must survive every shape.
        if (from.length === 1) nodes[fromId].nextIds = [...to];
        else if (col === 0) nodes[fromId].nextIds = [eliteId];
        else if (col === from.length - 1) nodes[fromId].nextIds = [battleId];
        else nodes[fromId].nextIds = [...to];
      });
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
    bossNodeId: rows[bossRow][0],
  };
}
