// The storage half of run persistence: localStorage, an IndexedDB mirror, and the real content
// catalogs. The rules live in src/run/save.ts and src/run/saveEnvelope.ts; this file binds them to
// keys and a browser (docs/save-system.md §6).
//
// A write is a swap: the new file goes to `.next` and is read back, the old main is copied to
// `.bak`, then main is written and `.next` removed. A read takes the first of main, `.next`, `.bak`
// whose checksum and decode both pass, so a write cut off at any step leaves a readable run.

import { classes } from '../data/classes';
import { CHAMPION_IDS } from '../data/enemies';
import { equipment } from '../data/equipment';
import { allCombatants, rosterHeroes } from '../data/content';
import { runEvents } from '../data/events';
import { locations } from '../data/locations';
import { moves } from '../data/moves';
import { progressionTable } from '../data/progression';
import { relics } from '../data/relics';
import { passives } from '../data/passives';
import { TYPES } from '../data/typechart';
import { buildContentIndex, decodeSave, encodeSave, type SaveCheckpoint, type SavedRun } from '../run/save';
import { decodeResume, type ResumePayload } from '../run/resume';
import { pickReadable, unwrapEnvelope, wrapEnvelope, type SaveSource } from '../run/saveEnvelope';
import type { RunState } from '../run/state';

const STORAGE_KEY = 'titanpact.run';
const NEXT_KEY = `${STORAGE_KEY}.next`;
const BACKUP_KEY = `${STORAGE_KEY}.bak`;

const contentIndex = buildContentIndex({
  // The roster may hold the companion, whose body is a spawn, so the catalog is the roster's.
  heroes: rosterHeroes,
  moves,
  equipment,
  relics,
  passives,
  classes,
  locations,
  championIds: CHAMPION_IDS,
  types: TYPES,
  progression: progressionTable,
  combatants: allCombatants,
  events: runEvents,
});

/** What a read found: the save and which copy held it, or why none of them could be read. */
export type SaveRead = { ok: true; save: SavedRun; source: SaveSource } | { ok: false; reason: string };

/** Where a save can live. localStorage today; Capacitor Preferences or a cloud save plug in here. */
interface SaveBackend {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

const local: SaveBackend = {
  get: (key) => localStorage.getItem(key),
  set: (key, value) => localStorage.setItem(key, value),
  remove: (key) => localStorage.removeItem(key),
};

function decodeStored(stored: Partial<Record<SaveSource, string | null>>): SaveRead | null {
  const picked = pickReadable(stored, (payload) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      return { ok: false, reason: 'the save file is not readable JSON' };
    }
    const result = decodeSave(parsed, contentIndex);
    return result.ok ? { ok: true, value: result.save } : result;
  });
  if (!picked) return null;
  if ('failure' in picked) return { ok: false, reason: picked.failure };
  return { ok: true, save: picked.value, source: picked.source };
}

/**
 * Null when there is nothing stored; a SaveRead otherwise, so the caller can tell "no save" apart
 * from "a save this build refuses" and say which.
 */
export function readSave(): SaveRead | null {
  try {
    return decodeStored({ main: local.get(STORAGE_KEY), next: local.get(NEXT_KEY), backup: local.get(BACKUP_KEY) });
  } catch {
    // Private-mode Safari throws on access, same as the audio prefs.
    return null;
  }
}

/** The screen the save was written on, checked against its run; null sends Continue to the checkpoint. */
export function readResume(save: SavedRun): ResumePayload | null {
  return save.resume === undefined ? null : decodeResume(save.resume, contentIndex, save.run);
}

/** The last envelope written, and whether it reached storage — what flushSave tries again. */
let pending: { envelope: string; written: boolean } | null = null;

/** The swap, against one backend. Throws what the backend throws; the caller decides what a full quota costs. */
function swapIn(backend: SaveBackend, envelope: string): void {
  backend.set(NEXT_KEY, envelope);
  if (backend.get(NEXT_KEY) !== envelope) throw new Error('the save did not read back');
  const current = backend.get(STORAGE_KEY);
  if (current !== null && unwrapEnvelope(current) !== null) backend.set(BACKUP_KEY, current);
  backend.set(STORAGE_KEY, envelope);
  backend.remove(NEXT_KEY);
}

