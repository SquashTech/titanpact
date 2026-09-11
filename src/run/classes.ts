// The Class system (docs/growth-overhaul.md §11): a one-per-hero, run-scoped VERB — a move
// granted outright, or a passive — tempered into a hero at the Crucible. Content is in
// src/data/classes.ts; this module owns the schema, the offer and the grant.

import type { PassiveId } from '../engine/content';
import { grantMove, MOVE_CAP } from './progression';
import type { RosterEntry, RunState } from './state';

export type ClassKind = 'offensive' | 'defensive' | 'utility';

/**
 * The Evolution path's schema minus the graft and the hero: a name, a kind, and exactly ONE of a
 * move or a passive. Never a stat line — a Class is a verb, and "+10 Attack" is what the Gems
 * were deleted for. Hero-agnostic by construction, so a class move is a role verb any hero can
 * use rather than a nuke priced on STAB.
 */
export interface ClassDefinition {
  id: string;
  name: string;
  /** Documentation of intent ("differ in kind") — the Crucible offers one of each. */
  kind: ClassKind;
  /** Shown on the Crucible's cards. */
  description: string;
  /** Granted outright on the choice, replace-or-decline at MOVE_CAP exactly as an Evolution's grant. */
  grantsMoveId?: string;
  /** In the passive catalog under the same id (data/passives.ts folds classPassives in). */
  grantsPassiveId?: PassiveId;
}

export const CLASS_KINDS: readonly ClassKind[] = ['offensive', 'defensive', 'utility'];

export class ClassError extends Error {}

function requireEntry(run: RunState, rosterId: string): RosterEntry {
  const entry = run.roster.find((r) => r.rosterId === rosterId);
  if (!entry) throw new ClassError(`${rosterId} is not on the roster`);
  return entry;
}

/** Exactly one verb. Enforced by test/classes.test.ts over the catalog and here on grant. */
export function isValidClassDefinition(cls: ClassDefinition): boolean {
  return (cls.grantsMoveId !== undefined) !== (cls.grantsPassiveId !== undefined);
}

/**
 * The Crucible's three: one per kind, each drawn uniformly from its kind. `rng` in [0, 1).
 * An Evolution branch is three paths differing in kind; the Crucible reads the same way.
 */
export function rollClassOffers(classes: Record<string, ClassDefinition>, rng: () => number): ClassDefinition[] {
  return CLASS_KINDS.flatMap((kind) => {
    const pool = Object.values(classes).filter((cls) => cls.kind === kind);
    return pool.length > 0 ? [pool[Math.floor(rng() * pool.length)]] : [];
  });
}

/** Whether the Crucible has anyone to temper: a hero holding no Class. */
export function anyClassAvailable(roster: readonly RosterEntry[]): boolean {
  return roster.some((entry) => entry.classId === null);
}

/** A class move the cap would refuse — the screen offers it as a replace-or-decline before granting. */
export function classMoveOverflows(cls: ClassDefinition, entry: RosterEntry): boolean {
  return !!cls.grantsMoveId && !entry.unlockedMoveIds.includes(cls.grantsMoveId) && entry.unlockedMoveIds.length >= MOVE_CAP;
}

/**
 * REPLACES any Class already held — "one Class per run" holds structurally. Free, like an
 * Evolution choice. A move-Class lands its move here (`replaceMoveId` when the kit is full;
 * omit it to decline the move and still take the Class); a passive-Class records its passive on
 * the entry so the stat/passive pipeline (entryStats.ts) needs no catalog to read it.
 */
export function grantClass(
  run: RunState,
  classes: Record<string, ClassDefinition>,
  rosterId: string,
  classId: string,
  replaceMoveId?: string
): RunState {
  const entry = requireEntry(run, rosterId);
  const cls = classes[classId];
  if (!cls) throw new ClassError(`Unknown class ${classId}`);
  if (!isValidClassDefinition(cls)) throw new ClassError(`Class ${classId} must grant exactly one of a move or a passive`);

  let next: RunState = {
    ...run,
    roster: run.roster.map((r) => (r.rosterId === rosterId ? { ...r, classId, classPassiveId: cls.grantsPassiveId ?? null } : r)),
  };
  const moveId = cls.grantsMoveId;
  if (moveId && !entry.unlockedMoveIds.includes(moveId)) {
    const room = entry.unlockedMoveIds.length < MOVE_CAP;
    if (room) next = grantMove(next, rosterId, moveId);
    else if (replaceMoveId) next = grantMove(next, rosterId, moveId, replaceMoveId);
  }
  return next;
}

export function chosenClass(classes: Record<string, ClassDefinition>, entry: RosterEntry): ClassDefinition | null {
  return entry.classId ? classes[entry.classId] ?? null : null;
}
