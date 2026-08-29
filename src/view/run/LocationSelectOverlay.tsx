import type { CSSProperties } from 'react';
import { locations } from '../../data/locations';
import { LocationHorizon } from '../shared/locationArt';
import { ElementGlyph } from '../shared/elementIcons';
import { getTypeColor } from '../combat/typeColors';

interface Props {
  /** Called with the chosen location id — App.tsx builds a run standing in that place (createLocationVisitRun). */
  onPick: (locationId: string) => void;
  onClose: () => void;
}

/**
 * Location picker behind the title screen's "Visit Location" button: the six
 * authored Locations (src/data/locations.ts) as a list, any one of which can
 * be dropped into directly instead of being reached by playing acts until
 * the itinerary happens to offer it.
 *
 * Each row is the place in miniature — its horizon silhouette
 * (locationArt.tsx), its tint, its faction and its domain glyphs — because a
 * list of six names is the one presentation that makes the choice
 * meaningless: the whole reason to visit a location is what it looks and
 * fights like, so the row has to carry both.
 *
 * Reuses .log-overlay/.log-panel so this reads as the same modal layer as the
 * Compendium and the Reference rather than inventing a chrome for one button.
 */
export function LocationSelectOverlay({ onPick, onClose }: Props) {
  return (
    <div className="log-overlay" onClick={onClose}>
      <div className="log-panel location-select-panel" onClick={(e) => e.stopPropagation()}>
        <div className="log-panel-header">
          <span>Visit Location</span>
          <button className="log-close-button" onClick={onClose}>
            ✕
          </button>
        </div>

        <p className="location-select-hint">Drops you into the chosen place with a random party of six.</p>

        <div className="location-select-list">
          {Object.values(locations).map((location) => (
            <button
              key={location.id}
              className="location-select-row"
              style={{ '--node-rgb': location.tintRgb } as CSSProperties}
              onClick={() => onPick(location.id)}
            >
              <span className="location-select-art" aria-hidden="true">
                <LocationHorizon locationId={location.id} />
              </span>

              <span className="location-select-body">
                <span className="location-select-name">{location.name}</span>
                <span className="location-select-faction">{location.faction}</span>
              </span>

              <span className="location-select-domains">
                {location.affinity ? (
                  location.affinity.map((type) => (
                    <span key={type} className="location-select-domain" style={{ color: getTypeColor(type) }} title={type}>
                      <ElementGlyph type={type} />
                    </span>
                  ))
                ) : (
                  <span className="location-select-domains-all">all</span>
                )}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
