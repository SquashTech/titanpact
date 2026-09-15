// The combatant id a roster entry is placed under, and the way back. Its own module so the
// run-side readers of a finished fight (companion.ts, wounds.ts) need not import the builder.

import type { CombatState, Side } from '../engine/state';

export function combatantIdFor(side: Side, rosterId: string): string {
  return `${side}:${rosterId}`;
}

/** The inverse: the roster entry a combatant id was placed from. */
export function rosterIdOfCombatant(combatantId: string): string {
  return combatantId.slice(combatantId.indexOf(':') + 1);
}

/** Roster ids on `side` that ended the fight KO'd — what the companion's mortality reads (run/companion.ts). */
export function koRosterIdsOf(state: CombatState, side: Side): string[] {
  return Object.values(state.combatants)
    .filter((c) => c.side === side && c.fainted)
    .map((c) => rosterIdOfCombatant(c.combatantId));
}
