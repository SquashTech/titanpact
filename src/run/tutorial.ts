// The scripted first run (docs/tutorial.md): mechanism only. Every line Valor says, every
// curated encounter and every payout figure is content, in src/data/tutorial.ts — this module
// never imports it, the same arrangement events.ts/data/events.ts already use.
//
// A tutorial run is a NORMAL run with three things pinned: the drafted pair, Act 1's map, and
// what Act 1's encounters and payouts are. `advanceToNextAct` regenerates Act 2 the ordinary
// way, so nothing here survives the first Guardian except the flag that says it happened.

import type { MapNode, MapNodeType, RunMap } from './map';
import type { RosterEntry, RunState } from './state';

/** Forced starters: Valor and Fang are partners, and the run is their pact (docs/lore.md). */
export const TUTORIAL_STARTER_IDS: readonly string[] = ['valor', 'packAlpha'];

// --- Script shape ---

/** Valor leads; Fang gets the occasional word. */
export type TutorialSpeaker = 'valor' | 'fang';

export interface TutorialLine {
  /** Defaults to Valor. */
  speaker?: TutorialSpeaker;
  text: string;
}

/** A bare string is a Valor line — the common case, so the script reads as prose. */
export type TutorialScriptLine = string | TutorialLine;

export interface TutorialBeat {
  /** Matches what `tutorialBeatKey` produces for the moment this beat belongs to. */
  id: string;
  /** Small header over the box: the mechanic being named. */
  topic?: string;
  lines: readonly TutorialScriptLine[];
}

export function normalizeLine(line: TutorialScriptLine): Required<TutorialLine> {
  return typeof line === 'string' ? { speaker: 'valor', text: line } : { speaker: line.speaker ?? 'valor', text: line.text };
}

// --- Out-of-fight beats ---

/**
 * The moment a beat is attached to. Deliberately a flat string namespace rather than a union of
 * screen kinds: App knows its own screens, and the script only has to name one.
 *
 * - `intro` / `arrival` / `outro` — the run's own bookends.
 * - `map:<nodeType>` — the map is showing and the one node ahead is of that type.
 * - `reward:<nodeType>` — that reward node's own screen is open.
 * - everything else names a screen (`gem`, `equip`, `levelUp`, `evolution`, `recruit`, …).
 *
 * Each node type appears exactly once on the tutorial map, so a node type is a unique address.
 */
export type TutorialBeatKey = string;

/**
 * Every beat key that names a SCREEN rather than a map node. App.tsx is the only producer of
 * these and this is the list it produces, so the script can be checked against it — a key
 * renamed on one side and not the other is a beat that silently never plays, which is exactly
 * the failure a dialogue system cannot report for itself (`test/tutorial.test.ts`).
 */
export const TUTORIAL_SCREEN_BEAT_KEYS = [
  'intro',
  'arrival',
  'gem',
  'equip',
  'levelUp',
  'evolution',
  'classNode',
  'recruit',
  'shop',
  'outro',
] as const;

export type TutorialScreenBeatKey = (typeof TUTORIAL_SCREEN_BEAT_KEYS)[number];

export function mapBeatKey(type: MapNodeType): TutorialBeatKey {
  return `map:${type}`;
}

export function rewardBeatKey(type: MapNodeType): TutorialBeatKey {
  return `reward:${type}`;
}

/** The beat for `key`, or null when the script has none or it has already played. */
export function tutorialBeat(
  script: readonly TutorialBeat[],
  run: RunState,
  key: TutorialBeatKey | null
): TutorialBeat | null {
  if (!run.tutorial || key === null) return null;
  if (run.tutorialSeenBeatIds.includes(key)) return null;
  return script.find((beat) => beat.id === key) ?? null;
}

/** Idempotent: a beat dismissed twice (a double-fired handler) records once. */
export function markTutorialBeatSeen(run: RunState, id: string): RunState {
  if (run.tutorialSeenBeatIds.includes(id)) return run;
  return { ...run, tutorialSeenBeatIds: [...run.tutorialSeenBeatIds, id] };
}

