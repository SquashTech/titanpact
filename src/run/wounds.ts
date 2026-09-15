// Wounds (docs/run-loop.md "Wounds", 2026-09-15, per user direction): HP persists across the
// nodes of an act. A fight leaves each fielded hero's missing HP on its roster entry, the next
// fight places it that much down, and only the act's end restores the roster whole. Mana is not
// carried — a fight still opens on a full pool (docs/mana.md). Stored as the HP MISSING rather
// than the HP held so that a max that moves mid-act (a growth roll, a Banner, an item swapped at
// the Blacksmith) moves the current by the same amount on its own.
//
// The walk floor is what keeps a wound from being a brick: every hero enters the next node with
// at least WALK_FLOOR of its max, KO'd or not. It is a floor on EVERYONE rather than a revive
// rule so that dying is never a better outcome than surviving low.

import type { HeroLookup } from '../engine/state';
import { getMaxHp, type CombatState, type Side } from '../engine/state';
import { rosterIdOfCombatant } from './combatantIds';
import type { RosterEntry, RunState } from './state';

export class WoundsError extends Error {}

/** The share of max HP a hero always has going into a node. */
export const WALK_FLOOR = 0.25;

/** Flat Guild Hall price for mending the whole roster. A pure gold sink, priced against a hire. */
export const MEND_PRICE = 40;

/** The HP a hero with `wounds` missing stands at against `maxHp`: never under the walk floor. */
export function woundedHp(maxHp: number, wounds: number): number {
  return Math.max(Math.ceil(maxHp * WALK_FLOOR), maxHp - wounds);
}

/** What a fight leaves: max less what is held, already floored, so what is stored is what the next fight places. */
export function woundsFrom(maxHp: number, currentHp: number): number {
  return maxHp - woundedHp(maxHp, Math.max(0, maxHp - currentHp));
}

export function isWounded(entry: RosterEntry): boolean {
  return entry.wounds > 0;
}

export function anyWounded(run: RunState): boolean {
  return run.roster.some(isWounded);
}

/**
 * Read one side's ending HP back onto its roster. The fight's own buffs are not carried — a
 * wound is read against the hero's baseline max, the same figure the next fight will place it
 * against. Heroes the fight did not field keep the wounds they had.
 */
export function recordWounds(run: RunState, state: CombatState, side: Side, heroes: HeroLookup): RunState {
  const woundsById = new Map<string, number>();
  for (const combatant of Object.values(state.combatants)) {
    if (combatant.side !== side) continue;
    const baselineMax = getMaxHp(heroes[combatant.heroId], { ...combatant, statModifiers: {} });
    woundsById.set(rosterIdOfCombatant(combatant.combatantId), woundsFrom(baselineMax, combatant.currentHp));
  }
  return {
    ...run,
    roster: run.roster.map((entry) => {
      const wounds = woundsById.get(entry.rosterId);
      return wounds === undefined ? entry : { ...entry, wounds };
    }),
  };
}

/** The whole roster made whole — the act's end, the Rest seat, the Guild Hall's mend. */
export function mendRoster(run: RunState): RunState {
  return { ...run, roster: run.roster.map((entry) => (entry.wounds === 0 ? entry : { ...entry, wounds: 0 })) };
}

export function canBuyMend(run: RunState, cost = MEND_PRICE): boolean {
  return anyWounded(run) && run.gold >= cost;
}

export function buyMend(run: RunState, cost = MEND_PRICE): RunState {
  if (!anyWounded(run)) throw new WoundsError('Nobody is wounded');
  if (run.gold < cost) throw new WoundsError(`Mending costs ${cost} gold, only ${run.gold} available`);
  return mendRoster({ ...run, gold: run.gold - cost });
}
