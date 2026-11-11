// Who an account owns, and the ids a recruit takes. A hero joins a run at the Recruit node
// (run/recruitNode.ts) or through an event (run/events.ts).

import type { RunState } from './state';

/** A rosterId that doesn't collide even when the same heroId is acquired more than once. */
export function freshRosterId(run: RunState, heroId: string): string {
  if (!run.roster.some((r) => r.rosterId === heroId)) return heroId;
  let n = 2;
  while (run.roster.some((r) => r.rosterId === `${heroId}-${n}`)) n++;
  return `${heroId}-${n}`;
}

/** Membership in the caller's recruitable pool (not whatever pool the fight drew from) — Goblins never satisfy it. */
export function isRecruitable(heroId: string, recruitablePool: Record<string, unknown>): boolean {
  return heroId in recruitablePool;
}

/** The ledger entry a Starfall leaves (docs/collection.md §4). Stored as `summon.`, the Starfall's first name. */
export const starfallLedgerId = (heroId: string): string => `summon.${heroId}`;
/** A single hero bought before singles were withdrawn (2026-09-26): still owned, refunded by the ledger. */
const legacySingleId = (heroId: string): string => `hero.${heroId}`;
/** A hero given free by a profile migration (run/profile.ts); costs nothing against the balance. */
export const grantLedgerId = (heroId: string): string => `grant.${heroId}`;

/**
 * Whether an account holds a hero: the base roster always; one outside it (`HeroDefinition.unlock`)
 * by its bundle or a Starfall — both entries in `Profile.purchases`.
 */
export function ownsHero(heroId: string, hero: { unlock?: string }, purchases: readonly string[]): boolean {
  return !hero.unlock || purchases.includes(hero.unlock) || purchases.includes(starfallLedgerId(heroId)) || purchases.includes(legacySingleId(heroId)) || purchases.includes(grantLedgerId(heroId));
}

/**
 * Every hero an account owns — the Collection, which the deck is built from (run/deck.ts). Read
 * once where the pool is read, the way `locationPool` is (run/locations.ts); the sim and the
 * tests pass nothing and get the base game.
 */
export function heroPool<T extends { unlock?: string }>(all: Record<string, T>, purchases: readonly string[] = []): Record<string, T> {
  return Object.fromEntries(Object.entries(all).filter(([id, hero]) => ownsHero(id, hero, purchases)));
}
