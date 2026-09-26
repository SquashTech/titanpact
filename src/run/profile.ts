// The player profile: what survives every run, as opposed to RunState, which is one run.
// Pure — shape, verbs and decoding; src/app/profileStorage.ts owns localStorage.
//
// Decoding here is LENIENT, and deliberately the opposite of save.ts. A refused save costs
// one run; a refused profile costs a lifetime of playtime and every star ever earned, and
// there is nothing to recover it from. So a malformed field falls back to its default and
// everything readable around it is kept, and star entries naming a hero this build no longer
// ships are dropped rather than taken as proof the file is bad. A profile is a record of what
// the player did, not state the engine runs on, so a partially-read one is still true.

import { spawnPosition } from '../data/titanspawn';

export const PROFILE_VERSION = 1;

export interface Profile {
  version: number;
  /** Total foreground ms. Accumulated by src/app/usePlaytime.ts, which flushes it periodically. */
  playtimeMs: number;
  /** Incremented when a draft is sealed, so an abandoned run still counts as played. */
  runsStarted: number;
  /** Every act cleared. */
  runsCompleted: number;
  /** Ended in a squad wipe. Abandoning is neither a clear nor a loss — the player chose to stop. */
  runsFailed: number;
  /** Furthest act reached in any run, 1-indexed. */
  furthestAct: number;
  /** The highest Ascension rung a run has been cleared on (run/ascension.ts); 0 until a run above Base is cleared. */
  ascensionCleared: number;
  /**
   * heroId -> the Evolution path ids that hero has cleared a run down. One star a path, three a
   * hero, and a hero that finished a run unevolved earns nothing — the star is for the form, not
   * the name. Stars are the meta-progression currency (spent on things designed later), so the
   * SET is the record and there is no count to inflate.
   */
  evolutionStars: Record<string, string[]>;
  /**
   * The Titanspawn lines (by type) a run has been cleared with the companion still on the roster —
   * one star a type, fourteen to collect, on the Compendium's Titanspawn page (docs/ascension.md §7).
   * Alive is the condition, not the body it reached.
   */
  companionStars: string[];
  /**
   * The Titanspawn lines (by type) whose companion reached the finale and woke to Ancient. Every
   * later companion of that line joins with Ancient in its secondary slot (run/companion.ts).
   */
  ascendedSpawnTypes: string[];
  /**
   * Every run that ENDED — cleared or wiped — newest first, at most RUN_HISTORY_CAP. An
   * abandoned run is not here for the same reason it is neither a clear nor a loss: the player
   * chose to stop, and a history of things that were stopped is not a history.
   */
  runHistory: RunRecord[];
  /**
   * `playtimeMs` as it stood when the current run's pact was sealed, so the run's own length
   * can be read off the same clock at its end; null when no run has been started this profile.
   * A dev test run never records a start, so its record carries no duration.
   */
  runStartedAtPlaytimeMs: number | null;
  /** Constellation (star shop) offer ids bought (run/starShop.ts), each at most once. Stars are never un-earned; this is what draws the balance down. */
  purchases: string[];
  /** The Starter Pack the next run drafts from (run/starterPacks.ts). 'base' by default; a pack not held falls back to it on read. */
  equippedPackId: string;
  /** 0 until the first run is sealed. */
  firstPlayedAt: number;
  lastPlayedAt: number;
  /**
   * First-time tips already shown (run/tips.ts, docs/tutorial.md), and the lore card as
   * `LORE_TIP_ID`. Account-wide rather than per run: a tip read in a run that was wiped is not
   * read again in the next one. Ids are kept whether or not this build still ships them.
   */
  seenTipIds: string[];
}

/** Oldest records fall off the end. Fifty is a season of play, and past that a list stops being read. */
export const RUN_HISTORY_CAP = 50;

/** A hero as it finished a run: which body, how far it grew, what form it took. */
export interface RunRecordHero {
  heroId: string;
  level: number;
  /** The last Evolution path taken, or null for a hero that finished unevolved. */
  evolutionPathId: string | null;
}

