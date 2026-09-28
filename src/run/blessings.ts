// Blessings (docs/blessings-and-statuses.md §1): a spent-once guard against death, held on the
// roster entry and carried from fight to fight until a knockout uses it. The engine spends it
// (faintHandling.ts applyHpDelta); this file only grants it.

import type { RosterEntry, RunState } from './state';

export class BlessingError extends Error {}

export function isBlessed(entry: RosterEntry): boolean {
  return entry.blessed;
}

/** At most one a hero, so the supply stays countable (§1.4). */
export function canBless(entry: RosterEntry): boolean {
  return !entry.blessed;
}

export function grantBlessing(run: RunState, rosterId: string): RunState {
  const entry = run.roster.find((r) => r.rosterId === rosterId);
  if (!entry) throw new BlessingError(`${rosterId} is not on the roster`);
  if (!canBless(entry)) throw new BlessingError(`${rosterId} already holds a Blessing`);
  return { ...run, roster: run.roster.map((r) => (r.rosterId === rosterId ? { ...r, blessed: true } : r)) };
}

/** The run's opening: every hero the draft put on the roster is Blessed. */
export function blessOpeningPair(run: RunState): RunState {
  return { ...run, roster: run.roster.map((r) => ({ ...r, blessed: true })) };
}
