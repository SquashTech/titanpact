// Wounds (docs/run-loop.md "Wounds", 2026-09-15, per user direction): HP persists across the
// nodes of an act. A fight leaves each fielded hero's missing HP on its roster entry, the next
// fight places it that much down, and only the act's end restores the roster whole. Mana is not
// carried — a fight still opens on a full pool (docs/mana.md). Stored as the HP MISSING rather
// than the HP held so that a max that moves mid-act (a growth roll, a Banner) moves the current by
// the same amount on its own.
//
// A knockout PERSISTS (2026-09-17, per user direction — the counterweight to every fight fielding
// the whole roster, docs/combat.md "The fielded roster"): a hero the fight KO'd is `down` and is
// not fielded until a Rest, the Guild Hall's mend or the act's end stands it up. The 25% walk floor this replaced was written against the 2026-08-16 reversal,
// where a KO'd hero was a brick with no way back; the faucets above are the way back.

import type { HeroLookup } from '../engine/state';
import { getMaxHp, type CombatState, type Side } from '../engine/state';
import { rosterIdOfCombatant } from './combatantIds';
import type { RosterEntry, RunState } from './state';

export class WoundsError extends Error {}

/** The HP a hero with `wounds` missing stands at against `maxHp`. */
export function woundedHp(maxHp: number, wounds: number): number {
  return Math.max(0, maxHp - wounds);
}

/** Where a roster hero's HP stands going into its next fight: nothing while it is down. */
export function standingHp(maxHp: number, entry: RosterEntry): number {
  return entry.down ? 0 : woundedHp(maxHp, entry.wounds);
}

/** What a fight leaves: max less what is held. */
export function woundsFrom(maxHp: number, currentHp: number): number {
  return maxHp - Math.max(0, Math.min(maxHp, currentHp));
}

export function isDown(entry: RosterEntry): boolean {
  return entry.down;
}

/** Hurt or down — anything a mend would change. */
export function isWounded(entry: RosterEntry): boolean {
  return entry.down || entry.wounds > 0;
}

export function anyWounded(run: RunState): boolean {
  return run.roster.some(isWounded);
}

export function anyDown(run: RunState): boolean {
  return run.roster.some(isDown);
}

/** The heroes a fight can field. */
export function standingRoster(roster: readonly RosterEntry[]): RosterEntry[] {
  return roster.filter((entry) => !entry.down);
}

/**
 * Read one side's ending HP back onto its roster. The fight's own buffs are not carried — a
 * wound is read against the hero's baseline max, the same figure the next fight will place it
 * against. A KO is written as `down` with the whole max missing, and a Blessing the fight spent
 * is gone (a replayed fight never reaches here, so it refunds one). Heroes the fight did not field
 * keep what they had.
 */
export function recordWounds(run: RunState, state: CombatState, side: Side, heroes: HeroLookup): RunState {
  const after = new Map<string, Pick<RosterEntry, 'wounds' | 'down' | 'blessed'>>();
  for (const combatant of Object.values(state.combatants)) {
    if (combatant.side !== side) continue;
    const baselineMax = getMaxHp(heroes[combatant.heroId], { ...combatant, statModifiers: {} });
    const down = combatant.fainted || combatant.currentHp <= 0;
    after.set(rosterIdOfCombatant(combatant.combatantId), {
      wounds: down ? baselineMax : woundsFrom(baselineMax, combatant.currentHp),
      down,
      blessed: combatant.blessed === true,
    });
  }
  return {
    ...run,
    roster: run.roster.map((entry) => {
      const next = after.get(entry.rosterId);
      return next === undefined ? entry : { ...entry, ...next };
    }),
  };
}

/** The whole roster made whole, the downed stood up — the act's end, the Rest seat, the Camp's Mend. */
export function mendRoster(run: RunState): RunState {
  return { ...run, roster: run.roster.map((entry) => (isWounded(entry) ? { ...entry, wounds: 0, down: false } : entry)) };
}
