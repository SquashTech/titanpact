// Constructed (docs/constructed.md): a team the player builds, and the roster it fields as.
// Pure — the shape, its legality, and the projection onto RosterEntry/Squad the fight builder
// already reads, so the engine never knows which mode it is in.

import type { GrowthStatKey, HeroDefinition, MoveDefinition, PassiveDefinition, StatKey, TypeId } from '../engine/content';
import type { HeroLookup } from '../engine/state';
import type { Profile } from './profile';
import type { Squad } from './squad';
import { openingSquad } from './squad';
import { createRosterEntry, createRunState, ROSTER_CAP, type RosterEntry, type RunState } from './state';
import { BASE_ITEM_SLOTS, equipmentIdFor, parseEquipmentId, type EquipmentDefinition, type EquipmentRarity } from './equipment';
import { MAX_LEVEL, expectedGrowthAt, xpForLevel } from './growth';
import { MASTERY_CAP } from './mastery';
import { GEM_ORDER, fittedGem, gemPointsForPip, type Gem } from './gems';
import { entryPassiveCounts, entryStatModifiers } from './entryStats';
import { innatePassiveIdsFor } from './innate';
import { MOVE_CAP, chooseEvolutionPath, rosterEntryTypes, scheduleEntries, scheduleFor, signatureIdFor, type EvolutionPath, type ProgressionTable } from './progression';

export const TEAM_SIZE = ROSTER_CAP;
export const CONSTRUCTED_LEVEL = MAX_LEVEL;
export const CONSTRUCTED_RARITY: EquipmentRarity = 'mythic';

export interface TeamSlot {
  heroId: string;
  /** One of the hero's three Evolution paths, or null to field it unevolved. */
  pathId: string | null;
  /** 1 to MOVE_CAP, from `constructedMovePool`. */
  moveIds: string[];
  /** Up to BASE_ITEM_SLOTS family items at Mythic, one a family; no enchants, no Uniques. */
  itemIds: string[];
  /**
   * The ten Gems behind Mastery 10, by pip: a stat the player chose, or null (or past the end) for
   * one filled by fit as an enemy's is. A pip's size is the run's (`gemPointsForPip`).
   */
  gems?: (GrowthStatKey | null)[];
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
  moves: Record<string, MoveDefinition>;
  passives: Record<string, PassiveDefinition>;
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
  return expectedGrowthAt(hero, CONSTRUCTED_LEVEL);
}

export function constructedPath(table: ProgressionTable, heroId: string, pathId: string | null): EvolutionPath | null {
  if (!pathId) return null;
  return (table.evolutions[heroId] ?? []).flatMap((node) => node.paths).find((p) => p.id === pathId) ?? null;
}

