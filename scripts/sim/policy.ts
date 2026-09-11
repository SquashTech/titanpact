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
import { heroes } from '../../src/data/heroes';
import { moves } from '../../src/data/moves';
import { equipment } from '../../src/data/equipment';
import { passives } from '../../src/data/passives';
import { statuses } from '../../src/data/statuses';
import type { EquipmentDefinition } from '../../src/run/equipment';
import { holdsItem } from '../../src/run/equipment';
import type { RosterEntry, RunState } from '../../src/run/state';
import {
  EVOLUTION_SCROLLS,
  MOVE_CAP,
  applyEvolutionMoves,
  availableEvolution,
  canSpendScroll,
  chooseEvolutionPath,
  grantOfferedMove,
  itemSlotsFor,
  masteryMovePool,
  recordMoveOffer,
  rosterEntryTypes,
  scrollMovePool,
  spendMasteryScroll,
} from '../../src/run/progression';
import { progressionTable } from '../../src/data/progression';
import { mergeStatMods } from '../../src/run/statMods';
import type { Rng } from './rng';

/** How a level-up pool is spread across the roster. */
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
    entry.level * 25 +
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

/** Who eats the next level-up. `spread` levels the weakest of the fielded four; `focus` pours everything into the single strongest. */
export function levelUpTarget(roster: readonly RosterEntry[], policy: LevelPolicy): RosterEntry | null {
  if (roster.length === 0) return null;
  const ordered = byPower(roster);
  if (policy === 'focus') return ordered[0];
  // The four that will actually be fielded, lowest level first — Evolution at 5 is the spike worth chasing on everyone.
  const core = ordered.slice(0, Math.min(4, ordered.length));
  return [...core].sort((a, b) => a.level - b.level || powerScore(b) - powerScore(a))[0];
}

/** One Evolution taken inside a pour, reported back so run.ts can log it as a choice. */
export interface PourEvolution {
  rosterId: string;
  offered: string[];
  picked: string;
}

/**
 * Every held Mastery Scroll, poured into the hero it is worth most to — highest power score that
 * can still take one. CONCENTRATED rather than spread, because that is the play the rank ladder
 * rewards and a sim that spread them evenly would measure a ceiling nobody reaches.
 *
 * The 6th Scroll into a hero is its Evolution (docs/growth-overhaul.md §11): the path is taken at
 * random (the path table is what is under test), its granted move's overflow resolved, and only
 * then does the Scroll's own offer roll — from the post-Evolution pool, as the screen does it.
 *
 * The move is taken when it beats the worst one held (or there is room), declined otherwise —
 * either way the Scroll is gone, which is the rule the screen enforces too.
 */
export function pourScrolls(run: RunState, rng: () => number, evolutions: PourEvolution[] = []): RunState {
  let next = run;
  // Bounded by the pool: every iteration spends one or breaks.
  while (next.masteryScrolls > 0) {
    const takers = next.roster.filter((entry) => canSpendScroll(progressionTable, moves, next, entry));
    if (takers.length === 0) break;
    // Breadth first, then depth (docs/growth-overhaul.md §11: six evolved is the expected ending):
    // the strongest hero still short of its Evolution takes the Scroll; once everyone has one, the
    // strongest hero outright does, so the ladder's open-ended top is measured as well.
    const short = takers.filter((entry) => entry.masteryScrollsSpent < EVOLUTION_SCROLLS);
    const candidates = short.length > 0 ? short : takers;
    const target = candidates.reduce((best, entry) => (powerScore(entry) > powerScore(best) ? entry : best));
    next = spendMasteryScroll(next, target.rosterId);

    const ranked = next.roster.find((r) => r.rosterId === target.rosterId)!;
    const node = availableEvolution(progressionTable, ranked);
    if (node && node.paths.length > 0) {
      const path = node.paths[Math.floor(rng() * node.paths.length)];
      const refused = applyEvolutionMoves(ranked.unlockedMoveIds, path.unlocksMoveIds).overflow;
      try {
        next = chooseEvolutionPath(next, progressionTable, heroes, target.rosterId, path.id);
        evolutions.push({ rosterId: target.rosterId, offered: node.paths.map((p) => p.id), picked: path.id });
        for (const moveId of refused) {
          const replaceId = replacementTarget(next.roster.find((r) => r.rosterId === target.rosterId)!, moveId);
          if (replaceId) next = grantOfferedMove(next, target.rosterId, moveId, replaceId);
        }
      } catch {
        // Illegal path for this hero (content bug) — the Scroll still ticked; carry on unevolved.
      }
    }

    const current = next.roster.find((r) => r.rosterId === target.rosterId)!;
    const pool = masteryMovePool(progressionTable, moves, current);
    // A dry band still takes the Scroll — the tick is what opens the next one.
    if (pool.length === 0) continue;
    const moveId = pool[Math.floor(rng() * pool.length)];
    next = recordMoveOffer(next, target.rosterId, [moveId]);
    if (current.unlockedMoveIds.length < MOVE_CAP) {
      next = grantOfferedMove(next, target.rosterId, moveId);
    } else {
      const replaceId = replacementTarget(current, moveId);
      if (replaceId) next = grantOfferedMove(next, target.rosterId, moveId, replaceId);
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
