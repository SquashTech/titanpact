import { useState, type CSSProperties, type ReactNode } from 'react';
import { STAR_SHOP_OFFERS, starShopCatalog } from '../../data/starShop';
import { locationDomains, locations } from '../../data/locations';
import { totalStars, type Profile } from '../../run/profile';
import { canBuy, isPurchased, starBalance, starsSpent, type StarShopGrant, type StarShopOffer } from '../../run/starShop';
import { HubGlyph } from '../shared/nodeIcons';
import { ElementGlyph } from '../shared/elementIcons';
import { LocationHorizon } from '../shared/locationArt';
import { TabStrip, type TabSpec } from '../shared/TabStrip';
import { getTypeColor } from '../combat/typeColors';

/** The shop's name, in one place: the title tile, this panel's header. The Constellation — the stars the Compendium charts, seen as one sky to draw on. */
export const STAR_SHOP_NAME = 'The Constellation';

type ShelfId = StarShopGrant['kind'];

/** One page per kind of grant. Counts come off the catalog, so an empty shelf greys on the strip. */
const SHELVES: readonly (TabSpec<ShelfId> & { empty: string })[] = [
  { id: 'starterPack', label: 'Starter Packs', glyph: 'packs', empty: 'A pack is a fresh set of heroes to draft from — eight or more, bought once and equipped from the title. None are written yet.' },
  { id: 'heroBundle', label: 'Hero Bundles', glyph: 'heroes', empty: 'A bundle is a few heroes into the recruit pool — a fourth for a type, or a themed handful. None are written yet.' },
  { id: 'location', label: 'Locations', glyph: 'places', empty: 'A place the road can offer beside the base five: its own weather, its own spawn, its own warden.' },
];

interface Props {
  profile: Profile;
  /** Spends stars on the offer and hands back the profile to render. */
  onBuy: (offer: StarShopOffer) => void;
  onClose: () => void;
}

/**
 * Where stars are spent (run/starShop.ts). The balance leads — earned, spent, left — then the
 * shelf the strip has open: Starter Packs, Hero Bundles, Locations, each an offer per row with
 * its price and one Buy. A Location's row is the place itself — its horizon and tint, the way the
 * choice screen draws it — since what is being bought is a scene. The Compendium's sheet
 * (CompendiumScreen), tabs at the foot.
 */
export function StarShopScreen({ profile, onBuy, onClose }: Props) {
  const earned = totalStars(profile);
  const spent = starsSpent(profile, starShopCatalog);
  const balance = starBalance(profile, starShopCatalog);
  // Opens on the first stocked shelf, so the first visit lands on something to buy.
  const [shelf, setShelf] = useState<ShelfId>(() => SHELVES.find((s) => STAR_SHOP_OFFERS.some((o) => o.grant.kind === s.id))?.id ?? 'starterPack');

  const tabs = SHELVES.map((s) => ({ ...s, count: STAR_SHOP_OFFERS.filter((o) => o.grant.kind === s.id).length }));
  const open = SHELVES.find((s) => s.id === shelf)!;
  const offers = STAR_SHOP_OFFERS.filter((o) => o.grant.kind === shelf);

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
          {/* The balance as the thing itself: one big star and the count, the ledger under it. */}
          <div className="star-shop-balance">
            <span className="star-shop-balance-star" aria-hidden="true">
              <HubGlyph name="star" />
            </span>
            <span className="star-shop-balance-count">{balance}</span>
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
                const affordable = canBuy(profile, starShopCatalog, offer);
                const buy = (
                  <button
                    type="button"
                    className="star-shop-offer-buy"
                    data-sfx={held ? 'none' : 'ui.commit'}
                    disabled={held || !affordable}
                    onClick={() => onBuy(offer)}
                    aria-label={held ? `${offer.name}: owned` : `Buy ${offer.name} for ${offer.cost} ${offer.cost === 1 ? 'star' : 'stars'}`}
                  >
                    {held ? 'Owned' : `★ ${offer.cost}`}
                  </button>
                );
                return offer.grant.kind === 'location' ? (
                  <LocationOffer key={offer.id} offer={offer} locationId={offer.grant.locationId} held={held} buy={buy} />
                ) : (
                  <div key={offer.id} className={`star-shop-offer${held ? ' is-held' : ''}`}>
                    <div className="star-shop-offer-body">
                      <span className="star-shop-offer-name">{offer.name}</span>
                      <span className="star-shop-offer-desc">{offer.description}</span>
                    </div>
                    {buy}
                  </div>
                );
              })}
            </div>
          )}

          <p className="records-note star-shop-note">
            A star is earned by clearing a run with a hero in one of its Evolutions — three a hero, one a form. Spending one never
            takes it off the hero: the Compendium keeps every star you have ever earned.
          </p>
        </div>

        <TabStrip tabs={tabs} active={shelf} onSelect={setShelf} />
      </div>

      <div className="sheet-footer" onClick={(e) => e.stopPropagation()}>
        <button className="resolve-button sheet-close-button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

/**
 * A Location's offer is drawn as the place: its tint on the row, its horizon behind the text,
 * its domains lit — the same three things the choice screen's card reads. What is sold is a
 * scene, so the row is one.
 */
function LocationOffer({ offer, locationId, held, buy }: { offer: StarShopOffer; locationId: string; held: boolean; buy: ReactNode }) {
  const location = locations[locationId];
  const domains = location ? locationDomains(location) : null;
  return (
    <div className={`star-shop-offer star-shop-place${held ? ' is-held' : ''}`} style={{ '--node-rgb': location?.tintRgb } as CSSProperties}>
      <span className="star-shop-place-scene" aria-hidden="true">
        <LocationHorizon locationId={locationId} />
      </span>
      <div className="star-shop-offer-body">
        <span className="star-shop-offer-name">{offer.name}</span>
        <span className="star-shop-offer-desc">{offer.description}</span>
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
      {buy}
    </div>
  );
}
