// Map-node progression (docs/run-loop.md): moving across a RunMap and
// resolving what each node type grants. Pure RunState transforms.

import type { HeroDefinition, StatKey } from '../engine/content';
import type { BrokenSeal, RunState, RosterEntry } from './state';
import type { EnchantmentId, EquipmentDefinition, EquipmentRarity, Stash } from './equipment';
import {
  actAllowsRarity,
  addToStash,
  canMergeItems,
  equipItem,
  equipmentIdFor,
  holdsItem,
  MAX_ITEM_SLOTS,
  mergeEnchantChoices,
  markItemSeen,
  markItemUnseen,
  mergeResultId,
  nextRarity,
  parseEquipmentId,
  pruneUnseen,
  removeFromStash,
  unequipSlot,
} from './equipment';
import { generateMap } from './map';
import { itemSlotsFor } from './progression';
import { ANVIL_PRICE_BY_TARGET, ENCHANT_PRICE_BY_RARITY, SLOT_PRICE_BY_TARGET, sellValueFor } from './shop';
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

/** hpBoostReward node resolution, folded into `bonusStatGrants`. */
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

/** What the Blacksmith charges this hero for its next slot, or null at the cap. */
export function slotQuote(
  run: RunState,
  rosterId: string,
  heroLookup: Record<string, HeroDefinition>
): { target: number; cost: number } | null {
  const entry = run.roster.find((r) => r.rosterId === rosterId);
  const hero = entry ? heroLookup[entry.heroId] : undefined;
  if (!entry || !hero) return null;
  const target = itemSlotsFor(hero, entry) + 1;
  const cost = SLOT_PRICE_BY_TARGET[target];
  return target > MAX_ITEM_SLOTS || cost == null ? null : { target, cost };
}

/** The paid Forge. Same grant, charged; the map's forgeReward node is the free one. */
export function buyItemSlot(
  run: RunState,
  rosterId: string,
  heroLookup: Record<string, HeroDefinition>
): RunState {
  const quote = slotQuote(run, rosterId, heroLookup);
  if (!quote) throw new RunProgressError(`${rosterId} cannot take another item slot`);
  if (run.gold < quote.cost) {
    throw new RunProgressError(`An item slot costs ${quote.cost} gold, only ${run.gold} available`);
  }
  return grantItemSlot({ ...run, gold: run.gold - quote.cost }, rosterId, heroLookup);
}

// --- The stash (docs/progression.md) ---

/**
 * Every write to the bag goes through here, so an unopened mark can never outlive the item it
 * points at — sold, merged away or seated on a hero, the mark goes with it.
 */
function withStash(run: RunState, stash: Stash): RunState {
  return { ...run, stash, unseenItemIds: pruneUnseen(run.unseenItemIds, stash) };
}

/**
 * An item ARRIVING — found, claimed or bought. Every drop lands here now (docs/progression.md
 * "The bag notification"), so this is also where the unopened mark is set: the run does not stop
 * to ask who carries it, and the badge is what says one is waiting. The bag is uncapped, so the
 * only thing that can refuse is an id naming nothing.
 */
export function stashItem(run: RunState, itemId: string, equipmentLookup: Record<string, EquipmentDefinition>): RunState {
  if (!equipmentLookup[itemId]) throw new RunProgressError(`Unknown equipment ${itemId}`);
  const next = withStash(run, addToStash(run.stash, itemId));
  return { ...next, unseenItemIds: markItemUnseen(next.unseenItemIds, itemId) };
}

/** The player has looked at it. Tapping a bag item — for any reason — is what calls this. */
export function markStashItemSeen(run: RunState, itemId: string): RunState {
  return { ...run, unseenItemIds: markItemSeen(run.unseenItemIds, itemId) };
}

/** Taking gear off. The bag always has room for it, so this cannot leave a hero stuck holding something. */
export function unequipToStash(run: RunState, rosterId: string, index: number): RunState {
  const entry = run.roster.find((r) => r.rosterId === rosterId);
  if (!entry) throw new RunProgressError(`${rosterId} is not on the roster`);
  const itemId = entry.equipment[index];
  if (!itemId) throw new RunProgressError(`${rosterId} has nothing in item slot ${index}`);

  const nextEntry: RosterEntry = { ...entry, equipment: unequipSlot(entry.equipment, index) };
  return withStash(
    { ...run, roster: run.roster.map((r) => (r.rosterId === rosterId ? nextEntry : r)) },
    addToStash(run.stash, itemId)
  );
}

