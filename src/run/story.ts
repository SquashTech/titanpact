// Story fights (docs/stories.md §5): fixed parties at fixed levels, a fixed seed, and a script for
// what both sides do, so a tutorial chapter plays out the same way every time.

import type { HeroDefinition } from '../engine/content';
import type { Action } from '../engine/combat/actions';
import type { CombatState, FightEndTrigger, Side } from '../engine/state';
import { combatantIdFor } from './combatantIds';
import type { Encounter } from './enemyGen';
import { expectedGrowthAt, xpForLevel } from './growth';
import { createRosterEntry, createRunState, type RosterEntry } from './state';

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
}

/** One line of a scene: spoken by an actor, thought by one (`think`), or narration (no speaker). */
export interface StoryLine {
  speaker?: string;
  text: string;
  think?: true;
}

/** A line over the fight's stage at the top of `round`'s command phase. */
export interface StoryCue {
  round: number;
  speaker?: string;
  text: string;
}

export type StoryBeat =
  | {
      kind: 'scene';
      /** The Location whose backdrop the scene stands on. */
      locationId: string;
      cast: readonly StoryActor[];
      lines: readonly StoryLine[];
      /** What a skipped scene leaves behind: one line saying what happened. */
      skipped: string;
    }
  | { kind: 'fight'; fight: StoryFight; cast: readonly StoryActor[]; cues?: readonly StoryCue[] }
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
export function storyCyclePips(story: StoryDefinition, done: readonly string[]): ('done' | 'now' | null)[] {
  const next = nextChapter(story, done);
  return [1, 2, 3, 4, 5].map((cycle) => {
    const chapters = story.chapters.filter((c) => c.cycle === cycle);
    if (next?.cycle === cycle) return 'now';
    return chapters.length > 0 && chapters.every((c) => done.includes(c.id)) ? 'done' : null;
  });
}

/** The cue for the round the board stands on, if the beat has one. */
export function cueFor(cues: readonly StoryCue[] | undefined, round: number): StoryCue | null {
  return cues?.find((cue) => cue.round === round) ?? null;
}
