import { useState, type CSSProperties } from 'react';
import { TYPES, typeChart } from '../../data/typechart';
import { statuses } from '../../data/statuses';
import { passives } from '../../data/passives';
import { fieldEffects } from '../../data/fieldEffects';
import { FIELD_EFFECT_DURATION_ROUNDS } from '../../engine/combat/fieldEffectEngine';
import type { FieldEffectDefinition, PassiveDefinition, StatusDefinition } from '../../engine/content';
import { getTypeColor, getTypeColorRgb } from '../combat/typeColors';
import { ElementGlyph } from './elementIcons';
import { fieldEffectIconArt } from './iconArt';
import { TypeBadge } from './TypeBadge';
import { StatusGlyph, statusColor, statusTint, statusClearText, pipelineLabel } from './statusIcons';
import { EquipmentCatalog, TypeDial } from './referencePages';
import { PassiveGlyph, passiveColor, passiveTint, passiveEffectSummary, PassiveStatChips } from './passiveIcons';

interface Props {
  onClose: () => void;
  initialTab?: Tab;
}

type Tab = 'types' | 'statuses' | 'passives' | 'fields' | 'equipment';

/** The fields a hero can set. Withering Gaze is the Titan's, met first in the finale, and is kept for it. */
const REFERENCE_FIELD_EFFECTS = Object.values(fieldEffects).filter((def) => def.id !== 'witheringGaze');

function multClass(mult: number): string {
  if (mult > 1) return 'eff-super';
  if (mult < 1) return 'eff-resist';
  return 'eff-neutral';
}

function formatCell(mult: number): string {
  return mult === 1 ? '–' : `${mult}`;
}

/** Player-facing rules reference: the type dial over the authored chart, the status, passive, Field Effect and equipment catalogs. */
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
          <button className={`reference-tab${tab === 'fields' ? ' reference-tab-active' : ''}`} onClick={() => setTab('fields')}>
            Fields
          </button>
          <button className={`reference-tab${tab === 'equipment' ? ' reference-tab-active' : ''}`} onClick={() => setTab('equipment')}>
            Equipment
          </button>
        </div>
        {tab === 'types' ? (
          <div className="status-reference-scroll">
            <TypeDial />
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
          </div>
        ) : tab === 'equipment' ? (
          <div className="status-reference-scroll">
            <EquipmentCatalog />
          </div>
        ) : tab === 'fields' ? (
          <div className="status-reference-scroll">
            <p className="reference-lead">One field at a time, for {FIELD_EFFECT_DURATION_ROUNDS} rounds. A different one replaces it.</p>
            {REFERENCE_FIELD_EFFECTS.map((def) => (
              <FieldEffectReferenceRow key={def.id} def={def} />
            ))}
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

function PassiveReferenceRow({ def }: { def: PassiveDefinition }) {
  const color = passiveColor(def.id);
  const summary = passiveEffectSummary(def);

  return (
    <div className="status-ref-row" style={{ '--plate-color': color } as CSSProperties}>
      {/* `color` too: the glyph is a currentColor path. */}
      <span className="status-ref-icon" style={{ color, background: passiveTint(def.id, 0.16) }}>
        <PassiveGlyph passiveId={def.id} />
      </span>
      <div className="status-ref-body">
        <div className="status-ref-head">
          <span className="status-ref-name" style={{ color }}>
            {def.name}
          </span>
        </div>
        <div className="status-ref-desc">{def.description}</div>
        <PassiveStatChips def={def} />
        {summary && <div className="status-ref-meta">{summary}</div>}
      </div>
    </div>
  );
}

function FieldEffectReferenceRow({ def }: { def: FieldEffectDefinition }) {
  const type = def.flavorType ?? 'Arcane';
  const color = getTypeColor(type);
  const iconSrc = fieldEffectIconArt[def.id];

  return (
    <div className="status-ref-row" style={{ '--plate-color': color } as CSSProperties}>
      <span className="status-ref-icon" style={{ color, background: `rgba(${getTypeColorRgb(type)}, 0.16)` }}>
        {iconSrc ? <img src={iconSrc} alt="" draggable={false} /> : <ElementGlyph type={type} />}
      </span>
      <div className="status-ref-body">
        <div className="status-ref-head">
          <span className="status-ref-name" style={{ color }}>
            {def.name}
          </span>
          <span className="status-ref-pipeline">{type}</span>
        </div>
        <div className="status-ref-desc">{def.description}</div>
      </div>
    </div>
  );
}

function StatusReferenceRow({ def }: { def: StatusDefinition }) {
  const color = statusColor(def.id);

  return (
    <div className="status-ref-row" style={{ '--plate-color': color } as CSSProperties}>
      {/* `color` too: the glyph is a currentColor path. */}
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