/** One line of the run history: what a finished run came to, as the summary screen showed it. */
export interface RunRecord {
  outcome: 'win' | 'loss';
  endedAt: number;
  /** Foreground playtime between the pact and the end, or null for a run whose start was not recorded. */
  durationMs: number | null;
  /** The act it ended in, 1-indexed; past SEAL_ACTS is the finale. */
  actReached: number;
  /** That act's Location, or null on a run without an itinerary. */
  locationId: string | null;
  encountersWon: number;
  /** The rung it was played on (run/ascension.ts); 0 on every record written before the ladder. */
  ascension: number;
  /** The roster at the end, in roster order. */
  roster: RunRecordHero[];
  /** The Evolution path ids — and `companion:<type>` — this run's clear starred for the first time; a loss stars nothing. */
  starsEarned: string[];
}

/** What the app hands over at a run's end; the verb fills in the rest of the record. */
export type RunEnd = Omit<RunRecord, 'endedAt' | 'durationMs' | 'starsEarned'>;

export function createProfile(): Profile {
  return {
    version: PROFILE_VERSION,
    playtimeMs: 0,
    runsStarted: 0,
    runsCompleted: 0,
    runsFailed: 0,
    furthestAct: 1,
    ascensionCleared: 0,
    evolutionStars: {},
    companionStars: [],
    ascendedSpawnTypes: [],
    runHistory: [],
    runStartedAtPlaytimeMs: null,
    purchases: [],
    equippedPackId: 'base',
    firstPlayedAt: 0,
    lastPlayedAt: 0,
    seenTipIds: [],
  };
}

// --- Verbs. Each returns a new Profile; none of them mutates. ---

/** Ignores a negative or non-finite span rather than corrupting the total with it. */
export function addPlaytime(profile: Profile, ms: number): Profile {
  if (!Number.isFinite(ms) || ms <= 0) return profile;
  return { ...profile, playtimeMs: profile.playtimeMs + Math.round(ms) };
}

export function recordRunStarted(profile: Profile, now: number): Profile {
  return {
    ...profile,
    runsStarted: profile.runsStarted + 1,
    runStartedAtPlaytimeMs: profile.playtimeMs,
    firstPlayedAt: profile.firstPlayedAt === 0 ? now : profile.firstPlayedAt,
    lastPlayedAt: now,
  };
}

/**
 * A run ended, cleared or wiped: the tallies, the stars and the history, in one write so the
 * three can never disagree about what happened.
 *
 * A clear stars every EVOLVED hero on the roster at the moment the last Guardian fell, keyed by
 * the path it finished down. Roster-at-the-end rather than ever-recruited: the run was cleared by
 * the team that finished it, and a hero terminated in Act 2 did not clear anything. A star already
 * held is not doubled — clearing twice down the same path is the same star — and the record
 * remembers only the stars that were NEW, which is what a history line has to say.
 */
export function recordRunEnded(profile: Profile, end: RunEnd, now: number): Profile {
  const evolutionStars = { ...profile.evolutionStars };
  const companionStars = [...profile.companionStars];
  const starsEarned: string[] = [];
  if (end.outcome === 'win') {
    for (const { heroId, evolutionPathId } of end.roster) {
      // The roster at the Eyes' close: a companion KO'd in the finale is already off it.
      const type = companionTypeOf(heroId);
      if (type && !companionStars.includes(type)) {
        companionStars.push(type);
        starsEarned.push(companionStarId(type));
      }
      if (!evolutionPathId) continue;
      const held = evolutionStars[heroId] ?? [];
      if (held.includes(evolutionPathId)) continue;
      evolutionStars[heroId] = [...held, evolutionPathId];
      starsEarned.push(evolutionPathId);
    }
  }
  const record: RunRecord = {
    ...end,
    roster: end.roster.map((hero) => ({ ...hero })),
    endedAt: now,
    durationMs: profile.runStartedAtPlaytimeMs === null ? null : Math.max(0, profile.playtimeMs - profile.runStartedAtPlaytimeMs),
    starsEarned,
  };
  return {
    ...profile,
    runsCompleted: profile.runsCompleted + (end.outcome === 'win' ? 1 : 0),
    runsFailed: profile.runsFailed + (end.outcome === 'loss' ? 1 : 0),
    ascensionCleared: end.outcome === 'win' ? Math.max(profile.ascensionCleared, end.ascension) : profile.ascensionCleared,
    evolutionStars,
    companionStars,
    runHistory: [record, ...profile.runHistory].slice(0, RUN_HISTORY_CAP),
    // The run is over; a dev test run started without a pact must not inherit this one's clock.
    runStartedAtPlaytimeMs: null,
    lastPlayedAt: now,
  };
}

