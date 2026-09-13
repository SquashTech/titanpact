// Consumables (docs/run-loop.md "Consumables"): the run's two potions. A TEAM purse, not a
// per-hero bag — held beside gold and the Scrolls, spent in a fight on whichever active hero
// needs it. The engine half (what a potion does to a combatant) is
// engine/combat/consumables.ts; this is what the run holds, pays and drops.

import type { ConsumableKind } from '../engine/combat/consumables';
import type { EncounterNodeKind } from './difficulty';
import type { RunState } from './state';

export type { ConsumableKind };

export class ConsumableError extends Error {}

export const CONSUMABLE_KINDS: readonly ConsumableKind[] = ['hpPotion', 'mpPotion'];

export type ConsumablePurse = Record<ConsumableKind, number>;

/** Every run opens with one of each — the early lever against an awkward first matchup. */
export const STARTING_CONSUMABLES: ConsumablePurse = { hpPotion: 1, mpPotion: 1 };

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

export const CONSUMABLE_NAMES: Record<ConsumableKind, string> = {
  hpPotion: 'HP Potion',
  mpPotion: 'MP Potion',
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

export function canBuyConsumable(run: RunState, kind: ConsumableKind, cost = CONSUMABLE_PRICE): boolean {
  return run.consumables[kind] < CONSUMABLE_HOLD_CAP && run.gold >= cost;
}

export function buyConsumable(run: RunState, kind: ConsumableKind, cost = CONSUMABLE_PRICE): RunState {
  if (run.consumables[kind] >= CONSUMABLE_HOLD_CAP) {
    throw new ConsumableError(`Already holding ${CONSUMABLE_HOLD_CAP} ${CONSUMABLE_NAMES[kind]}s`);
  }
  if (run.gold < cost) {
    throw new ConsumableError(`${CONSUMABLE_NAMES[kind]} costs ${cost} gold, only ${run.gold} available`);
  }
  return grantConsumable({ ...run, gold: run.gold - cost }, kind);
}

/** The kind a won encounter drops, or null. `rng` is a uniform [0, 1) source so the sim can seed it. */
export function rollConsumableDrop(nodeKind: EncounterNodeKind, rng: () => number = Math.random): ConsumableKind | null {
  if (rng() >= CONSUMABLE_DROP_CHANCE[nodeKind]) return null;
  return rng() < 0.5 ? 'hpPotion' : 'mpPotion';
}
