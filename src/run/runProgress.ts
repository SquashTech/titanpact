// Map-node progression (docs/run-loop.md): moving across a RunMap and
// resolving what each node type grants. Pure RunState transforms.

import type { HeroDefinition, StatKey } from '../engine/content';
import type { BrokenSeal, RunState, RosterEntry } from './state';
import type { EncounterNodeKind } from './difficulty';
import type { EnchantmentId, EquipmentDefinition, EquipmentRarity } from './equipment';
import { actAllowsRarity, equipItem, equipmentIdFor, holdsItem, mergeIntoHeld, nextRarity, parseEquipmentId } from './equipment';
import { generateMap } from './map';
import { itemSlotsFor } from './progression';
import { ANVIL_PRICE_BY_TARGET, ENCHANT_PRICE_BY_RARITY, sellValueFor } from './shop';
import { mergeStatMods } from './statMods';
import { mendRoster } from './wounds';

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

/**
 * Inclusive gold band a won encounter pays, by map node type. Two lanes: Monsters (`fight`,
 * `battle`) is the loot-and-gold lane, Skirmish (`skirmish`, `elite`) the Scroll lane on a thin
 * band; the row-0 opener stays thin because it already ships a drop. The Guardian pays in the
 * Banner, not coin, and the finale ends the run. One table, so the map's node readout and the
 * roll it describes cannot drift.
 */
export const GOLD_REWARD_RANGE: Record<EncounterNodeKind, readonly [number, number]> = {
  fight: [15, 25],
  skirmish: [15, 25],
  battle: [30, 45],
  elite: [15, 25],
  boss: [0, 0],
  finale: [0, 0],
};

/** What the `currencyReward` purse pays, inclusive. */
export const PURSE_GOLD_RANGE: readonly [number, number] = [15, 30];

export function rollGoldRange([min, max]: readonly [number, number], random: () => number = Math.random): number {
  return min + Math.floor(random() * (max - min + 1));
}

