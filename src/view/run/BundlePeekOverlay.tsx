import type { CSSProperties } from 'react';
import { heroes } from '../../data/heroes';
import { HeroPortrait } from '../shared/HeroPortrait';
import { ElementGlyph } from '../shared/elementIcons';
import { getTypeAbbr, getTypeColor, getTypeColorRgb } from '../combat/typeColors';
import { PurchaseButton, type OfferPurchase } from './StarShopScreen';

interface Props {
  heroIds: readonly string[];
  purchase: OfferPurchase;
  /** Opens the hero's dossier over this screen (StarShopScreen owns it). */
  onPeekHero: (heroId: string) => void;
  onClose: () => void;
}

/**
 * A Hero Bundle, opened from its shelf row: one box a hero — face, name, type — each a tap into
 * the dossier, and under them the one Purchase button the bundle has. The shelf row only opens
 * this; nothing there spends a star.
 */
export function BundlePeekOverlay({ heroIds, purchase, onPeekHero, onClose }: Props) {
  return (
    <div className="detail-overlay is-sheet" onClick={onClose}>
      <div className="detail-panel bundle-peek-panel" onClick={(e) => e.stopPropagation()}>
        <div className="detail-header bundle-peek-head">
          <span className="detail-name">{purchase.offer.name}</span>
        </div>
        <div className="bundle-peek-boxes">
          {heroIds.map((heroId) => {
            const hero = heroes[heroId];
            if (!hero) return null;
            return (
              <button
                type="button"
                key={heroId}
                className="bundle-peek-box"
                style={{ '--type-rgb': getTypeColorRgb(hero.types[0]) } as CSSProperties}
                onClick={() => onPeekHero(heroId)}
                aria-label={`${hero.name} — view details`}
              >
                <span className="bundle-peek-figure">
                  <span className="pick-ground" aria-hidden="true" />
                  <HeroPortrait heroId={heroId} className="bundle-peek-portrait" />
                </span>
                <span className="bundle-peek-name">{hero.name}</span>
                <span className="pick-types bundle-peek-types">
                  {hero.types.map((t) => (
                    <span key={t} className="pick-type-code" style={{ color: getTypeColor(t) }} title={t}>
                      <ElementGlyph type={t} />
                      {getTypeAbbr(t)}
                    </span>
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="sheet-footer" onClick={(e) => e.stopPropagation()}>
        <PurchaseButton purchase={purchase} />
        <button className="resolve-button sheet-close-button is-secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
