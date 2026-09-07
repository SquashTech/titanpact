// Map-node progression (docs/run-loop.md): moving across a RunMap and
// resolving what each node type grants. Pure RunState transforms.

import type { HeroDefinition, StatKey } from '../engine/content';
import type { BrokenSeal, RunState, RosterEntry } from './state';
import type { EquipmentDefinition } from './equipment';
import { addToStash, equipItem, holdsItem, MAX_ITEM_SLOTS, removeFromStash, stashIsFull, unequipSlot } from './equipment';
import { generateMap } from './map';
import { itemSlotsFor } from './progression';
import { sellValueFor } from './shop';
import { mergeStatMods } from './statMods';

export class RunProgressError extends Error {}

/** The start row if the map hasn't been entered yet, otherwise the current node's outgoing edges. */
export function reachableNodeIds(run: RunState): string[] {
  if (!run.map) return [];
  if (run.currentNodeId === null) return run.map.startNodeIds;
  return run.map.nodes[run.currentNodeId]?.nextIds ?? [];
}

/** Moves onto `nodeId` once it has been resolved (fight won, reward claimed, shop exited). */
export function advanceToNode(run: RunState, nodeId: string): RunState {
  if (!run.map) throw new RunProgressError('Run has no map');
  if (!run.map.nodes[nodeId]) throw new RunProgressError(`${nodeId} is not a node on this map`);
  if (!reachableNodeIds(run).includes(nodeId)) {
    throw new RunProgressError(`${nodeId} is not reachable from the current node`);
  }
  return {
    ...run,
    currentNodeId: nodeId,
    visitedNodeIds: run.visitedNodeIds.includes(nodeId) ? run.visitedNodeIds : [...run.visitedNodeIds, nodeId],
  };
}

export function grantCurrencyReward(run: RunState, amount: number): RunState {
  return { ...run, gold: run.gold + amount };
}

/** New XP always re-opens the Level Up gate, whatever the player banked before it. */
export function grantUpgradeReward(run: RunState, points: number): RunState {
  return { ...run, levelUpPool: run.levelUpPool + points, levelUpDeferred: false };
}

/** The player chose to bank rather than spend (LevelUpScreen's Continue). */
export function deferLevelUp(run: RunState): RunState {
  return { ...run, levelUpDeferred: true };
}

/** The per-act contract grant (App.tsx, on the boss-node win). */
export function grantContractReward(run: RunState, amount: number): RunState {
  return { ...run, recruitContracts: run.recruitContracts + amount };
}

/**
 * A Guardian's fall, snapshotted so the finale can field it again at the power it was
 * beaten at (docs/lore.md §6). Idempotent per act — a re-resolved boss node never
 * double-records.
 */
export function recordBrokenSeal(run: RunState, seal: BrokenSeal): RunState {
  if (run.brokenSeals.some((s) => s.actNumber === seal.actNumber)) return run;
  return { ...run, brokenSeals: [...run.brokenSeals, seal] };
}

/** Fresh map for the next act, per-act position fields reset. Roster/gold/relics/contracts untouched; callers own the TOTAL_ACTS check. */
export function advanceToNextAct(run: RunState, seed: number): RunState {
  return {
    ...run,
    map: generateMap(seed, run.actNumber + 1),
    currentNodeId: null,
    visitedNodeIds: [],
    actNumber: run.actNumber + 1,
  };
}

/** Duplicates are allowed (grants stack); the reward screen is expected to offer only unowned relics. */
export function grantRelicReward(run: RunState, relicId: string): RunState {
  return { ...run, relics: [...run.relics, relicId] };
}

/** hpBoost/manaBoost/manaRegenBoost node resolution, folded into `bonusStatGrants`. */
export function grantStatBonus(run: RunState, rosterId: string, stat: StatKey, amount: number): RunState {
  const entry = run.roster.find((r) => r.rosterId === rosterId);
  if (!entry) throw new RunProgressError(`${rosterId} is not on the roster`);
  const nextEntry: RosterEntry = { ...entry, bonusStatGrants: mergeStatMods(entry.bonusStatGrants, { [stat]: amount }) };
  return { ...run, roster: run.roster.map((r) => (r.rosterId === rosterId ? nextEntry : r)) };
}

