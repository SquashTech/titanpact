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
import { cycleOf } from './cycles';
import { grantLedgerId } from './recruitment';
import { unenchanted, type Team, type TeamSlot } from './constructed';
import type { Warden } from './wardens';

export const PROFILE_VERSION = 2;

/**
 * Heroes that left the base roster on 2026-09-28 (docs/types-and-heroes.md): a profile written
 * before then owned them free, so it is granted them (`grantLedgerId`) rather than losing them.
 */
export const LEFT_BASE_2026_09_28 = ['brimstone', 'tidecaller', 'glacialWarden', 'tempest', 'nightshade', 'zenith', 'mindweaver', 'steamColossus'];

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
  /** The highest Cycle a run has been cleared on (run/cycles.ts); 0 until a run is cleared. */
  cyclesCleared: number;
  /** The heroes of the first Cycle I win, each holding a seal from Cycle II (run/wardens.ts). Empty until then; never replaced. */
  wardens: Warden[];
  /**
   * heroId -> the Evolution path ids that hero has cleared a run down. One star a path, three a
   * hero, and a hero that finished a run unevolved earns nothing — the star is for the form, not
   * the name. Stars are the meta-progression currency (spent on things designed later), so the
   * SET is the record and there is no count to inflate.
   */
  evolutionStars: Record<string, string[]>;
  /**
   * The Titanspawn lines (by type) a run has been cleared with the companion still on the roster —
   * one star a type, fourteen to collect, on the Constellation's Spawn page (docs/ascension.md §7).
   * Alive is the condition, not the body it reached.
   */
  companionStars: string[];
  /**
   * Star id (a path id, `companion:<type>`, `curse:<id>`) -> the highest Cycle it was earned on
   * (docs/cycles.md §5): what colours the star. Absent for a held star = Cycle I, so every star
   * earned before the Cycles reads as one. Max-only, never walked back.
   */
  starCycles: Record<string, number>;
  /**
   * The curses (data/curses.ts, by id) a run has been cleared with a Turned hero still on the
   * roster — the Werewolf's star (docs/wild-innates-and-events.md §3.3). Turned is the condition:
   * a hero only bitten has not become the thing the star is for.
   */
  curseStars: string[];
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
  /** Lifetime stars paid by clear bonuses (run/cycles.ts `clearBonus`), beside the hero and companion stars. */
  bonusStars: number;
  /** Lifetime stars paid as Ascension entry fees before the Cycles deleted them — spent, never refunded. */
  feesPaid: number;
  /** Constellation (star shop) offer ids bought (run/starShop.ts), each at most once. Stars are never un-earned; this is what draws the balance down. */
  purchases: string[];
  /**
   * The deck as stored (run/deck.ts): type → hero ids, three a row. Kept loose and made legal on
   * read by `profileDeck`, so a hero leaving the catalog or a bundle not held can never strand it.
   * Empty is the default deck.
   */
  deck: Record<string, string[]>;
  /** 0 until the first run is sealed. */
  firstPlayedAt: number;
  lastPlayedAt: number;
  /**
   * First-time tips already shown (run/tips.ts, docs/tutorial.md), and the lore card as
   * `LORE_TIP_ID`. Account-wide rather than per run: a tip read in a run that was wiped is not
   * read again in the next one. Ids are kept whether or not this build still ships them.
   */
  seenTipIds: string[];
  /**
   * The Constructed teams (run/constructed.ts, docs/constructed.md §5), at most TEAM_SLOTS. Kept as
   * written: a slot this build cannot field is marked by the builder, never deleted on read.
   */
  constructedTeams: Team[];
  /**
   * The Trials beaten (data/trials.ts ids), each once — the record, and the stars: a first clear pays
   * TRIAL_CLEAR_STARS, derived from this set (starShop.ts starsEarned) so there is no count to inflate.
   */
  trialsCleared: string[];
}

/** Stars a Trial pays on its first clear (docs/constructed.md §7). First pass. */
export const TRIAL_CLEAR_STARS = 5;

/** Oldest records fall off the end. Fifty is a season of play, and past that a list stops being read. */
export const RUN_HISTORY_CAP = 50;