/** Idempotent: a tip dismissed twice (a double-fired handler) records once. */
export function recordTipSeen(profile: Profile, id: string): Profile {
  return profile.seenTipIds.includes(id) ? profile : { ...profile, seenTipIds: [...profile.seenTipIds, id] };
}

/** Every tip, and the lore card, shows again on its next occasion (the title's Dev menu). */
export function resetTips(profile: Profile): Profile {
  return profile.seenTipIds.length === 0 ? profile : { ...profile, seenTipIds: [] };
}

/** The companion reached the finale and woke: its line joins with Ancient on every later run. Idempotent. */
export function recordSpawnAscended(profile: Profile, type: string): Profile {
  return profile.ascendedSpawnTypes.includes(type) ? profile : { ...profile, ascendedSpawnTypes: [...profile.ascendedSpawnTypes, type] };
}

/** Monotonic: reaching Act 2 after a run that reached Act 4 does not walk the record back. */
export function recordActReached(profile: Profile, actNumber: number): Profile {
  if (!Number.isInteger(actNumber) || actNumber <= profile.furthestAct) return profile;
  return { ...profile, furthestAct: actNumber };
}

// --- Reading ---

export function hasEvolutionStar(profile: Profile, heroId: string, pathId: string): boolean {
  return profile.evolutionStars[heroId]?.includes(pathId) ?? false;
}

/** The Titanspawn line a body belongs to, or null for a hero. */
export function companionTypeOf(heroId: string): string | null {
  return spawnPosition(heroId)?.line.type ?? null;
}

/** A companion star as `RunRecord.starsEarned` names it, beside the path ids. */
export function companionStarId(type: string): string {
  return `companion:${type}`;
}

export function hasCompanionStar(profile: Profile, type: string): boolean {
  return profile.companionStars.includes(type);
}

export function isSpawnAscended(profile: Profile, type: string): boolean {
  return profile.ascendedSpawnTypes.includes(type);
}

export function totalStars(profile: Profile): number {
  let total = profile.companionStars.length;
  for (const paths of Object.values(profile.evolutionStars)) total += paths.length;
  return total;
}

/** Heroes holding at least one star. */
export function starredHeroCount(profile: Profile): number {
  return Object.values(profile.evolutionStars).filter((paths) => paths.length > 0).length;
}

/** "4h 12m", "12m", "under a minute" — coarse, because this is a keepsake figure, not a timer. */
export function formatPlaytime(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'under a minute';
  const hours = Math.floor(minutes / 60);
  if (hours < 1) return `${minutes}m`;
  return `${hours}h ${minutes % 60}m`;
}

// --- Decoding ---

function count(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Non-empty strings only, in order; anything else in the list is skipped. */
function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length > 0) : [];
}

/**
 * A record is kept if its outcome and act are readable — a line with no outcome says nothing.
 * Its roster keeps every hero with an id: a companion's body is not in `knownHeroIds`, and a
 * hero this build no longer ships is still what the run was played with (the view skips what
 * it cannot draw). Path ids are checked against `knownPathIds` where given, as the stars are.
 */
function decodeRunRecord(raw: unknown, knownPathIds?: ReadonlySet<string>): RunRecord | null {
  if (!isRecord(raw)) return null;
  if (raw.outcome !== 'win' && raw.outcome !== 'loss') return null;
  const actReached = count(raw.actReached);
  if (actReached < 1) return null;
  const knownPath = (id: unknown): string | null =>
    typeof id === 'string' && id.length > 0 && (!knownPathIds || knownPathIds.has(id)) ? id : null;
  const roster: RunRecordHero[] = [];
  if (Array.isArray(raw.roster)) {
    for (const hero of raw.roster) {
      if (!isRecord(hero) || typeof hero.heroId !== 'string' || hero.heroId.length === 0) continue;
      roster.push({ heroId: hero.heroId, level: Math.max(1, count(hero.level, 1)), evolutionPathId: knownPath(hero.evolutionPathId) });
    }
  }
  return {
    outcome: raw.outcome,
    endedAt: count(raw.endedAt),
    durationMs: typeof raw.durationMs === 'number' && Number.isFinite(raw.durationMs) && raw.durationMs >= 0 ? Math.floor(raw.durationMs) : null,
    actReached,
    locationId: typeof raw.locationId === 'string' && raw.locationId.length > 0 ? raw.locationId : null,
    encountersWon: count(raw.encountersWon),
    ascension: count(raw.ascension),
    roster,
    starsEarned: stringList(raw.starsEarned).filter((id) => id.startsWith('companion:') || knownPath(id) !== null),
  };
}

