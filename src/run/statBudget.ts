// What an authored stat line COSTS, as opposed to what it reads. Every budget figure in the
// game — the roster's 450, a faction's flat 400, a champion's 550, the Endbringer's 900 — is a
// number in these units, and every one of them is measured through this module.
//
// HP is the only stat whose authored figure is not its cost. It is authored in the units the HP
// bar draws (a hero's `hp: 240` is a 240-point bar) and priced at HP_BUDGET_VALUE, because a
// point of HP does less for a hero than a point of anything else: it is linear, it is absent
// from the damage ratio, and it does nothing on a turn the hero is not being hit.
//
// OPEN (2026-09-08): HP_BUDGET_VALUE is 0.5 here and 0.25 in `STAT_POINT_VALUE` (equipment.ts),
// so the roster and the item tiers have always priced HP against each other at 2:1. Both rates
// predate the HP doubling and neither was ever measured. Reconciling them is a balance decision,
// not a cleanup — see docs/progression.md "Pricing HP".

import type { StatKey } from '../engine/content';

/** Budget points one authored point of HP costs. Every other budgeted stat costs 1. */
export const HP_BUDGET_VALUE = 0.5;

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

/** Every stat present in the line, priced — for grants, where the caller has no fixed stat list. */
export function grantBudgetTotal(grant: Partial<Record<StatKey, number>>): number {
  return Object.entries(grant).reduce((sum, [stat, amount]) => sum + statBudgetCost(stat as StatKey, amount ?? 0), 0);
}
