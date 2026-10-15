// Patrons (docs/patrons.md): the Mentor's and the Academy's rows are patron SEATS, two patrons a
// seat, one taken. Every meeting raises that patron's Trust and pays the rung it reached; the
// first seat's pick is promised three more appearances; Trust tops at 4 on the road and the one
// capstone (rung 5) is paid right before the last Guardian. Content is data/patrons.ts.

import { createRng, nextFloat, type RngState } from '../engine/rng/seededRng';
import type { EquipmentDefinition, EquipmentFamilyId, EquipmentRarity } from './equipment';
import { actAllowsRarity, equipmentIdFor, nextRarity, parseEquipmentId } from './equipment';
import type { RunState } from './state';

/** One verb a rung pays. A rung is one or two of them, paid in order. */
export type PatronStep =
  /** A piece of the family, sized to the act, through the item who-screen; its taker becomes the student. */
  | { kind: 'item'; familyId: EquipmentFamilyId }
  /** The student's piece of the family a tier up, inside the act window; a fresh piece when it holds none. */
  | { kind: 'liftItem'; familyId: EquipmentFamilyId }
  /** The student's piece of the family becomes the patron's Unique, in place; the Unique outright when it holds none. */
  | { kind: 'unique'; familyId: EquipmentFamilyId; uniqueId: string }
  | { kind: 'move'; moveId: string }
  | { kind: 'passive'; passiveId: string }
  /** A Class for a hero without one: `count` offered, rolled, or the whole list when `pick`. */
  | { kind: 'class'; count: number; pick?: boolean }
  /** A Master Class, replacing a Class a hero holds: one of `classIds`. */
  | { kind: 'masterClass'; classIds: readonly string[] };

export interface PatronDefinition {
  id: string;
  /** What the map tile and the preview say ("the Swordsman"). */
  title: string;
  /** The person, said in the voice line. */
  name: string;
  /** A patron with a student pays every rung after the first to the hero who took the first. */
  hasStudent: boolean;
  /** Rungs 1–5, index 0 = rung 1. */
  rungs: readonly (readonly PatronStep[])[];
  /** Said on arrival, one picked a visit. */
  lines: readonly string[];
}

export interface PatronState {
  /** Trust by patron id, 0–5. Absent = 0. */
  trust: Record<string, number>;
  /** The student's rosterId by patron id. A student who has left the roster is no student. */
  students: Record<string, string>;
  /** The first seat's patron and the seats it is owed. Null until the first seat is taken. */
  promise: { patronId: string; seats: number[] } | null;
  /** The two patrons each seat offered, by seat index, written when the seat comes into reach. */
  offers: Record<number, readonly string[]>;
  /** The patron taken at each seat, by seat index. */
  taken: Record<number, string>;
}

export const SEATS_PER_ACT = 2;
/** The seats are rows 2 and 6 (run/map.ts PATRON_ROWS) of acts 1–4: eight a run. */
export const SEAT_COUNT = 8;
/** Trust a patron can reach on the road; the fifth is the capstone. */
export const ROAD_TRUST_CAP = 4;
export const CAPSTONE_TRUST = 5;
/** Seats the first patron is promised, out of the seven after the first. */
export const PROMISED_SEATS = 3;
/** A taken patron's draw weight is 1 + this × its Trust. The dial for how often a patron returns. */
export const TRUST_WEIGHT = 2;

/** The rarity an `item` step hands over, by act. */
export const PATRON_ITEM_RARITY_BY_ACT: readonly EquipmentRarity[] = ['rare', 'epic', 'legendary', 'legendary'];

export function createPatronState(): PatronState {
  return { trust: {}, students: {}, promise: null, offers: {}, taken: {} };
}

export function patronStateOf(run: Pick<RunState, 'patrons'>): PatronState {
  return run.patrons ?? createPatronState();
}

export function trustOf(run: Pick<RunState, 'patrons'>, patronId: string): number {
  return patronStateOf(run).trust[patronId] ?? 0;
}

