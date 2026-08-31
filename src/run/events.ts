// The run-tier mechanism behind map EVENTS (src/data/events.ts is the
// content). Pure RunState transforms and pure selection helpers — no view, no
// engine internals — same shape as runProgress.ts and classes.ts.
//
// Two jobs:
//   1. SELECTION — which events are eligible here (act + Location gates) and
//      rolling one. Called once at node-select time (App.tsx), never inside a
//      component, for the reason shop.ts's header spells out at length: a
//      component-local roll rerolls on every remount, and this screen remounts
//      whenever its loot hands off to the forced-equip gate.
//   2. RESOLUTION — the outcome verbs the screen calls once the player has
//      chosen. Move teaching deliberately reuses progression.ts's
//      grantLevelUpMove rather than growing a near-duplicate here: "add a move,
//      or swap it for one of the four" is one rule, and two copies of it would
//      drift the first time the cap changes.

import type { MoveDefinition, PassiveId, StatKey } from '../engine/content';
import type { MovePoolFilter, RunEventDefinition } from '../data/events';
import type { RosterEntry, RunState } from './state';
import { mergeStatMods } from './statMods';

export class RunEventError extends Error {}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

/**
 * The events that may be rolled at this point in this run. Two gates, both
 * authored per-event and both omitted by default:
 *
 *   - `minAct`      — earliest act, inclusive.
 *   - `locationIds` — the Locations this event belongs to (docs/locations.md).
 *
 * `locationId` is passed rather than read off the run because the run only
 * stores an itinerary of ids and the caller already resolved the current act's
 * Location for the screen's ambience — see src/run/locations.ts locationForAct.
 * Passing `null` (a run with no itinerary, e.g. a test fixture) matches only
 * the unrestricted events, which is the conservative reading: an event
 * authored for the Necropolis should not appear somewhere unknown.
 */
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

/**
 * Rolls one eligible event, uniformly (see the catalog's note on why there are
 * no weights yet). Returns null only if nothing is eligible at all — a case the
 * caller must handle rather than crash on, since a future Location gate could
 * in principle empty the pool.
 */
export function rollRunEvent(
  defs: Record<string, RunEventDefinition>,
  actNumber: number,
  locationId: string | null
): RunEventDefinition | null {
  const pool = eligibleEvents(defs, actNumber, locationId);
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * The move ids a `learnMove` filter resolves to, against the live catalog. An
 * omitted filter means every move in the game — which is exactly Wildcard, and
 * is why the empty case is the permissive one rather than an error.
 */
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

/** Rolls the single move a `learnMove` event offers. Undefined if the filter matches nothing — authored content should never do that, but a typo in `nameIncludes` shouldn't take the run down. */
export function rollEventMove(filter: MovePoolFilter | undefined, moves: Record<string, MoveDefinition>): string | undefined {
  const pool = movePoolFor(filter, moves);
  if (pool.length === 0) return undefined;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

/**
 * The lowest a `statShift` event is allowed to leave a hero's max HP.
 *
 * Soul Transfer is the first content that takes a stat AWAY, and nothing else
 * in the run tier assumes stats stay positive: max HP feeds getMaxHp, which
 * feeds starting HP, which at zero is a hero that faints the instant a fight is
 * built. One drain is nowhere near it (heroes base 80-110), so this is not a
 * balance knob — it is the floor that keeps a repeated or later, harsher drain
 * from producing an unplayable roster entry. The screen greys out a hero the
 * shift would push under it rather than failing on tap.
 */
export const MIN_HP_AFTER_SHIFT = 10;

/** Whether `deltas` may be applied to a hero whose current effective max HP is `currentMaxHp`. Only HP is floored — it is the only stat whose reaching zero ends the hero. */
export function statShiftAllowed(deltas: Partial<Record<StatKey, number>>, currentMaxHp: number): boolean {
  const hpDelta = deltas.hp ?? 0;
  return hpDelta >= 0 || currentMaxHp + hpDelta >= MIN_HP_AFTER_SHIFT;
}

function requireEntry(run: RunState, rosterId: string): RosterEntry {
  const entry = run.roster.find((r) => r.rosterId === rosterId);
  if (!entry) throw new RunEventError(`${rosterId} is not on the roster`);
  return entry;
}

/**
 * `statShift` resolution: folds every delta into the chosen hero's
 * `bonusStatGrants` in ONE transform, rather than calling runProgress.ts's
 * single-stat grantStatBonus once per entry. Soul Transfer's two halves are one
 * trade — applying them separately would let a caller commit the cost and drop
 * the payoff.
 */
export function applyStatShift(run: RunState, rosterId: string, deltas: Partial<Record<StatKey, number>>): RunState {
  const entry = requireEntry(run, rosterId);
  const next: RosterEntry = { ...entry, bonusStatGrants: mergeStatMods(entry.bonusStatGrants, deltas) };
  return { ...run, roster: run.roster.map((r) => (r.rosterId === rosterId ? next : r)) };
}

/**
 * `grantPassive` resolution: appends to the chosen hero's
 * `bonusPassiveGrants`. Appends rather than de-duplicating — a second copy
 * stacks (state.ts's field doc), the same way a second copy of a
 * passive-granting relic does.
 */
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