export function grantCurrencyReward(run: RunState, amount: number): RunState {
  return { ...run, gold: run.gold + amount };
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

/**
 * Fresh map for the next act, per-act position fields reset, the roster made whole — the one
 * free mend in a run (run/wounds.ts). Gold/relics/contracts untouched; callers own the
 * TOTAL_ACTS check.
 */
export function advanceToNextAct(run: RunState, seed: number): RunState {
  return {
    ...mendRoster(run),
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


/**
 * The Mana Well node (docs/run-loop.md "The Mana Well"): +MANA_WELL_AMOUNT max Mana to one hero,
 * permanently, onto `bonusStatGrants` beside every other map grant. A multiple of 10, as every
 * authored stat grant is. Never refused — there is no cap on a pool.
 */
export const MANA_WELL_AMOUNT = 30;

export function grantManaWell(run: RunState, rosterId: string): RunState {
  const entry = run.roster.find((r) => r.rosterId === rosterId);
  if (!entry) throw new RunProgressError(`${rosterId} is not on the roster`);
  const nextEntry: RosterEntry = {
    ...entry,
    bonusStatGrants: { ...entry.bonusStatGrants, manaPool: (entry.bonusStatGrants.manaPool ?? 0) + MANA_WELL_AMOUNT },
  };
  return { ...run, roster: run.roster.map((r) => (r.rosterId === rosterId ? nextEntry : r)) };
}

// --- Absorption (docs/gear-absorption.md) ---

/** What handing an item to a hero would do — what the who-screen's card reads. */
export type ItemReceipt =
  | { kind: 'take' }
  | { kind: 'merge'; heldItemId: string; resultId: string; resultRarity: EquipmentRarity }
  | { kind: 'none'; reason: 'full' | 'ceiling' };

/**
 * A free socket takes the item; the holder of its family merges it (mergeIntoHeld); a hero with
 * three full sockets and no family match, or holding the family at Mythic, cannot receive it.
 * Read the hero's sockets, not the roster's — the roster-wide question is `anyoneCanReceive`.
 */
export function itemReceiptFor(
  entry: RosterEntry,
  item: EquipmentDefinition,
  hero: HeroDefinition,
  equipmentLookup: Record<string, EquipmentDefinition>
): ItemReceipt {
  const heldIndex = entry.equipment.findIndex((heldId) => parseEquipmentId(heldId).base === parseEquipmentId(item.id).base);
  if (heldIndex >= 0) {
    const held = equipmentLookup[entry.equipment[heldIndex]];
    const resultId = held ? mergeIntoHeld(held, item) : null;
    const result = resultId ? equipmentLookup[resultId] : undefined;
    if (!result) return { kind: 'none', reason: 'ceiling' };
    return { kind: 'merge', heldItemId: held!.id, resultId: result.id, resultRarity: result.rarity };
  }
  return entry.equipment.length < itemSlotsFor(hero, entry) ? { kind: 'take' } : { kind: 'none', reason: 'full' };
}

/** Whether the who-screen has anyone to offer; when nobody, the item converts to gold (sellItem) and no screen is raised. */
export function anyoneCanReceive(
  run: RunState,
  item: EquipmentDefinition,
  equipmentLookup: Record<string, EquipmentDefinition>,
  heroLookup: Record<string, HeroDefinition>
): boolean {
  return run.roster.some((entry) => {
    const hero = heroLookup[entry.heroId];
    return hero !== undefined && itemReceiptFor(entry, item, hero, equipmentLookup).kind !== 'none';
  });
}

/**
 * The item is absorbed by `rosterId`: seated in a free socket, or merged into the family it
 * already holds. Irreversible — nothing ever comes off a hero. Throws where the card would have
 * been disabled.
 */
export function absorbItem(
  run: RunState,
  rosterId: string,
  itemId: string,
  equipmentLookup: Record<string, EquipmentDefinition>,
  heroLookup: Record<string, HeroDefinition>
): RunState {
  const entry = run.roster.find((r) => r.rosterId === rosterId);
  if (!entry) throw new RunProgressError(`${rosterId} is not on the roster`);
  const item = equipmentLookup[itemId];
  if (!item) throw new RunProgressError(`Unknown equipment ${itemId}`);
  const hero = heroLookup[entry.heroId];
  if (!hero) throw new RunProgressError(`Unknown hero ${entry.heroId}`);
  const receipt = itemReceiptFor(entry, item, hero, equipmentLookup);
  if (receipt.kind === 'none') {
    throw new RunProgressError(receipt.reason === 'full' ? `${rosterId} has no free socket` : `${rosterId} already holds ${item.name} at its ceiling`);
  }
  const nextLoadout =
    receipt.kind === 'take'
      ? equipItem(entry.equipment, itemId)
      : equipItem(entry.equipment, receipt.resultId, entry.equipment.indexOf(receipt.heldItemId));
  return { ...run, roster: run.roster.map((r) => (r.rosterId === rosterId ? { ...r, equipment: nextLoadout } : r)) };
}

/** The who-screen's one decline: the item becomes gold at `sellValueFor`, on the spot. */
export function sellItem(run: RunState, itemId: string, equipmentLookup: Record<string, EquipmentDefinition>): RunState {
  const item = equipmentLookup[itemId];
  if (!item) throw new RunProgressError(`Unknown equipment ${itemId}`);
  return { ...run, gold: run.gold + sellValueFor(item) };
}

// --- The Anvil, the Enchanter and merging (docs/equipment.md §5) ---

/** Where an item the player owns is sitting: on a hero, in a socket. Both services work on it in place. */
export type ItemRef = { rosterId: string; index: number };

function readItemRef(run: RunState, ref: ItemRef): string {
  const entry = run.roster.find((r) => r.rosterId === ref.rosterId);
  if (!entry) throw new RunProgressError(`${ref.rosterId} is not on the roster`);
  const itemId = entry.equipment[ref.index];
  if (!itemId) throw new RunProgressError(`${ref.rosterId} has nothing in item slot ${ref.index}`);
  return itemId;
}

/** Swaps one item for another in place. Never changes how many items exist, so no capacity check is owed. */
function writeItemRef(run: RunState, ref: ItemRef, itemId: string): RunState {
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
