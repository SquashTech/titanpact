// The Class system: a one-per-hero, run-scoped passive grant. A Class IS a
// Passive (src/data/classes.ts); this module only owns grant/replace.

import type { PassiveDefinition, PassiveId } from '../engine/content';
import type { RosterEntry, RunState } from './state';

export class ClassError extends Error {}

function requireEntry(run: RunState, rosterId: string): RosterEntry {
  const entry = run.roster.find((r) => r.rosterId === rosterId);
  if (!entry) throw new ClassError(`${rosterId} is not on the roster`);
  return entry;
}

/** REPLACES any Class already held — "one Class per run" holds structurally. Free, like an Evolution choice. */
export function grantClass(run: RunState, classes: Record<PassiveId, PassiveDefinition>, rosterId: string, classId: PassiveId): RunState {
  requireEntry(run, rosterId);
  if (!classes[classId]) throw new ClassError(`Unknown class ${classId}`);
  return {
    ...run,
    roster: run.roster.map((r) => (r.rosterId === rosterId ? { ...r, classId } : r)),
  };
}

export function chosenClass(classes: Record<PassiveId, PassiveDefinition>, entry: RosterEntry): PassiveDefinition | null {
  return entry.classId ? classes[entry.classId] ?? null : null;
}
