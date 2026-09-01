import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { ActiveFieldEffect } from '../../engine/state';
import { fieldEffects } from '../../data/fieldEffects';
import { getTypeColor } from './typeColors';
import { fieldEffectIconArt } from '../shared/iconArt';
import { overlayHost } from '../shared/overlayHost';

interface Props {
  active: ActiveFieldEffect;
  onClose: () => void;
}

/** Full readout for the active Field Effect, opened from the battlefield-divider plaque. Reuses StatusDetailOverlay's shell. */
export function FieldEffectDetailOverlay({ active, onClose }: Props) {
  const def = fieldEffects[active.fieldEffectId];
  if (!def) return null;
  const iconSrc = fieldEffectIconArt[active.fieldEffectId];

  function closeAndStop(e: { stopPropagation: () => void }) {
    e.stopPropagation();
    onClose();
  }

  // Border color set inline: this is portalled out of .battlefield, so its
  // --field-effect-rgb custom property does not reach here.
  return createPortal(
    <div className="detail-overlay" onClick={closeAndStop}>
      <div
        className="detail-panel status-detail-panel field-effect-detail-panel"
        style={{ borderTopColor: getTypeColor(def.flavorType ?? 'Arcane') } as CSSProperties}
        onClick={closeAndStop}
      >
        {iconSrc && (
          <div className="field-effect-detail-icon">
            <img src={iconSrc} alt="" draggable={false} />
          </div>
        )}
        <div className="status-detail-name">{def.name}</div>
        <div className="status-detail-readout">
          <span>Rounds left {active.roundsRemaining}</span>
        </div>
        <div className="status-detail-desc">{def.description}</div>
        <div className="detail-close-hint">Tap anywhere to close</div>
      </div>
    </div>,
    overlayHost()
  );
}
