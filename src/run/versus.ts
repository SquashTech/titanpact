// Versus (docs/versus.md): two players, one seed, lockstep. Pure — the twin draft, the one order
// both clients apply the two sides' choices in, and the hash they compare after every round.
// The host is side A and the guest side B on both screens; only the view decides which is "mine".

import type { Action } from '../engine/combat/actions';
import { applyForcedReplacement, placeLeads, replacementCandidates } from '../engine/combat/switching';
import { resolveBattleStartEntries, resolvePassiveReactions } from '../engine/combat/passiveEngine';
import type { FieldEffectDefinition, MoveDefinition, PassiveDefinition, StatusDefinition } from '../engine/content';
import type { CombatEvent } from '../engine/events';
import type { CombatState, HeroLookup, Side } from '../engine/state';
import { draftPick, rollOffer, type GauntletContent, type GauntletRun } from './gauntlet';
import type { TeamSlot } from './constructed';

export const HOST_SIDE: Side = 'A';
export const GUEST_SIDE: Side = 'B';
export const SIDES: readonly Side[] = ['A', 'B'];

export const otherSide = (side: Side): Side => (side === 'A' ? 'B' : 'A');

/** Each seat's board is its own: the match seed salted by the seat. */
const SEAT_SALT: Record<Side, number> = { A: 0x5bd1e995, B: 0x27d4eb2f };

/** Both players' owned heroes, sorted, so the two clients hand rollOffer the same list. */
export function versusPool(a: readonly string[], b: readonly string[]): string[] {
  return [...new Set([...a, ...b])].sort();
}

export interface VersusDraft {
  team: TeamSlot[];
  /** The three on offer; empty once the six are in. */
  offer: TeamSlot[];
}

/** A seat's draft replayed from the seed and its picks so far. No stars weight it: versus pays none (§1). */
export function versusDraft(content: GauntletContent, pool: readonly string[], seed: number, side: Side, picks: readonly number[]): VersusDraft {
  const start = { seed: (seed ^ SEAT_SALT[side]) >>> 0, team: [], seen: [] };
  let run: GauntletRun = { ...start, offer: rollOffer(content, pool, {}, start), wins: 0, losses: 0, fighting: false };
  for (const index of picks) run = draftPick(content, pool, {}, run, index);
  return { team: run.team, offer: run.offer };
}

/** Both sides' commands, A's then B's, whichever client is resolving. */
export function versusActions(bySide: Record<Side, readonly Action[]>): Action[] {
  return [...bySide.A, ...bySide.B];
}

export interface VersusEngineDefs {
  heroes: HeroLookup;
  moves: Record<string, MoveDefinition>;
  statuses: Record<string, StatusDefinition>;
  passives: Record<string, PassiveDefinition>;
  fieldEffects: Record<string, FieldEffectDefinition>;
}

/** Both sides' leads walk on together, A's first, and both sides' entry passives play. */
export function placeVersusLeads(state: CombatState, leads: Record<Side, readonly string[]>, defs: VersusEngineDefs): { placed: CombatState; state: CombatState; events: CombatEvent[] } {
  const placed = placeLeads(placeLeads(state, 'A', leads.A), 'B', leads.B);
  const entry = resolveBattleStartEntries(placed, state.round, defs.heroes, defs.statuses, defs.passives, defs.fieldEffects, SIDES);
  return { placed, ...entry };
}

/** How many forced replacements a side owes: its empty slots, as far as its bench reaches. */
export function replacementsOwed(state: CombatState, side: Side): number {
  const empty = state.active[side].filter((id) => id === null).length;
  return Math.min(empty, replacementCandidates(state, side).length);
}

/** Every owed replacement, A's then B's, each into the first empty slot, each with its entry reactions. */
export function applyVersusReplacements(state: CombatState, picks: Record<Side, readonly string[]>, defs: VersusEngineDefs): { state: CombatState; events: CombatEvent[] } {
  let working = state;
  const events: CombatEvent[] = [];
  for (const side of SIDES) {
    for (const benchedId of picks[side]) {
      const slot = working.active[side].indexOf(null);
      if (slot !== 0 && slot !== 1) break;
      const result = applyForcedReplacement(working, working.round, side, slot, benchedId, defs.statuses);
      const entry = resolvePassiveReactions(result.state, working.round, result.events, defs.heroes, defs.statuses, defs.passives, defs.fieldEffects, defs.moves);
      working = entry.state;
      events.push(...result.events, ...entry.events);
    }
  }
  return { state: working, events };
}

/** FNV-1a over the serialised state: equal on both clients, or the match is out of step. */
export function stateHash(value: unknown): number {
  const text = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** Stands in for a build hash until the game is hosted: two clients must hold the same catalog. */
export function contentStamp(heroIds: readonly string[], moveIds: readonly string[]): number {
  return stateHash([[...heroIds].sort(), [...moveIds].sort()]);
}

/** Seconds on a player's own clock (§3): a command phase, and every pick (draft, preview, leads, replacement). */
export const VERSUS_CLOCK = { command: 60, pick: 30 } as const;

/** Two builds must match before a room opens; a dev build has no SHA and is judged on content alone. */
export function buildsMatch(a: { stamp: number; build: string }, b: { stamp: number; build: string }): boolean {
  if (a.stamp !== b.stamp) return false;
  return a.build === 'dev' || b.build === 'dev' || a.build === b.build;
}

export type VersusMessage =
  | { kind: 'hello'; owned: string[]; stamp: number; build: string }
  | { kind: 'seed'; seed: number; owned: string[]; stamp: number; build: string }
  | { kind: 'pick'; n: number; index: number }
  | { kind: 'leads'; ids: string[] }
  | { kind: 'commands'; round: number; actions: Action[] }
  | { kind: 'replace'; round: number; ids: string[] }
  | { kind: 'hash'; round: number; hash: number }
  | { kind: 'leave' };

/** A message's identity: every message is sent again on reconnect (§2.1), and the first of each key is the one kept. */
export function messageKey(message: VersusMessage): string {
  switch (message.kind) {
    case 'pick':
      return `pick:${message.n}`;
    case 'commands':
    case 'replace':
    case 'hash':
      return `${message.kind}:${message.round}`;
    default:
      return message.kind;
  }
}
