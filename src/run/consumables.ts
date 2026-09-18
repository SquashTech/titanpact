// Consumables (docs/run-loop.md "Consumables"): the run's two potions and the Revive. A TEAM
// purse, not a per-hero bag — held beside gold and the Scrolls. A potion is drunk in a fight on
// whichever active hero needs it (the engine half is engine/combat/consumables.ts); the Revive is
// spent on a hero that is down — in a fight, from the Bag (the same engine half), or on the map,
// on the squad screen, on a hero a fight left down (run/wounds.ts). This is what the run holds,
// pays and drops.

import type { PotionKind } from '../engine/combat/consumables';
import type { EncounterNodeKind } from './difficulty';
import type { RunState } from './state';

export type { PotionKind };

/** Every kind the purse holds. `revive` is never sold; since 2026-09-18 it is used in a fight as well as on the squad screen. */
export type ConsumableKind = PotionKind | 'revive';

export class ConsumableError extends Error {}

/** The in-fight kinds: the Bag's tabs and the shelf's goods. */
export const POTION_KINDS: readonly PotionKind[] = ['hpPotion', 'mpPotion'];

export const CONSUMABLE_KINDS: readonly ConsumableKind[] = [...POTION_KINDS, 'revive'];

export type ConsumablePurse = Record<ConsumableKind, number>;

/** Every run opens with one of each potion and no Revive — the first one is found, never given. */
export const STARTING_CONSUMABLES: ConsumablePurse = { hpPotion: 1, mpPotion: 1, revive: 0 };

/**
 * Held count cap, per kind. One MP potion bends the mana invariant on purpose (docs/mana.md);
 * five banked by Act 4 would break it, so the purse cannot grow past this and a drop or a
 * purchase onto a full purse is refused rather than banked.
 */
export const CONSUMABLE_HOLD_CAP = 3;

/** Flat Guild Hall price, per potion. A pure gold sink: nothing here ever pays gold back. */
export const CONSUMABLE_PRICE = 20;

/**
 * Chance a won encounter drops ONE potion, kind rolled evenly. Low but not impossible: the shelf
 * is the faucet you can plan around, the drop is the one you cannot. First-pass figures.
 */
export const CONSUMABLE_DROP_CHANCE: Record<EncounterNodeKind, number> = {
  fight: 0.12,
  battle: 0.12,
  skirmish: 0.12,
  elite: 0.2,
  boss: 0.25,
  finale: 0,
};

/**
 * Chance a won encounter drops a Revive, rolled on its own so it never dilutes the potions. Rarer
 * than a potion and off the shelf (2026-09-17, per user direction): with knockouts persisting
 * through an act, a Revive that could be planned around would make a KO a 20g mistake. The Rest
 * seat and the Guild Hall's mend are the faucets you can plan around; this is the one you cannot.
 * First-pass figures.
 */
export const REVIVE_DROP_CHANCE: Record<EncounterNodeKind, number> = {
  fight: 0.06,
  battle: 0.06,
  skirmish: 0.08,
  elite: 0.15,
  boss: 0.2,
  finale: 0,
};

export const CONSUMABLE_NAMES: Record<ConsumableKind, string> = {
  hpPotion: 'HP Potion',
  mpPotion: 'MP Potion',
  revive: 'Revive',
};

/** The Bag's chip row at three across: the coin says which flask it is, so the word is the short one. */
export const CONSUMABLE_SHORT_NAMES: Record<ConsumableKind, string> = {
  hpPotion: 'HP',
  mpPotion: 'MP',
  revive: 'Revive',
};

/** What each one does, in the words every receipt and shelf line uses. */
export const CONSUMABLE_BLURBS: Record<ConsumableKind, string> = {
  hpPotion: 'Restores half of max HP',
  mpPotion: 'Restores half of max Mana',
  revive: 'Stands a downed hero up at half HP',
};

/** Clamped to the cap: an over-cap grant is lost, never banked. */
export function grantConsumable(run: RunState, kind: ConsumableKind, count = 1): RunState {
  const held = Math.min(CONSUMABLE_HOLD_CAP, run.consumables[kind] + count);
  return { ...run, consumables: { ...run.consumables, [kind]: held } };
}

/** What a fight consumed, taken off the purse at resolve (a replayed fight refunds it whole). */
export function spendConsumables(run: RunState, used: Readonly<Partial<ConsumablePurse>>): RunState {
  const purse = { ...run.consumables };
  for (const kind of CONSUMABLE_KINDS) {
    const n = used[kind] ?? 0;
    if (n > purse[kind]) throw new Error(`spent ${n} ${CONSUMABLE_NAMES[kind]}s, held ${purse[kind]}`);
    purse[kind] -= n;
  }
  return { ...run, consumables: purse };
}

export function canBuyConsumable(run: RunState, kind: PotionKind, cost = CONSUMABLE_PRICE): boolean {
  return run.consumables[kind] < CONSUMABLE_HOLD_CAP && run.gold >= cost;
}

export function buyConsumable(run: RunState, kind: PotionKind, cost = CONSUMABLE_PRICE): RunState {
  if (run.consumables[kind] >= CONSUMABLE_HOLD_CAP) {
    throw new ConsumableError(`Already holding ${CONSUMABLE_HOLD_CAP} ${CONSUMABLE_NAMES[kind]}s`);
  }
  if (run.gold < cost) {
    throw new ConsumableError(`${CONSUMABLE_NAMES[kind]} costs ${cost} gold, only ${run.gold} available`);
  }
  return grantConsumable({ ...run, gold: run.gold - cost }, kind);
}

/**
 * What a won encounter drops, or null: the potion roll first, the Revive's own roll only when
 * the potions missed — one drop a fight at most, so the result screen has one row to give it.
 * `rng` is a uniform [0, 1) source so the sim can seed it.
 */
export function rollConsumableDrop(nodeKind: EncounterNodeKind, rng: () => number = Math.random): ConsumableKind | null {
  if (rng() < CONSUMABLE_DROP_CHANCE[nodeKind]) return rng() < 0.5 ? 'hpPotion' : 'mpPotion';
  if (rng() < REVIVE_DROP_CHANCE[nodeKind]) return 'revive';
  return null;
}

export function canUseRevive(run: RunState): boolean {
  return run.consumables.revive > 0;
}

/** One Revive off the purse. The standing-up itself is wounds.ts reviveHero; callers pair the two. */
export function spendRevive(run: RunState): RunState {
  if (run.consumables.revive <= 0) throw new ConsumableError('No Revive held');
  return { ...run, consumables: { ...run.consumables, revive: run.consumables.revive - 1 } };
}
