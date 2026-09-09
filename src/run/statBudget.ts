// What an authored stat line COSTS, as opposed to what it reads. Two rules live here.
//
// THE HERO ROSTER pays face value (2026-09-09): every hero's seven stats sum to HERO_STAT_TOTAL,
// HP included at 1:1. The rule is the number the Stat Total row already prints, so "is this line
// on budget" is a question the player can answer off the sheet. What it cost: the measured
// break-even is nearer 0.33 HP per point, so this over-charges HP roughly 3x and the roster's HP
// range compressed to 170–270 in consequence — docs/progression.md "Pricing HP".
//
// EVERY OTHER budget figure — a faction's flat 400, a champion's 550, the Endbringer's 900 —
// still prices HP at HP_BUDGET_VALUE. Those lines carry no Mana and are authored against a
// measured baseline that assumes the discount; enemies were not re-based with the roster.

import type { StatKey } from '../engine/content';

/** Budget points one authored point of HP costs on an ENEMY line. Every other budgeted stat costs 1. */
export const HP_BUDGET_VALUE = 0.5;

/** What every authored hero's seven stats sum to, at face value. */
export const HERO_STAT_TOTAL = 550;

/** The hero budget: HP + Mana + the five battle stats. MP Regen is a flat 10 outside it. */
export const HERO_BUDGET_STATS: readonly StatKey[] = [
  'hp',
  'attack',
  'defense',
  'intelligence',
  'wisdom',
  'speed',
  'manaPool',
];

/** The enemy convention (docs/run-loop.md "Measured baseline"): the six combat stats, no mana. */
export const COMBAT_BUDGET_STATS: readonly StatKey[] = ['hp', 'attack', 'defense', 'intelligence', 'wisdom', 'speed'];

/** One stat amount in budget points. */
export function statBudgetCost(stat: StatKey, amount: number): number {
  return stat === 'hp' ? amount * HP_BUDGET_VALUE : amount;
}

/** A whole stat line (or a grant) in budget points, counting only `stats`. */
export function statBudgetTotal(line: Partial<Record<StatKey, number>>, stats: readonly StatKey[]): number {
  return stats.reduce((sum, stat) => sum + statBudgetCost(stat, line[stat] ?? 0), 0);
}

/** A hero's line at FACE VALUE — the seven budgeted stats, HP at 1:1. This is the roster rule. */
export function heroStatTotal(line: Partial<Record<StatKey, number>>): number {
  return HERO_BUDGET_STATS.reduce((sum, stat) => sum + (line[stat] ?? 0), 0);
}

/** Every stat present in the line, priced — for grants, where the caller has no fixed stat list. */
export function grantBudgetTotal(grant: Partial<Record<StatKey, number>>): number {
  return Object.entries(grant).reduce((sum, [stat, amount]) => sum + statBudgetCost(stat as StatKey, amount ?? 0), 0);
}
