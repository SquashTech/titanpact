// A Field Effect's rules as rows rather than as its sentence (2026-09-11, per user direction):
// each engine flag the definition sets, then the clock and the override rule every field shares
// (fieldEffectEngine.ts). Read off the fields, so the readout says what the engine will do.

import type { FieldEffectDefinition } from '../../engine/content';
import { FIELD_EFFECT_DURATION_ROUNDS } from '../../engine/combat/fieldEffectEngine';
import { statuses } from '../../data/statuses';
import { STAT_FULL_LABELS } from './relicStacks';

export interface FieldEffectFact {
  /** The row's register word. */
  label: string;
  text: string;
}

function statusNames(ids: readonly string[]): string {
  return ids.map((id) => statuses[id]?.name ?? id).join(', ');
}

/** The rows the definition's own flags produce — what the field DOES. */
function effectFacts(def: FieldEffectDefinition): FieldEffectFact[] {
  const rows: FieldEffectFact[] = [];
  if (def.mpRegenMultiplier != null) rows.push({ label: 'MP Regen', text: `×${def.mpRegenMultiplier}, every hero on both sides` });
  if (def.slowsStatusDecay) {
    rows.push({
      label: 'Decay',
      text: `${statusNames(def.slowsStatusDecay.statusIds)} keeps ${Math.round(def.slowsStatusDecay.retain * 100)}% each round, not 50%`,
    });
  }
  if (def.reversesSpeedOrder) rows.push({ label: 'Order', text: 'Slowest acts first within a priority bracket' });
  if (def.healPriorityBonus != null) {
    rows.push({ label: 'Priority', text: `${def.healPriorityBonus > 0 ? '+' : ''}${def.healPriorityBonus} on every healing move` });
  }
  if (def.statBonusEqualToStatusMagnitude) {
    const { statusId, stats } = def.statBonusEqualToStatusMagnitude;
    rows.push({
      label: 'Stats',
      text: `+${stats.map((s) => STAT_FULL_LABELS[s]).join(' & ')} equal to a hero’s own ${statuses[statusId]?.name ?? statusId}`,
    });
  }
  return rows;
}

export function fieldEffectFacts(def: FieldEffectDefinition): FieldEffectFact[] {
  return [
    ...effectFacts(def),
    { label: 'Lasts', text: `${FIELD_EFFECT_DURATION_ROUNDS} rounds, whichever side set it` },
    { label: 'Reset', text: 'Same field again: nothing · a different one replaces it, clock restarts' },
  ];
}

/** The rules as one dim line, for the field row on a move card. */
export function fieldEffectFactsLine(def: FieldEffectDefinition): string {
  const rows = effectFacts(def);
  const core = rows.length > 0 ? rows.map((r) => r.text) : def.description ? [def.description] : [];
  return [...core, `${FIELD_EFFECT_DURATION_ROUNDS} rounds`].join(' · ');
}
