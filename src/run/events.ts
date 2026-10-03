// Run-tier mechanism behind map EVENTS (content: src/data/events.ts).
// Selection is called once at node-select time, never inside a component
// (a component-local roll rerolls on every remount — see shop.ts).

import type { HeroDefinition, MoveDefinition, PassiveId, StatKey } from '../engine/content';
import {
  DEFAULT_EVENT_WEIGHT,
  type EventCost,
  type HeroOutcome,
  type HeroPoolFilter,
  type MovePoolFilter,
  type RunEventDefinition,
  type RunEventOutcome,
} from '../data/events';
import { grantMove, MOVE_CAP } from './progression';
import type { RosterEntry, RunState } from './state';
import { addRosterEntry, createRosterEntry, replaceRosterEntry, ROSTER_CAP } from './state';
import { mergeStatMods } from './statMods';
import { levelAfterEncounters, levelUpEntry } from './growth';
import { guildHallMastery } from './mastery';
import { lookupOf } from './deck';
import { signatureMoves } from '../data/signatures';
import { classMoves } from '../data/classes';

export class RunEventError extends Error {}

// --- Selection ---

/** Two per-event gates, both optional: `minAct` and `locationIds`. A null `locationId` matches only unrestricted events. */
export function eligibleEvents(
  defs: Record<string, RunEventDefinition>,
  actNumber: number,
  locationId: string | null
): RunEventDefinition[] {
  return Object.values(defs).filter((def) => {
    if (def.minAct !== undefined && actNumber < def.minAct) return false;
    if (def.locationIds && (locationId === null || !def.locationIds.includes(locationId))) return false;
    return true;
  });
}

/** Weighted roll (`weight`, else DEFAULT_EVENT_WEIGHT); null when nothing is eligible — callers must handle it. */
export function rollRunEvent(
  defs: Record<string, RunEventDefinition>,
  actNumber: number,
  locationId: string | null,
  random: () => number = Math.random
): RunEventDefinition | null {
  const pool = eligibleEvents(defs, actNumber, locationId);
  if (pool.length === 0) return null;
  const weightOf = (def: RunEventDefinition) => Math.max(0, def.weight ?? DEFAULT_EVENT_WEIGHT);
  const total = pool.reduce((sum, def) => sum + weightOf(def), 0);
  let roll = random() * total;
  for (const def of pool) {
    roll -= weightOf(def);
    if (roll < 0) return def;
  }
  return pool[pool.length - 1];
}

/**
 * An omitted filter means every move in the game (Wildcard) — less the two that belong to somebody:
 * a signature (one hero's identity, docs/mastery.md §5) and a Class move (the Crucible's alone).
 */
export function movePoolFor(filter: MovePoolFilter | undefined, moves: Record<string, MoveDefinition>): string[] {
  const needle = filter?.nameIncludes?.toLowerCase();
  return Object.values(moves)
    .filter((move) => {
      if (signatureMoves[move.id] || classMoves[move.id] || move.metamorphic) return false;
      if (needle && !move.name.toLowerCase().includes(needle)) return false;
      if (filter?.types && !filter.types.includes(move.type)) return false;
      if (filter?.kinds && !filter.kinds.includes(move.kind)) return false;
      return true;
    })
    .map((move) => move.id);
}

/** Undefined if the filter matches nothing — a typo in `nameIncludes` shouldn't take the run down. */
export function rollEventMove(filter: MovePoolFilter | undefined, moves: Record<string, MoveDefinition>): string | undefined {
  const pool = movePoolFor(filter, moves);
  if (pool.length === 0) return undefined;
  return pool[Math.floor(Math.random() * pool.length)];
}

// --- Resolution ---

/** Floor on max HP after a `statShift` — a zero-HP entry faints the instant a fight is built. Not a balance knob. */
export const MIN_HP_AFTER_SHIFT = 20;

