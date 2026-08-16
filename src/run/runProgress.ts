// Map-node progression (docs/run-loop.md): moving across a RunMap, and
// resolving what each node type grants. Pure RunState transforms — no view,
// no engine internals.

import type { RunState, RosterEntry } from './state';
import type { EquipmentDefinition, EquipmentSlot } from './equipment';
import { equipItem, unequipSlot } from './equipment';

export class RunProgressError extends Error {}

/** The nodes the player may currently move to: the map's start row if the map hasn't been entered yet, otherwise the current node's outgoing edges. */
export function reachableNodeIds(run: RunState): string[] {
  if (!run.map) return [];
  if (run.currentNodeId === null) return run.map.startNodeIds;
  return run.map.nodes[run.currentNodeId]?.nextIds ?? [];
}

/**
 * Moves the player onto `nodeId` once it's been resolved (fight won, reward
 * claimed, shop exited). `visitedNodeIds` tracks completed nodes for
 * MapScreen's greyed-out rendering; `currentNodeId` is the frontier
 * `reachableNodeIds` branches from next.
 */
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

/** currencyReward node resolution: a flat gold grant. */
export function grantCurrencyReward(run: RunState, amount: number): RunState {
  return { ...run, gold: run.gold + amount };
}

/** upgradeReward node resolution: a flat grant to the pooled level-up currency (docs/progression.md). */
export function grantUpgradeReward(run: RunState, points: number): RunState {
  return { ...run, levelUpPool: run.levelUpPool + points };
}

/** contractReward node resolution: a flat grant to the scarce Recruit Contract currency (docs/progression.md "raise-vs-recruit axis"). */
export function grantContractReward(run: RunState, amount: number): RunState {
  return { ...run, recruitContracts: run.recruitContracts + amount };
}

/** relicReward node resolution: adds an owned relic id. Duplicates are allowed (their flat grants simply stack) — the reward screen is expected to only offer relics not yet owned. */
export function grantRelicReward(run: RunState, relicId: string): RunState {
  return { ...run, relics: [...run.relics, relicId] };
}

/**
 * equipmentReward node resolution: adds the chosen item straight to the
 * unequipped inventory (RunState.inventory) rather than forcing an
 * immediate "which hero gets this" choice — that choice now happens later,
 * at leisure, in RosterManagementScreen.
 */
export function grantInventoryReward(run: RunState, itemId: string): RunState {
  return { ...run, inventory: [...run.inventory, itemId] };
}

/**
 * Equips one copy of `itemId` out of the inventory onto `rosterId`'s
 * matching slot (RosterManagementScreen's tap/drag-to-equip). Whatever was
 * already in that slot is returned to the inventory rather than discarded —
 * the no-inventory equipItem model this used to rely on (equipment.ts)
 * dropped the replaced item entirely, which was fine when equipping was the
 * only path but would silently destroy items now that they're tracked.
 */
export function equipFromInventory(
  run: RunState,
  rosterId: string,
  itemId: string,
  equipmentLookup: Record<string, EquipmentDefinition>
): RunState {
  const entry = run.roster.find((r) => r.rosterId === rosterId);
  if (!entry) throw new RunProgressError(`${rosterId} is not on the roster`);
  const item = equipmentLookup[itemId];
  if (!item) throw new RunProgressError(`Unknown equipment ${itemId}`);
  const invIndex = run.inventory.indexOf(itemId);
  if (invIndex === -1) throw new RunProgressError(`${itemId} is not in the inventory`);

  const previousItemId = entry.equipment[item.slot];
  const nextInventory = [...run.inventory];
  nextInventory.splice(invIndex, 1);
  if (previousItemId) nextInventory.push(previousItemId);

  const nextEntry: RosterEntry = { ...entry, equipment: equipItem(entry.equipment, item) };
  return {
    ...run,
    inventory: nextInventory,
    roster: run.roster.map((r) => (r.rosterId === rosterId ? nextEntry : r)),
  };
}

/** Unequips `slot` on `rosterId` and returns the item to the inventory (RosterManagementScreen's tap-to-unequip). */
export function unequipToInventory(run: RunState, rosterId: string, slot: EquipmentSlot): RunState {
  const entry = run.roster.find((r) => r.rosterId === rosterId);
  if (!entry) throw new RunProgressError(`${rosterId} is not on the roster`);
  const itemId = entry.equipment[slot];
  if (!itemId) throw new RunProgressError(`${rosterId} has nothing equipped in ${slot}`);

  const nextEntry: RosterEntry = { ...entry, equipment: unequipSlot(entry.equipment, slot) };
  return {
    ...run,
    inventory: [...run.inventory, itemId],
    roster: run.roster.map((r) => (r.rosterId === rosterId ? nextEntry : r)),
  };
}
