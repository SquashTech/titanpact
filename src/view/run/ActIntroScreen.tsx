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

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

/** "Act III", or a bare number past the authored numerals — TOTAL_ACTS could rise without this becoming a crash. */
function actLabel(actNumber: number): string {
  return `Act ${ROMAN[actNumber - 1] ?? actNumber}`;
}

/**
 * The per-act arrival beat (docs/locations.md §4): shown once at the top of
 * every act — after the draft for Act 1, after `advanceToNextAct` for the
 * rest — before the map is ever seen.
 *
 * It is **not** an Act-1 title card that happens to repeat. The screen's job
 * is to answer "where am I and who lives here" at the one moment the player
 * can still plan around the answer, which is a question every act asks.
 *
 * Standing on the node stage (docs/visual-language.md, ninth pass) gets the
 * whole grammar for free — a place, a voice, and nothing drawn around either —
 * and `--node-rgb` set once on the root is what tints the wash, the title
 * bloom, the particles and the horizon together. Two departures from the
 * other node screens, both because this screen has a different job:
 *
 * - **`LocationSky`, not `NodeSky`.** A node screen's sky says what *kind* of
 *   moment this is; this one has to say what *place* this is, which needs a
 *   silhouette and a weather (LocationSky.tsx, locationArt.tsx).
 * - **The act numeral is a watermark, not a heading.** It is the least
 *   important thing on the screen — the player knows roughly how far in they
 *   are — so it is drawn huge and nearly invisible behind the name, which is
 *   the thing they actually need.
 *
 * Per visual-language's standing rule, the only rectangle on the screen is
 * the button, because the button is the only thing you can act on. The
 * faction line and the domain glyphs are unboxed text and marks.
 */
export function ActIntroScreen({ run, location, onEnter }: Props) {
  const { affinity } = location;

  return (
    <div className="node-screen act-intro-screen" style={{ '--node-rgb': location.tintRgb } as CSSProperties}>
      <LocationSky location={location} />
      <RosterPeek run={run} />

      {/* Two flexible spacers around the body float the name in the middle of
          the sky rather than against its top edge — and the horizon has the
          bottom third of the screen to itself. */}
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
              /* Wild's Edge, and only Wild's Edge (docs/locations.md §1) — said
                 in words rather than by drawing all fifteen glyphs, which would
                 read as a legend rather than as a fact about the place. */
              <span className="act-intro-domains-label is-wide">Every domain walks here</span>
            )}
          </div>
        </div>
      </div>

      <div className="node-spacer" />

      <button className="resolve-button" onClick={onEnter}>
        Enter {location.name}
      </button>
    </div>
  );
}
