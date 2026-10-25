// Story fights (docs/stories.md §5): fixed parties at fixed levels, a fixed seed, and a script for
// what both sides do, so a tutorial chapter plays out the same way every time.

import type { HeroDefinition } from '../engine/content';
import type { Action } from '../engine/combat/actions';
import type { CombatState, FightEndTrigger, Side } from '../engine/state';
import { combatantIdFor } from './combatantIds';
import type { Encounter } from './enemyGen';
import { expectedGrowthAt, xpForLevel } from './growth';
import { PATRON_ROWS, type MapNode, type MapNodeType, type RunMap } from './map';
import { createPatronState, seatIndexFor } from './patrons';
import { createRosterEntry, createRunState, type RosterEntry, type RunState } from './state';
import type { Tip } from './tips';

export const STORY_PLAYER_SIDE: Side = 'A';
export const STORY_ENEMY_SIDE: Side = 'B';

/** One hero in a Story party, at a fixed level, holding exactly `moveIds` (default: its starting two). */
export interface StoryHeroSpec {
  rosterId: string;
  heroId: string;
  level: number;
  moveIds?: readonly string[];
  /** Passives beyond its innate, a Story's own. */
  passiveIds?: readonly string[];
}

/** What one hero does in a scripted round. Ids are roster ids on the hero's own side; a target names either side's. */
export type StoryCommand =
  | { actor: string; moveId: string; target?: { side: Side; rosterId: string } }
  | { actor: string; rest: true }
  | { actor: string; switchTo: string };

/** A scripted end, by roster id (FightEndTrigger by combatant id). */
export type StoryEnd =
  | { kind: 'afterRound'; round: number; winner: Side }
  | { kind: 'hpAtMost'; side: Side; rosterId: string; hp: number; winner: Side };

export interface StoryFight {
  id: string;
  seed: number;
  player: readonly StoryHeroSpec[];
  /** One or two leads; a single lead fights alone in the first slot. */
  playerLeads: readonly string[];
  enemy: readonly StoryHeroSpec[];
  enemyLeads: readonly string[];
  /** The enemy's commands, one list a round from round 1. A round past the end falls back to the AI. */
  enemyScript: readonly (readonly StoryCommand[])[];
  /** The one command the player is guided to each round, by hero. A round past the end is the player's own. */
  guide: readonly (readonly StoryCommand[])[];
  endsWhen?: readonly StoryEnd[];
}

/** What holds a guided fight to its lesson, wherever its two sides come from. */
export type StoryScript = Pick<StoryFight, 'seed' | 'enemyScript' | 'guide' | 'endsWhen'>;

export function storyEntry(spec: StoryHeroSpec, hero: HeroDefinition): RosterEntry {
  return {
    ...createRosterEntry(spec.rosterId, spec.heroId, spec.moveIds ?? hero.moveIds),
    xp: xpForLevel(spec.level),
    growthStatGrants: expectedGrowthAt(hero, spec.level),
    bonusPassiveGrants: [...(spec.passiveIds ?? [])],
  };
}

function storySide(specs: readonly StoryHeroSpec[], leads: readonly string[], heroes: Record<string, HeroDefinition>): Encounter {
  const roster = specs.map((spec) => {
    const hero = heroes[spec.heroId];
    if (!hero) throw new Error(`story: unknown hero ${spec.heroId}`);
    return storyEntry(spec, hero);
  });
  for (const id of leads) if (!roster.some((r) => r.rosterId === id)) throw new Error(`story: lead ${id} is not in the party`);
  return {
    run: { ...createRunState(0, 0), roster },
    squad: { activeIds: [leads[0] ?? null, leads[1] ?? null], benchIds: roster.map((r) => r.rosterId).filter((id) => !leads.includes(id)) },
  };
}

/** Both sides of a Story fight, leads placed, as FightScreen's player and AI encounters. */
export function storySides(fight: StoryFight, heroes: Record<string, HeroDefinition>): { player: Encounter; ai: Encounter } {
  return { player: storySide(fight.player, fight.playerLeads, heroes), ai: storySide(fight.enemy, fight.enemyLeads, heroes) };
}

export function storyEndTriggers(fight: StoryScript): FightEndTrigger[] {
  return (fight.endsWhen ?? []).map((end) =>
    end.kind === 'afterRound' ? end : { kind: 'hpAtMost', combatantId: combatantIdFor(end.side, end.rosterId), hp: end.hp, winner: end.winner }
  );
}