// --- The Anvil, the Enchanter and merging (docs/equipment.md §5) ---

/**
 * Where an item the player owns is sitting. Both services take one: requiring gear to come off
 * before it could be upgraded would reintroduce exactly the friction this rework removes.
 */
export type ItemRef = { kind: 'stash'; index: number } | { kind: 'hero'; rosterId: string; index: number };

function readItemRef(run: RunState, ref: ItemRef): string {
  if (ref.kind === 'stash') {
    const itemId = run.stash[ref.index];
    if (!itemId) throw new RunProgressError(`The bag has nothing in slot ${ref.index}`);
    return itemId;
  }
  const entry = run.roster.find((r) => r.rosterId === ref.rosterId);
  if (!entry) throw new RunProgressError(`${ref.rosterId} is not on the roster`);
  const itemId = entry.equipment[ref.index];
  if (!itemId) throw new RunProgressError(`${ref.rosterId} has nothing in item slot ${ref.index}`);
  return itemId;
}

/** Swaps one item for another in place. Never changes how many items exist, so no capacity check is owed. */
function writeItemRef(run: RunState, ref: ItemRef, itemId: string): RunState {
  if (ref.kind === 'stash') {
    return withStash(run, run.stash.map((held, i) => (i === ref.index ? itemId : held)));
  }
  return {
    ...run,
    roster: run.roster.map((r) =>
      r.rosterId === ref.rosterId ? { ...r, equipment: r.equipment.map((held, i) => (i === ref.index ? itemId : held)) } : r
    ),
  };
}

function spend(run: RunState, cost: number, what: string): RunState {
  if (run.gold < cost) throw new RunProgressError(`${what} costs ${cost} gold, only ${run.gold} available`);
  return { ...run, gold: run.gold - cost };
}

/** What the Anvil would charge, or null if this item cannot be lifted right now. */
export function anvilQuote(
  run: RunState,
  itemId: string,
  equipmentLookup: Record<string, EquipmentDefinition>
): { targetId: string; targetRarity: EquipmentRarity; cost: number } | null {
  const item = equipmentLookup[itemId];
  if (!item || item.familyId === undefined) return null; // a Unique has no ladder
  const target = nextRarity(item.rarity);
  if (target === null || !actAllowsRarity(run.actNumber, target)) return null;
  return {
    targetId: equipmentIdFor(item.familyId, target, item.enchantId),
    targetRarity: target,
    cost: ANVIL_PRICE_BY_TARGET[target],
  };
}

/** Lifts one owned item a tier for gold, keeping its family and its enchant. */
export function anvilUpgrade(
  run: RunState,
  ref: ItemRef,
  equipmentLookup: Record<string, EquipmentDefinition>
): RunState {
  const itemId = readItemRef(run, ref);
  const quote = anvilQuote(run, itemId, equipmentLookup);
  if (!quote) throw new RunProgressError(`${itemId} cannot be upgraded here`);
  if (!equipmentLookup[quote.targetId]) throw new RunProgressError(`Unknown equipment ${quote.targetId}`);
  return writeItemRef(spend(run, quote.cost, 'That upgrade'), ref, quote.targetId);
}

/** Binds an element to one owned item, overwriting any enchant already on it. One enchant per item, always. */
export function enchantItem(
  run: RunState,
  ref: ItemRef,
  enchantId: EnchantmentId,
  equipmentLookup: Record<string, EquipmentDefinition>
): RunState {
  const itemId = readItemRef(run, ref);
  const item = equipmentLookup[itemId];
  if (!item) throw new RunProgressError(`Unknown equipment ${itemId}`);
  if (item.enchantId === enchantId) throw new RunProgressError(`${item.name} already carries that enchantment`);
  const parsed = parseEquipmentId(itemId);
  const targetId = equipmentIdFor(parsed.base, parsed.rarity, enchantId);
  if (!equipmentLookup[targetId]) throw new RunProgressError(`Unknown equipment ${targetId}`);
  return writeItemRef(spend(run, ENCHANT_PRICE_BY_RARITY[item.rarity], 'That enchantment'), ref, targetId);
}