function isQuotaError(err: unknown): boolean {
  return err instanceof DOMException && (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED' || err.code === 22);
}

/** Set when a write had to drop the screen to fit; the title says so (TitleScreen's save note). */
let storageFull = false;

export function saveStorageFull(): boolean {
  return storageFull;
}

function store(save: SavedRun): boolean {
  const envelope = wrapEnvelope(JSON.stringify(save));
  pending = { envelope, written: false };
  try {
    swapIn(local, envelope);
  } catch (err) {
    if (!isQuotaError(err)) return false;
    // Full: the backup goes first, then the screen, keeping the checkpoint the run can always reach.
    try {
      local.remove(BACKUP_KEY);
      local.remove(NEXT_KEY);
      swapIn(local, envelope);
    } catch {
      const lean = wrapEnvelope(JSON.stringify(encodeSave(save.fallbackRun ?? save.run, save.checkpoint, save.savedAt)));
      try {
        swapIn(local, lean);
        storageFull = true;
      } catch {
        return false;
      }
      mirror(lean);
      pending = { envelope: lean, written: true };
      return true;
    }
  }
  storageFull = false;
  pending = { envelope, written: true };
  mirror(envelope);
  return true;
}

/**
 * Returns what it wrote, so the caller can keep a Continue card in sync without re-reading — the
 * whole save even when storage refused it, since a run still in memory can still be continued.
 */
export function writeSave(run: RunState, checkpoint: SaveCheckpoint, extras: { fallbackRun?: RunState; resume?: unknown } = {}): SavedRun {
  const save = encodeSave(run, checkpoint, Date.now(), extras);
  store(save);
  return save;
}

/** Tries the last write again if it did not land — as the page is hidden or closed. */
export function flushSave(): void {
  if (!pending || pending.written) return;
  try {
    swapIn(local, pending.envelope);
    pending.written = true;
    mirror(pending.envelope);
  } catch {
    /* Still refused; the run continues in memory. */
  }
}

export function clearSave(): void {
  pending = null;
  for (const key of [STORAGE_KEY, NEXT_KEY, BACKUP_KEY]) {
    try {
      local.remove(key);
    } catch {
      /* Nothing to do; the next write overwrites it anyway. */
    }
  }
  void idb((store) => store.delete(STORAGE_KEY));
}

/** Asks the browser to keep this origin's storage through eviction (iOS clears an unused web app's). Once a run start; a no-op where unsupported. */
export function persistStorage(): void {
  try {
    void navigator.storage?.persist?.();
  } catch {
    /* Unsupported; the IndexedDB mirror is the other half of the answer. */
  }
}

// --- The IndexedDB mirror: written behind every save, read only when localStorage is empty ---

const IDB_NAME = 'titanpact';
const IDB_STORE = 'saves';

function idb<T>(work: (store: IDBObjectStore) => IDBRequest<T>, mode: IDBTransactionMode = 'readwrite'): Promise<T | null> {
  return new Promise((resolve) => {
    try {
      const open = indexedDB.open(IDB_NAME, 1);
      open.onupgradeneeded = () => open.result.createObjectStore(IDB_STORE);
      open.onerror = () => resolve(null);
      open.onsuccess = () => {
        const db = open.result;
        try {
          const request = work(db.transaction(IDB_STORE, mode).objectStore(IDB_STORE));
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => resolve(null);
        } catch {
          resolve(null);
        } finally {
          db.close();
        }
      };
    } catch {
      resolve(null);
    }
  });
}

function mirror(envelope: string): void {
  void idb((store) => store.put(envelope, STORAGE_KEY));
}

/** The mirror's copy when localStorage has none, put back into localStorage once it decodes. */
export async function readSaveFromMirror(): Promise<SaveRead | null> {
  const envelope = await idb<unknown>((store) => store.get(STORAGE_KEY), 'readonly');
  if (typeof envelope !== 'string') return null;
  const result = decodeStored({ main: envelope });
  if (result?.ok) {
    try {
      swapIn(local, envelope);
    } catch {
      /* Readable from the mirror again next boot. */
    }
  }
  return result;
}
