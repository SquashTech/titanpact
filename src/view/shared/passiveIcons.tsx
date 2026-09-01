import type { PassiveDefinition } from '../../engine/content';
import { hexTint } from './statusIcons';

/** Emoji per passive id; a passive with no entry renders without an icon. */
export const passiveEmoji: Record<string, string> = {
  sanguine: '🩸',
  emberheart: '🔥',
  imposingPresence: '👁️',
};

/** Identity color per passive; unlisted ids fall back to neutral gold. */
const PASSIVE_COLOR: Record<string, string> = {
  sanguine: '#c0392b',
  emberheart: '#e2683c',
  imposingPresence: '#7d6bc4',
};

export function passiveColor(passiveId: string): string {
  return PASSIVE_COLOR[passiveId] ?? '#d9a441';
}

export function passiveTint(passiveId: string, alpha: number): string {
  return hexTint(passiveColor(passiveId), alpha);
}

/** One line for effects `description` doesn't carry (damage-modifier passives, whose % is data). */
export function passiveEffectSummary(def: PassiveDefinition): string | undefined {
  if (def.damageModifier) {
    const pct = Math.round(def.damageModifier.amount * 100);
    return `Damage bonus: +${pct}%.`;
  }
  return undefined;
}

/** Fixed-size detail readout, same `.move-info-panel` box as MoveInfoPanel/EquipmentInfoPanel. */
export function PassiveInfoPanel({ passive }: { passive: PassiveDefinition | null }) {
  const summary = passive ? passiveEffectSummary(passive) : undefined;
  return (
    <div className="move-info-panel">
      {passive ? (
        <>
          <div className="move-info-head">
            <span className="move-info-name">
              {passiveEmoji[passive.id] ? `${passiveEmoji[passive.id]} ` : ''}
              {passive.name}
            </span>
          </div>
          <div className="move-info-placeholder">{passive.description}</div>
          {summary && <div className="move-info-placeholder">{summary}</div>}
        </>
      ) : (
        <div className="move-info-placeholder">No passive selected.</div>
      )}
    </div>
  );
}
