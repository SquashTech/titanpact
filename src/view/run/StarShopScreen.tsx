import { useState, type CSSProperties } from 'react';
import { STAR_SHOP_OFFERS, starShopCatalog } from '../../data/starShop';
import { locationDomains, locations } from '../../data/locations';
import { heroes } from '../../data/heroes';
import type { Profile } from '../../run/profile';
import { bundleOwnedHeroIds, canBuy, canCallStarfall, offerHeld, offerPrice, starBalance, starfallPool, starsEarned, starsSpent, type StarShopOffer } from '../../run/starShop';
import { HubGlyph } from '../shared/nodeIcons';
import { ElementGlyph } from '../shared/elementIcons';
import { LocationHorizon } from '../shared/locationArt';
import { locationBackdrop } from '../shared/locationBackdrops';
import { HeroPortrait } from '../shared/HeroPortrait';
import { TabStrip, type TabSpec } from '../shared/TabStrip';
import { getTypeColor } from '../combat/typeColors';
import { HeroDossierOverlay } from './HeroDossierOverlay';
import { LocationPeekOverlay } from './LocationPeekOverlay';
import { BundlePeekOverlay } from './BundlePeekOverlay';
import { HeroStarsPage, SpawnStarsPage } from './StarPages';
import { StarfallCard, StarfallScreen } from './Starfall';

/** The shop's name, in one place: the title tile, this panel's header. The Constellation — every star earned, charted, and the sky they are spent on. */
export const STAR_SHOP_NAME = 'The Constellation';

type ShelfId = 'heroes' | 'places' | 'stars' | 'spawn';

/** The two shelves stars are spent on, then the two pages that chart where they were earned. No hero is sold singly. */
const SHELVES: readonly (TabSpec<ShelfId> & { grant?: StarShopOffer['grant']['kind']; empty?: string })[] = [
  { id: 'heroes', label: 'Heroes', glyph: 'heroes', grant: 'heroBundle' },
  { id: 'places', label: 'Locations', glyph: 'places', grant: 'location', empty: 'A place the road can offer beside the base five: its own weather, its own spawn, its own warden.' },
  { id: 'stars', label: 'Stars', glyph: 'stars' },
  { id: 'spawn', label: 'Spawn', glyph: 'spawn' },
];

interface Props {
  profile: Profile;
  /** Spends stars on the offer and hands back the profile to render. */
  onBuy: (offer: StarShopOffer) => void;
  /** One Starfall (run/starShop.ts starfall), written to the profile; returns the hero drawn. */
  onStarfall: () => string;
  onClose: () => void;
}

/** What an offer's own screen needs to say and do about buying it. */
export interface OfferPurchase {
  offer: StarShopOffer;
  held: boolean;
  /** What it costs this profile now — a bundle less the heroes already owned. */
  price: number;
  affordable: boolean;
  onBuy: () => void;
}

/**
 * Where stars are spent (run/starShop.ts) and where they are charted; the deck is dressed in the
 * Collection. The balance leads — the star and the count — then the page the strip has open. The
 * Heroes page is the Starfall, a seat for Alignments, and the bundles.
 * Bundles and Locations are rows that OPEN: a bundle's row is a line-up and a place's row is a
 * scene, and tapping either brings up its own screen, where the heroes can be examined and the
 * place looked around — and where the one Purchase button is. Nothing on a shelf row spends a
 * star; the cost on it is a label. Tabs at the foot, in the thumb's arc.
 */
