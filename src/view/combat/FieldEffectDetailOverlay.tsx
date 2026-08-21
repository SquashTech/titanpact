import { createPortal } from 'react-dom';
import type { ActiveFieldEffect } from '../../engine/state';
import { fieldEffects } from '../../data/fieldEffects';

interface Props {
  active: ActiveFieldEffect;
  onClose: () => void;
}

/**
 * Full readout for the active Field Effect (docs/field-effects.md), opened by
 * long-pressing its badge on the battlefield divider (FightScreen) — the
 * badge itself only has room for name + rounds remaining, not what it does.
 * Reuses .detail-overlay/.detail-panel and the .status-detail-* readout/desc
 * styles wholesale (StatusDetailOverlay's shell), including the "tap anywhere
 * to close" convention, since a Field Effect's detail card is the same shape
 * (name, a rounds-remaining stat, a description) just without the emoji icon.
 */
export function FieldEffectDetailOverlay({ active, onClose }: Props) {
  const def = fieldEffects[active.fieldEffectId];
  if (!def) return null;

  function closeAndStop(e: { stopPropagation: () => void }) {
    e.stopPropagation();
    onClose();
  }

  return createPortal(
    <div className="detail-overlay" onClick={closeAndStop}>
      <div className="detail-panel status-detail-panel field-effect-detail-panel" onClick={closeAndStop}>
        <div className="status-detail-name">{def.name}</div>
        <div className="status-detail-readout">
          <span>Rounds left {active.roundsRemaining}</span>
        </div>
        <div className="status-detail-desc">{def.description}</div>
        <div className="detail-close-hint">Tap anywhere to close</div>
      </div>
    </div>,
    document.body
  );
}
