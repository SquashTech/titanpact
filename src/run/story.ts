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
  playerLeads: readonly [string, string];
  enemy: readonly StoryHeroSpec[];
  enemyLeads: readonly [string, string];
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

function storySide(specs: readonly StoryHeroSpec[], leads: readonly [string, string], heroes: Record<string, HeroDefinition>): Encounter {
  const roster = specs.map((spec) => {
    const hero = heroes[spec.heroId];
    if (!hero) throw new Error(`story: unknown hero ${spec.heroId}`);
    return storyEntry(spec, hero);
  });
  for (const id of leads) if (!roster.some((r) => r.rosterId === id)) throw new Error(`story: lead ${id} is not in the party`);
  return {
    run: { ...createRunState(0, 0), roster },
    squad: { activeIds: [leads[0], leads[1]], benchIds: roster.map((r) => r.rosterId).filter((id) => !leads.includes(id)) },
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
