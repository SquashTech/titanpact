import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { ActiveFieldEffect } from '../../engine/state';
import { FIELD_EFFECT_DURATION_ROUNDS } from '../../engine/combat/fieldEffectEngine';
import { fieldEffects } from '../../data/fieldEffects';
import { getTypeColor } from './typeColors';
import { ElementGlyph } from '../shared/elementIcons';
import { fieldEffectIconArt } from '../shared/iconArt';
import { fieldEffectFacts } from '../shared/fieldEffectFacts';
import { overlayHost } from '../shared/overlayHost';

interface Props {
  active: ActiveFieldEffect;
  onClose: () => void;
}

/**
 * The Field Effect dossier: what a hold on the battlefield-divider plaque opens. Same chassis as
 * every other dossier — the disc and name in the field's element colour, the clock as a numbers
 * strip, and the rules as rows read off the definition's own flags plus the two every field
 * shares (the flat clock, the override rule). The sentence stays as fine print. Portalled into
 * overlayHost(), never document.body — see overlayHost.ts; the --field-effect-rgb the battlefield
 * sets does not reach here, so the colour is set inline.
 */
export function FieldEffectDetailOverlay({ active, onClose }: Props) {
  const def = fieldEffects[active.fieldEffectId];
  if (!def) return null;
  const type = def.flavorType ?? 'Arcane';
  const color = getTypeColor(type);
  const iconSrc = fieldEffectIconArt[active.fieldEffectId];
  const facts = fieldEffectFacts(def);

  function closeAndStop(e: { stopPropagation: () => void }) {
    e.stopPropagation();
    onClose();
  }

  return createPortal(
    <div className="detail-overlay" onClick={closeAndStop}>
      <div className="detail-panel field-dossier-panel" style={{ borderTopColor: color, '--field-color': color } as CSSProperties} onClick={closeAndStop}>
        <div className="move-detail-head">
          <span className="field-dossier-disc">
            {iconSrc ? <img src={iconSrc} alt="" draggable={false} /> : <ElementGlyph type={type} />}
          </span>
          <div className="move-detail-titles">
            <div className="move-detail-name" style={{ color }}>
              {def.name}
            </div>
            <div className="move-detail-line">
              <span>Field Effect</span>
              <span className="move-detail-sep">·</span>
              <span style={{ color }}>{type}</span>
            </div>
          </div>
        </div>

        <div className="move-detail-stats">
          <span className="move-detail-stat">
            <strong>{active.roundsRemaining}</strong>
            <span className="move-detail-unit">/ {FIELD_EFFECT_DURATION_ROUNDS} rounds left</span>
          </span>
        </div>

        <div className="status-dossier-facts">
          {facts.map((fact) => (
            <div key={fact.label} className="status-dossier-fact">
              <span className="status-dossier-fact-label">{fact.label}</span>
              <span className="status-dossier-fact-text">{fact.text}</span>
            </div>
          ))}
        </div>

        {def.description && <div className="status-dossier-desc">{def.description}</div>}
        <div className="detail-close-hint">Tap anywhere to close</div>
      </div>
    </div>,
    overlayHost()
  );
}
