import { useState, type CSSProperties } from 'react';
import { STAR_SHOP_OFFERS, starShopCatalog } from '../../data/starShop';
import { locationDomains, locations } from '../../data/locations';
import { heroes } from '../../data/heroes';
import type { Profile } from '../../run/profile';
import { SUMMON_PRICE, canBuy, canSummon, offerHeld, offerWithdrawn, starBalance, starsEarned, starsSpent, summonPool, type StarShopGrant, type StarShopOffer } from '../../run/starShop';
import { HubGlyph } from '../shared/nodeIcons';
import { ElementGlyph } from '../shared/elementIcons';
import { LocationHorizon } from '../shared/locationArt';
import { HeroPortrait } from '../shared/HeroPortrait';
import { TabStrip, type TabSpec } from '../shared/TabStrip';
import { getTypeColor, getTypeColorRgb } from '../combat/typeColors';
import { HeroDossierOverlay } from './HeroDossierOverlay';
import { LocationPeekOverlay } from './LocationPeekOverlay';
import { BundlePeekOverlay } from './BundlePeekOverlay';

/** The shop's name, in one place: the title tile, this panel's header. The Constellation — the stars the Compendium charts, seen as one sky to draw on. */
export const STAR_SHOP_NAME = 'The Constellation';

type ShelfId = StarShopGrant['kind'];

/** One page per kind of grant. Counts come off the catalog, so an empty shelf greys on the strip. */
const SHELVES: readonly (TabSpec<ShelfId> & { empty: string })[] = [
  { id: 'hero', label: 'Heroes', glyph: 'recruit', empty: 'Every hero outside the base roster, one at a time.' },
  { id: 'heroBundle', label: 'Hero Bundles', glyph: 'heroes', empty: 'A bundle is a few heroes into the recruit pool — a fourth for a type, or a themed handful. None are written yet.' },
  { id: 'location', label: 'Locations', glyph: 'places', empty: 'A place the road can offer beside the base five: its own weather, its own spawn, its own warden.' },
];

interface Props {
  profile: Profile;
  /** Spends stars on the offer and hands back the profile to render. */
  onBuy: (offer: StarShopOffer) => void;
  /** One blind draw (run/starShop.ts summon); returns the hero drawn. */
  onSummon: () => string;
  onClose: () => void;
}