// --- Mid-fight cues ---

/**
 * When a cue fires, checked at the start of every command phase. All authored fields must hold
 * at once. Declarative rather than a predicate so the script file stays pure data and editable
 * without reading this module.
 */
export interface TutorialCueCondition {
  /** Exactly this round. */
  round?: number;
  /** This round or later. */
  minRound?: number;
  /** A player active hero can pay for no move at all — the moment Rest exists for. */
  outOfMana?: boolean;
  /** The player side has lost voluntary switching (2+ KOs on a side). */
  lockedIn?: boolean;
  /** Any player active hero is at or below this fraction of its max HP. */
  playerHpBelow?: number;
  /** This heroId is standing on the enemy side of the field — a Guardian's champion arriving. */
  enemyOnField?: string;
}

export interface TutorialFightCue extends TutorialBeat {
  /** Which tutorial fight this belongs to, by its map node type. */
  node: MapNodeType;
  when: TutorialCueCondition;
}

/** What a cue is tested against. FightScreen derives this from live combat state. */
export interface TutorialFightContext {
  round: number;
  anyOutOfMana: boolean;
  lockedIn: boolean;
  /** 1 when nobody is on the field, so a `playerHpBelow` cue cannot fire into an empty board. */
  lowestPlayerHpFraction: number;
  enemyHeroIds: readonly string[];
}

function cueMatches(when: TutorialCueCondition, ctx: TutorialFightContext): boolean {
  if (when.round !== undefined && ctx.round !== when.round) return false;
  if (when.minRound !== undefined && ctx.round < when.minRound) return false;
  if (when.outOfMana !== undefined && ctx.anyOutOfMana !== when.outOfMana) return false;
  if (when.lockedIn !== undefined && ctx.lockedIn !== when.lockedIn) return false;
  if (when.playerHpBelow !== undefined && ctx.lowestPlayerHpFraction > when.playerHpBelow) return false;
  if (when.enemyOnField !== undefined && !ctx.enemyHeroIds.includes(when.enemyOnField)) return false;
  return true;
}

/**
 * The first unseen cue for this fight whose conditions hold. Script order is priority order:
 * a round-1 lesson wins over a standing condition that also happens to be true.
 */
export function matchTutorialCue(
  cues: readonly TutorialFightCue[],
  node: MapNodeType,
  ctx: TutorialFightContext,
  seenIds: ReadonlySet<string>
): TutorialFightCue | null {
  return cues.find((cue) => cue.node === node && !seenIds.has(cue.id) && cueMatches(cue.when, ctx)) ?? null;
}

// --- The curated map ---

/**
 * Act 1, one node per row (per user direction): the standard eight-row Mentor-act shape with
 * every choice row narrowed to a single node, so Valor can walk the player through each one and
 * nothing is missed to routing luck. The 1-of-3 choices *inside* a reward node are untouched —
 * the choosing is the lesson, the routing is not.
 */
export const TUTORIAL_ROW_TYPES: readonly MapNodeType[] = [
  'fight',
  'equipmentReward',
  'classReward',
  'skirmish',
  'relicReward',
  'battle',
  'shop',
  'boss',
];

/** `seed` is carried only so a tutorial RunMap round-trips through save.ts like any other. */
export function generateTutorialMap(seed: number = 0): RunMap {
  const ids = TUTORIAL_ROW_TYPES.map((_, row) => `r${row}-c0`);
  const nodes: Record<string, MapNode> = {};
  TUTORIAL_ROW_TYPES.forEach((type, row) => {
    nodes[ids[row]] = { id: ids[row], type, row, col: 0, nextIds: row + 1 < ids.length ? [ids[row + 1]] : [] };
  });
  return {
    seed,
    nodes,
    rows: ids.map((id) => [id]),
    startNodeIds: [ids[0]],
    bossNodeId: ids[ids.length - 1],
  };
}

// --- Curated encounters and payouts ---

export interface TutorialEncounter {
  /**
   * Forced enemy ids in field order — the first two lead, the rest bench. Replaces the node's
   * random draw entirely, so the fight is the one the script talks about.
   */
  heroIds: readonly string[];
}