/** Everything the hero could hold at the end of a run in this form: kit, pool, the path's moves, the signature. No Class (§3). */
export function constructedMovePool(content: ConstructedContent, slot: Pick<TeamSlot, 'heroId' | 'pathId'>): string[] {
  const hero = content.heroes[slot.heroId];
  if (!hero) return [];
  const path = constructedPath(content.table, slot.heroId, slot.pathId);
  return [
    ...new Set([
      ...hero.moveIds,
      ...(content.table.moveTiers[hero.id] ?? []),
      ...(path?.unlocksMoveIds ?? []),
      ...(path?.learnableMoveIds ?? []),
      ...[signatureIdFor(hero, { offenseSwapped: !!path?.swapsOffense })].filter((id): id is string => !!id),
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

  if (slot.moveIds.length === 0) problems.push(`${slot.heroId} holds no move`);
  if (slot.moveIds.length > MOVE_CAP) problems.push(`${slot.heroId} holds ${slot.moveIds.length} moves, the cap is ${MOVE_CAP}`);
  if (new Set(slot.moveIds).size !== slot.moveIds.length) problems.push(`${slot.heroId} holds a move twice`);
  const pool = new Set(constructedMovePool(content, slot));
  for (const id of slot.moveIds) if (!pool.has(id)) problems.push(`${id} is not in ${slot.heroId}'s pool`);

  const gems = slot.gems ?? [];
  if (gems.length > MASTERY_CAP) problems.push(`${slot.heroId} holds ${gems.length} Gems, Mastery is ${MASTERY_CAP}`);
  for (const stat of gems) if (stat !== null && !GEM_ORDER.includes(stat)) problems.push(`${stat} is not a Gem`);

  // A move the pool can never pay for is dead weight (§3): the hero's Mana at level 30 is the bar.
  if (slot.pathId === null || constructedPath(content.table, slot.heroId, slot.pathId)) {
    for (const id of overPoolMoveIds(content, slot)) problems.push(`${id} costs more Mana than ${slot.heroId} holds`);
  }

  if (slot.itemIds.length > BASE_ITEM_SLOTS) problems.push(`${slot.heroId} holds ${slot.itemIds.length} items, the sockets are ${BASE_ITEM_SLOTS}`);
  const bases = new Set<string>();
  for (const id of slot.itemIds) {
    const item = content.equipment[id];
    if (!item) {
      problems.push(`unknown item ${id}`);
      continue;
    }
    // The id's own tier, not the item's: a Unique is Mythic but has no family, and Constructed fields none (§3).
    const { rarity, base, enchantId } = parseEquipmentId(id);
    if (rarity !== CONSTRUCTED_RARITY) problems.push(`${id} is not a ${CONSTRUCTED_RARITY} family item`);
    if (enchantId) problems.push(`${id} is enchanted`);
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
  return slotEntry(content, slot);
}

/** The same projection, unchecked — the builder's preview of a slot mid-edit (no moves yet, a socket empty). A path the hero lacks is read as none. */
export function slotEntry(content: ConstructedContent, slot: TeamSlot): RosterEntry {
  const hero = content.heroes[slot.heroId];
  if (!hero) throw new ConstructedError(`unknown hero ${slot.heroId}`);
  if (slot.pathId && !constructedPath(content.table, slot.heroId, slot.pathId)) slot = { ...slot, pathId: null };

  const raw: RosterEntry = {
    ...createRosterEntry(slot.heroId, slot.heroId, hero.moveIds),
    xp: xpForLevel(CONSTRUCTED_LEVEL),
    mastery: MASTERY_CAP,
    growthStatGrants: expectedGrowthGrants(hero),
    scheduleTaken: scheduleEntries(scheduleFor(hero)).length,
  };
  // The path goes through the run's own verb, so a graft, a rewire and a path passive land exactly as in Classic.
  const evolved = slot.pathId ? chooseEvolutionPath({ ...createRunState(), roster: [raw] }, content.table, content.heroes, raw.rosterId, slot.pathId).roster[0] : raw;

  return {
    ...evolved,
    unlockedMoveIds: [...slot.moveIds],
    offeredMoveIds: [],
    equipment: [...slot.itemIds],
    gems: slotGems(hero, evolved, slot),
  };
}

/** All ten Gems the slot fields with, the player's where placed and fit's elsewhere. */
export function slotGems(hero: HeroDefinition, entry: Pick<RosterEntry, 'offenseSwapped'>, slot: Pick<TeamSlot, 'gems'>): Gem[] {
  return Array.from({ length: MASTERY_CAP }, (_, i) => {
    const stat = slot.gems?.[i] ?? null;
    return stat && GEM_ORDER.includes(stat) ? { stat, points: gemPointsForPip(i) } : fittedGem(hero, entry, i);
  });
}

/** The slot's Mana pool as it would field: base, growth, Gems, items and passives. */
export function slotManaPool(content: ConstructedContent, slot: TeamSlot): number {
  const hero = content.heroes[slot.heroId];
  if (!hero) return 0;
  const entry = slotEntry(content, slot);
  const counts = entryPassiveCounts(entry, content.equipment, {}, innatePassiveIdsFor(hero, entry) ?? []);
  return hero.baseStats.manaPool + (entryStatModifiers(entry, content.equipment, content.passives, counts).manaPool ?? 0);
}

/** Held moves whose authored cost is over the slot's pool. */
export function overPoolMoveIds(content: ConstructedContent, slot: TeamSlot): string[] {
  const pool = slotManaPool(content, slot);
  return slot.moveIds.filter((id) => (content.moves[id]?.manaCost ?? 0) > pool);
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

// --- The builder's verbs (docs/constructed.md §9): pure, so the screen only renders ---

/** Saved teams a player can hold (§5). */
export const TEAM_SLOTS = 6;

/** The slot's typing as it fields: the innate primary, the path's graft owning the secondary. */
export function slotTypes(content: ConstructedContent, slot: Pick<TeamSlot, 'heroId' | 'pathId'>): readonly TypeId[] {
  const hero = content.heroes[slot.heroId];
  if (!hero) return [];
  const path = constructedPath(content.table, slot.heroId, slot.pathId);
  return rosterEntryTypes(hero, { evolutionTypeGraft: path?.typeGraft ?? null });
}

/** A new path keeps the moves its pool still holds; a path's own line leaves with it. */
export function withPath(content: ConstructedContent, slot: TeamSlot, pathId: string | null): TeamSlot {
  const next = { ...slot, pathId };
  const pool = new Set(constructedMovePool(content, next));
  // A held signature changes hands with the stats, into or out of a rewire.
  const hero = content.heroes[slot.heroId];
  const signature = signatureIdFor(hero, { offenseSwapped: !!constructedPath(content.table, slot.heroId, pathId)?.swapsOffense });
  const before = signatureIdFor(hero, { offenseSwapped: !!constructedPath(content.table, slot.heroId, slot.pathId)?.swapsOffense });
  const moveIds = slot.moveIds.map((id) => (id === before && signature ? signature : id));
  return { ...next, moveIds: moveIds.filter((id) => pool.has(id)) };
}

/** Held: dropped. Not held: added while there is room, else nothing. */
export function toggleMove(slot: TeamSlot, moveId: string): TeamSlot {
  if (slot.moveIds.includes(moveId)) return { ...slot, moveIds: slot.moveIds.filter((id) => id !== moveId) };
  if (slot.moveIds.length >= MOVE_CAP) return slot;
  return { ...slot, moveIds: [...slot.moveIds, moveId] };
}

/**
 * Socket `index` takes `itemId`, or empties on null. The list stays compact, and a family held in
 * another socket leaves it — one a family is a legality rule, so the builder never makes a breach.
 */
export function setItem(slot: TeamSlot, index: number, itemId: string | null): TeamSlot {
  const items = [...slot.itemIds];
  if (itemId === null) {
    items.splice(index, 1);
    return { ...slot, itemIds: items };
  }
  const family = parseEquipmentId(itemId).base;
  if (index < items.length) items[index] = itemId;
  else items.push(itemId);
  const placed = Math.min(index, items.length - 1);
  return { ...slot, itemIds: items.filter((id, i) => i === placed || parseEquipmentId(id).base !== family).slice(0, BASE_ITEM_SLOTS) };
}

/** Pip `index` takes `stat`, or goes back to fit on null. */
export function setGem(slot: TeamSlot, index: number, stat: GrowthStatKey | null): TeamSlot {
  if (index < 0 || index >= MASTERY_CAP) return slot;
  const gems = Array.from({ length: MASTERY_CAP }, (_, i) => slot.gems?.[i] ?? null);
  gems[index] = stat;
  while (gems.length > 0 && gems[gems.length - 1] === null) gems.pop();
  return { ...slot, gems };
}

/** An item id without its enchant — a team saved while Constructed still took them reads as the bare piece. */
export function unenchanted(itemId: string): string {
  const { base, rarity, enchantId } = parseEquipmentId(itemId);
  return enchantId ? equipmentIdFor(base, rarity) : itemId;
}
