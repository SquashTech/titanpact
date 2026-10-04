// Constructed (docs/constructed.md): a team the player builds, and the roster it fields as.
// Pure — the shape, its legality, and the projection onto RosterEntry/Squad the fight builder
// already reads, so the engine never knows which mode it is in.

import type { HeroDefinition, StatKey, TypeId } from '../engine/content';
import type { ClassDefinition } from './classes';
import type { HeroLookup } from '../engine/state';
import type { Profile } from './profile';
import type { Squad } from './squad';
import { openingSquad } from './squad';
import { createRosterEntry, createRunState, ROSTER_CAP, type RosterEntry, type RunState } from './state';
import { BASE_ITEM_SLOTS, parseEquipmentId, type EquipmentDefinition, type EquipmentRarity } from './equipment';
import { GROWTH_STATS, MAX_LEVEL, gradeExpectedPoints, gradesFor, growthUnitFor, xpForLevel } from './growth';
import { MASTERY_CAP } from './mastery';
import { MOVE_CAP, chooseEvolutionPath, scheduleEntries, scheduleFor, type EvolutionPath, type ProgressionTable } from './progression';

export const TEAM_SIZE = ROSTER_CAP;
export const CONSTRUCTED_LEVEL = MAX_LEVEL;
export const CONSTRUCTED_RARITY: EquipmentRarity = 'mythic';

export interface TeamSlot {
  heroId: string;
  /** One of the hero's three Evolution paths, or null to field it unevolved. */
  pathId: string | null;
  /** 1 to MOVE_CAP, from `constructedMovePool`. */
  moveIds: string[];
  /** Up to BASE_ITEM_SLOTS Mythic items, one a family; enchanted ids allowed. */
  itemIds: string[];
  classId: string | null;
}

export interface Team {
  name: string;
  slots: TeamSlot[];
}

/** An authored opponent (§6): one type's six, one gameplan, and the cover for its own chart weakness. */
export interface TrialDefinition {
  id: string;
  type: TypeId;
  name: string;
  /** One line of voice, shown on the Trial's tile. */
  line: string;
  /** The plan in one sentence — what every slot serves. */
  gameplan: string;
  /** How it answers the types that hit it super-effectively, named. */
  cover: string;
  /** Threats no legal build of the six can answer super-effectively — a roster gap, declared rather than hidden. */
  uncovered?: readonly TypeId[];
  /** The AI's opening two, by hero id. */
  leads: readonly [string, string];
  team: Team;
}

export interface ConstructedContent {
  heroes: HeroLookup;
  table: ProgressionTable;
  equipment: Record<string, EquipmentDefinition>;
  classes: Record<string, ClassDefinition>;
}

export class ConstructedError extends Error {}

/** The hero gate (§2): a hero is buildable once any of its paths is starred, and in all three. */
export function constructedHeroIds(profile: Pick<Profile, 'evolutionStars'>): Set<string> {
  return new Set(Object.entries(profile.evolutionStars).filter(([, paths]) => paths.length > 0).map(([heroId]) => heroId));
}

/** Constructed is open once a Classic run has been won. */
export function isConstructedOpen(profile: Pick<Profile, 'runsCompleted'>): boolean {
  return profile.runsCompleted > 0;
}

/** §4: every roll from level 1 to CONSTRUCTED_LEVEL at its grade's mean, rounded once. */
export function expectedGrowthGrants(hero: HeroDefinition): Partial<Record<StatKey, number>> {
  const grades = gradesFor(hero);
  const levels = CONSTRUCTED_LEVEL - 1;
  const grants: Partial<Record<StatKey, number>> = {};
  for (const stat of GROWTH_STATS) {
    const amount = Math.round(levels * gradeExpectedPoints(grades[stat]) * growthUnitFor(stat));
    if (amount !== 0) grants[stat] = amount;
  }
  return grants;
}

export function constructedPath(table: ProgressionTable, heroId: string, pathId: string | null): EvolutionPath | null {
  if (!pathId) return null;
  return (table.evolutions[heroId] ?? []).flatMap((node) => node.paths).find((p) => p.id === pathId) ?? null;
}

/** Everything the hero could hold at the end of a run in this form: kit, pool, the path's moves, the signature, the Class's move. */
export function constructedMovePool(content: ConstructedContent, slot: Pick<TeamSlot, 'heroId' | 'pathId' | 'classId'>): string[] {
  const hero = content.heroes[slot.heroId];
  if (!hero) return [];
  const path = constructedPath(content.table, slot.heroId, slot.pathId);
  const classMove = slot.classId ? content.classes[slot.classId]?.grantsMoveId : undefined;
  return [
    ...new Set([
      ...hero.moveIds,
      ...(content.table.moveTiers[hero.id] ?? []),
      ...(path?.unlocksMoveIds ?? []),
      ...(path?.learnableMoveIds ?? []),
      ...(hero.signatureMoveId ? [hero.signatureMoveId] : []),
      ...(classMove ? [classMove] : []),
    ]),
  ];
}

