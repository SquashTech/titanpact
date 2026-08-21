// The Class system: a run-scoped, one-per-hero passive grant applying a
// thematic two-stat buff (CLAUDE.md-adjacent design, 2026-08-20 conversation
// — "a hero can only get one Class per run... generally they apply a
// thematic application of BST"). A Class IS a Passive (engine/content.ts
// PassiveDefinition, src/data/classes.ts) — this module only owns the
// run-tier grant/replace mechanics, mirroring progression.ts's Evolution
// pattern but with a single nullable slot (RosterEntry.classId) instead of
// an accumulating list, since "one Class per run" means a later grant
// REPLACES the current one rather than stacking. How a Class is offered
// (a map-node reward type, an act-end choice, a scripted event) is not yet
// decided — deliberately out of scope here; this module only implements the
// mechanism once a classId has been chosen by whatever offers it.

import type { PassiveDefinition, PassiveId } from '../engine/content';
import type { RosterEntry, RunState } from './state';

export class ClassError extends Error {}

function requireEntry(run: RunState, rosterId: string): RosterEntry {
  const entry = run.roster.find((r) => r.rosterId === rosterId);
  if (!entry) throw new ClassError(`${rosterId} is not on the roster`);
  return entry;
}

/**
 * Grants a Class to a roster entry, REPLACING whatever Class it already held
 * (if any) — this is what makes "one Class per run" true structurally rather
 * than by convention, since RosterEntry.classId is a single slot, not a list.
 * Free, like choosing an Evolution path: whatever currency/event unlocked the
 * offer already paid for it.
 */
export function grantClass(run: RunState, classes: Record<PassiveId, PassiveDefinition>, rosterId: string, classId: PassiveId): RunState {
  const entry = requireEntry(run, rosterId);
  if (!classes[classId]) throw new ClassError(`Unknown class ${classId}`);
  return {
    ...run,
    roster: run.roster.map((r) => (r.rosterId === rosterId ? { ...r, classId } : r)),
  };
}

/** Resolves a roster entry's chosen Class back to its full data, or null if it hasn't taken one yet — for read-only display (roster/stat screens). */
export function chosenClass(classes: Record<PassiveId, PassiveDefinition>, entry: RosterEntry): PassiveDefinition | null {
  return entry.classId ? classes[entry.classId] ?? null : null;
}
