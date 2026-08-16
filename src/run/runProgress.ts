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

/** equipmentReward node resolution: equips the chosen item onto the chosen roster hero, via the existing per-loadout equipItem. */
export function applyEquipmentReward(run: RunState, rosterId: string, item: EquipmentDefinition): RunState {
  const entry = run.roster.find((r) => r.rosterId === rosterId);
  if (!entry) throw new RunProgressError(`${rosterId} is not on the roster`);
  const nextEntry: RosterEntry = { ...entry, equipment: equipItem(entry.equipment, item) };
  return { ...run, roster: run.roster.map((r) => (r.rosterId === rosterId ? nextEntry : r)) };
}

/**
 * Moves an equipped item from one roster hero's slot to another's — the
 * Manage Roster equipment-reassignment feature. Unequips the source slot and
 * equips the item onto the target's matching slot, which (per equipItem's
 * no-inventory model) drops whatever the target already had equipped there.
 */
export function moveEquipment(
  run: RunState,
  fromRosterId: string,
  slot: EquipmentSlot,
  toRosterId: string,
  equipmentLookup: Record<string, EquipmentDefinition>
): RunState {
  const fromEntry = run.roster.find((r) => r.rosterId === fromRosterId);
  const toEntry = run.roster.find((r) => r.rosterId === toRosterId);
  if (!fromEntry || !toEntry) throw new RunProgressError('Unknown roster entry');
  const itemId = fromEntry.equipment[slot];
  if (!itemId) throw new RunProgressError(`${fromRosterId} has nothing equipped in ${slot}`);
  const item = equipmentLookup[itemId];
  if (!item) throw new RunProgressError(`Unknown equipment ${itemId}`);

  return {
    ...run,
    roster: run.roster.map((r) => {
      if (r.rosterId === fromRosterId) return { ...r, equipment: unequipSlot(r.equipment, slot) };
      if (r.rosterId === toRosterId) return { ...r, equipment: equipItem(r.equipment, item) };
      return r;
    }),
  };
}
