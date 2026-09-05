// The player profile: what survives every run, as opposed to RunState, which is one run.
// Pure — shape, verbs and decoding; src/app/profileStorage.ts owns localStorage.
//
// Decoding here is LENIENT, and deliberately the opposite of save.ts. A refused save costs
// one run; a refused profile costs a lifetime of playtime and every star ever earned, and
// there is nothing to recover it from. So a malformed field falls back to its default and
// everything readable around it is kept, and star entries naming a hero this build no longer
// ships are dropped rather than taken as proof the file is bad. A profile is a record of what
// the player did, not state the engine runs on, so a partially-read one is still true.

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
  /**
   * heroId -> runs cleared with that hero on the final roster. A count, not a tier: the
   * Compendium renders one star and the number, so there is no ceiling to design around.
   */
  heroStars: Record<string, number>;
  /** 0 until the first run is sealed. */
  firstPlayedAt: number;
  lastPlayedAt: number;
}

export function createProfile(): Profile {
  return {
    version: PROFILE_VERSION,
    playtimeMs: 0,
    runsStarted: 0,
    runsCompleted: 0,
    runsFailed: 0,
    furthestAct: 1,
    heroStars: {},
    firstPlayedAt: 0,
    lastPlayedAt: 0,
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
    firstPlayedAt: profile.firstPlayedAt === 0 ? now : profile.firstPlayedAt,
    lastPlayedAt: now,
  };
}

/**
 * A star per hero on the roster at the moment the last Guardian fell. Roster-at-the-end rather
 * than ever-recruited: the run was cleared by the team that finished it, and a hero terminated
 * in Act 2 did not clear anything. Duplicated hero ids on one roster cannot happen (recruitment
 * bars a second copy), but the tally is written as an increment so it would not matter.
 */
export function recordRunCompleted(profile: Profile, finalHeroIds: readonly string[], now: number): Profile {
  const heroStars = { ...profile.heroStars };
  for (const heroId of finalHeroIds) heroStars[heroId] = (heroStars[heroId] ?? 0) + 1;
  return { ...profile, runsCompleted: profile.runsCompleted + 1, heroStars, lastPlayedAt: now };
}

export function recordRunFailed(profile: Profile, now: number): Profile {
  return { ...profile, runsFailed: profile.runsFailed + 1, lastPlayedAt: now };
}

/** Monotonic: reaching Act 2 after a run that reached Act 4 does not walk the record back. */
export function recordActReached(profile: Profile, actNumber: number): Profile {
  if (!Number.isInteger(actNumber) || actNumber <= profile.furthestAct) return profile;
  return { ...profile, furthestAct: actNumber };
}

// --- Reading ---

export function totalStars(profile: Profile): number {
  let total = 0;
  for (const count of Object.values(profile.heroStars)) total += count;
  return total;
}

export function starredHeroCount(profile: Profile): number {
  return Object.values(profile.heroStars).filter((count) => count > 0).length;
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

/**
 * Never fails and never throws: an unreadable profile decodes to a fresh one, and a partly
 * readable one keeps every field that survived. `knownHeroIds` drops stars for heroes this
 * build no longer ships — omit it to keep every entry (the tests do, so a rename is visible).
 */
export function decodeProfile(raw: unknown, knownHeroIds?: ReadonlySet<string>): Profile {
  const base = createProfile();
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return base;
  const value = raw as Record<string, unknown>;

  const heroStars: Record<string, number> = {};
  if (typeof value.heroStars === 'object' && value.heroStars !== null && !Array.isArray(value.heroStars)) {
    for (const [heroId, stars] of Object.entries(value.heroStars as Record<string, unknown>)) {
      if (knownHeroIds && !knownHeroIds.has(heroId)) continue;
      const tally = count(stars);
      if (tally > 0) heroStars[heroId] = tally;
    }
  }

  return {
    version: PROFILE_VERSION,
    playtimeMs: count(value.playtimeMs),
    runsStarted: count(value.runsStarted),
    runsCompleted: count(value.runsCompleted),
    runsFailed: count(value.runsFailed),
    furthestAct: Math.max(1, count(value.furthestAct, 1)),
    heroStars,
    firstPlayedAt: count(value.firstPlayedAt),
    lastPlayedAt: count(value.lastPlayedAt),
  };
}