/** The Forge node: one more item slot for one hero, permanently. Refused at MAX_ITEM_SLOTS — a hero already there is not a legal target. */
export function grantItemSlot(run: RunState, rosterId: string, heroLookup: Record<string, HeroDefinition>): RunState {
  const entry = run.roster.find((r) => r.rosterId === rosterId);
  if (!entry) throw new RunProgressError(`${rosterId} is not on the roster`);
  const hero = heroLookup[entry.heroId];
  if (!hero) throw new RunProgressError(`Unknown hero ${entry.heroId}`);
  if (itemSlotsFor(hero, entry) >= MAX_ITEM_SLOTS) {
    throw new RunProgressError(`${entry.heroId} is already at the ${MAX_ITEM_SLOTS}-slot cap`);
  }
  const nextEntry: RosterEntry = { ...entry, bonusItemSlots: entry.bonusItemSlots + 1 };
  return { ...run, roster: run.roster.map((r) => (r.rosterId === rosterId ? nextEntry : r)) };
}

// --- The stash (docs/progression.md) ---

/** Picking an item up. Refused when the bag is full; the caller offers a sale instead. */
export function stashItem(run: RunState, itemId: string, equipmentLookup: Record<string, EquipmentDefinition>): RunState {
  if (!equipmentLookup[itemId]) throw new RunProgressError(`Unknown equipment ${itemId}`);
  if (stashIsFull(run.stash)) throw new RunProgressError(`The bag is full`);
  return { ...run, stash: addToStash(run.stash, itemId) };
}

/** Taking gear off. Refused when the bag is full — the only way a hero is stuck holding something. */
export function unequipToStash(run: RunState, rosterId: string, index: number): RunState {
  const entry = run.roster.find((r) => r.rosterId === rosterId);
  if (!entry) throw new RunProgressError(`${rosterId} is not on the roster`);
  const itemId = entry.equipment[index];
  if (!itemId) throw new RunProgressError(`${rosterId} has nothing in item slot ${index}`);
  if (stashIsFull(run.stash)) throw new RunProgressError(`The bag is full`);

  const nextEntry: RosterEntry = { ...entry, equipment: unequipSlot(entry.equipment, index) };
  return {
    ...run,
    roster: run.roster.map((r) => (r.rosterId === rosterId ? nextEntry : r)),
    stash: addToStash(run.stash, itemId),
  };
}

/** Sells one carried item at `sellValueFor`. The bag is the only place gear is sold from — equipped gear comes off first. */
export function sellFromStash(run: RunState, index: number, equipmentLookup: Record<string, EquipmentDefinition>): RunState {
  const itemId = run.stash[index];
  if (!itemId) throw new RunProgressError(`The bag has nothing in slot ${index}`);
  const item = equipmentLookup[itemId];
  if (!item) throw new RunProgressError(`Unknown equipment ${itemId}`);
  return { ...run, gold: run.gold + sellValueFor(item), stash: removeFromStash(run.stash, index) };
}

/**
 * Seats a carried item on a hero. `replaceIndex` is required once the hero is full, and what
 * it displaces goes back into the bag — a net-zero trade, so this can never overflow.
 */
export function equipFromStash(
  run: RunState,
  stashIndex: number,
  rosterId: string,
  equipmentLookup: Record<string, EquipmentDefinition>,
  heroLookup: Record<string, HeroDefinition>,
  replaceIndex?: number
): RunState {
  const itemId = run.stash[stashIndex];
  if (!itemId) throw new RunProgressError(`The bag has nothing in slot ${stashIndex}`);
  return equipToRoster({ ...run, stash: removeFromStash(run.stash, stashIndex) }, rosterId, itemId, equipmentLookup, heroLookup, replaceIndex);
}

/**
 * Seats a loose item — one just found, bought or claimed — straight onto a hero, skipping the
 * bag. `replaceIndex` is required once the hero is full; what it displaces lands in the bag,
 * so a full bag is the one thing that can refuse the swap.
 */