/** Only HP is floored — it is the only stat whose reaching zero ends the hero. */
export function statShiftAllowed(deltas: Partial<Record<StatKey, number>>, currentMaxHp: number): boolean {
  const hpDelta = deltas.hp ?? 0;
  return hpDelta >= 0 || currentMaxHp + hpDelta >= MIN_HP_AFTER_SHIFT;
}

function requireEntry(run: RunState, rosterId: string): RosterEntry {
  const entry = run.roster.find((r) => r.rosterId === rosterId);
  if (!entry) throw new RunEventError(`${rosterId} is not on the roster`);
  return entry;
}

/** All deltas in ONE transform, so a two-sided trade can't commit the cost and drop the payoff. */
export function applyStatShift(run: RunState, rosterId: string, deltas: Partial<Record<StatKey, number>>): RunState {
  const entry = requireEntry(run, rosterId);
  const next: RosterEntry = { ...entry, bonusStatGrants: mergeStatMods(entry.bonusStatGrants, deltas) };
  return { ...run, roster: run.roster.map((r) => (r.rosterId === rosterId ? next : r)) };
}

/** Appends rather than de-duplicating — a second copy stacks. */
export function grantEventPassive(
  run: RunState,
  rosterId: string,
  passiveId: PassiveId,
  passiveLookup: Record<PassiveId, { id: PassiveId }>
): RunState {
  const entry = requireEntry(run, rosterId);
  if (!passiveLookup[passiveId]) throw new RunEventError(`Unknown passive ${passiveId}`);
  const next: RosterEntry = { ...entry, bonusPassiveGrants: [...entry.bonusPassiveGrants, passiveId] };
  return { ...run, roster: run.roster.map((r) => (r.rosterId === rosterId ? next : r)) };
}

/**
 * A curse, in one transform: the typing replaced, the move taught (`replaceMoveId` at MOVE_CAP; a
 * move the hero already holds is not taught twice), and the tenth pip's payout rewritten.
 */
export function applyTransform(
  run: RunState,
  rosterId: string,
  outcome: Extract<RunEventOutcome, { kind: 'transform' }>,
  replaceMoveId?: string
): RunState {
  let next = run;
  const entry = requireEntry(next, rosterId);
  if (outcome.moveId && !entry.unlockedMoveIds.includes(outcome.moveId)) {
    if (entry.unlockedMoveIds.length >= MOVE_CAP && !replaceMoveId) throw new RunEventError(`${rosterId} is at the move cap — name a move to replace`);
    next = grantMove(next, rosterId, outcome.moveId, entry.unlockedMoveIds.length >= MOVE_CAP ? replaceMoveId : undefined);
  }
  const cursed = requireEntry(next, rosterId);
  const changed: RosterEntry = {
    ...cursed,
    typeOverride: [...outcome.types],
    masteryOverride: outcome.mastery ? { passiveIds: [...outcome.mastery.passiveIds], ...(outcome.mastery.formId ? { formId: outcome.mastery.formId } : {}) } : cursed.masteryOverride,
  };
  return { ...next, roster: next.roster.map((r) => (r.rosterId === rosterId ? changed : r)) };
}

/** A gamble's branch, or a lone hero outcome, onto one hero. */
export function applyHeroOutcome(
  run: RunState,
  rosterId: string,
  outcome: HeroOutcome,
  passiveLookup: Record<PassiveId, { id: PassiveId }>
): RunState {
  return outcome.kind === 'statShift'
    ? applyStatShift(run, rosterId, outcome.deltas)
    : grantEventPassive(run, rosterId, outcome.passiveId, passiveLookup);
}

/** A hero can take a gamble only if it survives the worse branch: both are checked, since either can land. */
export function heroOutcomeAllowed(outcome: HeroOutcome, currentMaxHp: number): boolean {
  return outcome.kind !== 'statShift' || statShiftAllowed(outcome.deltas, currentMaxHp);
}

