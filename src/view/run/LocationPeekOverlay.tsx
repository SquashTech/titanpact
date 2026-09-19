import type { CSSProperties } from 'react';
import { locationDomains, locations } from '../../data/locations';
import { enemies } from '../../data/enemies';
import { LocationMotes } from '../shared/LocationSky';
import { LocationHorizon } from '../shared/locationArt';
import { HeroPortrait } from '../shared/HeroPortrait';
import { ElementGlyph } from '../shared/elementIcons';
import { getTypeColor } from '../combat/typeColors';
import { PurchaseButton, type OfferPurchase } from './StarShopScreen';

interface Props {
  locationId: string;
  /** The offer this place is, when it is being looked at from the shelf; the Purchase lives here and nowhere else. */
  purchase?: OfferPurchase;
  onClose: () => void;
}

/** How much of a place's weather the peek carries — the choice card's density, since it is that card at full size. */
const PEEK_MOTE_DENSITY = 0.7;

/**
 * A place, looked at before it is paid for (StarShopScreen): the choice screen's card at full
 * size — horizon, weather, the warden on the skyline — and under it the three things a row
 * cannot say: the omen the place speaks on arrival, its domains by name, and who keeps it — and
 * the one Purchase button the place has, above Close.
 */
export function LocationPeekOverlay({ locationId, purchase, onClose }: Props) {
  const location = locations[locationId];
  if (!location) return null;
  const domains = locationDomains(location);
  const warden = location.guardianFinalEnemyId ? enemies[location.guardianFinalEnemyId] : null;

  return (
    <div className="detail-overlay is-sheet" onClick={onClose}>
      <div className="detail-panel location-peek-panel" style={{ '--node-rgb': location.tintRgb } as CSSProperties} onClick={(e) => e.stopPropagation()}>
        <div className="location-choice-card is-picked location-peek-card">
          <span className="location-choice-scene" aria-hidden="true">
            <span className="location-choice-wash" />
            <LocationMotes kind={location.ambience} density={PEEK_MOTE_DENSITY} />
            {location.guardianFinalEnemyId && (
              <span className="location-choice-warden">
                <HeroPortrait heroId={location.guardianFinalEnemyId} className="location-choice-warden-figure" />
              </span>
            )}
            <LocationHorizon locationId={location.id} />
          </span>
          <span className="location-choice-body">
            <span className="location-choice-name">{location.name}</span>
          </span>
          <span className="location-choice-domains">
            {domains ? (
              domains.map((type) => (
                <span key={type} className="location-choice-domain" style={{ color: getTypeColor(type) }} title={type}>
                  <ElementGlyph type={type} />
                </span>
              ))
            ) : (
              <span className="location-choice-domains-all">Every domain</span>
            )}
          </span>
        </div>

        <div className="location-peek-body">
          <p className="location-peek-omen">{location.omen}</p>
          <div className="location-peek-facts">
            <div className="location-peek-fact">
              <span className="location-peek-fact-label">Leaks here</span>
              <span className="location-peek-fact-value">
                {domains ? (
                  domains.map((type) => (
                    <span key={type} className="location-peek-domain" style={{ color: getTypeColor(type) }}>
                      <ElementGlyph type={type} />
                      {type}
                    </span>
                  ))
                ) : (
                  'Every domain'
                )}
              </span>
            </div>
            {warden && (
              <div className="location-peek-fact">
                <span className="location-peek-fact-label">Kept by</span>
                <span className="location-peek-fact-value">
                  <span className="location-peek-domain" style={{ color: getTypeColor(warden.types[0]) }}>
                    <ElementGlyph type={warden.types[0]} />
                    {warden.name}
                  </span>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="sheet-footer" onClick={(e) => e.stopPropagation()}>
        {purchase && <PurchaseButton purchase={purchase} />}
        <button className={`resolve-button sheet-close-button${purchase ? ' is-secondary' : ''}`} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
