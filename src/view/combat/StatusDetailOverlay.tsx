import { createPortal } from 'react-dom';
import type { StatusInstance } from '../../engine/state';
import { statuses } from '../../data/statuses';
import { StatusGlyph, statusColor, statusTint, statusClearText, pipelineLabel, PoisonPips } from '../shared/statusIcons';
import { overlayHost } from '../shared/overlayHost';

interface Props {
  instance: StatusInstance;
  onClose: () => void;
}

/** Full readout for one status, opened by long-pressing its badge on a CombatantCard. Dismisses on any tap. */
export function StatusDetailOverlay({ instance, onClose }: Props) {
  const def = statuses[instance.statusId];
  if (!def) return null;
  const color = statusColor(instance.statusId);

  function closeAndStop(e: { stopPropagation: () => void }) {
    e.stopPropagation();
    onClose();
  }

  const clearText = statusClearText(def);

  // Portalled: the card above can carry filter/transform, which would trap a
  // position: fixed descendant. Host is .app-shell, never body (overlayHost.ts).
  return createPortal(
    <div className="detail-overlay status-detail-overlay" onClick={closeAndStop}>
      <div className="detail-panel status-detail-panel" style={{ borderTopColor: color }} onClick={closeAndStop}>
        <div className="status-detail-head">
          <span className="status-detail-icon" style={{ color, background: statusTint(instance.statusId, 0.16) }}>
            <StatusGlyph statusId={instance.statusId} />
          </span>
          <div>
            <div className="status-detail-name" style={{ color }}>
              {def.name}
            </div>
            <div className="status-detail-pipeline">{pipelineLabel(def.pipeline)}</div>
          </div>
          {instance.statusId === 'Poison' && <PoisonPips duration={instance.duration} />}
        </div>
        {(instance.magnitude !== undefined || instance.duration !== undefined) && (
          <div className="status-detail-readout">
            {instance.magnitude !== undefined && <span>Magnitude {instance.magnitude}</span>}
            {instance.duration !== undefined && (
              <span>{def.shape === 'timer' ? 'Detonates in' : 'Rounds left'} {instance.duration}</span>
            )}
          </div>
        )}
        {def.description && <div className="status-detail-desc">{def.description}</div>}
        <div className="status-detail-meta">{clearText}</div>
        <div className="detail-close-hint">Tap anywhere to close</div>
      </div>
    </div>,
    overlayHost()
  );
}