/**
 * Never fails and never throws: an unreadable profile decodes to a fresh one, and a partly
 * readable one keeps every field that survived. `knownHeroIds` drops stars for heroes this
 * build no longer ships and `knownPathIds` stars for paths it no longer authors — omit them to
 * keep every entry (the tests do, so a rename is visible).
 *
 * A pre-2026-09-16 file's `heroStars` (heroId -> a run count) is not carried over: a count names
 * no path, so there is nothing to attach it to. Those stars are lost on purpose rather than
 * guessed onto a path the player may never have taken.
 */
export function decodeProfile(raw: unknown, knownHeroIds?: ReadonlySet<string>, knownPathIds?: ReadonlySet<string>): Profile {
  const base = createProfile();
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return base;
  const value = raw as Record<string, unknown>;

  const evolutionStars: Record<string, string[]> = {};
  if (isRecord(value.evolutionStars)) {
    for (const [heroId, paths] of Object.entries(value.evolutionStars)) {
      if (knownHeroIds && !knownHeroIds.has(heroId)) continue;
      if (!Array.isArray(paths)) continue;
      const kept: string[] = [];
      for (const pathId of paths) {
        if (typeof pathId !== 'string' || pathId.length === 0 || kept.includes(pathId)) continue;
        if (knownPathIds && !knownPathIds.has(pathId)) continue;
        kept.push(pathId);
      }
      if (kept.length > 0) evolutionStars[heroId] = kept;
    }
  }

  const runHistory: RunRecord[] = [];
  if (Array.isArray(value.runHistory)) {
    for (const raw of value.runHistory) {
      const record = decodeRunRecord(raw, knownPathIds);
      if (record) runHistory.push(record);
      if (runHistory.length >= RUN_HISTORY_CAP) break;
    }
  }

  return {
    version: PROFILE_VERSION,
    playtimeMs: count(value.playtimeMs),
    runsStarted: count(value.runsStarted),
    runsCompleted: count(value.runsCompleted),
    runsFailed: count(value.runsFailed),
    furthestAct: Math.max(1, count(value.furthestAct, 1)),
    ascensionCleared: count(value.ascensionCleared),
    evolutionStars,
    // Absent on every file written before the bestiary; such a player starts both empty.
    companionStars: [...new Set(stringList(value.companionStars))],
    ascendedSpawnTypes: [...new Set(stringList(value.ascendedSpawnTypes))],
    runHistory,
    runStartedAtPlaytimeMs: typeof value.runStartedAtPlaytimeMs === 'number' && Number.isFinite(value.runStartedAtPlaytimeMs) ? Math.max(0, Math.floor(value.runStartedAtPlaytimeMs)) : null,
    // Deduplicated: an offer is held once. An id this build no longer sells is kept — it costs
    // nothing against the balance (starShop.ts) and comes back if the offer does.
    purchases: [...new Set(stringList(value.purchases))],
    // 'base' on every file written before packs existed; an unknown id is harmless (equippedPack falls back).
    equippedPackId: typeof value.equippedPackId === 'string' && value.equippedPackId ? value.equippedPackId : 'base',
    firstPlayedAt: count(value.firstPlayedAt),
    lastPlayedAt: count(value.lastPlayedAt),
    // Absent on every profile written before the tips; such a player sees each one once. A
    // pre-tips `tutorialDone` is dropped — the scripted run it recorded no longer exists.
    seenTipIds: [...new Set(stringList(value.seenTipIds))],
  };
}
