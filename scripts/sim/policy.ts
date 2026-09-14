// The simulated player. Two rules govern every function here:
//
// 1. Anything that is a BALANCE QUESTION is decided UNIFORMLY AT RANDOM — which
//    starters to draft, which relic, which Evolution path, which Class, which
//    Banner. Random choice is what turns each reward screen into a randomized
//    experiment (see ChoiceAgg), and it is the only way a weak option's weakness
//    can show up in the data rather than being designed around.
// 2. Everything else plays like a competent-but-unimaginative player: field your
//    strongest four, put gear on whoever it helps, spend points.

import type { MoveDefinition, StatKey } from '../../src/engine/content';
import { statusApplicationsOf } from '../../src/engine/content';
import { rosterHeroes as heroes } from '../../src/data/content';
import { applyCompanionTierStep, companionTierStep } from '../../src/run/companion';
import { moves } from '../../src/data/moves';
import { equipment } from '../../src/data/equipment';
import { passives } from '../../src/data/passives';
import { statuses } from '../../src/data/statuses';
import type { EquipmentDefinition } from '../../src/run/equipment';
import { holdsItem } from '../../src/run/equipment';
import type { RosterEntry, RunState } from '../../src/run/state';
import { MASTERY_EVOLUTION, SCRIBE_PICKS, canTakeMastery } from '../../src/run/mastery';
import {
  MOVE_CAP,
  applyEvolutionMoves,
  availableEvolution,
  chooseEvolutionPath,
  grantOfferedMove,
  itemSlotsFor,
  levelMovePool,
  pendingScheduleEntry,
  recordMoveOffer,
  rosterEntryTypes,
  takeScheduleEntry,
} from '../../src/run/progression';
import { progressionTable } from '../../src/data/progression';
import { mergeStatMods } from '../../src/run/statMods';
import type { Rng } from './rng';
import { levelOf } from '../../src/run/growth';

/**
 * How Scrolls are aimed (docs/mastery.md §2, §8 phase 5's rotate / carry pair). `focus`
 * concentrates: the fielded hero closest to its next milestone. `spread` rotates: the fielded hero
 * with the fewest pips, so the roster evolves in step. Ichor's focus-vs-spread dial before it
 * (docs/xp-overhaul.md §3), on the currency that replaced it.
 */
export type LevelPolicy = 'spread' | 'focus';

export interface PolicyOptions {
  levelPolicy: LevelPolicy;
}

export const DEFAULT_POLICY: PolicyOptions = { levelPolicy: 'spread' };

// --- Stat reading ---

const ALL_STATS: readonly StatKey[] = ['hp', 'attack', 'defense', 'intelligence', 'wisdom', 'speed', 'manaPool', 'mpRegen'];

/** Base line plus every run-permanent grant plus worn gear — what the hero actually fights with. */
export function effectiveStats(entry: RosterEntry): Record<StatKey, number> {
  const base = { ...heroes[entry.heroId].baseStats } as Record<StatKey, number>;
  let grants = mergeStatMods(entry.evolutionStatGrants, entry.bonusStatGrants);
  grants = mergeStatMods(grants, entry.growthStatGrants);
  for (const itemId of entry.equipment) {
    if (equipment[itemId]) grants = mergeStatMods(grants, equipment[itemId].statGrants);
  }
  const out = {} as Record<StatKey, number>;
  for (const stat of ALL_STATS) out[stat] = (base[stat] ?? 0) + (grants[stat] ?? 0);
  return out;
}

/** True when the hero hits harder with Attack than with Intelligence. Decides which offensive stat gear is worth anything to it. */
export function isPhysical(entry: RosterEntry): boolean {
  const stats = effectiveStats(entry);
  return stats.attack >= stats.intelligence;
}

/**
 * One number for "how much fight is in this hero". Used only for ordering
 * (which four to field, who gets the item, who to terminate) — never as a
 * balance readout.
 */
export function powerScore(entry: RosterEntry): number {
  const stats = effectiveStats(entry);
  const offense = Math.max(stats.attack, stats.intelligence);
  return (
    levelOf(entry) * 25 +
    stats.hp * 0.4 +
    offense +
    stats.defense * 0.6 +
    stats.wisdom * 0.6 +
    stats.speed * 0.6 +
    stats.manaPool * 0.25 +
    stats.mpRegen * 2 +
    entry.evolutionPassiveGrants.length * 8 +
    entry.bonusPassiveGrants.length * 8 +
    (entry.classId ? 8 : 0)
  );
}

