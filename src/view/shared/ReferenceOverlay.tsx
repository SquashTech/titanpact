import { useState, type CSSProperties, type ReactNode } from 'react';
import { TYPES, typeChart } from '../../data/typechart';
import { statuses } from '../../data/statuses';
import { IconText } from './IconText';
import { fieldEffects } from '../../data/fieldEffects';
import { FIELD_EFFECT_DURATION_ROUNDS } from '../../engine/combat/fieldEffectEngine';
import type { FieldEffectDefinition, StatusDefinition } from '../../engine/content';
import { getTypeColor, getTypeColorRgb } from '../combat/typeColors';
import { FieldGlyph } from './fieldIcons';
import { TypeBadge } from './TypeBadge';
import { StatusGlyph, statusColor, statusTint, statusClearText, pipelineLabel } from './statusIcons';
import { EquipmentCatalog, HowToPlay, TypeDial } from './referencePages';
import { PlateButton } from './PlateButton';
import { playSfx } from '../../audio/sfx';
import './referenceDock.css';

interface Props {
  onClose: () => void;
  initialTab?: Tab;
}

type Tab = 'howto' | 'types' | 'statuses' | 'fields' | 'equipment';

/** Line icons for the dock, in the 24-box. */
const TAB_ICONS: Record<Tab, ReactNode> = {
  howto: (
    <>
      <path d="M4 5c3-1 6-1 8 1 2-2 5-2 8-1v14c-3-1-6-1-8 1-2-2-5-2-8-1z" />
      <path d="M12 6v14" />
    </>
  ),
  types: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5v17M3.5 12h17M6 6l12 12M18 6 6 18" />
    </>
  ),
  statuses: <path d="M12 3c2 3.5 5 5.5 5 9.5a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.3 1.8 1.2 2.6 2 3-.4-3 .4-5.6 1-8z" />,
  fields: (
    <>
      <path d="M3 17c3-2 6-2 9 0s6 2 9 0M3 12c3-2 6-2 9 0s6 2 9 0" />
      <circle cx="12" cy="6" r="2.5" />
    </>
  ),
  equipment: (
    <>
      <path d="M14 4l6 6-9 9H5v-6z" />
      <path d="M12 6l6 6" />
    </>
  ),
};

/** Each tab: its name over the page, and the short word under its icon in the dock. */
const TABS: readonly { id: Tab; name: string; short: string }[] = [
  { id: 'howto', name: 'How to Play', short: 'Rules' },
  { id: 'types', name: 'Types', short: 'Types' },
  { id: 'statuses', name: 'Statuses', short: 'Status' },
  { id: 'fields', name: 'Fields', short: 'Fields' },
  { id: 'equipment', name: 'Gear', short: 'Gear' },
];

function TabIcon({ tab }: { tab: Tab }) {
  return (
    <svg className="ref-dock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
      {TAB_ICONS[tab]}
    </svg>
  );
}

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

/**
 * Player-facing rules reference: How to Play, the type dial over the authored chart, and the status,
 * Field Effect and equipment catalogs. Full screen, its tabs docked at the bottom over Close, so every
 * press is under the thumb.
 */
export function ReferenceOverlay({ onClose, initialTab = 'types' }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const current = TABS.find((t) => t.id === tab)!;

  return (
    <div className="ref-dock" role="dialog" aria-label="Reference">
      <header className="ref-dock-head">
        <TabIcon tab={tab} />
        <h2 className="ref-dock-title">{current.name}</h2>
      </header>
      <div className="ref-dock-rule" aria-hidden="true" />

      <div key={tab} className="ref-dock-page status-reference-scroll">
        {tab === 'howto' ? (
          <HowToPlay />
        ) : tab === 'types' ? (
          <>
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
          </>
        ) : tab === 'equipment' ? (
          <EquipmentCatalog />
        ) : tab === 'fields' ? (
          <>
            <p className="reference-lead">One field at a time, for {FIELD_EFFECT_DURATION_ROUNDS} rounds. A different one replaces it.</p>
            {REFERENCE_FIELD_EFFECTS.map((def) => (
              <FieldEffectReferenceRow key={def.id} def={def} />
            ))}
          </>
        ) : (
          Object.values(statuses).map((def) => <StatusReferenceRow key={def.id} def={def} />)
        )}
      </div>

      <footer className="ref-dock-foot">
        <nav className="ref-dock-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={t.id === tab}
              className={`ref-dock-tab${t.id === tab ? ' is-on' : ''}`}
              data-sfx="none"
              onClick={() => {
                if (t.id === tab) return;
                playSfx('ui.tab');
                setTab(t.id);
              }}
            >
              <TabIcon tab={t.id} />
              <span className="ref-dock-tab-label">{t.short}</span>
            </button>
          ))}
        </nav>
        <PlateButton className="ref-dock-close" onClick={onClose} data-sfx="ui.back">
          Close
        </PlateButton>
      </footer>
    </div>
  );
}

function FieldEffectReferenceRow({ def }: { def: FieldEffectDefinition }) {
  const type = def.flavorType ?? 'Arcane';
  const color = getTypeColor(type);
  return (
    <div className="status-ref-row" style={{ '--plate-color': color } as CSSProperties}>
      <span className="status-ref-icon" style={{ color, background: `rgba(${getTypeColorRgb(type)}, 0.16)` }}>
        <FieldGlyph fieldEffectId={def.id} />
      </span>
      <div className="status-ref-body">
        <div className="status-ref-head">
          <span className="status-ref-name" style={{ color }}>
            {def.name}
          </span>
          <span className="status-ref-pipeline">{type}</span>
        </div>
        <div className="status-ref-desc"><IconText text={def.description} /></div>
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
        {def.description && <div className="status-ref-desc"><IconText text={def.description} /></div>}
        <div className="status-ref-meta">{statusClearText(def)}</div>
      </div>
    </div>
  );
}
