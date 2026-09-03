// Map-node progression (docs/run-loop.md): moving across a RunMap and
// resolving what each node type grants. Pure RunState transforms.

import type { StatKey } from '../engine/content';
import type { RunState, RosterEntry } from './state';
import type { EquipmentDefinition, EquipmentSlot } from './equipment';
import { equipItem, unequipSlot } from './equipment';
import { generateMap } from './map';
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

export interface EquipOutcome {
  run: RunState;
  /** Whatever the slot held, now unequipped. There is no stash: the caller (ForceEquipScreen) must send it somewhere. */
  bumpedItemId: string | null;
}

/** Every obtained item is resolved on the spot — equipped or trashed — since there is no inventory. */
export function equipToRoster(
  run: RunState,
  rosterId: string,
  itemId: string,
  equipmentLookup: Record<string, EquipmentDefinition>
): EquipOutcome {
  const entry = run.roster.find((r) => r.rosterId === rosterId);
  if (!entry) throw new RunProgressError(`${rosterId} is not on the roster`);
  const item = equipmentLookup[itemId];
  if (!item) throw new RunProgressError(`Unknown equipment ${itemId}`);

  const bumpedItemId = entry.equipment[item.slot];
  const nextEntry: RosterEntry = { ...entry, equipment: equipItem(entry.equipment, item) };
  return {
    run: { ...run, roster: run.roster.map((r) => (r.rosterId === rosterId ? nextEntry : r)) },
    bumpedItemId,
  };
}

/** A true swap: anything already in the destination slot moves back into the source's. */
export function swapEquipment(run: RunState, fromRosterId: string, toRosterId: string, slot: EquipmentSlot): RunState {
  const fromEntry = run.roster.find((r) => r.rosterId === fromRosterId);
  const toEntry = run.roster.find((r) => r.rosterId === toRosterId);
  if (!fromEntry) throw new RunProgressError(`${fromRosterId} is not on the roster`);
  if (!toEntry) throw new RunProgressError(`${toRosterId} is not on the roster`);
  if (fromRosterId === toRosterId) return run;
  const movingItemId = fromEntry.equipment[slot];
  if (!movingItemId) throw new RunProgressError(`${fromRosterId} has nothing equipped in ${slot}`);
  const displacedItemId = toEntry.equipment[slot];

  return {
    ...run,
    roster: run.roster.map((r) => {
      if (r.rosterId === fromRosterId) return { ...r, equipment: { ...r.equipment, [slot]: displacedItemId } };
      if (r.rosterId === toRosterId) return { ...r, equipment: { ...r.equipment, [slot]: movingItemId } };
      return r;
    }),
  };
}

/** Permanently destroys the item in `slot` — the only way to shed gear. */
export function trashEquipment(run: RunState, rosterId: string, slot: EquipmentSlot): RunState {
  const entry = run.roster.find((r) => r.rosterId === rosterId);
  if (!entry) throw new RunProgressError(`${rosterId} is not on the roster`);
  if (!entry.equipment[slot]) throw new RunProgressError(`${rosterId} has nothing equipped in ${slot}`);

  const nextEntry: RosterEntry = { ...entry, equipment: unequipSlot(entry.equipment, slot) };
  return { ...run, roster: run.roster.map((r) => (r.rosterId === rosterId ? nextEntry : r)) };
}