// --- Equipment ---

/** Relevance weights: a stat the hero cannot use is worth almost nothing to it. */
function statWeight(entry: RosterEntry, stat: StatKey): number {
  const physical = isPhysical(entry);
  switch (stat) {
    case 'hp':
      return 0.35;
    case 'attack':
      return physical ? 1 : 0.1;
    case 'intelligence':
      return physical ? 0.1 : 1;
    case 'defense':
      return 0.6;
    case 'wisdom':
      return 0.6;
    case 'speed':
      return 0.7;
    case 'manaPool':
      return 0.3;
    case 'mpRegen':
      return 2;
    default:
      return 0.3;
  }
}

export function itemValueFor(entry: RosterEntry, item: EquipmentDefinition | null): number {
  if (!item) return 0;
  let value = 0;
  for (const stat of Object.keys(item.statGrants) as StatKey[]) {
    value += (item.statGrants[stat] ?? 0) * statWeight(entry, stat);
  }
  value += (item.grantsPassiveIds?.length ?? 0) * 8;
  const types = rosterEntryTypes(heroes[entry.heroId], entry);
  for (const grant of item.grantsStatusIds ?? []) {
    // Elemental Force is worth its magnitude only on a hero that casts that type.
    const onType = types.some((type) => grant.statusId.startsWith(type));
    value += (grant.magnitude ?? 0) * (onType ? 0.6 : 0.1);
  }
  return value;
}

/**
 * Who should wear `item`, and what it costs them: a hero with a free slot compares against
 * nothing, a full one against its WEAKEST held item — that is the one a player would give up, so
 * it is the one the sim gives up. `replaceIndex` is undefined when the slot was free.
 */
export function bestWearer(
  roster: readonly RosterEntry[],
  item: EquipmentDefinition
): { rosterId: string; gain: number; replaceIndex?: number } | null {
  let best: { rosterId: string; gain: number; replaceIndex?: number } | null = null;
  for (const entry of roster) {
    // A hero never holds two copies, so an owner is not a candidate. Through holdsItem, not an id
    // comparison: the rule is measured on the FAMILY, so a hero carrying an enchanted sibling of
    // this item already holds it. Comparing ids let the sim pick that hero and then throw inside
    // equipToRoster, which cost it 15% of every batch — silently, since a crashed run is dropped.
    if (holdsItem(entry.equipment, item.id)) continue;
    const offered = itemValueFor(entry, item);

    if (entry.equipment.length < itemSlotsFor(heroes[entry.heroId], entry)) {
      if (!best || offered > best.gain + 1e-9) best = { rosterId: entry.rosterId, gain: offered };
      continue;
    }

    let weakestIndex = -1;
    let weakestValue = Infinity;
    entry.equipment.forEach((heldId, index) => {
      const value = itemValueFor(entry, equipment[heldId] ?? null);
      if (value < weakestValue) {
        weakestValue = value;
        weakestIndex = index;
      }
    });
    if (weakestIndex < 0) continue;
    const gain = offered - weakestValue;
    if (!best || gain > best.gain + 1e-9) best = { rosterId: entry.rosterId, gain, replaceIndex: weakestIndex };
  }
  return best;
}

// --- Moves ---

/**
 * A guard (Barrier) negates a whole round of what the far side aims at the holder, which is
 * worth about a mid-tier attack — not the flat 15 a rider scores. Without this the pool's
 * crude scorer buried it second-from-bottom and no simulated hero ever took it, so the move
 * could not be measured at all.
 */
const GUARD_SLOT_VALUE = 50;

function guardValue(move: MoveDefinition): number {
  return statusApplicationsOf(move).some((app) => statuses[app.statusId]?.blocksIncomingMoves) ? GUARD_SLOT_VALUE : 0;
}

/** Crude "is this move worth a slot" score, for the replace-at-cap decision only. */
export function moveValue(moveId: string): number {
  const move = moves[moveId];
  if (!move) return 0;
  const power = move.basePower ?? move.randomBasePower?.max ?? 0;
  const heal = move.healPower ?? 0;
  const utility = (move.statDeltas ? 15 : 0) + (move.statusApplication ? 15 : 0) + guardValue(move);
  // Mana is the balance lever on reliable moves, so a cheap move of equal power is a better slot.
  return power + heal * 1.2 + utility - (move.manaCost ?? 0) * 0.4;
}

