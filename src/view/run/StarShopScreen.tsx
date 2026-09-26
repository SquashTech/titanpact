import { useState, type CSSProperties } from 'react';
import { STAR_SHOP_OFFERS, starShopCatalog } from '../../data/starShop';
import { locationDomains, locations } from '../../data/locations';
import { heroes } from '../../data/heroes';
import { totalStars, type Profile } from '../../run/profile';
import { canBuy, isPurchased, starBalance, starsSpent, type StarShopGrant, type StarShopOffer } from '../../run/starShop';
import { HubGlyph } from '../shared/nodeIcons';
import { ElementGlyph } from '../shared/elementIcons';
import { LocationHorizon } from '../shared/locationArt';
import { HeroPortrait } from '../shared/HeroPortrait';
import { TabStrip, type TabSpec } from '../shared/TabStrip';
import { getTypeColor } from '../combat/typeColors';
import { HeroDossierOverlay } from './HeroDossierOverlay';
import { LocationPeekOverlay } from './LocationPeekOverlay';
import { BundlePeekOverlay } from './BundlePeekOverlay';

/** The shop's name, in one place: the title tile, this panel's header. The Constellation — the stars the Compendium charts, seen as one sky to draw on. */
export const STAR_SHOP_NAME = 'The Constellation';

type ShelfId = StarShopGrant['kind'];

/** One page per kind of grant. Counts come off the catalog, so an empty shelf greys on the strip. */
const SHELVES: readonly (TabSpec<ShelfId> & { empty: string })[] = [
  { id: 'heroBundle', label: 'Hero Bundles', glyph: 'heroes', empty: 'A bundle is a few heroes into the recruit pool — a fourth for a type, or a themed handful. None are written yet.' },
  { id: 'location', label: 'Locations', glyph: 'places', empty: 'A place the road can offer beside the base five: its own weather, its own spawn, its own warden.' },
];

interface Props {
  profile: Profile;
  /** Spends stars on the offer and hands back the profile to render. */
  onBuy: (offer: StarShopOffer) => void;
  onClose: () => void;
}

/** What an offer's own screen needs to say and do about buying it. */
export interface OfferPurchase {
  offer: StarShopOffer;
  held: boolean;
  affordable: boolean;
  onBuy: () => void;
}

/**
 * Where stars are spent (run/starShop.ts); the deck is dressed in the Collection. The
 * balance leads — the star and the count — then the shelf the strip has open.
 * Bundles and Locations are rows that OPEN: a bundle's row is a line-up and a place's row is a
 * scene, and tapping either brings up its own screen, where the heroes can be examined and the
 * place looked around — and where the one Purchase button is. Nothing on a shelf row spends a
 * star; the cost on it is a label. The Compendium's sheet (CompendiumScreen), tabs at the foot.
 */
