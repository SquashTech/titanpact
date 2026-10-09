// Consumables (docs/run-loop.md "Consumables"): the run's two potions and the Revive. A TEAM
// purse, not a per-hero bag — held beside gold and the Scrolls. A potion is drunk in a fight on
// whichever active hero needs it (the engine half is engine/combat/consumables.ts); the Revive is
// spent on a hero that is down — in a fight, from the Bag or the lead pick (the same engine half),
// a hero a fight left down entering the next one fallen (run/squad.ts openingSquad). This is what the run holds,
// pays and drops.

import type { PotionKind } from '../engine/combat/consumables';
import type { EncounterNodeKind } from './difficulty';
import type { RunState } from './state';

export type { PotionKind };

/** Every kind the purse holds. `revive` is never sold; it is used in a fight, the lead pick included (a downed hero enters fallen). */
export type ConsumableKind = PotionKind | 'revive';

export class ConsumableError extends Error {}

/** The in-fight kinds: the Bag's tabs. */
export const POTION_KINDS: readonly PotionKind[] = ['hpPotion', 'mpPotion'];

export const CONSUMABLE_KINDS: readonly ConsumableKind[] = [...POTION_KINDS, 'revive'];

export type ConsumablePurse = Record<ConsumableKind, number>;

/** Every run opens with one of each potion and no Revive — the first one is found, never given. */
export const STARTING_CONSUMABLES: ConsumablePurse = { hpPotion: 1, mpPotion: 1, revive: 0 };

/**
 * Held count cap, per kind. One MP potion bends the mana invariant on purpose (docs/mana.md);
 * five banked by Act 4 would break it, so the purse cannot grow past this and a drop onto a
 * full purse is refused rather than banked.
 */
export const CONSUMABLE_HOLD_CAP = 3;

/**
 * Chance a won encounter drops ONE potion, kind rolled evenly. With the run's opening pair, the
 * only faucet: nothing sells them (2026-10-08, per user direction). First-pass figures.
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
 * Chance a won encounter drops a Revive, rolled on its own so it never dilutes the potions — its
 * only faucet, nothing sells one (2026-10-08, per user direction). The Rest seat and the Guild
 * Hall's mend are the faucets you can plan around; this is the one you cannot. First-pass figures.
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

/** What each one does, in the words every receipt uses. */
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
