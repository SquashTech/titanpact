import { useState, type CSSProperties } from 'react';
import { STAR_SHOP_OFFERS, starShopCatalog } from '../../data/starShop';
import { locationDomains, locations } from '../../data/locations';
import { heroes } from '../../data/heroes';
import type { Profile } from '../../run/profile';
import { ownsHero } from '../../run/recruitment';
import { STARFALL_PRICE, bundleOwnedHeroIds, canBuy, canCallStarfall, offerHeld, offerPrice, starBalance, starfallPool, starsEarned, starsSpent, type StarShopOffer } from '../../run/starShop';
import { HubGlyph } from '../shared/nodeIcons';
import { ElementGlyph } from '../shared/elementIcons';
import { LocationHorizon } from '../shared/locationArt';
import { locationBackdrop } from '../shared/locationBackdrops';
import { HeroPortrait } from '../shared/HeroPortrait';
import { getTypeColor, getTypeColorRgb } from '../combat/typeColors';
import { HeroDossierOverlay } from './HeroDossierOverlay';
import { LocationPeekOverlay } from './LocationPeekOverlay';
import { BundlePeekOverlay } from './BundlePeekOverlay';
import { HeroStarsPage, SpawnStarsPage } from './StarPages';
import { STARFALL_NAME, StarfallScreen } from './Starfall';
import { SKY_HERO_COUNT, StarSky } from './StarSky';
import { HubPageHead, HubSubtabs, type SubtabSpec } from './hubChrome';

/** The shop's name, in one place: the hub tab, this page's head. The Constellation — every star earned, charted, and the sky they are spent on. */
export const STAR_SHOP_NAME = 'The Constellation';

type SectionId = 'sky' | 'shop' | 'stars' | 'spawn';