export function equipToRoster(
  run: RunState,
  rosterId: string,
  itemId: string,
  equipmentLookup: Record<string, EquipmentDefinition>,
  heroLookup: Record<string, HeroDefinition>,
  replaceIndex?: number
): RunState {
  const entry = run.roster.find((r) => r.rosterId === rosterId);
  if (!entry) throw new RunProgressError(`${rosterId} is not on the roster`);
  if (!equipmentLookup[itemId]) throw new RunProgressError(`Unknown equipment ${itemId}`);
  const hero = heroLookup[entry.heroId];
  if (!hero) throw new RunProgressError(`Unknown hero ${entry.heroId}`);
  if (holdsItem(entry.equipment, itemId)) throw new RunProgressError(`${rosterId} already holds ${itemId}`);

  const capacity = itemSlotsFor(hero, entry);
  const full = entry.equipment.length >= capacity;
  if (full && replaceIndex === undefined) throw new RunProgressError(`${rosterId} has no free item slot`);
  const target = full ? replaceIndex : undefined;
  if (target !== undefined && (target < 0 || target >= entry.equipment.length)) {
    throw new RunProgressError(`${rosterId} has no item slot ${target}`);
  }

  const bumpedItemId = target === undefined ? null : entry.equipment[target];
  if (bumpedItemId && stashIsFull(run.stash)) throw new RunProgressError(`The bag is full`);
  const nextEntry: RosterEntry = { ...entry, equipment: equipItem(entry.equipment, itemId, target) };
  return {
    ...run,
    roster: run.roster.map((r) => (r.rosterId === rosterId ? nextEntry : r)),
    stash: bumpedItemId ? addToStash(run.stash, bumpedItemId) : run.stash,
  };
}

export interface MoveItemOutcome {
  run: RunState;
  /** What the destination gave up to make room, or null if it had a free slot. Handed straight back to the source hero. */
  displacedItemId: string | null;
}

/**
 * Hands one held item to another hero (Manage Roster). With uncategorised slots there is no
 * matching slot to trade into, so a full destination gives back whatever `toIndex` held and
 * the two items change places; an un-full destination just takes it.
 */
export function moveEquipment(
  run: RunState,
  fromRosterId: string,
  fromIndex: number,
  toRosterId: string,
  heroLookup: Record<string, HeroDefinition>,
  toIndex?: number
): MoveItemOutcome {
  const fromEntry = run.roster.find((r) => r.rosterId === fromRosterId);
  const toEntry = run.roster.find((r) => r.rosterId === toRosterId);
  if (!fromEntry) throw new RunProgressError(`${fromRosterId} is not on the roster`);
  if (!toEntry) throw new RunProgressError(`${toRosterId} is not on the roster`);
  if (fromRosterId === toRosterId) return { run, displacedItemId: null };
  const movingItemId = fromEntry.equipment[fromIndex];
  if (!movingItemId) throw new RunProgressError(`${fromRosterId} has nothing in item slot ${fromIndex}`);
  if (holdsItem(toEntry.equipment, movingItemId)) throw new RunProgressError(`${toRosterId} already holds ${movingItemId}`);

  const toHero = heroLookup[toEntry.heroId];
  if (!toHero) throw new RunProgressError(`Unknown hero ${toEntry.heroId}`);
  const full = toEntry.equipment.length >= itemSlotsFor(toHero, toEntry);
  const target = full ? (toIndex ?? toEntry.equipment.length - 1) : undefined;
  if (target !== undefined && (target < 0 || target >= toEntry.equipment.length)) {
    throw new RunProgressError(`${toRosterId} has no item slot ${target}`);
  }
  const displacedItemId = target === undefined ? null : toEntry.equipment[target];
  if (displacedItemId && holdsItem(unequipSlot(fromEntry.equipment, fromIndex), displacedItemId)) {
    throw new RunProgressError(`${fromRosterId} already holds ${displacedItemId}`);
  }

  return {
    run: {
      ...run,
      roster: run.roster.map((r) => {
        if (r.rosterId === fromRosterId) {
          const without = unequipSlot(r.equipment, fromIndex);
          return { ...r, equipment: displacedItemId ? equipItem(without, displacedItemId) : without };
        }
        if (r.rosterId === toRosterId) return { ...r, equipment: equipItem(r.equipment, movingItemId, target) };
        return r;
      }),
    },
    displacedItemId,
  };
}

/** Permanently destroys the item in slot `index`, bag or no bag. Shedding gear normally goes through `unequipToStash`. */
export function trashEquipment(run: RunState, rosterId: string, index: number): RunState {
  const entry = run.roster.find((r) => r.rosterId === rosterId);
  if (!entry) throw new RunProgressError(`${rosterId} is not on the roster`);
  if (!entry.equipment[index]) throw new RunProgressError(`${rosterId} has nothing in item slot ${index}`);

  const nextEntry: RosterEntry = { ...entry, equipment: unequipSlot(entry.equipment, index) };
  return { ...run, roster: run.roster.map((r) => (r.rosterId === rosterId ? nextEntry : r)) };
}