/** The built board with the fight's scripted ends on it. */
export function withStoryEnds(state: CombatState, fight: StoryScript): CombatState {
  const endsWhen = storyEndTriggers(fight);
  return endsWhen.length > 0 ? { ...state, endsWhen } : state;
}

function toAction(command: StoryCommand, side: Side): Action {
  const combatantId = combatantIdFor(side, command.actor);
  if ('rest' in command) return { kind: 'rest', combatantId };
  if ('switchTo' in command) return { kind: 'switch', combatantId, benchedCombatantId: combatantIdFor(side, command.switchTo) };
  return {
    kind: 'move',
    combatantId,
    moveId: command.moveId,
    declaredTarget: command.target ? combatantIdFor(command.target.side, command.target.rosterId) : null,
  };
}

function commandsFor(script: readonly (readonly StoryCommand[])[], state: CombatState, side: Side): Action[] | null {
  const round = script[state.round - 1];
  if (!round) return null;
  const active = new Set(state.active[side].filter((id): id is string => !!id && !state.combatants[id]?.fainted));
  return round.map((command) => toAction(command, side)).filter((action) => active.has(action.combatantId));
}

/** The enemy's scripted actions this round, those whose actor stands active; null past the script's end. */
export function scriptedEnemyActions(fight: StoryScript, state: CombatState): Action[] | null {
  return commandsFor(fight.enemyScript, state, STORY_ENEMY_SIDE);
}

/** The action the player is guided to this round for `combatantId`, or null when that hero is the player's own to command. */
export function guidedAction(fight: StoryScript, state: CombatState, combatantId: string): Action | null {
  return commandsFor(fight.guide, state, STORY_PLAYER_SIDE)?.find((action) => action.combatantId === combatantId) ?? null;
}

/** What a lesson teaches at the top of `round`'s command phase: it guides, it tips, and Blip says why. */
export interface StoryCue {
  round: number;
  /**
   * Controls taught at the top of this round (docs/stories.md §1c), in order, each once an account:
   * plain game words, the thing each names lit on the board or drawn (view/run/tipStaging.ts,
   * data/tipScenes.ts, by the tip's id).
   */
  tips?: readonly Tip[];
  /** A hand points at each guided tap this round: the move, then its target. */
  point?: true;
  /** Blip's thought once the tips are done: why this round's guided taps are the ones (docs/the-sky.md §1). */
  blip?: readonly string[];
}

export type StoryBeat =
  /** A scripted fight, stood on `locationId`'s ground (unset: the plain arena). */
  | { kind: 'fight'; fight: StoryFight; locationId?: string; cues?: readonly StoryCue[] }
  /** One Act of a run on the real map (docs/stories.md §14), a fixed party and fixed fights, ending at its last row. */
  | { kind: 'act'; act: StoryAct };

/** A run of beats played in order; a First Light lesson is a chapter of one (data/lessons.ts). */
export interface StoryChapter {
  id: string;
  title: string;
  beats: readonly StoryBeat[];
}

export interface StoryDefinition {
  id: string;
  name: string;
  chapters: readonly StoryChapter[];
}

/**
 * A node of a Story act: its kind, and for a fight the party it fields (leads default to the first
 * two) and the one item it drops. An Items chest offers `items`. Nothing else drops in a Story act:
 * every piece is chosen for the party it is handed to.
 */
export interface StoryActNode {
  type: MapNodeType;
  enemy?: readonly StoryHeroSpec[];
  enemyLeads?: readonly string[];
  drop?: string;
  items?: readonly string[];
  /** A patron seat's patron(s), one a tile. The seat must stand on a patron row (run/map.ts PATRON_ROWS). */
  patrons?: readonly string[];
  /** A fight's control tips, as a lesson fight's (StoryCue). */
  cues?: readonly StoryCue[];
  /** A guided fight's script; the enemy's roster ids are its enemy's, the player's the act party's. */
  script?: StoryScript;
}

/**
 * A single Act played on the run's own screens: a hand-built map whose rows connect fully, a fixed
 * party, no draft and no recruiting. Winning the last row's fight ends the act and the chapter goes on.
 */
export interface StoryAct {
  locationId: string;
  party: readonly StoryHeroSpec[];
  rows: readonly (readonly StoryActNode[])[];
  gold?: number;
  /** Patron id -> the party member it teaches, set before the seat so the lesson goes to them. */
  students?: Readonly<Record<string, string>>;
}

