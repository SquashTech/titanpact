// The Boon node (docs/run-loop.md "Boons"): a 1-of-3 passive, then the hero it settles on. A Boon
// IS an ordinary passive — the engine never learns the word, and `grantEventPassive` is the same
// verb the events already use — so this file owns only the question the catalog can't answer:
// which passives this particular roster may be offered.

import type { HeroDefinition, MoveDefinition, PassiveDefinition } from '../engine/content';
import { boonPassives, chargeBoonPassives, fieldHeraldPassiveFor, typeDamagePassiveFor } from '../data/passives';
import { moves } from '../data/moves';
import type { RosterEntry } from './state';
import { rosterEntryTypes } from './progression';

/** A Boon offer is a 1-of-3, the same shape as the Mentor and the equipment cache. */
export const BOON_OFFER_COUNT = 3;

/**
 * Every type the roster fields, Evolution type-grafts included — a hero that traded into Storm
 * can be offered Stormcaller's Focus, and one that traded out of it can no longer be.
 */
export function rosterTypes(roster: readonly RosterEntry[], heroLookup: Record<string, HeroDefinition>): Set<string> {
  const types = new Set<string>();
  for (const entry of roster) {
    const hero = heroLookup[entry.heroId];
    if (!hero) continue;
    for (const type of rosterEntryTypes(hero, entry)) types.add(type);
  }
  return types;
}

/**
 * What this roster may be offered: every roster-agnostic passive, plus the type-locked ones for
 * each type somebody actually fields — the +20% damage Boon and the field Herald.
 *
 * The filter is the whole reason type-locked Boons can exist at all. Unfiltered they would be
 * fourteen entries against sixteen generic ones, so a typical 1-of-3 would show two grants nobody
 * on the roster could use, and the node would read as "did I roll my type" rather than as a
 * choice. Filtered, a type Boon is never dead and is usually the strongest thing on the card —
 * which is what makes it worth passing up a generic one for.
 *
 * NOT filtered by what a hero already holds: `bonusPassiveGrants` appends, so a second Bloodthirst
 * stacks, and stacking one effect on one hero is a build rather than a wasted pick.
 */
export function boonPool(roster: readonly RosterEntry[], heroLookup: Record<string, HeroDefinition>): string[] {
  const owned = rosterTypes(roster, heroLookup);
  const typeLocked = [...Object.entries(typeDamagePassiveFor), ...Object.entries(fieldHeraldPassiveFor)]
    .filter(([type]) => owned.has(type))
    .map(([, id]) => id);
  const chargeLocked = Object.keys(chargeBoonPassives).filter((id) => roster.some((entry) => chargeBoonFits(chargeBoonPassives[id], entry)));
  return [...Object.keys(boonPassives), ...typeLocked, ...chargeLocked];
}

/**
 * Whether a Charge-refill Boon has anything to refill on this hero: a held move with Charges, carrying
 * the tag the refill names, if it names one. Read off the definition, so a new refill needs no table.
 */
export function chargeBoonFits(passive: PassiveDefinition | undefined, entry: RosterEntry, moveLookup: Record<string, MoveDefinition> = moves): boolean {
  return (chargeBoonMoveCount(passive, entry, moveLookup) ?? 0) > 0;
}

/** How many of this hero's moves a Charge-refill Boon would refill; `null` for any other Boon. The Boon screen's fit note. */
export function chargeBoonMoveCount(passive: PassiveDefinition | undefined, entry: RosterEntry, moveLookup: Record<string, MoveDefinition> = moves): number | null {
  const refill = [passive?.reactive?.effect, passive?.reactive?.alsoEffect].find((e) => e?.kind === 'restoreCharge');
  if (!refill || refill.kind !== 'restoreCharge') return null;
  return entry.unlockedMoveIds.filter((id) => {
    const move = moveLookup[id];
    return move?.chargesPerFight != null && (refill.moveTag === undefined || !!move.tags?.includes(refill.moveTag));
  }).length;
}

/** The type a Boon is locked to, or null for the roster-agnostic ones. Read off the definition rather than a table, so a new type Boon needs no registration. */
export function boonMoveType(passive: PassiveDefinition | undefined): string | null {
  return passive?.damageModifier?.eventFieldEquals?.moveType ?? null;
}

/**
 * How many of this hero's unlocked moves a type-locked Boon would actually fire on. `null` for a
 * roster-agnostic Boon, which fires for anybody.
 *
 * The pool filter guarantees SOMEBODY on the roster fields the type; it cannot guarantee the hero
 * the player then taps does. And it should not decide for them — a hero may carry a few off-type
 * moves by design (docs/types-and-heroes.md), so an Iron Boon on a Water hero holding one Iron
 * move is a thin pick rather than an illegal one. Counting the moves says exactly how thin.
 */
export function boonMoveCount(
  passive: PassiveDefinition | undefined,
  entry: RosterEntry,
  moveLookup: Record<string, MoveDefinition>
): number | null {
  const type = boonMoveType(passive);
  if (!type) return null;
  return entry.unlockedMoveIds.filter((id) => moveLookup[id]?.type === type).length;
}

/** `count` distinct Boons from the roster's pool, in random order. */
export function pickBoonOffers(
  roster: readonly RosterEntry[],
  heroLookup: Record<string, HeroDefinition>,
  count: number = BOON_OFFER_COUNT,
  random: () => number = Math.random
): string[] {
  const remaining = boonPool(roster, heroLookup);
  const picked: string[] = [];
  while (picked.length < Math.min(count, remaining.length)) {
    picked.push(remaining.splice(Math.floor(random() * remaining.length), 1)[0]);
  }
  return picked;
}
