// The storage half of run persistence: localStorage plus the real content catalogs.
// The rules live in src/run/save.ts; this file only binds them to a key and a browser.

import { classes } from '../data/classes';
import { equipment } from '../data/equipment';
import { heroes } from '../data/heroes';
import { locations } from '../data/locations';
import { moves } from '../data/moves';
import { progressionTable } from '../data/progression';
import { relics } from '../data/relics';
import { passives } from '../data/passives';
import { TYPES } from '../data/typechart';
import {
  buildContentIndex,
  decodeSave,
  encodeSave,
  type LoadResult,
  type SaveCheckpoint,
  type SavedRun,
} from '../run/save';
import type { RunState } from '../run/state';

const STORAGE_KEY = 'titanpact.run';

const contentIndex = buildContentIndex({
  heroes,
  moves,
  equipment,
  relics,
  passives,
  classes,
  locations,
  types: TYPES,
  progression: progressionTable,
});

/**
 * Null when there is nothing stored; a LoadResult otherwise, so the caller can tell
 * "no save" apart from "a save this build refuses" and say which.
 */
export function readSave(): LoadResult | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Private-mode Safari throws on access, same as the audio prefs.
    return null;
  }
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'the save file is not readable JSON' };
  }
  return decodeSave(parsed, contentIndex);
}

/**
 * Returns what it wrote, so the caller can keep a Continue card in sync without re-reading.
 * Storage failure is swallowed: a run that cannot be written is still playable, and a full
 * quota must not break the map.
 */
export function writeSave(run: RunState, checkpoint: SaveCheckpoint): SavedRun {
  const save = encodeSave(run, checkpoint);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  } catch {
    /* Storage unavailable or full — the run continues in memory. */
  }
  return save;
}

export function clearSave(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* Nothing to do; the next write overwrites it anyway. */
  }
}
