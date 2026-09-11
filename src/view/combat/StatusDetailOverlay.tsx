import { createPortal } from 'react-dom';
import type { CSSProperties } from 'react';
import type { StatusInstance } from '../../engine/state';
import { statuses } from '../../data/statuses';
import { StatusGlyph, statusColor, pipelineLabel, PoisonPips } from '../shared/statusIcons';
import { statusFacts } from '../shared/statusFacts';
import { overlayHost } from '../shared/overlayHost';

interface Props {
  instance: StatusInstance;
  onClose: () => void;
}

/** What the live magnitude IS, per pipeline — the unit beside the numeral. */
function magnitudeUnit(pipeline: string, shape: string): string {
  if (shape === 'timer') return '% max HP';
  switch (pipeline) {
    case 'dot':
      return 'dmg / round';
    case 'hot':
      return 'heal / round';
    case 'basePower':
      return 'BP';
    default:
      return 'magnitude';
  }
}

/**
 * The status dossier: what a hold on a status badge opens. The move dossier's three facets — the
 * disc and name in the status's colour with its pipeline under them; the live numbers (magnitude
 * with what it means, rounds left or the detonation clock); and the rules as ROWS — each round,
 * then, reapplied, switch, cleanse, and whatever the status does that a field says (a guard, a
 * pull, a detonation, a spread, a Force) — read off the definition the statusEngine runs on. The
 * authored sentence stays as fine print for the rule no field carries (Freeze halving Speed).
 * Portalled into overlayHost(), never document.body — see overlayHost.ts.
 */
export function StatusDetailOverlay({ instance, onClose }: Props) {
  const def = statuses[instance.statusId];
  if (!def) return null;
  const color = statusColor(instance.statusId);
  const facts = statusFacts(def);

  function closeAndStop(e: { stopPropagation: () => void }) {
    e.stopPropagation();
    onClose();
  }

  return createPortal(
    <div className="detail-overlay status-detail-overlay" onClick={closeAndStop}>
      <div className="detail-panel status-dossier-panel" style={{ borderTopColor: color, '--status-color': color } as CSSProperties} onClick={closeAndStop}>
        <div className="move-detail-head">
          <span className="status-dossier-disc">
            <StatusGlyph statusId={instance.statusId} />
          </span>
          <div className="move-detail-titles">
            <div className="move-detail-name" style={{ color }}>
              {def.name}
            </div>
            <div className="move-detail-line">
              <span>{pipelineLabel(def.pipeline)}</span>
              <span className="move-detail-sep">·</span>
              <span style={{ color: def.positive ? 'var(--hp-high)' : 'var(--hp-low)' }}>{def.positive ? 'Buff' : 'Debuff'}</span>
            </div>
          </div>
          {instance.statusId === 'Poison' && <PoisonPips duration={instance.duration} />}
        </div>

        <div className="move-detail-stats">
          {instance.magnitude !== undefined && (
            <span className="move-detail-stat">
              <StatusGlyph statusId={instance.statusId} />
              <strong>{instance.magnitude}</strong>
              <span className="move-detail-unit">{magnitudeUnit(def.pipeline, def.shape)}</span>
            </span>
          )}
          {instance.duration !== undefined && (
            <span className="move-detail-stat">
              <strong>{instance.duration}</strong>
              <span className="move-detail-unit">{def.shape === 'timer' ? 'rounds to detonation' : 'rounds left'}</span>
            </span>
          )}
        </div>

        <div className="status-dossier-facts">
          {facts.map((fact) => (
            <div key={fact.label + fact.text} className="status-dossier-fact">
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
