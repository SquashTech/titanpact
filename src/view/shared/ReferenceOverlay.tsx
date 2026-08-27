import { useState } from 'react';
import { TYPES, typeChart } from '../../data/typechart';
import { statuses } from '../../data/statuses';
import { passives } from '../../data/passives';
import type { PassiveDefinition, StatusDefinition } from '../../engine/content';
import { TypeBadge } from './TypeBadge';
import { StatusGlyph, statusColor, statusTint, statusClearText, pipelineLabel } from './statusIcons';
import { passiveEmoji, passiveColor, passiveTint, passiveEffectSummary } from './passiveIcons';

interface Props {
  onClose: () => void;
  /** Which tab opens first — callers reached via a "Types"-flavored button (FightScreen's 📊) land on the matchup grid; a future "Statuses" entry point can open straight to the catalog instead. Defaults to the grid, matching this overlay's original type-chart-only behavior. */
  initialTab?: Tab;
}

type Tab = 'types' | 'statuses' | 'passives';

function multClass(mult: number): string {
  if (mult > 1) return 'eff-super';
  if (mult < 1) return 'eff-resist';
  return 'eff-neutral';
}

function formatCell(mult: number): string {
  return mult === 1 ? '–' : `${mult}`;
}

/**
 * Full player-facing reference, reachable from every screen that benefits
 * from a rules lookup (title, map, squad-select/battle-preview, combat).
 * Two tabs: the 15x15 type effectiveness matrix (src/data/typechart.ts) and
 * the 9-status condition catalog (src/data/statuses.ts) — the same
 * definitions StatusDetailOverlay reads for its live in-combat readout, just
 * presented as a static list instead of one instance's magnitude/duration.
 * Read-only: this is the current fixture chart, not the authored balance
 * content (see typechart.ts's placeholder warning).
 */
export function ReferenceOverlay({ onClose, initialTab = 'types' }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <div className="log-overlay" onClick={onClose}>
      <div className="log-panel reference-panel" onClick={(e) => e.stopPropagation()}>
        <div className="log-panel-header">
          <span>Reference</span>
          <button className="log-close-button" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="reference-tabs">
          <button className={`reference-tab${tab === 'types' ? ' reference-tab-active' : ''}`} onClick={() => setTab('types')}>
            Types
          </button>
          <button className={`reference-tab${tab === 'statuses' ? ' reference-tab-active' : ''}`} onClick={() => setTab('statuses')}>
            Statuses
          </button>
          <button className={`reference-tab${tab === 'passives' ? ' reference-tab-active' : ''}`} onClick={() => setTab('passives')}>
            Passives
          </button>
        </div>
        {tab === 'types' ? (
          <div className="type-chart-scroll">
            <div className="type-chart-grid">
              <div className="tc-cell tc-corner" />
              {TYPES.map((col) => (
                <div className="tc-cell tc-col-header" key={col}>
                  <TypeBadge type={col} iconOnly />
                </div>
              ))}
              {TYPES.map((row) => (
                <div className="tc-row" key={row}>
                  {/* Glyph-only on both axes: a header repeats down every
                      one of 15 rows, so the three letters were being read 30
                      times to answer a question the position already answers,
                      and they were doing it at the 9px the 30px column
                      allows. The glyph gets that width to itself instead. */}
                  <div className="tc-cell tc-row-header">
                    <TypeBadge type={row} iconOnly />
                  </div>
                  {TYPES.map((col) => {
                    const mult = typeChart[row][col];
                    return (
                      <div className={`tc-cell tc-value ${multClass(mult)}`} key={col}>
                        {formatCell(mult)}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        ) : tab === 'statuses' ? (
          <div className="status-reference-scroll">
            {Object.values(statuses).map((def) => (
              <StatusReferenceRow key={def.id} def={def} />
            ))}
          </div>
        ) : (
          <div className="status-reference-scroll">
            {Object.values(passives).map((def) => (
              <PassiveReferenceRow key={def.id} def={def} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Mirrors StatusReferenceRow's layout exactly (same .status-ref-* classes — a catalog row is a catalog row regardless of content type) since passives don't yet have their own reference-catalog styling. */
function PassiveReferenceRow({ def }: { def: PassiveDefinition }) {
  const emoji = passiveEmoji[def.id];
  const color = passiveColor(def.id);
  const summary = passiveEffectSummary(def);

  return (
    <div className="status-ref-row" style={{ borderLeftColor: color }}>
      {emoji && (
        <span className="status-ref-icon" style={{ background: passiveTint(def.id, 0.16) }}>
          {emoji}
        </span>
      )}
      <div className="status-ref-body">
        <div className="status-ref-head">
          <span className="status-ref-name" style={{ color }}>
            {def.name}
          </span>
        </div>
        <div className="status-ref-desc">{def.description}</div>
        {summary && <div className="status-ref-meta">{summary}</div>}
      </div>
    </div>
  );
}

function StatusReferenceRow({ def }: { def: StatusDefinition }) {
  const color = statusColor(def.id);

  return (
    <div className="status-ref-row" style={{ borderLeftColor: color }}>
      {/* `color` as well as `background`: the glyph inside is a currentColor
          path now (statusIcons.tsx), not the full-colour PNG this disc used to
          hold, so the status's identity colour has to reach it from here. */}
      <span className="status-ref-icon" style={{ color, background: statusTint(def.id, 0.16) }}>
        <StatusGlyph statusId={def.id} />
      </span>
      <div className="status-ref-body">
        <div className="status-ref-head">
          <span className="status-ref-name" style={{ color }}>
            {def.name}
          </span>
          {def.positive && <span className="status-ref-tag">Buff</span>}
          <span className="status-ref-pipeline">{pipelineLabel(def.pipeline)}</span>
        </div>
        {def.description && <div className="status-ref-desc">{def.description}</div>}
        <div className="status-ref-meta">{statusClearText(def)}</div>
      </div>
    </div>
  );
}