/** Total payout for winning a scripted node — replaces `trainingPointsFor` / `goldRewardFor`, not added to them. */
export interface TutorialPayout {
  xp: number;
  gold: number;
}

export function tutorialEncounterFor(
  encounters: Partial<Record<MapNodeType, TutorialEncounter>>,
  run: RunState,
  type: MapNodeType
): TutorialEncounter | null {
  if (!isTutorialAct(run)) return null;
  return encounters[type] ?? null;
}

export function tutorialPayoutFor(
  payouts: Partial<Record<MapNodeType, TutorialPayout>>,
  run: RunState,
  type: MapNodeType
): TutorialPayout | null {
  if (!isTutorialAct(run)) return null;
  return payouts[type] ?? null;
}

/**
 * The scripted stretch: a tutorial run still inside Act 1. Everything the tutorial pins is
 * checked through this, so Act 2 onward is a normal run without a single extra branch.
 */
export function isTutorialAct(run: RunState): boolean {
  return run.tutorial && run.actNumber === 1;
}

// --- Locks: the choices the scripted act takes away ---

/**
 * A lesson the player is allowed to decline is a lesson some players never see, so the scripted
 * act removes the option rather than recommending against it (2026-09-06, per user direction).
 * Three locks, each lifting the moment its lesson has landed — none of them survives Act 1.
 *
 * The Evolution needs no lock of its own: `LevelUpScreen` already refuses to bank or auto-close
 * while one is pending. What it needed was a guarantee the player *reaches* one, which is what
 * `focusHeroId` is — with every point going to one hero, the fork arrives on schedule.
 */
export interface TutorialLocks {
  /**
   * The only hero the Level Up screen will spend on, until that hero has taken an Evolution.
   * Every point lands on one hero, so the Evolution arrives instead of being averaged away.
   */
  focusHeroId: string;
  /**
   * The one Recruit Contract the Skirmish offers, and it cannot be walked past. Chosen to be a
   * MAGICAL specialist: the physical/magical split is invisible until the player owns one of
   * each, and the run cannot rely on them happening to draft it.
   */
  recruitHeroId: string;
  /** The hero that must stand in the ACTIVE pair — owning the lesson is not the same as flying it. */
  fieldHeroId: string;
  /** Map nodes `fieldHeroId` is locked into. */
  fieldAtNodes: readonly MapNodeType[];
}

/** The roster id the Level Up screen is restricted to, or null when nothing is restricted. */
export function tutorialFocusRosterId(locks: TutorialLocks, run: RunState): string | null {
  if (!isTutorialAct(run)) return null;
  const entry = run.roster.find((r) => r.heroId === locks.focusHeroId);
  // The lock exists to reach an Evolution; once one is taken it has nothing left to do.
  if (!entry || entry.chosenPathIds.length > 0) return null;
  return entry.rosterId;
}

/** Roster ids that must occupy an active slot at `nodeType`. Empty when the hero is not owned. */
export function tutorialLockedActiveRosterIds(
  locks: TutorialLocks,
  run: RunState,
  nodeType: MapNodeType
): readonly string[] {
  if (!isTutorialAct(run) || !locks.fieldAtNodes.includes(nodeType)) return [];
  const entry = run.roster.find((r) => r.heroId === locks.fieldHeroId);
  return entry ? [entry.rosterId] : [];
}

/**
 * The forced contract offer, or null to let the normal sample run. Non-null also means the
 * Recruit screen has no way out but signing — App passes the same answer to both.
 */
export function tutorialContractOffers(
  locks: TutorialLocks,
  run: RunState,
  defeated: readonly RosterEntry[]
): RosterEntry[] | null {
  if (!isTutorialAct(run)) return null;
  // Already claimed (a replayed node, or the Guild Hall got there first) — nothing left to force.
  if (run.roster.some((r) => r.heroId === locks.recruitHeroId)) return null;
  const forced = defeated.find((entry) => entry.heroId === locks.recruitHeroId);
  return forced ? [forced] : null;
}