/**
 * Two carried items of the same family and tier become one of the next tier, free. Bag-only: the
 * pair has to be loose for the player to have chosen it, and a merge is net -1 so it can never
 * overflow. `keepEnchantId` is the player's pick among `mergeEnchantChoices`.
 */
export function mergeFromStash(
  run: RunState,
  indexA: number,
  indexB: number,
  equipmentLookup: Record<string, EquipmentDefinition>,
  keepEnchantId?: EnchantmentId
): RunState {
  if (indexA === indexB) throw new RunProgressError('A merge needs two different items');
  const a = equipmentLookup[readItemRef(run, { kind: 'stash', index: indexA })];
  const b = equipmentLookup[readItemRef(run, { kind: 'stash', index: indexB })];
  if (!a || !b) throw new RunProgressError('Unknown equipment');
  if (!canMergeItems(a, b)) throw new RunProgressError(`${a.name} and ${b.name} do not merge`);

  const up = nextRarity(a.rarity)!;
  if (!actAllowsRarity(run.actNumber, up)) throw new RunProgressError(`${up} is beyond this act`);
  if (keepEnchantId !== undefined && !mergeEnchantChoices(a, b).includes(keepEnchantId)) {
    throw new RunProgressError(`Neither item carries that enchantment`);
  }
  const resultId = mergeResultId(a, keepEnchantId);
  if (!resultId || !equipmentLookup[resultId]) throw new RunProgressError('That merge has no result');

  // Drop both inputs, then add the result — never the other way round, or a full bag would refuse it.
  const remaining = run.stash.filter((_, i) => i !== indexA && i !== indexB);
  return withStash(run, [...remaining, resultId]);
}

/** Sells one carried item at `sellValueFor`. The bag is the only place gear is sold from — equipped gear comes off first. */
export function sellFromStash(run: RunState, index: number, equipmentLookup: Record<string, EquipmentDefinition>): RunState {
  const itemId = run.stash[index];
  if (!itemId) throw new RunProgressError(`The bag has nothing in slot ${index}`);
  const item = equipmentLookup[itemId];
  if (!item) throw new RunProgressError(`Unknown equipment ${itemId}`);
  return withStash({ ...run, gold: run.gold + sellValueFor(item) }, removeFromStash(run.stash, index));
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
  return equipToRoster(withStash(run, removeFromStash(run.stash, stashIndex)), rosterId, itemId, equipmentLookup, heroLookup, replaceIndex);
}

/**
 * Seats a loose item straight onto a hero, skipping the bag. `replaceIndex` is required once
 * the hero is full; what it displaces lands in the bag, which always has room for it.
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
  const capacity = itemSlotsFor(hero, entry);
  const full = entry.equipment.length >= capacity;
  if (full && replaceIndex === undefined) throw new RunProgressError(`${rosterId} has no free item slot`);
  const target = full ? replaceIndex : undefined;
  if (target !== undefined && (target < 0 || target >= entry.equipment.length)) {
    throw new RunProgressError(`${rosterId} has no item slot ${target}`);
  }

  // The one-per-family rule is measured against what the hero will STILL be holding, so a swap is
  // never blocked by the item it replaces. Upgrading an Iron Sword to an Etched one — what the
  // Anvil, the Enchanter and a merge all produce — is a same-family replacement every time.
  const keeping = target === undefined ? entry.equipment : entry.equipment.filter((_, i) => i !== target);
  if (holdsItem(keeping, itemId)) throw new RunProgressError(`${rosterId} already holds ${itemId}`);

  const bumpedItemId = target === undefined ? null : entry.equipment[target];
  const nextEntry: RosterEntry = { ...entry, equipment: equipItem(entry.equipment, itemId, target) };
  return withStash(
    { ...run, roster: run.roster.map((r) => (r.rosterId === rosterId ? nextEntry : r)) },
    bumpedItemId ? addToStash(run.stash, bumpedItemId) : run.stash
  );
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