/** A hero as it finished a run: which body, how far it grew, what form it took. */
export interface RunRecordHero {
  heroId: string;
  level: number;
  /** The last Evolution path taken, or null for a hero that finished unevolved. */
  evolutionPathId: string | null;
  /** The curse the hero finished Turned by (data/curses.ts), or null; absent on records before curses. */
  curseId?: string | null;
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
  /** The Cycle it was played on (run/cycles.ts); Cycle I on every record written before the ladder. */
  cycle: number;
  /** The roster at the end, in roster order. */
  roster: RunRecordHero[];
  /** The companion's line (run/companion.ts), or null for a run that never took one; absent on records before the Call. */
  companionType?: string | null;
  /** The Evolution path ids — and `companion:<type>` — this run's clear starred for the first time; a loss stars nothing. */
  starsEarned: string[];
  /** The Cycle's clear bonus this run paid; 0 on a loss and on every record written before the stakes. */
  clearBonus: number;
}

/** What the app hands over at a run's end; the verb fills in the rest of the record. */
export type RunEnd = Omit<RunRecord, 'endedAt' | 'durationMs' | 'starsEarned' | 'clearBonus'>;

export function createProfile(): Profile {
  return {
    version: PROFILE_VERSION,
    playtimeMs: 0,
    runsStarted: 0,
    runsCompleted: 0,
    runsFailed: 0,
    furthestAct: 1,
    cyclesCleared: 0,
    wardens: [],
    evolutionStars: {},
    companionStars: [],
    starCycles: {},
    curseStars: [],
    ascendedSpawnTypes: [],
    runHistory: [],
    runStartedAtPlaytimeMs: null,
    bonusStars: 0,
    feesPaid: 0,
    purchases: [],
    deck: {},
    firstPlayedAt: 0,
    lastPlayedAt: 0,
    seenTipIds: [],
    constructedTeams: [],
    trialsCleared: [],
  };
}

// --- Verbs. Each returns a new Profile; none of them mutates. ---

/** Ignores a negative or non-finite span rather than corrupting the total with it. */
export function addPlaytime(profile: Profile, ms: number): Profile {
  if (!Number.isFinite(ms) || ms <= 0) return profile;
  return { ...profile, playtimeMs: profile.playtimeMs + Math.round(ms) };
}

