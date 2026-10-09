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
  type ResolvableOutcome,
  type RunEventDefinition,
} from '../data/events';
import { curses } from '../data/curses';
import { curseOf, curseTurnOwed } from './curse';
import { grantMove, MOVE_CAP } from './progression';
import type { RosterEntry, RunState } from './state';
import { addRosterEntry, createRosterEntry, replaceRosterEntry, ROSTER_CAP } from './state';
import { mergeStatMods } from './statMods';
import { statGrantCost } from './equipment';
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
 * a signature (one hero's identity, docs/mastery.md §5) and a Class move (the Academy's alone).
 */
export function movePoolFor(filter: MovePoolFilter | undefined, moves: Record<string, MoveDefinition>): string[] {
  const needle = filter?.nameIncludes?.toLowerCase();
  return Object.values(moves)
    .filter((move) => {
      if (signatureMoves[move.id] || classMoves[move.id] || move.metamorphic) return false;
      if (needle && !move.name.toLowerCase().includes(needle)) return false;
      if (filter?.types && !filter.types.includes(move.type)) return false;
      if (filter?.kinds && !filter.kinds.includes(move.kind)) return false;
      if (filter?.tiers && !filter.tiers.includes(move.tier ?? 'early')) return false;
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

// --- Balance (docs/events.md "Balance") ---
//
// An event competes for its row with the Item Cache, whose best-of-three grows ~50 → ~100 budget
// points from Act 1 to Act 5. So an event's stat payout is authored at its Act 1 figure and GROWS
// with the act as the cache does; only the gains grow — a cost stays what it says. The price of an
// event is that you do not know which one you will get, never that it might be a bad trade.

/** What an event's stat GAINS are multiplied by, by act (1-indexed; the last entry holds past it). */
export const EVENT_STAT_SCALE_BY_ACT: readonly number[] = [1, 1.25, 1.5, 1.75, 2];

export function eventStatScale(actNumber: number): number {
  const index = Math.max(1, Math.floor(actNumber)) - 1;
  return EVENT_STAT_SCALE_BY_ACT[Math.min(index, EVENT_STAT_SCALE_BY_ACT.length - 1)];
}

/** Gains scaled to the act and kept on the multiples of 5; costs left as authored. */
export function scaleDeltas(deltas: Partial<Record<StatKey, number>>, actNumber: number): Partial<Record<StatKey, number>> {
  const scale = eventStatScale(actNumber);
  const out: Partial<Record<StatKey, number>> = {};
  for (const [stat, amount] of Object.entries(deltas) as [StatKey, number][]) {
    out[stat] = amount > 0 ? Math.round((amount * scale) / 5) * 5 : amount;
  }
  return out;
}

function scaleHero(outcome: HeroOutcome, actNumber: number): HeroOutcome {
  return outcome.kind === 'statShift' ? { ...outcome, deltas: scaleDeltas(outcome.deltas, actNumber) } : outcome;
}

/** An outcome as THIS act pays it: what the screen shows and what resolution lands. */
export function outcomeForAct(outcome: ResolvableOutcome, actNumber: number): ResolvableOutcome {
  if (outcome.kind === 'statShift') return scaleHero(outcome, actNumber);
  if (outcome.kind === 'gamble') return { ...outcome, win: scaleHero(outcome.win, actNumber), lose: scaleHero(outcome.lose, actNumber) };
  return outcome;
}

/** A stat line in item-budget points (run/equipment.ts statGrantCost): the scale the Item Cache is read on. */
export function deltaPoints(deltas: Partial<Record<StatKey, number>>): number {
  return (Object.entries(deltas) as [StatKey, number][]).reduce((sum, [stat, amount]) => sum + statGrantCost(stat, amount), 0);
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
 * The Turn (data/curses.ts): the hero becomes the curse, and its move is taught — below MOVE_CAP it
 * simply lands, at it only with `replaceMoveId` (no replace is the decline, and the Turn lands
 * anyway). A move already held is not taught twice.
 */
export function turnCurse(run: RunState, rosterId: string, replaceMoveId?: string): RunState {
  const entry = requireEntry(run, rosterId);
  const curse = curseOf(entry);
  if (!curse) throw new RunEventError(`${rosterId} carries no curse`);
  let next = run;
  if (!entry.unlockedMoveIds.includes(curse.moveId)) {
    if (entry.unlockedMoveIds.length < MOVE_CAP) next = grantMove(next, rosterId, curse.moveId);
    else if (replaceMoveId) next = grantMove(next, rosterId, curse.moveId, replaceMoveId);
  }
  const turned: RosterEntry = { ...requireEntry(next, rosterId), curseTurned: true };
  return { ...next, roster: next.roster.map((r) => (r.rosterId === rosterId ? turned : r)) };
}

/** The bite: marks the hero; one already at the curse's pip Turns on the spot (`replaceMoveId` as turnCurse). */
export function applyCurse(run: RunState, rosterId: string, curseId: string, replaceMoveId?: string): RunState {
  if (!curses[curseId]) throw new RunEventError(`Unknown curse ${curseId}`);
  const marked: RosterEntry = { ...requireEntry(run, rosterId), curseId, curseTurned: false };
  const next = { ...run, roster: run.roster.map((r) => (r.rosterId === rosterId ? marked : r)) };
  return curseTurnOwed(marked) ? turnCurse(next, rosterId, replaceMoveId) : next;
}

/** Whether the bite would Turn this hero now — and so whether its move needs room. */
export function curseTurnsOnBite(entry: RosterEntry, curseId: string): boolean {
  return curseTurnOwed({ ...entry, curseId, curseTurned: false });
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