/**
 * At MOVE_CAP: the currently-held move worth replacing, or null to decline the offer.
 *
 * A swap must leave the hero able to CAST something. `moveValue` prices a move on power minus a
 * fraction of its cost, so a greedy climb happily trades every cheap move away for a big one and
 * strands the hero on Rest for the rest of the run — measured, Brimstone reached level 10 holding
 * four moves priced 75-80 against a 65 pool and won 0 of 350 fights. No player does that, so the
 * simulated one does not either: the last affordable move is never the one given up, and an
 * unaffordable offer is declined unless something affordable survives it.
 */
export function replacementTarget(entry: RosterEntry, incomingMoveId: string): string | null {
  const pool = effectiveStats(entry).manaPool;
  const affordable = (id: string) => (moves[id]?.manaCost ?? 0) <= pool;
  const incoming = moveValue(incomingMoveId);

  let worstId: string | null = null;
  let worst = Infinity;
  for (const id of entry.unlockedMoveIds) {
    // Keep the last castable move, whatever it scores.
    const keepsOneCastable = affordable(incomingMoveId) || entry.unlockedMoveIds.some((other) => other !== id && affordable(other));
    if (!keepsOneCastable) continue;
    const value = moveValue(id);
    if (value < worst) {
      worst = value;
      worstId = id;
    }
  }
  return worstId !== null && incoming > worst ? worstId : null;
}

// --- Roster ordering ---

/** Strongest first. */
export function byPower(roster: readonly RosterEntry[]): RosterEntry[] {
  return [...roster].sort((a, b) => powerScore(b) - powerScore(a));
}

/** The four (or fewer) heroes the policy fields, strongest first. */
export function fieldedSquadIds(roster: readonly RosterEntry[], size: number): string[] {
  return byPower(roster).slice(0, size).map((r) => r.rosterId);
}

/** One Evolution taken inside a pour, reported back so run.ts can log it as a choice. */
export interface PourEvolution {
  rosterId: string;
  offered: string[];
  picked: string;
}

/** What one pass of the schedule paid, so run.ts can tally it. */
export interface SchedulePayout {
  /** Offers that were a DECISION: the kit was full, so the screen asked replace-or-decline. */
  offers: number;
  /** Offers that simply landed: room in the kit, so the screen was a receipt. */
  receipts: number;
  evolutions: PourEvolution[];
}

/**
 * What a hero's Mastery pips owe it (src/view/run/masteryFlow.ts), paid for every hero on the
 * roster: the companion's tier-step, or its Evolution — the path taken at random, since the path
 * table is what is under test, and its granted move's overflow resolved. Called wherever a pip
 * lands and from the level-up report as the catch-all a hire arriving past the pip needs.
 */
export function payMastery(run: RunState, rng: () => number, payout: SchedulePayout = { offers: 0, receipts: 0, evolutions: [] }): RunState {
  let next = run;
  for (const { rosterId } of run.roster) {
    const entry = next.roster.find((r) => r.rosterId === rosterId);
    if (!entry) continue;
    if (companionTierStep(entry)) {
      next = applyCompanionTierStep(next, rosterId);
      continue;
    }
    const node = availableEvolution(progressionTable, entry);
    if (!node || node.paths.length === 0) continue;
    const path = node.paths[Math.floor(rng() * node.paths.length)];
    const refused = applyEvolutionMoves(entry.unlockedMoveIds, path.unlocksMoveIds).overflow;
    try {
      next = chooseEvolutionPath(next, progressionTable, heroes, rosterId, path.id);
      payout.evolutions.push({ rosterId, offered: node.paths.map((p) => p.id), picked: path.id });
      for (const moveId of refused) {
        const replaceId = replacementTarget(next.roster.find((r) => r.rosterId === rosterId)!, moveId);
        if (replaceId) next = grantOfferedMove(next, rosterId, moveId, replaceId);
      }
    } catch {
      // Illegal path for this hero (content bug) — carry on unevolved.
    }
  }
  return next;
}