export function StarShopScreen({ profile, onBuy, onClose }: Props) {
  const earned = totalStars(profile);
  const spent = starsSpent(profile, starShopCatalog);
  const balance = starBalance(profile, starShopCatalog);
  const [shelf, setShelf] = useState<ShelfId>('heroBundle');
  const [dossierHeroId, setDossierHeroId] = useState<string | null>(null);
  const [openOfferId, setOpenOfferId] = useState<string | null>(null);

  const tabs = SHELVES.map((s) => ({ ...s, count: STAR_SHOP_OFFERS.filter((o) => o.grant.kind === s.id).length }));
  const open = SHELVES.find((s) => s.id === shelf)!;
  const offers = STAR_SHOP_OFFERS.filter((o) => o.grant.kind === shelf);
  const dossierHero = dossierHeroId ? heroes[dossierHeroId] : null;
  const openOffer = openOfferId ? starShopCatalog[openOfferId] : null;
  const purchaseOf = (offer: StarShopOffer): OfferPurchase => ({
    offer,
    held: isPurchased(profile, offer.id),
    affordable: canBuy(profile, starShopCatalog, offer),
    onBuy: () => onBuy(offer),
  });

  return (
    <div className="detail-overlay is-sheet" onClick={onClose}>
      <div className="detail-panel is-tabbed is-hero-sheet compendium-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="detail-header is-hero compendium-head">
          <span className="detail-portrait-plate compendium-head-plate" aria-hidden="true">
            <HubGlyph name="star" className="compendium-head-glyph" />
          </span>
          <span className="detail-name compendium-head-title">{STAR_SHOP_NAME}</span>
        </div>

        {/* Keyed on the shelf so a switch scrolls the well back to its top. */}
        <div key={shelf} className="detail-tab-body compendium-body" role="tabpanel">
          {/* The balance as the thing itself: the star and the count side by side, the ledger under them. */}
          <div className="star-shop-balance">
            <span className="star-shop-balance-head">
              <span className="star-shop-balance-star" aria-hidden="true">
                <HubGlyph name="star" />
              </span>
              <span className="star-shop-balance-count">{balance}</span>
            </span>
            <span className="star-shop-balance-label">{balance === 1 ? 'star' : 'stars'} to spend</span>
            <span className="star-shop-balance-ledger">
              {earned} earned · {spent} spent
            </span>
          </div>

          {offers.length === 0 ? (
            <div className="star-shop-empty">
              <span className="star-shop-empty-title">Nothing on this shelf yet</span>
              <span className="star-shop-empty-note">{open.empty}</span>
            </div>
          ) : (
            <div className="star-shop-offers">
              {offers.map((offer) => {
                const held = isPurchased(profile, offer.id);
                if (offer.grant.kind === 'location') {
                  return <LocationRow key={offer.id} offer={offer} locationId={offer.grant.locationId} held={held} onOpen={() => setOpenOfferId(offer.id)} />;
                }
                if (offer.grant.kind === 'heroBundle') {
                  return <BundleRow key={offer.id} offer={offer} heroIds={offer.grant.heroIds} held={held} onOpen={() => setOpenOfferId(offer.id)} />;
                }
                return (
                  <div key={offer.id} className={`star-shop-offer${held ? ' is-held' : ''}`}>
                    <div className="star-shop-offer-body">
                      <span className="star-shop-offer-name">{offer.name}</span>
                    </div>
                    <CostBadge offer={offer} held={held} />
                  </div>
                );
              })}
            </div>
          )}

          <p className="records-note star-shop-note">
            {'A star is earned by clearing a run with a hero in one of its Evolutions — three a hero, one a form. Spending one never takes it off the hero: the Compendium keeps every star you have ever earned.'}
          </p>
        </div>

        <TabStrip tabs={tabs} active={shelf} onSelect={setShelf} />
      </div>

      <div className="sheet-footer" onClick={(e) => e.stopPropagation()}>
        <button className="resolve-button sheet-close-button" onClick={onClose}>
          Close
        </button>
      </div>

      {openOffer?.grant.kind === 'location' && (
        <LocationPeekOverlay locationId={openOffer.grant.locationId} purchase={purchaseOf(openOffer)} onClose={() => setOpenOfferId(null)} />
      )}
      {openOffer?.grant.kind === 'heroBundle' && (
        <BundlePeekOverlay heroIds={openOffer.grant.heroIds} purchase={purchaseOf(openOffer)} onPeekHero={setDossierHeroId} onClose={() => setOpenOfferId(null)} />
      )}
      {dossierHero && <HeroDossierOverlay hero={dossierHero} onClose={() => setDossierHeroId(null)} />}
    </div>
  );
}

/** The price as a label, never a button: the Purchase is on the offer's own screen. */
export function CostBadge({ offer, held }: { offer: StarShopOffer; held: boolean }) {
  return <span className={`star-shop-offer-cost${held ? ' is-held' : ''}`}>{held ? 'Owned' : `★ ${offer.cost}`}</span>;
}

/** The one Purchase: on an offer's own screen, above Close. Disabled says why in its label. */
export function PurchaseButton({ purchase }: { purchase: OfferPurchase }) {
  const { offer, held, affordable, onBuy } = purchase;
  return (
    <button
      type="button"
      className="resolve-button sheet-close-button star-shop-purchase"
      data-sfx={held || !affordable ? 'none' : 'ui.commit'}
      disabled={held || !affordable}
      onClick={onBuy}
      aria-label={held ? `${offer.name}: owned` : affordable ? `Purchase ${offer.name} for ${offer.cost} ${offer.cost === 1 ? 'star' : 'stars'}` : `${offer.name} costs ${offer.cost} stars — not enough`}
    >
      {held ? 'Owned' : `Purchase · ★ ${offer.cost}`}
    </button>
  );
}

