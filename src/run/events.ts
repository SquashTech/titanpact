// Run-tier mechanism behind map EVENTS (content: src/data/events.ts).
// Selection is called once at node-select time, never inside a component
// (a component-local roll rerolls on every remount — see shop.ts).

import type { MoveDefinition, PassiveId, StatKey } from '../engine/content';
import type { MovePoolFilter, RunEventDefinition } from '../data/events';
import type { RosterEntry, RunState } from './state';
import { mergeStatMods } from './statMods';

export class RunEventError extends Error {}

// --- Selection ---

/** Two per-event gates, both optional: `minAct` and `locationIds`. A null `locationId` matches only unrestricted events. */
export function eligibleEvents(
  defs: Record<string, RunEventDefinition>,
  actNumber: number,
  locationId: string | null
): RunEventDefinition[] {
  return Object.values(defs).filter((def) => {
    if (def.minAct !== undefined && actNumber < def.minAct) return false;
    if (def.locationIds && (locationId === null || !def.locationIds.includes(locationId))) return false;
    return true;
  });
}

/** Uniform roll; null when nothing is eligible — callers must handle it. */
export function rollRunEvent(
  defs: Record<string, RunEventDefinition>,
  actNumber: number,
  locationId: string | null
): RunEventDefinition | null {
  const pool = eligibleEvents(defs, actNumber, locationId);
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** An omitted filter means every move in the game (Wildcard). */
export function movePoolFor(filter: MovePoolFilter | undefined, moves: Record<string, MoveDefinition>): string[] {
  const needle = filter?.nameIncludes?.toLowerCase();
  return Object.values(moves)
    .filter((move) => {
      if (needle && !move.name.toLowerCase().includes(needle)) return false;
      if (filter?.types && !filter.types.includes(move.type)) return false;
      if (filter?.kinds && !filter.kinds.includes(move.kind)) return false;
      return true;
    })
    .map((move) => move.id);
}

/** Undefined if the filter matches nothing — a typo in `nameIncludes` shouldn't take the run down. */
export function rollEventMove(filter: MovePoolFilter | undefined, moves: Record<string, MoveDefinition>): string | undefined {
  const pool = movePoolFor(filter, moves);
  if (pool.length === 0) return undefined;
  return pool[Math.floor(Math.random() * pool.length)];
}

// --- Resolution ---

/** Floor on max HP after a `statShift` — a zero-HP entry faints the instant a fight is built. Not a balance knob. */
export const MIN_HP_AFTER_SHIFT = 10;

/** Only HP is floored — it is the only stat whose reaching zero ends the hero. */
export function statShiftAllowed(deltas: Partial<Record<StatKey, number>>, currentMaxHp: number): boolean {
  const hpDelta = deltas.hp ?? 0;
  return hpDelta >= 0 || currentMaxHp + hpDelta >= MIN_HP_AFTER_SHIFT;
}

function requireEntry(run: RunState, rosterId: string): RosterEntry {
  const entry = run.roster.find((r) => r.rosterId === rosterId);
  if (!entry) throw new RunEventError(`${rosterId} is not on the roster`);
  return entry;
}

/** All deltas in ONE transform, so a two-sided trade can't commit the cost and drop the payoff. */
export function applyStatShift(run: RunState, rosterId: string, deltas: Partial<Record<StatKey, number>>): RunState {
  const entry = requireEntry(run, rosterId);
  const next: RosterEntry = { ...entry, bonusStatGrants: mergeStatMods(entry.bonusStatGrants, deltas) };
  return { ...run, roster: run.roster.map((r) => (r.rosterId === rosterId ? next : r)) };
}

/** Appends rather than de-duplicating — a second copy stacks. */
export function grantEventPassive(
  run: RunState,
  rosterId: string,
  passiveId: PassiveId,
  passiveLookup: Record<PassiveId, { id: PassiveId }>
): RunState {
  const entry = requireEntry(run, rosterId);
  if (!passiveLookup[passiveId]) throw new RunEventError(`Unknown passive ${passiveId}`);
  const next: RosterEntry = { ...entry, bonusPassiveGrants: [...entry.bonusPassiveGrants, passiveId] };
  return { ...run, roster: run.roster.map((r) => (r.rosterId === rosterId ? next : r)) };
}