/** What an offer's own screen needs to say and do about buying it. */
export interface OfferPurchase {
  offer: StarShopOffer;
  held: boolean;
  /** A bundle part of which is already owned: its heroes are singles now. */
  withdrawn: boolean;
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
export function StarShopScreen({ profile, onBuy, onSummon, onClose }: Props) {
  const earned = starsEarned(profile);
  const spent = starsSpent(profile, starShopCatalog);
  const balance = starBalance(profile, starShopCatalog);
  const [shelf, setShelf] = useState<ShelfId>('hero');
  const [dossierHeroId, setDossierHeroId] = useState<string | null>(null);
  const [openOfferId, setOpenOfferId] = useState<string | null>(null);
  const [summonedHeroId, setSummonedHeroId] = useState<string | null>(null);

  const tabs = SHELVES.map((s) => ({ ...s, count: STAR_SHOP_OFFERS.filter((o) => o.grant.kind === s.id).length }));
  const open = SHELVES.find((s) => s.id === shelf)!;
  const offers = STAR_SHOP_OFFERS.filter((o) => o.grant.kind === shelf);
  const dossierHero = dossierHeroId ? heroes[dossierHeroId] : null;
  const openOffer = openOfferId ? starShopCatalog[openOfferId] : null;
  const purchaseOf = (offer: StarShopOffer): OfferPurchase => ({
    offer,
    held: offerHeld(profile, offer),
    withdrawn: offerWithdrawn(profile, offer),
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

          {shelf === 'hero' && (
            <SummonRow
              left={summonPool(profile).length}
              enabled={canSummon(profile, starShopCatalog)}
              onSummon={() => setSummonedHeroId(onSummon())}
            />
          )}

          {offers.length === 0 ? (
            <div className="star-shop-empty">
              <span className="star-shop-empty-title">Nothing on this shelf yet</span>
              <span className="star-shop-empty-note">{open.empty}</span>
            </div>
          ) : (
            <div className="star-shop-offers">
              {offers.map((offer) => {
                const held = offerHeld(profile, offer);
                if (offer.grant.kind === 'hero') {
                  return <HeroRow key={offer.id} offer={offer} heroId={offer.grant.heroId} held={held} onOpen={() => setOpenOfferId(offer.id)} />;
                }
                if (offer.grant.kind === 'location') {
                  return <LocationRow key={offer.id} offer={offer} locationId={offer.grant.locationId} held={held} onOpen={() => setOpenOfferId(offer.id)} />;
                }
                if (offer.grant.kind === 'heroBundle') {
                  return <BundleRow key={offer.id} offer={offer} heroIds={offer.grant.heroIds} held={held} withdrawn={offerWithdrawn(profile, offer)} onOpen={() => setOpenOfferId(offer.id)} />;
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
            {'A star is earned by clearing a run with a hero in one of its Evolutions — three a hero, one a form — and every clear pays a bonus on top, more on a harder rung. Spending one never takes it off the hero: the Compendium keeps every star you have ever earned.'}
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
      {openOffer?.grant.kind === 'hero' && (
        <BundlePeekOverlay heroIds={[openOffer.grant.heroId]} purchase={purchaseOf(openOffer)} onPeekHero={setDossierHeroId} onClose={() => setOpenOfferId(null)} />
      )}
      {summonedHeroId && <SummonReveal heroId={summonedHeroId} onPeekHero={setDossierHeroId} onClose={() => setSummonedHeroId(null)} />}
      {dossierHero && <HeroDossierOverlay hero={dossierHero} onClose={() => setDossierHeroId(null)} />}
    </div>
  );
}

/** The price as a label, never a button: the Purchase is on the offer's own screen. */
export function CostBadge({ offer, held, withdrawn = false }: { offer: StarShopOffer; held: boolean; withdrawn?: boolean }) {
  return <span className={`star-shop-offer-cost${held || withdrawn ? ' is-held' : ''}`}>{held ? 'Owned' : withdrawn ? 'Singles' : `★ ${offer.cost}`}</span>;
}

/** The one Purchase: on an offer's own screen, above Close. Disabled says why in its label. */
export function PurchaseButton({ purchase }: { purchase: OfferPurchase }) {
  const { offer, held, withdrawn, affordable, onBuy } = purchase;
  if (withdrawn) {
    return (
      <button type="button" className="resolve-button sheet-close-button star-shop-purchase" data-sfx="none" disabled>
        One is yours · buy the rest singly
      </button>
    );
  }
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
function BundleRow({ offer, heroIds, held, withdrawn, onOpen }: { offer: StarShopOffer; heroIds: readonly string[]; held: boolean; withdrawn: boolean; onOpen: () => void }) {
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
      <CostBadge offer={offer} held={held} withdrawn={withdrawn} />
    </OpenRow>
  );
}

/** One hero on its own: the face, the name, its types — and opens the hero's own screen with the Purchase. */
function HeroRow({ offer, heroId, held, onOpen }: { offer: StarShopOffer; heroId: string; held: boolean; onOpen: () => void }) {
  const hero = heroes[heroId];
  if (!hero) return null;
  return (
    <OpenRow className={`star-shop-bundle star-shop-hero${held ? ' is-held' : ''}`} label={`${hero.name} — see the hero`} onOpen={onOpen}>
      <span className="star-shop-bundle-face" style={{ color: getTypeColor(hero.types[0]) }} aria-hidden="true">
        <HeroPortrait heroId={heroId} className="star-shop-bundle-portrait" />
        <span className="star-shop-bundle-face-type">
          <ElementGlyph type={hero.types[0]} />
        </span>
      </span>
      <div className="star-shop-offer-body">
        <span className="star-shop-offer-name">{hero.name}</span>
        <span className="star-shop-hero-type" style={{ color: getTypeColor(hero.types[0]) }}>
          {hero.types.join(' / ')}
        </span>
      </div>
      <CostBadge offer={offer} held={held} />
    </OpenRow>
  );
}

/**
 * The Summoning (docs/collection.md §4): one hero the account does not own, drawn blind, under a
 * single hero's price. Never a duplicate, so it goes quiet only when there is nothing left to draw.
 */
function SummonRow({ left, enabled, onSummon }: { left: number; enabled: boolean; onSummon: () => void }) {
  return (
    <button type="button" className="star-shop-offer star-shop-summon" disabled={!enabled} data-sfx={enabled ? 'ui.commit' : 'none'} onClick={onSummon}>
      <span className="star-shop-summon-glyph" aria-hidden="true">
        <HubGlyph name="star" />
      </span>
      <div className="star-shop-offer-body">
        <span className="star-shop-offer-name">Summoning</span>
        <span className="star-shop-summon-note">{left === 0 ? 'Every hero is yours.' : `A hero you don't own, drawn blind · ${left} left`}</span>
      </div>
      <span className={`star-shop-offer-cost${left === 0 ? ' is-held' : ''}`}>★ {SUMMON_PRICE}</span>
    </button>
  );
}

/** What a Summoning drew: the hero, a tap into its dossier. */
function SummonReveal({ heroId, onPeekHero, onClose }: { heroId: string; onPeekHero: (heroId: string) => void; onClose: () => void }) {
  const hero = heroes[heroId];
  if (!hero) return null;
  return (
    <div className="detail-overlay is-sheet" onClick={onClose}>
      <div className="detail-panel bundle-peek-panel star-shop-reveal" onClick={(e) => e.stopPropagation()}>
        <div className="detail-header bundle-peek-head">
          <span className="detail-name">Summoned</span>
        </div>
        <div className="bundle-peek-boxes">
          <button
            type="button"
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
          </button>
        </div>
        <p className="records-note star-shop-reveal-note">In your Collection now. Swap it into your deck there.</p>
      </div>
      <div className="sheet-footer" onClick={(e) => e.stopPropagation()}>
        <button className="resolve-button sheet-close-button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