/** The roll happens once, here, as the hero is named — so what the player saw is never re-rolled. */
export function resolveGamble(chance: number, random: () => number = Math.random): 'win' | 'lose' {
  return random() < chance ? 'win' : 'lose';
}

// --- Costs ---

export function costAffordable(run: RunState, cost: EventCost | undefined): boolean {
  return !cost?.gold || run.gold >= cost.gold;
}

/**
 * Gold off the purse, Wounds onto every standing hero. A wound never drops a hero: it stops at 1
 * HP, so an event cannot KO anyone — `down` is the fights' to set.
 */
export function applyEventCost(run: RunState, cost: EventCost | undefined, maxHpOf: (entry: RosterEntry) => number): RunState {
  if (!cost) return run;
  if (!costAffordable(run, cost)) throw new RunEventError(`The event costs ${cost.gold} gold, only ${run.gold} available`);
  let next: RunState = cost.gold ? { ...run, gold: run.gold - cost.gold } : run;
  const fraction = cost.woundAll ?? 0;
  if (fraction > 0) {
    next = {
      ...next,
      roster: next.roster.map((entry) => {
        if (entry.down) return entry;
        const max = maxHpOf(entry);
        const wounds = Math.min(max - 1, entry.wounds + Math.round(max * fraction));
        return { ...entry, wounds: Math.max(entry.wounds, wounds) };
      }),
    };
  }
  return next;
}

// --- Recruit ---

/** What a recruit draws from: the deck the run was sealed with, or `catalog` whole on a save from before decks. */
export function recruitPool(run: Pick<RunState, 'deck'>, catalog: Record<string, HeroDefinition>): Record<string, HeroDefinition> {
  return run.deck ? lookupOf(catalog, run.deck) : catalog;
}

/** Every hero `filter` admits from `pool` that is not already on the roster. */
export function recruitCandidates(
  run: RunState,
  filter: HeroPoolFilter,
  pool: Record<string, HeroDefinition>
): string[] {
  const held = new Set(run.roster.map((entry) => entry.heroId));
  return Object.values(pool)
    .filter((hero) => !held.has(hero.id))
    .filter((hero) => !filter.types || hero.types.some((type) => filter.types!.includes(type)))
    .filter((hero) => !filter.heroIds || filter.heroIds.includes(hero.id))
    .map((hero) => hero.id);
}

/** Up to `count` distinct candidates, rolled once at mount. */
export function rollRecruits(
  run: RunState,
  filter: HeroPoolFilter,
  count: number,
  pool: Record<string, HeroDefinition>,
  random: () => number = Math.random
): string[] {
  const candidates = recruitCandidates(run, filter, pool);
  const picked: string[] = [];
  while (picked.length < count && candidates.length > 0) {
    picked.push(candidates.splice(Math.floor(random() * candidates.length), 1)[0]);
  }
  return picked;
}

/**
 * What an event recruit joins as: RAW at the player's PAR — a Guild hire's terms (its authored
 * kit, every schedule entry owed, the hire's pips) without the hire's act of lag. The lag is what
 * the hire's gold buys back; an event recruit costs a node instead, and is narrowed by theme.
 */
export function eventRecruitEntry(
  run: RunState,
  hero: HeroDefinition,
  rosterId: string,
  random: () => number = Math.random
): RosterEntry {
  const base = { ...createRosterEntry(rosterId, hero.id, hero.moveIds), mastery: guildHallMastery(run.actNumber) };
  const level = levelAfterEncounters(run.encountersWon);
  return level <= 1 ? base : levelUpEntry(base, hero, level - 1, random).entry;
}

/** Joins outright below the cap; at it, `terminatedRosterId` leaves with its gear. */
export function joinEventRecruit(run: RunState, entry: RosterEntry, terminatedRosterId?: string): RunState {
  if (run.roster.length < ROSTER_CAP) return addRosterEntry(run, entry);
  if (!terminatedRosterId) throw new RunEventError('The roster is full — someone has to leave');
  return replaceRosterEntry(run, terminatedRosterId, entry);
}
