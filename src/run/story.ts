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
  /** Passives beyond its innate, a Story's own (the Endbringer's cannotBeKnockedOut). */
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

export function storyEndTriggers(fight: StoryFight): FightEndTrigger[] {
  return (fight.endsWhen ?? []).map((end) =>
    end.kind === 'afterRound' ? end : { kind: 'hpAtMost', combatantId: combatantIdFor(end.side, end.rosterId), hp: end.hp, winner: end.winner }
  );
}

/** The built board with the fight's scripted ends on it. */
export function withStoryEnds(state: CombatState, fight: StoryFight): CombatState {
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
export function scriptedEnemyActions(fight: StoryFight, state: CombatState): Action[] | null {
  return commandsFor(fight.enemyScript, state, STORY_ENEMY_SIDE);
}

/** The action the player is guided to this round for `combatantId`, or null when that hero is the player's own to command. */
export function guidedAction(fight: StoryFight, state: CombatState, combatantId: string): Action | null {
  return commandsFor(fight.guide, state, STORY_PLAYER_SIDE)?.find((action) => action.combatantId === combatantId) ?? null;
}

/** Who stands in a scene: a name over a figure drawn from a hero's sprite. */
export interface StoryActor {
  id: string;
  name: string;
  /** A hero or combatant id whose sprite is drawn. */
  artHeroId: string;
  /** Faces into the scene from this side. */
  stands: 'left' | 'right';
  /** The blip under this actor's typed lines, and its pitch. Unset: typed in silence. */
  voice?: StoryVoice;
  /** Drawn this much larger than a hero (the risen Endbringer towers). Unset: 1. */
  scale?: number;
}

/**
 * Where an actor stands in a scene: `x` across the ground (0 the left edge, 100 the right), `depth`
 * into it (0 the far back, small and high; 1 the front). `off` is off stage: not yet come, or gone.
 */
export interface StageMark {
  x: number;
  depth: number;
  off?: boolean;
}

/** The cast spread over the ground when a scene authors no stage: each side fanned out, depths staggered. */
export function autoStage(cast: readonly StoryActor[]): Record<string, StageMark> {
  const marks: Record<string, StageMark> = {};
  for (const side of ['left', 'right'] as const) {
    const group = cast.filter((actor) => actor.stands === side);
    group.forEach((actor, i) => {
      const t = group.length === 1 ? 0.5 : i / (group.length - 1);
      const x = side === 'left' ? 14 + t * 26 : 86 - t * 26;
      marks[actor.id] = { x, depth: i % 2 === 0 ? 0.8 : 0.45 };
    });
  }
  return marks;
}

/** The marks standing at line `step`: the scene's stage with every line's moves up to it applied. */
export function stageAt(cast: readonly StoryActor[], stage: Readonly<Record<string, StageMark>> | undefined, lines: readonly StoryLine[], step: number): Record<string, StageMark> {
  const marks: Record<string, StageMark> = { ...autoStage(cast), ...(stage ?? {}) };
  for (const line of lines.slice(0, step + 1)) {
    for (const [id, move] of Object.entries(line.moves ?? {})) marks[id] = { ...marks[id], ...move } as StageMark;
  }
  return marks;
}

/** A timbre (audio/sounds.ts `voice.*`) and a pitch multiplier. */
export interface StoryVoice {
  timbre: 'bright' | 'warm' | 'deep';
  pitch: number;
}

/** One line of a scene: spoken by an actor, thought by one (`think`), or narration (no speaker). */
export interface StoryLine {
  speaker?: string;
  text: string;
  think?: true;
  /** A sound the moment the line appears (audio/sounds.ts id): Fang's bark, his howl. */
  sound?: 'wolf.bark' | 'wolf.howl';
  /** Who moves as the line appears, and to where: a step, a retreat, an entrance (`off: false`), an exit (`off: true`). */
  moves?: Readonly<Record<string, Partial<StageMark>>>;
}

/** A line over the fight's stage at the top of `round`'s command phase. */
export interface StoryCue {
  round: number;
  speaker?: string;
  text: string;
  sound?: 'wolf.bark' | 'wolf.howl';
  /**
   * A control taught at the top of this round (docs/stories.md §1c), once an account: plain game
   * words, the thing it names lit on the board (view/run/tipStaging.ts, by the tip's id).
   */
  tip?: Tip;
}

export type StoryBeat =
  /** Valor remembering (docs/stories.md §1): her lines over the place, before its scene. */
  | { kind: 'memory'; locationId: string; lines: readonly string[]; voice?: StoryVoice }
  | {
      kind: 'scene';
      /** The Location whose backdrop the scene stands on. */
      locationId: string;
      cast: readonly StoryActor[];
      lines: readonly StoryLine[];
      /** Where the cast stands at the scene's start. Unset: `autoStage`. */
      stage?: Readonly<Record<string, StageMark>>;
      /** What a skipped scene leaves behind: one line saying what happened. */
      skipped: string;
    }
  | { kind: 'fight'; fight: StoryFight; cast: readonly StoryActor[]; cues?: readonly StoryCue[] }
  /** The Titan's fall across the sky (docs/stories.md §4), its lines crawling over it a tap at a time. */
  | { kind: 'fall'; lines: readonly string[] }
  /** One Act of a run on the real map (docs/stories.md §14), a fixed party and fixed fights, ending at its last row. */
  | { kind: 'act'; act: StoryAct }
  | { kind: 'end'; line: string };

export interface StoryChapter {
  id: string;
  title: string;
  /** The Cycle the chapter is set in (docs/stories.md §2). */
  cycle: number;
  beats: readonly StoryBeat[];
}

export interface StoryDefinition {
  id: string;
  name: string;
  chapters: readonly StoryChapter[];
  /** Chapters planned for each Cycle, built or not, so the select's marks count the whole of it. */
  plannedChapters: Readonly<Record<number, number>>;
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

/** The first chapter of `story` not yet finished, or null when every one is. */
export function nextChapter(story: StoryDefinition, done: readonly string[]): StoryChapter | null {
  return story.chapters.find((chapter) => !done.includes(chapter.id)) ?? null;
}

export function chapterById(stories: readonly StoryDefinition[], chapterId: string): { story: StoryDefinition; chapter: StoryChapter } | null {
  for (const story of stories) {
    const chapter = story.chapters.find((c) => c.id === chapterId);
    if (chapter) return { story, chapter };
  }
  return null;
}

/** Each Cycle's mark on the Story select: done once every chapter set in it is, current where the next chapter is. */
/**
 * The Story select's marks (docs/stories.md §10): one a chapter of the Cycle the Story stands in,
 * planned ones included, finished ones lit and the next one ringed.
 */
export function storyChapterPips(story: StoryDefinition, done: readonly string[]): { cycle: number; marks: ('done' | 'now' | null)[] } {
  const next = nextChapter(story, done);
  const cycle = next?.cycle ?? story.chapters[story.chapters.length - 1]?.cycle ?? 1;
  const built = story.chapters.filter((c) => c.cycle === cycle);
  const count = Math.max(story.plannedChapters[cycle] ?? 0, built.length);
  const marks = Array.from({ length: count }, (_, i) => {
    const chapter = built[i];
    if (chapter && done.includes(chapter.id)) return 'done' as const;
    return chapter && chapter.id === next?.id ? ('now' as const) : null;
  });
  return { cycle, marks };
}

/** A chapter's place in its Story, 1-based: chapter 1 is the prologue. */
export function chapterNumber(story: StoryDefinition, chapterId: string): number {
  return story.chapters.findIndex((c) => c.id === chapterId) + 1;
}

/** The cue for the round the board stands on, if the beat has one. */
export function cueFor(cues: readonly StoryCue[] | undefined, round: number): StoryCue | null {
  return cues?.find((cue) => cue.round === round) ?? null;
}