/**
 * Who the next Scroll goes to (docs/mastery.md §2: concentrating is dominant, and the question
 * is which hero's next step). The fielded four first. `focus`: among them the hero closest to its
 * next milestone — an unevolved hero before an evolved one, since an Evolution outranks a
 * signature — and the stronger on a tie. `spread`: the fewest pips first, so the four evolve in
 * step. Null when nobody can take one.
 */
export function scrollTarget(roster: readonly RosterEntry[], policy: LevelPolicy, exclude: readonly string[] = []): RosterEntry | null {
  const ordered = byPower(roster).filter((r) => canTakeMastery(r) && !exclude.includes(r.rosterId));
  if (ordered.length === 0) return null;
  const rank = (r: RosterEntry) => ordered.indexOf(r);
  const core = new Set(ordered.slice(0, Math.min(4, ordered.length)).map((r) => r.rosterId));
  return [...ordered].sort((a, b) => {
    const fielded = Number(core.has(b.rosterId)) - Number(core.has(a.rosterId));
    if (fielded !== 0) return fielded;
    if (policy === 'spread') return a.mastery - b.mastery || rank(a) - rank(b);
    const unevolved = Number(b.mastery < MASTERY_EVOLUTION) - Number(a.mastery < MASTERY_EVOLUTION);
    if (unevolved !== 0) return unevolved;
    return b.mastery - a.mastery || rank(a) - rank(b);
  })[0];
}

/** The Scribe's two picks: the first two scrollTarget names, distinct. */
export function scribeTargets(roster: readonly RosterEntry[], policy: LevelPolicy): RosterEntry[] {
  const picked: RosterEntry[] = [];
  while (picked.length < SCRIBE_PICKS) {
    const next = scrollTarget(roster, policy, picked.map((r) => r.rosterId));
    if (!next) break;
    picked.push(next);
  }
  return picked;
}

/**
 * The level-up report's payout (src/view/run/levelUpFlow.ts): what the pips owe first (the
 * catch-all), then every hero owed a schedule entry takes ONE — an offer rolled from the band
 * its level has opened. The move is taken when it beats the worst one held (or there is room),
 * declined otherwise — either way the entry is taken, which is the rule the screen enforces too.
 */
export function takeSchedule(run: RunState, rng: () => number, payout: SchedulePayout = { offers: 0, receipts: 0, evolutions: [] }): RunState {
  let next = payMastery(run, rng, payout);
  for (const { rosterId } of run.roster) {
    const entry = next.roster.find((r) => r.rosterId === rosterId);
    if (!entry) continue;
    const hero = heroes[entry.heroId];
    const owed = pendingScheduleEntry(hero, entry);
    if (!owed) continue;
    const pool = levelMovePool(progressionTable, moves, hero, entry);
    next = takeScheduleEntry(next, rosterId);
    // A dry band pays nothing; the level's growth was the whole of it.
    if (pool.length === 0) continue;
    const moveId = pool[Math.floor(rng() * pool.length)];
    next = recordMoveOffer(next, rosterId, [moveId]);
    if (entry.unlockedMoveIds.length < MOVE_CAP) {
      payout.receipts++;
      next = grantOfferedMove(next, rosterId, moveId);
    } else {
      payout.offers++;
      const replaceId = replacementTarget(entry, moveId);
      if (replaceId) next = grantOfferedMove(next, rosterId, moveId, replaceId);
    }
  }
  return next;
}

/** A stat-boost node's recipient: the hero the stat is worth the most to. */
export function statBoostTarget(roster: readonly RosterEntry[], stat: StatKey): RosterEntry | null {
  if (roster.length === 0) return null;
  return byPower(roster).reduce((best, entry) =>
    statWeight(entry, stat) * powerScore(entry) > statWeight(best, stat) * powerScore(best) ? entry : best
  );
}

/** Class and event passives go to the strongest hero — the one most likely to stay fielded. */
export function passiveTarget(roster: readonly RosterEntry[]): RosterEntry | null {
  return byPower(roster)[0] ?? null;
}

export function passiveExists(passiveId: string): boolean {
  return passiveId in passives;
}

export function randomOf<T>(rng: Rng, pool: readonly T[]): T | null {
  return pool.length === 0 ? null : pool[Math.floor(rng() * pool.length)];
}