/** The guided fight a scripted tile plays, its sides the act's party and the tile's enemy; null for a tile without a script. */
export function storyNodeFight(act: StoryAct, node: StoryActNode, id: string): StoryFight | null {
  if (!node.script || !node.enemy) return null;
  const enemyLeads = node.enemyLeads ?? node.enemy.slice(0, 2).map((s) => s.rosterId);
  return { id, ...node.script, player: act.party, playerLeads: act.party.slice(0, 2).map((s) => s.rosterId), enemy: node.enemy, enemyLeads };
}

/** Where a Story act sits in its chapter, carried on the run so the act's end can hand back. */
export interface StoryActMarker {
  chapterId: string;
  beat: number;
}

export function storyActMap(act: StoryAct, seed: number): RunMap {
  const id = (row: number, col: number) => `r${row}-c${col}`;
  const nodes: Record<string, MapNode> = {};
  const rows = act.rows.map((row, r) =>
    row.map((node, c) => {
      const nextIds = r + 1 < act.rows.length ? act.rows[r + 1].map((_, nc) => id(r + 1, nc)) : [];
      nodes[id(r, c)] = { id: id(r, c), type: node.type, row: r, col: c, nextIds };
      return id(r, c);
    })
  );
  return { seed, nodes, rows, startNodeIds: rows[0], bossNodeId: rows[rows.length - 1][0] };
}

/** The run a Story act plays on: its party at their levels, its map, its place, and no contract to recruit with. */
export function storyActRun(act: StoryAct, marker: StoryActMarker, heroes: Record<string, HeroDefinition>, seed: number): RunState {
  const roster = act.party.map((spec) => {
    const hero = heroes[spec.heroId];
    if (!hero) throw new Error(`story: unknown hero ${spec.heroId}`);
    return storyEntry(spec, hero);
  });
  return {
    ...createRunState(act.gold ?? 0, 0),
    roster,
    map: storyActMap(act, seed),
    locationIds: [act.locationId],
    story: marker,
    patrons: storyPatrons(act),
  };
}

/** The act's seats filled with the patrons it names, and its students set (run/patrons.ts). */
function storyPatrons(act: StoryAct) {
  const offers: Record<number, readonly string[]> = {};
  act.rows.forEach((row, r) => {
    const seated = row.find((node) => node.type === 'patronSeat');
    if (!seated) return;
    const seat = seatIndexFor(1, r, PATRON_ROWS);
    if (seat === null) throw new Error(`story: a patron seat on row ${r} is not on a patron row`);
    offers[seat] = row.map((node) => node.patrons?.[0] ?? '');
  });
  return { ...createPatronState(), offers, students: { ...(act.students ?? {}) } };
}

/** The act a run is playing, or null for a run outside Stories. */
export function storyActOf(run: RunState, stories: readonly StoryDefinition[]): StoryAct | null {
  if (!run.story) return null;
  const beat = chapterById(stories, run.story.chapterId)?.chapter.beats[run.story.beat];
  return beat?.kind === 'act' ? beat.act : null;
}

/** The authored node a Story act's map node was built from, or null outside Stories. */
export function storyNodeSpec(run: RunState, stories: readonly StoryDefinition[], nodeId: string): StoryActNode | null {
  const act = storyActOf(run, stories);
  const node = run.map?.nodes[nodeId];
  return (act && node && act.rows[node.row]?.[node.col]) || null;
}

/** The fixed party a Story act's fight node fields, or null for a node or a run without one. */
export function storyNodeEncounter(run: RunState, stories: readonly StoryDefinition[], nodeId: string, heroes: Record<string, HeroDefinition>): Encounter | null {
  const spec = storyNodeSpec(run, stories, nodeId);
  if (!spec?.enemy) return null;
  return storySide(spec.enemy, spec.enemyLeads ?? spec.enemy.slice(0, 2).map((s) => s.rosterId), heroes);
}

/** Whether winning this node ends the Story act: its last row. */
export function endsStoryAct(run: RunState, nodeId: string): boolean {
  const node = run.map?.nodes[nodeId];
  return !!run.story && !!node && !!run.map && node.row === run.map.rows.length - 1;
}

export function chapterById(stories: readonly StoryDefinition[], chapterId: string): { story: StoryDefinition; chapter: StoryChapter } | null {
  for (const story of stories) {
    const chapter = story.chapters.find((c) => c.id === chapterId);
    if (chapter) return { story, chapter };
  }
  return null;
}

/** The cue for the round the board stands on, if the beat has one. */
export function cueFor(cues: readonly StoryCue[] | undefined, round: number): StoryCue | null {
  return cues?.find((cue) => cue.round === round) ?? null;
}
