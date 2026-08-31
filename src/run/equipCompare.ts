// What changes when one piece of equipment takes another's place in a slot.
//
// Added 2026-08-31, per user report: by the middle of a run every hero is
// already holding something, and the equip screen asked "who gets this?"
// without ever answering "compared to what?" — the player had to walk six
// hero sheets to find out, one overlay at a time, and then hold all six in
// their head.
//
// The whole answer is a DIFF, and a diff is pure data: two item definitions
// in, an ordered list of "this went from X to Y" out. It lives here rather
// than in the view because it is the substance of the decision, not a way of
// drawing it — and because here it is inside tsconfig.json's build and can
// be tested (test/equipCompare.test.ts).
//
// Deliberately NOT a verdict. It would be easy to sum the deltas into a
// single better/worse arrow, and it would be wrong: Attack on an
// Intelligence hero is not worth what Attack on a physical one is, Fire Force
// is worth nothing to a hero with no Fire moves, and the north star
// ("every hero must be viable under *some* combination") means the game
// cannot know which combination the player is building toward. The screen
// shows the numbers and the player rules on them.

import type { StatKey } from '../engine/content';
import { STAT_ORDER } from '../engine/content';
import type { EquipmentDefinition } from './equipment';

/**
 * Which of the three things a piece of equipment can carry a change belongs
 * to — see EquipmentDefinition: flat stat grants, persistent status grants
 * (currently Elemental Force), and granted passives.
 */
export type EquipChangeKind = 'stat' | 'status' | 'passive';

export interface EquipChange {
  kind: EquipChangeKind;
  /** A StatKey, a status id (`FireForce`), or a PassiveId — unique within one comparison. */
  key: string;
  /** The magnitude the hero has now, from the item currently in the slot. 0 when the slot is empty or that item doesn't carry this. */
  from: number;
  /** The magnitude the offered item would give. 0 when it doesn't carry this — i.e. taking the offer loses it. */
  to: number;
  /** `to - from`. Never 0 in the list compareEquipment returns. */
  delta: number;
}

/** A passive is present or absent, so it enters the same from/to shape as a magnitude of 1. */
const PASSIVE_MAGNITUDE = 1;

function statusMagnitude(item: EquipmentDefinition | null, statusId: string): number {
  // Summed rather than found: nothing in the catalog grants the same status
  // twice today, but two grants of Fire Force would stack additively in the
  // engine (src/data/statuses.ts, `stacking: 'additive'`), so the readout
  // has to agree with what the hero would actually get.
  // `magnitude` is optional on StatusGrant (engine/content.ts) — a
  // shape-less status is granted without one. Treated as 1 so a present/
  // absent grant still reads as a change rather than as nothing.
  return (item?.grantsStatusIds ?? []).reduce((sum, grant) => (grant.statusId === statusId ? sum + (grant.magnitude ?? 1) : sum), 0);
}

/**
 * Ids in a stable order: everything the current item carries first, in its
 * own authored order, then whatever the offered item adds. Keeps the losses
 * on the left and the gains on the right of a row without having to sort,
 * and — more importantly — keeps a chip from jumping position between two
 * heroes' rows on the same screen.
 */
function orderedIds(current: readonly string[], next: readonly string[]): string[] {
  return [...new Set([...current, ...next])];
}

/**
 * Every effect that differs between what a hero is holding in a slot and what
 * is being offered for it. Unchanged effects are omitted: an item that grants
 * +10 Attack replacing one that grants +10 Attack has nothing to say about
 * Attack, and saying it anyway is what buries the two lines that matter.
 *
 * `current` is null for an empty slot, in which case every entry is a pure
 * gain (`from: 0`). `next` is nullable too, so the same function can describe
 * an unequip.
 */
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

  const passiveIds = orderedIds(current?.grantsPassiveIds ?? [], next?.grantsPassiveIds ?? []);
  for (const passiveId of passiveIds) {
    const from = (current?.grantsPassiveIds ?? []).includes(passiveId) ? PASSIVE_MAGNITUDE : 0;
    const to = (next?.grantsPassiveIds ?? []).includes(passiveId) ? PASSIVE_MAGNITUDE : 0;
    if (from !== to) changes.push({ kind: 'passive', key: passiveId, from, to, delta: to - from });
  }

  return changes;
}