/** Every reason this slot cannot be fielded; empty when it can. `unlocked` omitted = no gate (Trials, tests). */
export function slotProblems(content: ConstructedContent, slot: TeamSlot, unlocked?: ReadonlySet<string>): string[] {
  const problems: string[] = [];
  const hero = content.heroes[slot.heroId];
  if (!hero) return [`unknown hero ${slot.heroId}`];
  if (unlocked && !unlocked.has(slot.heroId)) problems.push(`${slot.heroId} has not been won with`);

  if (slot.pathId && !constructedPath(content.table, slot.heroId, slot.pathId)) problems.push(`${slot.pathId} is not a path of ${slot.heroId}`);
  if (slot.classId && !content.classes[slot.classId]) problems.push(`unknown class ${slot.classId}`);

  if (slot.moveIds.length === 0) problems.push(`${slot.heroId} holds no move`);
  if (slot.moveIds.length > MOVE_CAP) problems.push(`${slot.heroId} holds ${slot.moveIds.length} moves, the cap is ${MOVE_CAP}`);
  if (new Set(slot.moveIds).size !== slot.moveIds.length) problems.push(`${slot.heroId} holds a move twice`);
  const pool = new Set(constructedMovePool(content, slot));
  for (const id of slot.moveIds) if (!pool.has(id)) problems.push(`${id} is not in ${slot.heroId}'s pool`);

  if (slot.itemIds.length > BASE_ITEM_SLOTS) problems.push(`${slot.heroId} holds ${slot.itemIds.length} items, the sockets are ${BASE_ITEM_SLOTS}`);
  const bases = new Set<string>();
  for (const id of slot.itemIds) {
    const item = content.equipment[id];
    if (!item) {
      problems.push(`unknown item ${id}`);
      continue;
    }
    if (item.rarity !== CONSTRUCTED_RARITY) problems.push(`${id} is not ${CONSTRUCTED_RARITY}`);
    const base = parseEquipmentId(id).base;
    if (bases.has(base)) problems.push(`${slot.heroId} holds two of ${base}`);
    bases.add(base);
  }
  return problems;
}

/** A team in progress may be short; `isTeamReady` is what a fight asks. */
export function teamProblems(content: ConstructedContent, team: Team, unlocked?: ReadonlySet<string>): string[] {
  const problems: string[] = [];
  if (team.slots.length > TEAM_SIZE) problems.push(`${team.slots.length} heroes, a team is ${TEAM_SIZE}`);
  const heroIds = team.slots.map((s) => s.heroId);
  if (new Set(heroIds).size !== heroIds.length) problems.push('a hero appears twice');
  for (const slot of team.slots) problems.push(...slotProblems(content, slot, unlocked));
  return problems;
}

export function isTeamReady(content: ConstructedContent, team: Team, unlocked?: ReadonlySet<string>): boolean {
  return team.slots.length === TEAM_SIZE && teamProblems(content, team, unlocked).length === 0;
}

/** One slot as the roster entry a run would have ended with: level 30, Mastery 10, the expected line. */
export function constructedEntry(content: ConstructedContent, slot: TeamSlot): RosterEntry {
  const problems = slotProblems(content, slot);
  if (problems.length > 0) throw new ConstructedError(problems.join('; '));
  const hero = content.heroes[slot.heroId];

  const raw: RosterEntry = {
    ...createRosterEntry(slot.heroId, slot.heroId, hero.moveIds),
    xp: xpForLevel(CONSTRUCTED_LEVEL),
    mastery: MASTERY_CAP,
    growthStatGrants: expectedGrowthGrants(hero),
    scheduleTaken: scheduleEntries(scheduleFor(hero)).length,
  };
  // The path goes through the run's own verb, so a graft, a rewire and a path passive land exactly as in Classic.
  const evolved = slot.pathId ? chooseEvolutionPath({ ...createRunState(), roster: [raw] }, content.table, content.heroes, raw.rosterId, slot.pathId).roster[0] : raw;

  const cls = slot.classId ? content.classes[slot.classId] : null;
  return {
    ...evolved,
    unlockedMoveIds: [...slot.moveIds],
    offeredMoveIds: [],
    equipment: [...slot.itemIds],
    classId: cls ? cls.id : null,
    classPassiveId: cls?.grantsPassiveId ?? null,
  };
}

export function constructedRoster(content: ConstructedContent, team: Team): RosterEntry[] {
  return team.slots.map((slot) => constructedEntry(content, slot));
}

/**
 * A team as one side of a fight: a throwaway RunState holding no gold, relics or potions (§3), and
 * its squad — the authored `leads` for the AI's side, else no leads, picked in the fight as in Classic.
 */
export function constructedSide(content: ConstructedContent, team: Team, leads?: readonly [string, string]): { run: RunState; squad: Squad } {
  const roster = constructedRoster(content, team);
  const run: RunState = { ...createRunState(0, 0), roster, consumables: { hpPotion: 0, mpPotion: 0, revive: 0 } };
  if (!leads) return { run, squad: openingSquad(roster) };
  for (const id of leads) if (!roster.some((r) => r.rosterId === id)) throw new ConstructedError(`lead ${id} is not on the team`);
  return { run, squad: { activeIds: [leads[0], leads[1]], benchIds: roster.map((r) => r.rosterId).filter((id) => !leads.includes(id)) } };
}
