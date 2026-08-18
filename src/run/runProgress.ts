// Map-node progression (docs/run-loop.md): moving across a RunMap, and
// resolving what each node type grants. Pure RunState transforms — no view,
// no engine internals.

import type { StatKey } from '../engine/content';
import type { RunState, RosterEntry } from './state';
import type { EquipmentDefinition, EquipmentSlot } from './equipment';
import { equipItem, unequipSlot } from './equipment';
import { generateMap } from './map';
import { mergeStatMods } from './statMods';

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

/** A flat grant to the scarce Recruit Contract currency (docs/progression.md "raise-vs-recruit axis") — used at the end of every act (App.tsx, on the boss-node win) since the old contractReward map node was removed (2026-08-17). */
export function grantContractReward(run: RunState, amount: number): RunState {
  return { ...run, recruitContracts: run.recruitContracts + amount };
}

/**
 * End-of-act transition (docs/run-loop.md "Multi-act sequencing"): replaces
 * the current map with a freshly generated one for the next act and resets
 * the per-act position fields (`currentNodeId`, `visitedNodeIds`) — the
 * player starts the new act's map from its own start row, same as entering
 * the run's very first map. Does not touch roster/gold/relics/contracts or
 * bump `actNumber` itself — callers (App.tsx) own the TOTAL_ACTS check and
 * increment `actNumber` alongside this.
 */
export function advanceToNextAct(run: RunState, seed: number): RunState {
  return {
    ...run,
    map: generateMap(seed),
    currentNodeId: null,
    visitedNodeIds: [],
    actNumber: run.actNumber + 1,
  };
}

/** relicReward node resolution: adds an owned relic id. Duplicates are allowed (their flat grants simply stack) — the reward screen is expected to only offer relics not yet owned. */
export function grantRelicReward(run: RunState, relicId: string): RunState {
  return { ...run, relics: [...run.relics, relicId] };
}

/**
 * hpBoostReward/manaBoostReward node resolution: a flat, permanent-for-the-run
 * stat grant to one chosen roster hero (CLAUDE.md "flat additive integers,
 * multiples of 5 or 10"), folded into that entry's `bonusStatGrants`.
 */
export function grantStatBonus(run: RunState, rosterId: string, stat: StatKey, amount: number): RunState {
  const entry = run.roster.find((r) => r.rosterId === rosterId);
  if (!entry) throw new RunProgressError(`${rosterId} is not on the roster`);
  const nextEntry: RosterEntry = { ...entry, bonusStatGrants: mergeStatMods(entry.bonusStatGrants, { [stat]: amount }) };
  return { ...run, roster: run.roster.map((r) => (r.rosterId === rosterId ? nextEntry : r)) };
}

export interface EquipOutcome {
  run: RunState;
  /** Whatever was already in that slot, now unequipped — or null if the slot was empty. There is no stash to drop it into: the caller (ForceEquipScreen) is responsible for making sure it goes somewhere, another hero or the trash. */
  bumpedItemId: string | null;
}

/**
 * Equips `itemId` onto `rosterId`'s matching slot. Every piece of equipment
 * obtained must be resolved on the spot (ForceEquipScreen) — equip it to a
 * hero or trash it — there is no unequipped inventory to fall back on. If
 * the target slot already held something, that item comes back as
 * `bumpedItemId` so the caller can queue it for the same forced choice.
 */
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

/**
 * Moves whatever is in `slot` from one roster hero to another
 * (RosterManagementScreen's tap/drag-to-reassign). If the destination
 * already has an item there, it moves back into the source's now-empty
 * slot — a true swap, never orphaning a copy since there's no stash to park
 * it in.
 */
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

/** Permanently destroys whatever is equipped in `slot` on `rosterId` — the only way to shed unwanted gear now that there's no stash to return it to. */
export function trashEquipment(run: RunState, rosterId: string, slot: EquipmentSlot): RunState {
  const entry = run.roster.find((r) => r.rosterId === rosterId);
  if (!entry) throw new RunProgressError(`${rosterId} is not on the roster`);
  if (!entry.equipment[slot]) throw new RunProgressError(`${rosterId} has nothing equipped in ${slot}`);

  const nextEntry: RosterEntry = { ...entry, equipment: unequipSlot(entry.equipment, slot) };
  return { ...run, roster: run.roster.map((r) => (r.rosterId === rosterId ? nextEntry : r)) };
}