/** The seat a node is, or null: rows 2 and 6 of acts 1–4, numbered 0–7 down the run. */
export function seatIndexFor(actNumber: number, row: number, patronRows: readonly number[]): number | null {
  const within = patronRows.indexOf(row);
  if (within < 0 || actNumber < 1 || actNumber > SEAT_COUNT / SEATS_PER_ACT) return null;
  return (actNumber - 1) * SEATS_PER_ACT + within;
}

/** The student, while it is still on the roster. */
export function studentOf(run: Pick<RunState, 'patrons' | 'roster'>, patronId: string): string | null {
  const rosterId = patronStateOf(run).students[patronId];
  return rosterId && run.roster.some((r) => r.rosterId === rosterId) ? rosterId : null;
}

function rngFor(seed: number, salt: number): RngState {
  return createRng((seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0);
}

/**
 * The two patrons a seat offers. Every patron below the road cap is a candidate, weighted
 * 1 + TRUST_WEIGHT × Trust; the promised patron takes a tile at its seats. Deterministic off the
 * map seed and the Trust the seat was reached with.
 */
export function drawSeatOffers(
  state: PatronState,
  patrons: Record<string, PatronDefinition>,
  seat: number,
  seed: number
): string[] {
  const ids = Object.keys(patrons);
  let candidates = ids.filter((id) => (state.trust[id] ?? 0) < ROAD_TRUST_CAP);
  if (candidates.length < 2) candidates = [...candidates, ...ids.filter((id) => !candidates.includes(id))];
  const chosen: string[] = [];
  const promise = state.promise;
  if (promise && promise.seats.includes(seat) && candidates.includes(promise.patronId)) chosen.push(promise.patronId);
  let rng = rngFor(seed, seat);
  while (chosen.length < 2 && chosen.length < candidates.length) {
    const pool = candidates.filter((id) => !chosen.includes(id));
    const weights = pool.map((id) => 1 + TRUST_WEIGHT * (state.trust[id] ?? 0));
    const total = weights.reduce((a, b) => a + b, 0);
    const { value, nextState } = nextFloat(rng);
    rng = nextState;
    let threshold = value * total;
    let pick = pool[pool.length - 1];
    for (let i = 0; i < pool.length; i++) {
      threshold -= weights[i];
      if (threshold <= 0) {
        pick = pool[i];
        break;
      }
    }
    chosen.push(pick);
  }
  // The promised patron's tile is not always the left one.
  if (chosen.length === 2 && nextFloat(rng).value < 0.5) chosen.reverse();
  return chosen;
}

/** Writes a seat's offers the first time it comes into reach; a seat already written is kept. */
export function withSeatOffers(run: RunState, seat: number, patrons: Record<string, PatronDefinition>): RunState {
  const state = patronStateOf(run);
  if (state.offers[seat] || !run.map) return run;
  const offers = drawSeatOffers(state, patrons, seat, run.map.seed);
  return { ...run, patrons: { ...state, offers: { ...state.offers, [seat]: offers } } };
}

/** The patron a seat tile holds: the seat's offer at the tile's column. */
export function patronAtSeat(run: Pick<RunState, 'patrons'>, seat: number, col: number): string | null {
  return patronStateOf(run).offers[seat]?.[col] ?? null;
}

/** Picks the promised seats off the seed: three of the seven after the first. */
export function rollPromise(patronId: string, seed: number): { patronId: string; seats: number[] } {
  const open = Array.from({ length: SEAT_COUNT - 1 }, (_, i) => i + 1);
  let rng = rngFor(seed, 101);
  const seats: number[] = [];
  while (seats.length < PROMISED_SEATS) {
    const { value, nextState } = nextFloat(rng);
    rng = nextState;
    seats.push(open.splice(Math.floor(value * open.length), 1)[0]);
  }
  return { patronId, seats: seats.sort((a, b) => a - b) };
}

/**
 * The meeting: the patron's Trust rises by one and the rung it reached is what the screen pays.
 * The first seat's pick is promised its seats. Returns the rung (1-based).
 */
export function meetPatron(run: RunState, patronId: string, seat: number | null): { run: RunState; rung: number } {
  const state = patronStateOf(run);
  const rung = Math.min((state.trust[patronId] ?? 0) + 1, CAPSTONE_TRUST);
  const next: PatronState = {
    ...state,
    trust: { ...state.trust, [patronId]: rung },
    taken: seat === null ? state.taken : { ...state.taken, [seat]: patronId },
    promise: seat === 0 && !state.promise && run.map ? rollPromise(patronId, run.map.seed) : state.promise,
  };
  return { run: { ...run, patrons: next }, rung };
}

export function setStudent(run: RunState, patronId: string, rosterId: string): RunState {
  const state = patronStateOf(run);
  return { ...run, patrons: { ...state, students: { ...state.students, [patronId]: rosterId } } };
}

/** The patrons owed their capstone: at the road cap, as the last Guardian's gate opens. */
export function capstoneCandidates(run: Pick<RunState, 'patrons'>, patrons: Record<string, PatronDefinition>): string[] {
  const state = patronStateOf(run);
  return Object.keys(patrons).filter((id) => (state.trust[id] ?? 0) === ROAD_TRUST_CAP);
}

// --- Item steps ---

/** The piece an `item` step hands over this act. */
export function patronItemId(familyId: EquipmentFamilyId, actNumber: number): string {
  const rarity = PATRON_ITEM_RARITY_BY_ACT[Math.min(Math.max(actNumber, 1), PATRON_ITEM_RARITY_BY_ACT.length) - 1];
  return equipmentIdFor(familyId, rarity);
}

/** The socket holding the family on `rosterId`, or -1. */
export function heldFamilyIndex(run: RunState, rosterId: string, familyId: EquipmentFamilyId): number {
  const entry = run.roster.find((r) => r.rosterId === rosterId);
  return entry ? entry.equipment.findIndex((id) => parseEquipmentId(id).base === familyId) : -1;
}

function writeSocket(run: RunState, rosterId: string, index: number, itemId: string): RunState {
  return {
    ...run,
    roster: run.roster.map((r) => (r.rosterId === rosterId ? { ...r, equipment: r.equipment.map((held, i) => (i === index ? itemId : held)) } : r)),
  };
}

/** What a `liftItem` step would make of the held piece: its next tier inside the act window, or null at the ceiling. */
export function liftedItemId(heldId: string, actNumber: number, lookup: Record<string, EquipmentDefinition>): string | null {
  const held = lookup[heldId];
  const parsed = parseEquipmentId(heldId);
  if (!held || !parsed.rarity) return null;
  const up = nextRarity(parsed.rarity);
  if (!up || !actAllowsRarity(actNumber, up)) return null;
  const id = equipmentIdFor(parsed.base, up, parsed.enchantId);
  return lookup[id] ? id : null;
}

/** Lifts the student's piece in place. Unchanged when it is already at the act's ceiling. */
export function liftHeldItem(run: RunState, rosterId: string, familyId: EquipmentFamilyId, lookup: Record<string, EquipmentDefinition>): RunState {
  const index = heldFamilyIndex(run, rosterId, familyId);
  if (index < 0) return run;
  const heldId = run.roster.find((r) => r.rosterId === rosterId)!.equipment[index];
  const lifted = liftedItemId(heldId, run.actNumber, lookup);
  return lifted ? writeSocket(run, rosterId, index, lifted) : run;
}

/** The student's piece becomes the Unique in its socket, its enchant kept. Unchanged when it holds no piece of the family. */
export function forgeUnique(run: RunState, rosterId: string, familyId: EquipmentFamilyId, uniqueId: string): RunState {
  const index = heldFamilyIndex(run, rosterId, familyId);
  if (index < 0) return run;
  const { enchantId } = parseEquipmentId(run.roster.find((r) => r.rosterId === rosterId)!.equipment[index]);
  return writeSocket(run, rosterId, index, equipmentIdFor(uniqueId, null, enchantId));
}
