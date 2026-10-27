// Which of an item's grants a hero leans on (docs/gear-absorption.md §2 "Fit chips"). Pure: the
// who-screen passes the hero's current stats and its kit, already resolved for its typing.

import { statusApplicationsOf, type MoveDefinition, type StatKey, type StatusDefinition, type StatusId } from '../engine/content';
import type { EquipmentDefinition } from './equipment';

export type ItemFitChip = { kind: 'stat'; stat: StatKey; lit: boolean } | { kind: 'force'; statusId: StatusId; lit: boolean };

const RANKED: readonly StatKey[] = ['attack', 'defense', 'intelligence', 'wisdom'];

const isHit = (move: MoveDefinition) => move.kind === 'damage';
const isHeal = (move: MoveDefinition) => move.kind === 'heal' || !!move.healPower;
const castsShield = (move: MoveDefinition) => statusApplicationsOf(move).some((rider) => rider.statusId === 'Shield');

function kitReads(stat: StatKey, kit: readonly MoveDefinition[]): boolean {
  switch (stat) {
    case 'attack': return kit.some((m) => isHit(m) && m.category === 'physical');
    case 'intelligence': return kit.some((m) => isHit(m) && m.category === 'magical');
    case 'wisdom': return kit.some(isHeal);
    case 'defense': return kit.some(castsShield);
    default: return false;
  }
}

/** Ties included: a hero whose second stat is shared lights both. */
function topTwo(stats: Record<StatKey, number>): Set<StatKey> {
  const second = RANKED.map((stat) => stats[stat]).sort((a, b) => b - a)[1];
  return new Set(RANKED.filter((stat) => stats[stat] >= second));
}

function forceFits(def: StatusDefinition | undefined, kit: readonly MoveDefinition[]): boolean {
  if (!def) return false;
  if (def.forceHeal) return kit.some(isHeal);
  return kit.some((m) => isHit(m) && (!!def.forceAllTypes || def.forceType === m.type || (def.forceTag !== undefined && !!m.tags?.includes(def.forceTag))));
}

export function itemFitChips(
  item: EquipmentDefinition,
  stats: Record<StatKey, number>,
  kit: readonly MoveDefinition[],
  statusDefs: Record<StatusId, StatusDefinition>
): ItemFitChip[] {
  const top = topTwo(stats);
  const chips: ItemFitChip[] = [];
  for (const [stat, amount] of Object.entries(item.statGrants) as [StatKey, number][]) {
    if (!amount || amount < 0) continue;
    chips.push({ kind: 'stat', stat, lit: !RANKED.includes(stat) || top.has(stat) || kitReads(stat, kit) });
  }
  for (const { statusId } of item.grantsStatusIds ?? []) chips.push({ kind: 'force', statusId, lit: forceFits(statusDefs[statusId], kit) });
  return chips;
}