/** The pact sealed. No Cycle costs anything to enter (docs/cycles.md §5). */
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
  const curseStars = [...profile.curseStars];
  const starsEarned: string[] = [];
  const starCycles = { ...profile.starCycles };
  const raise = (starId: string, held: boolean) => {
    starCycles[starId] = Math.max(held ? starCycles[starId] ?? 1 : 0, end.cycle);
  };
  if (end.outcome === 'win') {
    for (const { heroId, evolutionPathId, curseId } of end.roster) {
      if (curseId) {
        raise(curseStarId(curseId), curseStars.includes(curseId));
        if (!curseStars.includes(curseId)) {
          curseStars.push(curseId);
          starsEarned.push(curseStarId(curseId));
        }
      }
      if (!evolutionPathId) continue;
      const held = evolutionStars[heroId] ?? [];
      raise(evolutionPathId, held.includes(evolutionPathId));
      if (held.includes(evolutionPathId)) continue;
      evolutionStars[heroId] = [...held, evolutionPathId];
      starsEarned.push(evolutionPathId);
    }
  }
  // A clear with the companion's line along: it cannot be lost, so a clear is the whole condition.
  const companionType = end.outcome === 'win' ? end.companionType : null;
  if (companionType) raise(companionStarId(companionType), companionStars.includes(companionType));
  if (companionType && !companionStars.includes(companionType)) {
    companionStars.push(companionType);
    starsEarned.push(companionStarId(companionType));
  }
  const record: RunRecord = {
    ...end,
    roster: end.roster.map((hero) => ({ ...hero })),
    endedAt: now,
    durationMs: profile.runStartedAtPlaytimeMs === null ? null : Math.max(0, profile.playtimeMs - profile.runStartedAtPlaytimeMs),
    starsEarned,
    clearBonus: end.outcome === 'win' ? cycleOf(end.cycle).clearBonus : 0,
  };
  return {
    ...profile,
    runsCompleted: profile.runsCompleted + (end.outcome === 'win' ? 1 : 0),
    runsFailed: profile.runsFailed + (end.outcome === 'loss' ? 1 : 0),
    cyclesCleared: end.outcome === 'win' ? Math.max(profile.cyclesCleared, end.cycle) : profile.cyclesCleared,
    evolutionStars,
    companionStars,
    curseStars,
    starCycles,
    bonusStars: profile.bonusStars + record.clearBonus,
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

/** A curse star as `RunRecord.starsEarned` names it. */
export function curseStarId(curseId: string): string {
  return `curse:${curseId}`;
}

export function hasCurseStar(profile: Profile, curseId: string): boolean {
  return profile.curseStars.includes(curseId);
}

export function hasCompanionStar(profile: Profile, type: string): boolean {
  return profile.companionStars.includes(type);
}

/** The Cycle a star was earned on at its highest (docs/cycles.md §5), or 0 for a star not held. */
export function starCycleOf(profile: Profile, starId: string, held: boolean): number {
  return held ? profile.starCycles[starId] ?? 1 : 0;
}

export function isSpawnAscended(profile: Profile, type: string): boolean {
  return profile.ascendedSpawnTypes.includes(type);
}

export function totalStars(profile: Profile): number {
  let total = profile.companionStars.length + profile.curseStars.length;
  for (const paths of Object.values(profile.evolutionStars)) total += paths.length;
  return total;
}

/** A Trial won: recorded the first time, unchanged after — a replay pays nothing (docs/constructed.md §7). */
export function recordTrialCleared(profile: Profile, trialId: string): Profile {
  if (profile.trialsCleared.includes(trialId)) return profile;
  return { ...profile, trialsCleared: [...profile.trialsCleared, trialId] };
}

/** What the beaten Trials have paid into the balance. */
export function trialStars(profile: Profile): number {
  return profile.trialsCleared.length * TRIAL_CLEAR_STARS;
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
/** A file written before decks (or with none) decodes empty, which `profileDeck` reads as the default deck. */
function decodeDeck(value: Record<string, unknown>): Record<string, string[]> {
  if (!isRecord(value.deck)) return {};
  const deck: Record<string, string[]> = {};
  for (const [type, row] of Object.entries(value.deck)) deck[type] = [...new Set(stringList(row))];
  return deck;
}

/** A slot keeps its hero id and whatever else reads; a team keeps its readable slots. */
function decodeTeamSlot(raw: unknown): TeamSlot | null {
  if (!isRecord(raw) || typeof raw.heroId !== 'string' || raw.heroId.length === 0) return null;
  return { heroId: raw.heroId, pathId: typeof raw.pathId === 'string' ? raw.pathId : null, moveIds: stringList(raw.moveIds), itemIds: stringList(raw.itemIds).map(unenchanted) };
}

function decodeTeams(value: unknown): Team[] {
  if (!Array.isArray(value)) return [];
  const teams: Team[] = [];
  for (const raw of value) {
    if (!isRecord(raw)) continue;
    const slots = Array.isArray(raw.slots) ? raw.slots.map(decodeTeamSlot).filter((s): s is TeamSlot => s !== null) : [];
    teams.push({ name: typeof raw.name === 'string' ? raw.name : 'Team', slots });
  }
  return teams;
}

/** A Warden keeps its seat while its hero ships; a path this build no longer authors is dropped, the Warden kept unevolved. */
function decodeWardens(value: unknown, knownHeroIds?: ReadonlySet<string>, knownPathIds?: ReadonlySet<string>): Warden[] {
  if (!Array.isArray(value)) return [];
  const wardens: Warden[] = [];
  for (const raw of value) {
    if (!isRecord(raw) || typeof raw.heroId !== 'string' || typeof raw.sealId !== 'string') continue;
    if (knownHeroIds && !knownHeroIds.has(raw.heroId)) continue;
    if (wardens.some((w) => w.heroId === raw.heroId || w.sealId === raw.sealId)) continue;
    const pathId = typeof raw.pathId === 'string' && (!knownPathIds || knownPathIds.has(raw.pathId)) ? raw.pathId : null;
    wardens.push({
      heroId: raw.heroId,
      sealId: raw.sealId,
      pathId,
      moveIds: stringList(raw.moveIds),
      classId: typeof raw.classId === 'string' && raw.classId.length > 0 ? raw.classId : null,
      itemIds: stringList(raw.itemIds),
    });
  }
  return wardens;
}

function decodeStarCycles(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  const out: Record<string, number> = {};
  for (const [id, cycle] of Object.entries(value)) {
    if (typeof cycle === 'number' && Number.isInteger(cycle) && cycle >= 1) out[id] = cycle;
  }
  return out;
}

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
      roster.push({
        heroId: hero.heroId,
        level: Math.max(1, count(hero.level, 1)),
        evolutionPathId: knownPath(hero.evolutionPathId),
        ...(typeof hero.curseId === 'string' && hero.curseId.length > 0 ? { curseId: hero.curseId } : {}),
      });
    }
  }
  return {
    outcome: raw.outcome,
    endedAt: count(raw.endedAt),
    durationMs: typeof raw.durationMs === 'number' && Number.isFinite(raw.durationMs) && raw.durationMs >= 0 ? Math.floor(raw.durationMs) : null,
    actReached,
    locationId: typeof raw.locationId === 'string' && raw.locationId.length > 0 ? raw.locationId : null,
    encountersWon: count(raw.encountersWon),
    // A record from before the Cycles holds an Ascension rung, 0 being Cycle I.
    cycle: raw.cycle !== undefined ? Math.max(1, count(raw.cycle, 1)) : count(raw.ascension) + 1,
    roster,
    ...(typeof raw.companionType === 'string' && raw.companionType.length > 0 ? { companionType: raw.companionType } : {}),
    starsEarned: stringList(raw.starsEarned).filter((id) => id.startsWith('companion:') || id.startsWith('curse:') || knownPath(id) !== null),
    clearBonus: count(raw.clearBonus),
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
    // A file from before the Cycles holds the highest Ascension rung cleared, 0 being Cycle I.
    cyclesCleared: value.cyclesCleared !== undefined ? count(value.cyclesCleared) : count(value.runsCompleted) > 0 ? count(value.ascensionCleared) + 1 : 0,
    wardens: decodeWardens(value.wardens, knownHeroIds, knownPathIds),
    evolutionStars,
    // Absent on every file written before the bestiary; such a player starts both empty.
    companionStars: [...new Set(stringList(value.companionStars))],
    // Absent on every file written before the Cycles: every star reads as Cycle I.
    starCycles: decodeStarCycles(value.starCycles),
    // Absent on every file written before curses.
    curseStars: [...new Set(stringList(value.curseStars))],
    ascendedSpawnTypes: [...new Set(stringList(value.ascendedSpawnTypes))],
    runHistory,
    runStartedAtPlaytimeMs: typeof value.runStartedAtPlaytimeMs === 'number' && Number.isFinite(value.runStartedAtPlaytimeMs) ? Math.max(0, Math.floor(value.runStartedAtPlaytimeMs)) : null,
    // Deduplicated: an offer is held once. An id this build no longer sells is kept — it costs
    // nothing against the balance (starShop.ts) and comes back if the offer does.
    // Absent on every file written before the stakes; such a player has earned and paid none.
    bonusStars: count(value.bonusStars),
    feesPaid: count(value.feesPaid),
    purchases: [...new Set([...stringList(value.purchases), ...(count(value.version, 1) < 2 ? LEFT_BASE_2026_09_28.map(grantLedgerId) : [])])],
    deck: decodeDeck(value),
    firstPlayedAt: count(value.firstPlayedAt),
    lastPlayedAt: count(value.lastPlayedAt),
    // Absent on every profile written before the tips; such a player sees each one once. A
    // pre-tips `tutorialDone` is dropped — the scripted run it recorded no longer exists.
    seenTipIds: [...new Set(stringList(value.seenTipIds))],
    // Absent on every profile written before Constructed.
    constructedTeams: decodeTeams(value.constructedTeams),
    trialsCleared: [...new Set(stringList(value.trialsCleared))],
  };
}
