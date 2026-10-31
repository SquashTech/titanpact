// Story fights (docs/stories.md §5): fixed parties at fixed levels, a fixed seed, and a script for
// what both sides do, so a lesson plays out the same way every time.

import type { HeroDefinition } from '../engine/content';
import type { Action } from '../engine/combat/actions';
import type { CombatState, FightEndTrigger, Side } from '../engine/state';
import { combatantIdFor } from './combatantIds';
import type { Encounter } from './enemyGen';
import { expectedGrowthAt, xpForLevel } from './growth';
import { createRosterEntry, createRunState, type RosterEntry } from './state';
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
  /** The sides whose heroes fight without their innates, a Titanspawn's Mark among them. */
  quietSides?: readonly Side[];
}

/** What holds a guided fight to its lesson, wherever its two sides come from. */
export type StoryScript = Pick<StoryFight, 'seed' | 'enemyScript' | 'guide' | 'endsWhen'>;

export function storyEntry(spec: StoryHeroSpec, hero: HeroDefinition, quiet = false): RosterEntry {
  return {
    ...(quiet ? { innateQuiet: true as const } : {}),
    ...createRosterEntry(spec.rosterId, spec.heroId, spec.moveIds ?? hero.moveIds),
    xp: xpForLevel(spec.level),
    growthStatGrants: expectedGrowthAt(hero, spec.level),
    bonusPassiveGrants: [...(spec.passiveIds ?? [])],
  };
}

function storySide(specs: readonly StoryHeroSpec[], leads: readonly string[], heroes: Record<string, HeroDefinition>, quiet: boolean): Encounter {
  const roster = specs.map((spec) => {
    const hero = heroes[spec.heroId];
    if (!hero) throw new Error(`story: unknown hero ${spec.heroId}`);
    return storyEntry(spec, hero, quiet);
  });
  for (const id of leads) if (!roster.some((r) => r.rosterId === id)) throw new Error(`story: lead ${id} is not in the party`);
  return {
    run: { ...createRunState(0, 0), roster },
    squad: { activeIds: [leads[0] ?? null, leads[1] ?? null], benchIds: roster.map((r) => r.rosterId).filter((id) => !leads.includes(id)) },
  };
}

/** Both sides of a Story fight, leads placed, as FightScreen's player and AI encounters. */
export function storySides(fight: StoryFight, heroes: Record<string, HeroDefinition>): { player: Encounter; ai: Encounter } {
  const quiet = (side: Side) => fight.quietSides?.includes(side) ?? false;
  return {
    player: storySide(fight.player, fight.playerLeads, heroes, quiet(STORY_PLAYER_SIDE)),
    ai: storySide(fight.enemy, fight.enemyLeads, heroes, quiet(STORY_ENEMY_SIDE)),
  };
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

/** What a lesson teaches at the top of `round`'s command phase: it guides, it tips, and a hero calls the plan. */
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
  /** Said once the tips are done, by the heroes on the field: the round's plan, and why its guided taps are the ones (docs/the-sky.md §1). */
  lines?: readonly CueLine[];
}

/** An item a lesson hands over before its fight, and the roster id of the one hero who may take it. */
export interface StoryHandOver {
  itemId: string;
  to: string;
}

/** One line of a hero's call, by the roster id of a hero standing on the player's side. */
export interface CueLine {
  by: string;
  text: string;
}

export type StoryBeat =
  /**
   * A scripted fight, stood on `locationId`'s ground (unset: the plain arena). `line` is a lesson's one
   * line, on the top bar while it commands; `handOver` is a piece the party is given before it, on the
   * item screen, to the one hero it names.
   */
  | { kind: 'fight'; fight: StoryFight; locationId?: string; cues?: readonly StoryCue[]; line?: string; handOver?: StoryHandOver };

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
