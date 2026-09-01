// The diff between what a hero holds in a slot and what is offered for it.
// Deliberately NOT a verdict: Attack on an Int hero is not worth what it is on
// a physical one, and the game cannot know which build the player is after.

import type { StatKey } from '../engine/content';
import { STAT_ORDER } from '../engine/content';
import type { EquipmentDefinition } from './equipment';

export type EquipChangeKind = 'stat' | 'status' | 'passive';

export interface EquipChange {
  kind: EquipChangeKind;
  /** A StatKey, a status id, or a PassiveId — unique within one comparison. */
  key: string;
  /** 0 when the slot is empty or the current item doesn't carry this. */
  from: number;
  /** 0 when the offered item doesn't carry this — taking the offer loses it. */
  to: number;
  /** `to - from`. Never 0 in the returned list. */
  delta: number;
}

/** A passive is present or absent, so it enters the from/to shape as a magnitude of 1. */
const PASSIVE_MAGNITUDE = 1;

function statusMagnitude(item: EquipmentDefinition | null, statusId: string): number {
  // Summed, since two grants of the same Force stack additively in the engine.
  // A shape-less grant (no `magnitude`) counts as 1 so present/absent still reads as a change.
  return (item?.grantsStatusIds ?? []).reduce((sum, grant) => (grant.statusId === statusId ? sum + (grant.magnitude ?? 1) : sum), 0);
}

/** Current item's ids first (authored order), then whatever the offer adds — keeps a chip from jumping position between rows. */
function orderedIds(current: readonly string[], next: readonly string[]): string[] {
  return [...new Set([...current, ...next])];
}

/** Every effect that differs; unchanged effects are omitted. `current` null = empty slot; `next` null = an unequip. */
export function compareEquipment(current: EquipmentDefinition | null, next: EquipmentDefinition | null): EquipChange[] {
  const changes: EquipChange[] = [];

  for (const stat of STAT_ORDER) {
    const from = current?.statGrants[stat as StatKey] ?? 0;
    const to = next?.statGrants[stat as StatKey] ?? 0;
    if (from !== to) changes.push({ kind: 'stat', key: stat, from, to, delta: to - from });
  }

  const statusIds = orderedIds(
    (current?.grantsStatusIds ?? []).map((g) => g.statusId),
    (next?.grantsStatusIds ?? []).map((g) => g.statusId)
  );
  for (const statusId of statusIds) {
    const from = statusMagnitude(current, statusId);
    const to = statusMagnitude(next, statusId);
    if (from !== to) changes.push({ kind: 'status', key: statusId, from, to, delta: to - from });
  }

  const currentPassives = current?.grantsPassiveIds ?? [];
  const nextPassives = next?.grantsPassiveIds ?? [];
  for (const passiveId of orderedIds(currentPassives, nextPassives)) {
    const from = currentPassives.includes(passiveId) ? PASSIVE_MAGNITUDE : 0;
    const to = nextPassives.includes(passiveId) ? PASSIVE_MAGNITUDE : 0;
    if (from !== to) changes.push({ kind: 'passive', key: passiveId, from, to, delta: to - from });
  }

  return changes;
}
