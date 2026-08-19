import { createPortal } from 'react-dom';
import type { StatusInstance } from '../../engine/state';
import { statuses } from '../../data/statuses';
import { statusEmoji, statusColor, statusTint, PoisonPips } from '../shared/statusIcons';

const PIPELINE_LABELS: Record<string, string> = {
  dot: 'Damage over time',
  hot: 'Heal over time',
  control: 'Control effect',
  timer: 'Delayed detonation',
  trigger: 'Trigger / mark',
  target: 'Targeting effect',
  none: 'Effect',
};

interface Props {
  instance: StatusInstance;
  onClose: () => void;
}

/**
 * Full readout for a single status effect, opened by long-pressing its icon
 * on a battlefield card (CombatantCard.tsx) — the accessible "what does this
 * actually do" companion to the compact icon+number badge, since the badge
 * itself has no room for the status's clear condition or effect type.
 * Dismisses on any tap, matching HeroDetailOverlay's convention.
 */
export function StatusDetailOverlay({ instance, onClose }: Props) {
  const def = statuses[instance.statusId];
  if (!def) return null;
  const emoji = statusEmoji[instance.statusId];
  const color = statusColor(instance.statusId);

  function closeAndStop(e: { stopPropagation: () => void }) {
    e.stopPropagation();
    onClose();
  }

  const clearText = def.clearsOnSwitch
    ? 'Cleared by switching to the bench.'
    : def.positive
      ? "Persists through switching — Cleanse can't remove it."
      : 'Persists through switching — removed by Cleanse.';

  // Portalled to document.body rather than rendered in place: this overlay is
  // reached from a status icon nested inside a CombatantCard, and that card
  // can carry `filter` (fainted/locked) or `transform` (targetable:hover) —
  // either one turns a `position: fixed` descendant into a containing-block
  // child of the card instead of the viewport. Portalling sidesteps that.
  return createPortal(
    <div className="detail-overlay status-detail-overlay" onClick={closeAndStop}>
      <div className="detail-panel status-detail-panel" style={{ borderTopColor: color }} onClick={closeAndStop}>
        <div className="status-detail-head">
          {emoji && (
            <span className="status-detail-icon" style={{ background: statusTint(instance.statusId, 0.16) }}>
              {emoji}
            </span>
          )}
          <div>
            <div className="status-detail-name" style={{ color }}>
              {def.name}
            </div>
            <div className="status-detail-pipeline">{PIPELINE_LABELS[def.pipeline]}</div>
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
    document.body
  );
}