interface Props {
  profile: Profile;
  /** Spends stars on the offer and hands back the profile to render. */
  onBuy: (offer: StarShopOffer) => void;
  /** One Starfall (run/starShop.ts starfall), written to the profile; returns the hero drawn. */
  onStarfall: () => string;
  /** A Starfall's hero once its scene closes — the hub marks it new in the Collection. */
  onHeroFallen: (heroId: string) => void;
  /** The last hero fallen this session; its star flares in the sky. */
  freshHeroId: string | null;
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
 * The Constellation, a hub page (run/starShop.ts): where stars are spent and charted. Its first
 * section is the sky itself — every hero a star, the owned ones lit — with the Lodestar at its
 * centre, which calls the Starfall. The Market holds the bundles and the Locations; Stars and
 * Spawn chart where stars were earned. Nothing on a Market row spends a star: rows open the
 * offer's own screen, where the one Purchase button is.
 */
export function StarShopScreen({ profile, onBuy, onStarfall, onHeroFallen, freshHeroId }: Props) {
  const earned = starsEarned(profile);
  const spent = starsSpent(profile, starShopCatalog);
  const balance = starBalance(profile, starShopCatalog);
  const [section, setSection] = useState<SectionId>('sky');
  const [dossierHeroId, setDossierHeroId] = useState<string | null>(null);
  const [openOfferId, setOpenOfferId] = useState<string | null>(null);
  const [fallen, setFallen] = useState<{ heroId: string; balanceBefore: number } | null>(null);
  const [showPool, setShowPool] = useState(false);

  const pool = starfallPool(profile);
  const lit = Object.values(heroes).filter((hero) => ownsHero(hero.id, hero, profile.purchases)).length;
  const canCall = canCallStarfall(profile, starShopCatalog);
  const bundles = STAR_SHOP_OFFERS.filter((o) => o.grant.kind === 'heroBundle');
  const places = STAR_SHOP_OFFERS.filter((o) => o.grant.kind === 'location');
  const dossierHero = dossierHeroId ? heroes[dossierHeroId] : null;
  const openOffer = openOfferId ? starShopCatalog[openOfferId] : null;
  const purchaseOf = (offer: StarShopOffer): OfferPurchase => ({
    offer,
    held: offerHeld(profile, offer),
    price: offerPrice(profile, offer),
    affordable: canBuy(profile, starShopCatalog, offer),
    onBuy: () => onBuy(offer),
  });

  const sections: readonly SubtabSpec<SectionId>[] = [
    { id: 'sky', label: STARFALL_NAME },
    { id: 'shop', label: 'Market' },
    { id: 'stars', label: 'Stars' },
    { id: 'spawn', label: 'Spawn' },
  ];

  function call() {
    if (!canCall) return;
    setFallen({ balanceBefore: balance, heroId: onStarfall() });
  }

  return (
    <div className="hub-page sky-page">
      <div className="sky-backdrop" aria-hidden="true">
        <span className="sky-nebula is-a" />
        <span className="sky-nebula is-b" />
        <span className="sky-field is-far" />
        <span className="sky-field is-near" />
        <span className="sky-meteor is-a" />
        <span className="sky-meteor is-b" />
        <span className="sky-meteor is-c" />
      </div>

      <HubPageHead title={STAR_SHOP_NAME} balance={balance} />
      <HubSubtabs tabs={sections} active={section} onSelect={setSection} />

      <div key={section} className={`hub-body sky-body is-${section}`}>
        {section === 'sky' && (
          <>
            <StarSky purchases={profile.purchases} freshId={freshHeroId} onPeekHero={setDossierHeroId}>
              <button
                type="button"
                className={`lodestar${canCall ? ' is-ready' : ''}`}
                data-sfx={canCall ? 'ui.commit' : 'ui.denied'}
                onClick={call}
                aria-label={canCall ? `Call to the stars for ${STARFALL_PRICE} stars` : 'Not enough stars to call one'}
              >
                <span className="lodestar-rays" aria-hidden="true" />
                <span className="lodestar-halo" aria-hidden="true" />
                <span className="lodestar-core" aria-hidden="true">
                  <HubGlyph name="star" />
                </span>
              </button>
            </StarSky>

            <div className="sky-tally">
              <span className="sky-tally-count">{lit}</span>
              <span className="sky-tally-of"> / {SKY_HERO_COUNT} heroes owned</span>
            </div>

            <button type="button" className="sky-call" disabled={!canCall} data-sfx={canCall ? 'ui.commit' : 'none'} onClick={call}>
              <span className="sky-call-sheen" aria-hidden="true" />
              <span className="sky-call-label">{pool.length === 0 ? 'The sky is quiet' : 'Call to the Stars'}</span>
              {pool.length > 0 && (
                <span className="sky-call-price">
                  <HubGlyph name="star" />
                  {STARFALL_PRICE}
                </span>
              )}
            </button>
            <p className="sky-hint">
              {pool.length === 0
                ? 'Every hero is yours.'
                : balance < STARFALL_PRICE
                  ? `${STARFALL_PRICE - balance} more ${STARFALL_PRICE - balance === 1 ? 'star' : 'stars'} to call one down. Clear a run to earn them.`
                  : 'A hero you don’t own falls into your Collection.'}
            </p>

            {pool.length > 0 && (
              <button type="button" className="sky-pool-toggle" aria-expanded={showPool} onClick={() => setShowPool((v) => !v)}>
                {showPool ? 'Hide who is left' : `Still undiscovered · ${pool.length}`}
                <span className={`sky-pool-chevron${showPool ? ' is-open' : ''}`} aria-hidden="true">
                  ▾
                </span>
              </button>
            )}
            {showPool && (
              <div className="sky-pool">
                {pool.map((id) => {
                  const hero = heroes[id];
                  if (!hero) return null;
                  return (
                    <button
                      key={id}
                      type="button"
                      className="sky-pool-face"
                      style={{ '--type-rgb': getTypeColorRgb(hero.types[0]) } as CSSProperties}
                      onClick={() => setDossierHeroId(id)}
                      aria-label={`${hero.name} — view details`}
                    >
                      <HeroPortrait heroId={id} className="sky-pool-portrait" />
                      <span className="sky-pool-name">{hero.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {section === 'shop' && (
          <>
            <div className="hub-section-head">Bundles</div>
            <div className="star-shop-offers">
              {bundles.map((offer) =>
                offer.grant.kind === 'heroBundle' ? (
                  <BundleRow
                    key={offer.id}
                    offer={offer}
                    heroIds={offer.grant.heroIds}
                    ownedIds={bundleOwnedHeroIds(profile, offer)}
                    price={offerPrice(profile, offer)}
                    held={offerHeld(profile, offer)}
                    onOpen={() => setOpenOfferId(offer.id)}
                  />
                ) : null
              )}
            </div>
            {/* A seat for curated Starfalls (docs/collection.md §4, PROPOSED): none are authored. */}
            <div className="hub-section-head">Alignments</div>
            <div className="star-shop-empty star-shop-alignments">
              <span className="star-shop-empty-title">No stars are aligned</span>
              <span className="star-shop-empty-note">Now and then the sky lines up over a chosen few, and a Starfall under it draws only from them.</span>
            </div>
            <div className="hub-section-head">Locations</div>
            <div className="star-shop-offers">
              {places.map((offer) =>
                offer.grant.kind === 'location' ? (
                  <LocationRow key={offer.id} offer={offer} locationId={offer.grant.locationId} held={offerHeld(profile, offer)} onOpen={() => setOpenOfferId(offer.id)} />
                ) : null
              )}
            </div>
          </>
        )}

        {section === 'stars' && (
          <>
            <div className="star-shop-balance">
              <span className="star-shop-balance-ledger">
                {earned} earned · {spent} spent
              </span>
            </div>
            <HeroStarsPage profile={profile} />
            <p className="records-note star-shop-note">
              {'One star is earned by winning a run with an evolved hero. The star can only be earned one time per evolution.'}
            </p>
          </>
        )}

        {section === 'spawn' && <SpawnStarsPage profile={profile} />}
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
      {fallen && (
        <StarfallScreen
          heroId={fallen.heroId}
          balanceBefore={fallen.balanceBefore}
          onClose={() => {
            onHeroFallen(fallen.heroId);
            setFallen(null);
            setShowPool(false);
          }}
        />
      )}
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