/** A line-up of faces, each its primary type's glyph under it, each a tap into the hero's dossier. */
function FaceRow({ heroIds, onPeekHero }: { heroIds: readonly string[]; onPeekHero: (heroId: string) => void }) {
  return (
    <span className="star-shop-bundle-faces">
      {heroIds.map((heroId) => {
        const hero = heroes[heroId];
        if (!hero) return null;
        return (
          <button
            type="button"
            key={heroId}
            className="star-shop-bundle-face"
            style={{ color: getTypeColor(hero.types[0]) }}
            onClick={(e) => {
              e.stopPropagation();
              onPeekHero(heroId);
            }}
            aria-label={`${hero.name} — view details`}
          >
            <HeroPortrait heroId={heroId} className="star-shop-bundle-portrait" />
            <span className="star-shop-bundle-face-type" aria-hidden="true">
              <ElementGlyph type={hero.types[0]} />
            </span>
          </button>
        );
      })}
    </span>
  );
}

/** A row that opens its offer's screen: a button in all but tag, since it holds inline glyphs and a badge. */
function OpenRow({ className, style, label, onOpen, children }: { className: string; style?: CSSProperties; label: string; onOpen: () => void; children: React.ReactNode }) {
  return (
    <div
      className={`star-shop-offer is-openable ${className}`}
      style={style}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      aria-label={label}
    >
      {children}
    </div>
  );
}

/** A Location's row is the place — tint, horizon, domains — and opens the place. */
function LocationRow({ offer, locationId, held, onOpen }: { offer: StarShopOffer; locationId: string; held: boolean; onOpen: () => void }) {
  const location = locations[locationId];
  const domains = location ? locationDomains(location) : null;
  return (
    <OpenRow className={`star-shop-place${held ? ' is-held' : ''}`} style={{ '--node-rgb': location?.tintRgb } as CSSProperties} label={`${offer.name} — look around`} onOpen={onOpen}>
      <span className="star-shop-place-scene" aria-hidden="true">
        <LocationHorizon locationId={locationId} />
      </span>
      <div className="star-shop-offer-body">
        <span className="star-shop-offer-name">{offer.name}</span>
        {domains && (
          <span className="star-shop-place-domains">
            {domains.map((type) => (
              <span key={type} className="star-shop-place-domain" style={{ color: getTypeColor(type) }} title={type}>
                <ElementGlyph type={type} />
              </span>
            ))}
          </span>
        )}
      </div>
      <CostBadge offer={offer} held={held} />
    </OpenRow>
  );
}

/** A bundle's row is the heroes — a line-up — and opens the bundle. The faces open nothing here; the bundle's own screen is where they are examined. */
function BundleRow({ offer, heroIds, held, onOpen }: { offer: StarShopOffer; heroIds: readonly string[]; held: boolean; onOpen: () => void }) {
  return (
    <OpenRow className={`star-shop-bundle${held ? ' is-held' : ''}`} label={`${offer.name} — see the heroes`} onOpen={onOpen}>
      <div className="star-shop-offer-body">
        <span className="star-shop-offer-name">{offer.name}</span>
        <span className="star-shop-bundle-faces" aria-hidden="true">
          {heroIds.map((heroId) => {
            const hero = heroes[heroId];
            if (!hero) return null;
            return (
              <span key={heroId} className="star-shop-bundle-face" style={{ color: getTypeColor(hero.types[0]) }}>
                <HeroPortrait heroId={heroId} className="star-shop-bundle-portrait" />
                <span className="star-shop-bundle-face-type">
                  <ElementGlyph type={hero.types[0]} />
                </span>
              </span>
            );
          })}
        </span>
      </div>
      <CostBadge offer={offer} held={held} />
    </OpenRow>
  );
}
