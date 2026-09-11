import { createPortal } from 'react-dom';
import type { CSSProperties, ReactNode } from 'react';
import type { PassiveDefinition } from '../../engine/content';
import { STAT_LABELS } from './StatBars';
import { MoveKindGlyph, StatGlyph } from './statIcons';
import { ElementGlyph } from './elementIcons';
import { StatusGlyph, statusColor } from './statusIcons';
import { PassiveGlyph, passiveColor, passiveKindLabel, passiveStatGrants, passiveTint } from './passiveIcons';
import { passiveFacts, type PassiveFact } from './passiveFacts';
import { getTypeColor } from '../combat/typeColors';
import { overlayHost } from './overlayHost';

function factGlyph(fact: PassiveFact): ReactNode {
  switch (fact.glyph.kind) {
    case 'status':
      return <StatusGlyph statusId={fact.glyph.statusId} />;
    case 'stat':
      return <StatGlyph stat={fact.glyph.stat} />;
    case 'element':
      return <ElementGlyph type={fact.glyph.type} />;
    case 'move':
      return <MoveKindGlyph kind={fact.glyph.move} />;
  }
}

function factColor(fact: PassiveFact): string | undefined {
  if (fact.color === 'status' && fact.glyph.kind === 'status') return statusColor(fact.glyph.statusId);
  if (fact.color === 'element' && fact.glyph.kind === 'element') return getTypeColor(fact.glyph.type);
  return undefined;
}

/**
 * The passive dossier: what a tap on any passive chip opens — the hero sheets, a Class's passive,
 * an Evolution path's. Same three facets as the move dossier: who it is (tinted disc, name in its
 * own colour, its kind), the numbers (every flat or conditional grant as a figure, in the move
 * card's strip), and the rule as ROWS — When / Then / Limit / Damage / While — each read off the
 * fields the passiveEngine matches on rather than off the sentence. The authored description
 * stays under them as fine print, since it is the one line that can carry a nuance the rows
 * cannot. It replaced `PassiveInfoPanel`, a grey box holding the sentence and a chip.
 */
export function PassiveDetailCard({ passive }: { passive: PassiveDefinition }) {
  const color = passiveColor(passive.id);
  const grants = passiveStatGrants(passive);
  const facts = passiveFacts(passive);
  return (
    <div className="passive-detail-card" style={{ '--passive-color': color, '--passive-tint': passiveTint(passive.id, 0.16) } as CSSProperties}>
      <div className="move-detail-head">
        <span className="passive-detail-disc">
          <PassiveGlyph passiveId={passive.id} />
        </span>
        <div className="move-detail-titles">
          <div className="move-detail-name" style={{ color }}>
            {passive.name}
          </div>
          <div className="move-detail-line">
            {/* The cap is its own row below, so the line does not say it twice. */}
            <span>{passive.reactive?.oncePerFight ? 'Reactive' : passiveKindLabel(passive)}</span>
          </div>
        </div>
      </div>

      <div className="move-detail-stats">
        {grants.map(([stat, amount]) => (
          <span key={stat} className={`move-detail-stat${amount < 0 ? ' is-loss' : ''}`}>
            <StatGlyph stat={stat} />
            <strong>{amount > 0 ? `+${amount}` : amount}</strong>
            <span className="move-detail-unit">{STAT_LABELS[stat]}</span>
          </span>
        ))}
      </div>

      {facts.length > 0 && (
        <div className="passive-detail-facts">
          {facts.map((fact, i) => {
            const rowColor = factColor(fact);
            return (
              <div key={i} className="passive-detail-fact" style={rowColor ? ({ '--fact-color': rowColor } as CSSProperties) : undefined}>
                <span className="passive-detail-fact-glyph">{factGlyph(fact)}</span>
                <span className="passive-detail-fact-label">{fact.label}</span>
                <span className="passive-detail-fact-text">{fact.text}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="passive-detail-desc">{passive.description}</div>
    </div>
  );
}

/**
 * The passive dossier on the `.detail-overlay` / `.detail-panel` chassis — the passive's colour on
 * the stripe and the wash, "tap anywhere to close". Portalled into overlayHost(), never
 * document.body — see overlayHost.ts.
 */
export function PassiveDetailOverlay({ passive, onClose }: { passive: PassiveDefinition | null; onClose: () => void }) {
  if (!passive) return null;
  const color = passiveColor(passive.id);

  function closeAndStop(e: { stopPropagation: () => void }) {
    e.stopPropagation();
    onClose();
  }

  return createPortal(
    <div className="detail-overlay" onClick={closeAndStop}>
      <div className="detail-panel passive-detail-panel" style={{ borderTopColor: color, '--passive-color': color } as CSSProperties} onClick={closeAndStop}>
        <PassiveDetailCard passive={passive} />
        <div className="detail-close-hint">Tap anywhere to close</div>
      </div>
    </div>,
    overlayHost()
  );
}
