// Wounds (docs/run-loop.md "Wounds", 2026-09-15, per user direction): HP persists across the
// nodes of an act. A fight leaves each fielded hero's missing HP on its roster entry, the next
// fight places it that much down, and only the act's end restores the roster whole. Mana is not
// carried — a fight still opens on a full pool (docs/mana.md). Stored as the HP MISSING rather
// than the HP held so that a max that moves mid-act (a growth roll, a Banner) moves the current by
// the same amount on its own.
//
// A knockout PERSISTS (2026-09-17, per user direction — the counterweight to every fight fielding
// the whole roster, docs/combat.md "The fielded roster"): a hero the fight KO'd is `down` and is
// not fielded until a Rest, the Guild Hall's mend, a Revive (run/consumables.ts) or the act's end
// stands it up. The 25% walk floor this replaced was written against the 2026-08-16 reversal,
// where a KO'd hero was a brick with no way back; the faucets above are the way back.

import type { HeroLookup } from '../engine/state';
import { getMaxHp, type CombatState, type Side } from '../engine/state';
import { rosterIdOfCombatant } from './combatantIds';
import type { RosterEntry, RunState } from './state';

export class WoundsError extends Error {}

/**
 * The Guild Hall's mend is priced by what is missing (2026-09-18, per user direction): gold per
 * hero's worth of missing HP across the roster, a downed hero counting as a whole one, rounded to
 * the coin and never under the floor. Six heroes at half cost 45 — about the old flat 40, at the
 * point that price was worth paying — and a scratch costs a scratch. Still a pure gold sink.
 */
export const MEND_PRICE_PER_HERO = 15;
export const MEND_PRICE_FLOOR = 5;
/** Prices are struck in fives, as the shelf's are. */
const MEND_PRICE_STEP = 5;

/** How much of the roster is missing, in heroes' worth: each hero's wounds over its max, a downed hero 1. */
export function rosterMissing(run: RunState, maxHpOf: (entry: RosterEntry) => number): number {
  let missing = 0;
  for (const entry of run.roster) {
    if (entry.down) missing += 1;
    else if (entry.wounds > 0) missing += Math.min(1, entry.wounds / Math.max(1, maxHpOf(entry)));
  }
  return missing;
}

/** What the mend costs right now — `maxHpOf` because what a hero's max IS is the run side's to read (see reviveHero). */
export function mendPrice(run: RunState, maxHpOf: (entry: RosterEntry) => number): number {
  const priced = Math.round((MEND_PRICE_PER_HERO * rosterMissing(run, maxHpOf)) / MEND_PRICE_STEP) * MEND_PRICE_STEP;
  return Math.max(MEND_PRICE_FLOOR, priced);
}

/** A Revive stands a downed hero up at this share of its max — the potions' figure, flat. */
export const REVIVE_FRACTION = 0.5;

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
 * against. A KO is written as `down` with the whole max missing. Heroes the fight did not field
 * keep what they had.
 */
export function recordWounds(run: RunState, state: CombatState, side: Side, heroes: HeroLookup): RunState {
  const after = new Map<string, Pick<RosterEntry, 'wounds' | 'down'>>();
  for (const combatant of Object.values(state.combatants)) {
    if (combatant.side !== side) continue;
    const baselineMax = getMaxHp(heroes[combatant.heroId], { ...combatant, statModifiers: {} });
    const down = combatant.fainted || combatant.currentHp <= 0;
    after.set(rosterIdOfCombatant(combatant.combatantId), { wounds: down ? baselineMax : woundsFrom(baselineMax, combatant.currentHp), down });
  }
  return {
    ...run,
    roster: run.roster.map((entry) => {
      const next = after.get(entry.rosterId);
      return next === undefined ? entry : { ...entry, ...next };
    }),
  };
}

/** The whole roster made whole, the downed stood up — the act's end, the Rest seat, the Guild Hall's mend. */
export function mendRoster(run: RunState): RunState {
  return { ...run, roster: run.roster.map((entry) => (isWounded(entry) ? { ...entry, wounds: 0, down: false } : entry)) };
}

/** `cost` is mendPrice(run, maxHpOf), computed by the caller that can read max HP. */
export function canBuyMend(run: RunState, cost: number): boolean {
  return anyWounded(run) && run.gold >= cost;
}

export function buyMend(run: RunState, cost: number): RunState {
  if (!anyWounded(run)) throw new WoundsError('Nobody is wounded');
  if (run.gold < cost) throw new WoundsError(`Mending costs ${cost} gold, only ${run.gold} available`);
  return mendRoster({ ...run, gold: run.gold - cost });
}

/**
 * One downed hero stood up at REVIVE_FRACTION of `maxHp` — the Revive's half, spent by the caller
 * (consumables.ts). `maxHp` is passed in because what a hero's max IS depends on gear, Banners
 * and growth the run side reads through entryStatTotals, and this module reads none of them.
 */
export function reviveHero(run: RunState, rosterId: string, maxHp: number): RunState {
  const entry = run.roster.find((r) => r.rosterId === rosterId);
  if (!entry) throw new WoundsError(`${rosterId} is not on the roster`);
  if (!entry.down) throw new WoundsError(`${rosterId} is not down`);
  const wounds = maxHp - Math.max(1, Math.round(maxHp * REVIVE_FRACTION));
  return { ...run, roster: run.roster.map((r) => (r.rosterId === rosterId ? { ...r, wounds, down: false } : r)) };
}
