import type { CSSProperties } from 'react';
import type { LocationDefinition } from '../../data/locations';
import type { RunState } from '../../run/state';
import { TOTAL_ACTS } from '../../run/state';
import { LocationSky } from '../shared/LocationSky';
import { NodeHeader } from '../shared/NodeStage';
import { ElementGlyph } from '../shared/elementIcons';
import { getTypeColor } from '../combat/typeColors';
import { RosterPeek } from './RosterPeek';

interface Props {
  run: RunState;
  location: LocationDefinition;
  onEnter: () => void;
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];

/** Falls back to a bare number past the authored numerals. */
function actLabel(actNumber: number): string {
  return `Act ${ROMAN[actNumber - 1] ?? actNumber}`;
}

// Per-act arrival beat (docs/locations.md §4), shown at the top of every act.
// LocationSky rather than NodeSky: this screen says what PLACE, not what kind of moment.
export function ActIntroScreen({ run, location, onEnter }: Props) {
  const { affinity } = location;

  return (
    <div className="node-screen act-intro-screen" style={{ '--node-rgb': location.tintRgb } as CSSProperties}>
      <LocationSky location={location} />
      <RosterPeek run={run} />

      <div className="node-spacer" />

      <div className="act-intro-body">
        <div className="act-intro-numeral" aria-hidden="true">
          {ROMAN[run.actNumber - 1] ?? run.actNumber}
        </div>

        <NodeHeader
          eyebrow={`${actLabel(run.actNumber)} of ${ROMAN[TOTAL_ACTS - 1] ?? TOTAL_ACTS}`}
          title={location.name}
          readout={location.flavor}
        />

        <div className="act-intro-dossier">
          <p className="act-intro-faction">
            Held by the <strong>{location.faction}</strong>
          </p>

          <div className="act-intro-domains">
            {affinity ? (
              <>
                <span className="act-intro-domains-label">Domains here</span>
                <span className="act-intro-domain-marks">
                  {affinity.map((type) => (
                    <span key={type} className="act-intro-domain" style={{ color: getTypeColor(type) }} title={type}>
                      <ElementGlyph type={type} />
                    </span>
                  ))}
                </span>
              </>
            ) : (
              /* Wild's Edge only (docs/locations.md §1). */
              <span className="act-intro-domains-label is-wide">Every domain walks here</span>
            )}
          </div>
        </div>
      </div>

      <div className="node-spacer" />

      <button className="resolve-button" onClick={onEnter}>
        {/* Lower-cased article so a name that carries one does not read "Enter The Threshold". */}
        Enter {location.name.replace(/^The /, 'the ')}
      </button>
    </div>
  );
}
