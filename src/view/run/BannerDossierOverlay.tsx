import { createPortal } from 'react-dom';
import type { CSSProperties } from 'react';
import type { StatKey } from '../../engine/content';
import { STAT_ORDER } from '../../engine/content';
import { relics } from '../../data/relics';
import { SEAL_ACTS } from '../../run/state';
import { RelicArt } from '../shared/relicArt';
import { BANNER, relicColor } from '../shared/relicIcons';
import { stackedRelicName } from '../shared/relicStacks';
import { STAT_LABELS } from '../shared/StatBars';
import { StatGlyph } from '../shared/statIcons';
import { SectionGlyph } from '../shared/sectionIcons';
import { overlayHost } from '../shared/overlayHost';

/**
 * What a tap on a raised standard opens: the Banner's ledger. The standard itself at the head
 * with the folded name ("Banner of Vitality +2"), every stat it grants as the SUMMED figure the
 * team is actually getting with the per-copy grant as fine print, and how many are flying against
 * the five a run can raise. Same chassis as every other dossier; the stripe and the wash take
 * the Banner's colour, which is its lead stat's. It replaced a grey box holding one sentence.
 * Portalled into overlayHost(), never document.body — see overlayHost.ts.
 */
export function BannerDossierOverlay({ relicId, count, onClose }: { relicId: string | null; count: number; onClose: () => void }) {
  const relic = relicId ? relics[relicId] : null;
  if (!relicId || !relic) return null;
  const copies = Math.max(count, 1);
  const color = relicColor(relicId);
  const grants = STAT_ORDER.map((stat) => [stat, relic.statGrants[stat] ?? 0] as [StatKey, number]).filter(([, amount]) => amount !== 0);

  function closeAndStop(e: { stopPropagation: () => void }) {
    e.stopPropagation();
    onClose();
  }

  return createPortal(
    <div className="detail-overlay" onClick={closeAndStop}>
      <div className="detail-panel banner-dossier-panel" style={{ borderTopColor: color, '--relic-color': color, '--node-color': color } as CSSProperties} onClick={closeAndStop}>
        <div className="move-detail-head">
          <RelicArt relicId={relicId} className="banner-dossier-art" />
          <div className="move-detail-titles">
            <div className="move-detail-name">{stackedRelicName(relic, copies)}</div>
            <div className="move-detail-line">
              <span style={{ color }}>Guardian’s Banner</span>
              <span className="move-detail-sep">·</span>
              <span>Team-wide</span>
            </div>
          </div>
        </div>

        <div className="move-detail-stats">
          {grants.map(([stat, amount]) => {
            const total = amount * copies;
            return (
              <span key={stat} className={`move-detail-stat${total < 0 ? ' is-loss' : ''}`}>
                <StatGlyph stat={stat} />
                <strong>{total > 0 ? `+${total}` : total}</strong>
                <span className="move-detail-unit">{STAT_LABELS[stat]}</span>
                {copies > 1 && <span className="move-detail-boost banner-dossier-per">{amount > 0 ? `+${amount}` : amount} each</span>}
              </span>
            );
          })}
        </div>

        <div className="node-dossier-facts">
          <div className="node-dossier-fact">
            <span className="node-dossier-fact-glyph">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
                {BANNER}
              </svg>
            </span>
            <span className="node-dossier-fact-label">Flying</span>
            <span className="node-dossier-fact-value">
              <strong>×{count}</strong>
              <span className="node-dossier-fact-note">of {SEAL_ACTS} a run can raise</span>
            </span>
          </div>
          <div className="node-dossier-fact">
            <span className="node-dossier-fact-glyph">
              <SectionGlyph name="heroes" />
            </span>
            <span className="node-dossier-fact-label">Applies to</span>
            <span className="node-dossier-fact-value">
              <strong>Every hero</strong>
              <span className="node-dossier-fact-note">active and bench alike</span>
            </span>
          </div>
        </div>

        <div className="detail-close-hint">Tap anywhere to close</div>
      </div>
    </div>,
    overlayHost()
  );
}