export function StarShopScreen({ profile, onBuy, onStarfall, onClose }: Props) {
  const earned = starsEarned(profile);
  const spent = starsSpent(profile, starShopCatalog);
  const balance = starBalance(profile, starShopCatalog);
  const [shelf, setShelf] = useState<ShelfId>('heroes');
  const [dossierHeroId, setDossierHeroId] = useState<string | null>(null);
  const [openOfferId, setOpenOfferId] = useState<string | null>(null);
  const [fallen, setFallen] = useState<{ heroId: string; balanceBefore: number } | null>(null);

  const tabs = SHELVES.map((s) => (s.id === 'places' ? { ...s, count: STAR_SHOP_OFFERS.filter((o) => o.grant.kind === s.grant).length } : s));
  const open = SHELVES.find((s) => s.id === shelf)!;
  const offers = open.grant ? STAR_SHOP_OFFERS.filter((o) => o.grant.kind === open.grant) : [];
  const dossierHero = dossierHeroId ? heroes[dossierHeroId] : null;
  const openOffer = openOfferId ? starShopCatalog[openOfferId] : null;
  const purchaseOf = (offer: StarShopOffer): OfferPurchase => ({
    offer,
    held: offerHeld(profile, offer),
    price: offerPrice(profile, offer),
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

          {shelf === 'heroes' && (
            <>
              <StarfallCard
                pool={starfallPool(profile)}
                enabled={canCallStarfall(profile, starShopCatalog)}
                onCall={() => setFallen({ balanceBefore: balance, heroId: onStarfall() })}
                onPeekHero={setDossierHeroId}
              />
              {/* A seat for curated Starfalls (docs/collection.md §4, PROPOSED): none are authored. */}
              <div className="tab-subhead star-shop-section-head">Alignments</div>
              <div className="star-shop-empty star-shop-alignments">
                <span className="star-shop-empty-title">No stars are aligned</span>
                <span className="star-shop-empty-note">Now and then the sky lines up over a chosen few, and a Starfall under it draws only from them.</span>
              </div>
              <div className="tab-subhead star-shop-section-head">Bundles</div>
            </>
          )}

          {shelf === 'stars' ? (
            <HeroStarsPage profile={profile} />
          ) : shelf === 'spawn' ? (
            <SpawnStarsPage profile={profile} />
          ) : offers.length === 0 ? (
            <div className="star-shop-empty">
              <span className="star-shop-empty-title">Nothing on this shelf yet</span>
              <span className="star-shop-empty-note">{open.empty}</span>
            </div>
          ) : (
            <div className="star-shop-offers">
              {offers.map((offer) => {
                const held = offerHeld(profile, offer);
                if (offer.grant.kind === 'location') {
                  return <LocationRow key={offer.id} offer={offer} locationId={offer.grant.locationId} held={held} onOpen={() => setOpenOfferId(offer.id)} />;
                }
                if (offer.grant.kind === 'heroBundle') {
                  return (
                    <BundleRow
                      key={offer.id}
                      offer={offer}
                      heroIds={offer.grant.heroIds}
                      ownedIds={bundleOwnedHeroIds(profile, offer)}
                      price={offerPrice(profile, offer)}
                      held={held}
                      onOpen={() => setOpenOfferId(offer.id)}
                    />
                  );
                }
                return null;
              })}
            </div>
          )}

          {shelf === 'stars' && (
            <p className="records-note star-shop-note">
              {'A star is earned by clearing a run with a hero in one of its Evolutions — three a hero, one a form — and every clear pays a bonus on top, more on a harder rung. Spending one never takes it off this page.'}
            </p>
          )}
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
        <BundlePeekOverlay
          heroIds={openOffer.grant.heroIds}
          ownedIds={bundleOwnedHeroIds(profile, openOffer)}
          purchase={purchaseOf(openOffer)}
          onPeekHero={setDossierHeroId}
          onClose={() => setOpenOfferId(null)}
        />
      )}
      {fallen && <StarfallScreen heroId={fallen.heroId} balanceBefore={fallen.balanceBefore} onClose={() => setFallen(null)} />}
      {dossierHero && <HeroDossierOverlay hero={dossierHero} onClose={() => setDossierHeroId(null)} />}
    </div>
  );
}

/** The price as a label, never a button: the Purchase is on the offer's own screen. A discounted bundle shows its full price struck beside it. */
export function CostBadge({ offer, held, price = offer.cost }: { offer: StarShopOffer; held: boolean; price?: number }) {
  if (held) return <span className="star-shop-offer-cost is-held">Owned</span>;
  return (
    <span className={`star-shop-offer-cost${price < offer.cost ? ' is-discounted' : ''}`}>
      {price < offer.cost && <s className="star-shop-offer-was">{offer.cost}</s>}★ {price}
    </span>
  );
}

/** The one Purchase: on an offer's own screen, above Close. Disabled says why in its label. */
export function PurchaseButton({ purchase }: { purchase: OfferPurchase }) {
  const { offer, held, price, affordable, onBuy } = purchase;
  return (
    <button
      type="button"
      className="resolve-button sheet-close-button star-shop-purchase"
      data-sfx={held || !affordable ? 'none' : 'ui.commit'}
      disabled={held || !affordable}
      onClick={onBuy}
      aria-label={held ? `${offer.name}: owned` : affordable ? `Purchase ${offer.name} for ${price} ${price === 1 ? 'star' : 'stars'}` : `${offer.name} costs ${price} stars — not enough`}
    >
      {held ? 'Owned' : `Purchase · ★ ${price}`}
    </button>
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
  const backdrop = locationBackdrop(locationId);
  return (
    <OpenRow className={`star-shop-place${held ? ' is-held' : ''}`} style={{ '--node-rgb': location?.tintRgb } as CSSProperties} label={`${offer.name} — look around`} onOpen={onOpen}>
      <span className={`star-shop-place-scene${backdrop ? ' has-backdrop' : ''}`} aria-hidden="true">
        {backdrop ? <img className="location-backdrop" src={backdrop} alt="" draggable={false} /> : <LocationHorizon locationId={locationId} />}
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

/** A bundle's row is the heroes — a line-up, the ones already owned marked — and opens the bundle. */
function BundleRow({
  offer,
  heroIds,
  ownedIds,
  price,
  held,
  onOpen,
}: {
  offer: StarShopOffer;
  heroIds: readonly string[];
  ownedIds: readonly string[];
  price: number;
  held: boolean;
  onOpen: () => void;
}) {
  return (
    <OpenRow className={`star-shop-bundle${held ? ' is-held' : ''}`} label={`${offer.name} — see the heroes`} onOpen={onOpen}>
      <div className="star-shop-offer-body">
        <span className="star-shop-offer-name">{offer.name}</span>
        <span className="star-shop-bundle-faces" aria-hidden="true">
          {heroIds.map((heroId) => {
            const hero = heroes[heroId];
            if (!hero) return null;
            return (
              <span key={heroId} className={`star-shop-bundle-face${!held && ownedIds.includes(heroId) ? ' is-owned' : ''}`} style={{ color: getTypeColor(hero.types[0]) }}>
                <HeroPortrait heroId={heroId} className="star-shop-bundle-portrait" />
                <span className="star-shop-bundle-face-type">
                  <ElementGlyph type={hero.types[0]} />
                </span>
              </span>
            );
          })}
        </span>
        {!held && ownedIds.length > 0 && <span className="star-shop-bundle-owned">{ownedIds.length} of {heroIds.length} already yours</span>}
      </div>
      <CostBadge offer={offer} held={held} price={price} />
    </OpenRow>
  );
}
