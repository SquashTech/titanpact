import { useState, type CSSProperties, type ReactNode } from 'react';
import { STAR_SHOP_OFFERS, starShopCatalog } from '../../data/starShop';
import { STARTER_PACKS } from '../../data/starterPacks';
import { locationDomains, locations } from '../../data/locations';
import { heroes } from '../../data/heroes';
import { totalStars, type Profile } from '../../run/profile';
import { canBuy, isPurchased, starBalance, starsSpent, type StarShopGrant, type StarShopOffer } from '../../run/starShop';
import { equippedPack, packHeld, type StarterPack } from '../../run/starterPacks';
import { HubGlyph } from '../shared/nodeIcons';
import { ElementGlyph } from '../shared/elementIcons';
import { LocationHorizon } from '../shared/locationArt';
import { HeroPortrait } from '../shared/HeroPortrait';
import { TabStrip, type TabSpec } from '../shared/TabStrip';
import { getTypeColor } from '../combat/typeColors';
import { HeroDossierOverlay } from './HeroDossierOverlay';
import { LocationPeekOverlay } from './LocationPeekOverlay';

/** The shop's name, in one place: the title tile, this panel's header. The Constellation — the stars the Compendium charts, seen as one sky to draw on. */
export const STAR_SHOP_NAME = 'The Constellation';

type ShelfId = StarShopGrant['kind'];

/** One page per kind of grant. Counts come off the catalog, so an empty shelf greys on the strip. */
const SHELVES: readonly (TabSpec<ShelfId> & { empty: string })[] = [
  { id: 'starterPack', label: 'Starter Packs', glyph: 'packs', empty: 'A pack is a fresh set of heroes to draft from — eight or more, equipped here for the next run.' },
  { id: 'heroBundle', label: 'Hero Bundles', glyph: 'heroes', empty: 'A bundle is a few heroes into the recruit pool — a fourth for a type, or a themed handful. None are written yet.' },
  { id: 'location', label: 'Locations', glyph: 'places', empty: 'A place the road can offer beside the base five: its own weather, its own spawn, its own warden.' },
];

interface Props {
  profile: Profile;
  /** Spends stars on the offer and hands back the profile to render. */
  onBuy: (offer: StarShopOffer) => void;
  /** Equips a held Starter Pack for the next run — free, reversible. */
  onEquipPack: (packId: string) => void;
  onClose: () => void;
}

/**
 * Where stars are spent (run/starShop.ts) and the draft is dressed (run/starterPacks.ts). The
 * balance leads — earned, spent, left — then the shelf the strip has open. Starter Packs are a
 * radio: pack zero and every pack held, one equipped; a pack not yet held says what opens it.
 * Bundles and Locations are offers with a price and one Buy. Everything on a shelf can be looked
 * at before it is paid for: a hero's face opens its dossier, a place's row opens the place —
 * what a star buys should be read, not guessed. The Compendium's sheet (CompendiumScreen),
 * tabs at the foot.
 */
export function StarShopScreen({ profile, onBuy, onEquipPack, onClose }: Props) {
  const earned = totalStars(profile);
  const spent = starsSpent(profile, starShopCatalog);
  const balance = starBalance(profile, starShopCatalog);
  const [shelf, setShelf] = useState<ShelfId>('starterPack');
  const [dossierHeroId, setDossierHeroId] = useState<string | null>(null);
  const [peekLocationId, setPeekLocationId] = useState<string | null>(null);

  const tabs = SHELVES.map((s) => ({ ...s, count: s.id === 'starterPack' ? STARTER_PACKS.length : STAR_SHOP_OFFERS.filter((o) => o.grant.kind === s.id).length }));
  const open = SHELVES.find((s) => s.id === shelf)!;
  const offers = STAR_SHOP_OFFERS.filter((o) => o.grant.kind === shelf);
  const equipped = equippedPack(profile, STARTER_PACKS);
  const dossierHero = dossierHeroId ? heroes[dossierHeroId] : null;

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

          {shelf === 'starterPack' ? (
            <div className="star-shop-offers">
              {STARTER_PACKS.map((pack) => (
                <PackRow
                  key={pack.id}
                  pack={pack}
                  held={packHeld(profile, pack)}
                  equipped={pack.id === equipped.id}
                  onEquip={() => onEquipPack(pack.id)}
                  onPeekHero={setDossierHeroId}
                />
              ))}
            </div>
          ) : offers.length === 0 ? (
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
                    onClick={(e) => {
                      e.stopPropagation();
                      onBuy(offer);
                    }}
                    aria-label={held ? `${offer.name}: owned` : `Buy ${offer.name} for ${offer.cost} ${offer.cost === 1 ? 'star' : 'stars'}`}
                  >
                    {held ? 'Owned' : `★ ${offer.cost}`}
                  </button>
                );
                if (offer.grant.kind === 'location') {
                  const { locationId } = offer.grant;
                  return <LocationOffer key={offer.id} offer={offer} locationId={locationId} held={held} buy={buy} onPeek={() => setPeekLocationId(locationId)} />;
                }
                if (offer.grant.kind === 'heroBundle') {
                  return <BundleOffer key={offer.id} offer={offer} heroIds={offer.grant.heroIds} held={held} buy={buy} onPeekHero={setDossierHeroId} />;
                }
                return (
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
            {shelf === 'starterPack'
              ? 'The equipped pack is what the next run drafts from — four of it shown, two taken. Equipping costs nothing and can be changed before any run.'
              : 'A star is earned by clearing a run with a hero in one of its Evolutions — three a hero, one a form. Spending one never takes it off the hero: the Compendium keeps every star you have ever earned.'}
          </p>
        </div>

        <TabStrip tabs={tabs} active={shelf} onSelect={setShelf} />
      </div>

      <div className="sheet-footer" onClick={(e) => e.stopPropagation()}>
        <button className="resolve-button sheet-close-button" onClick={onClose}>
          Close
        </button>
      </div>

      {dossierHero && <HeroDossierOverlay hero={dossierHero} onClose={() => setDossierHeroId(null)} />}
      {peekLocationId && <LocationPeekOverlay locationId={peekLocationId} onClose={() => setPeekLocationId(null)} />}
    </div>
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

/**
 * A Starter Pack's row: the heroes it drafts from, and one of three states on the right —
 * Equipped, Equip, or what opens it. A locked pack still shows its faces: the point of the shelf
 * is to see what a clear is for.
 */
function PackRow({ pack, held, equipped, onEquip, onPeekHero }: { pack: StarterPack; held: boolean; equipped: boolean; onEquip: () => void; onPeekHero: (heroId: string) => void }) {
  const lock = pack.unlock?.kind === 'clear' ? 'Opens with your first cleared run' : pack.unlock ? 'Not yet held' : null;
  return (
    <div className={`star-shop-offer star-shop-pack${equipped ? ' is-equipped' : ''}${held ? '' : ' is-locked'}`}>
      <div className="star-shop-offer-body">
        <span className="star-shop-offer-name">{pack.name}</span>
        <span className="star-shop-offer-desc">{pack.description}</span>
        <FaceRow heroIds={pack.heroIds} onPeekHero={onPeekHero} />
        {!held && lock && <span className="star-shop-pack-lock">{lock}</span>}
      </div>
      <button
        type="button"
        className="star-shop-offer-buy"
        data-sfx={equipped || !held ? 'none' : 'ui.commit'}
        disabled={equipped || !held}
        onClick={onEquip}
        aria-pressed={equipped}
        aria-label={equipped ? `${pack.name}: equipped` : held ? `Equip ${pack.name}` : `${pack.name}: ${lock ?? 'locked'}`}
      >
        {equipped ? 'Equipped' : held ? 'Equip' : 'Locked'}
      </button>
    </div>
  );
}

/**
 * A Location's offer is drawn as the place: its tint on the row, its horizon behind the text,
 * its domains lit — the same three things the choice screen's card reads. What is sold is a
 * scene, so the row is one, and tapping it opens the scene full size.
 */
function LocationOffer({ offer, locationId, held, buy, onPeek }: { offer: StarShopOffer; locationId: string; held: boolean; buy: ReactNode; onPeek: () => void }) {
  const location = locations[locationId];
  const domains = location ? locationDomains(location) : null;
  return (
    <div
      className={`star-shop-offer star-shop-place is-peekable${held ? ' is-held' : ''}`}
      style={{ '--node-rgb': location?.tintRgb } as CSSProperties}
      role="button"
      tabIndex={0}
      onClick={onPeek}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onPeek();
      }}
      aria-label={`${offer.name} — look around`}
    >
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

/** A bundle's offer is drawn as the heroes: a line-up, each face a tap into its dossier. What is sold is people, so the row is who. */
function BundleOffer({ offer, heroIds, held, buy, onPeekHero }: { offer: StarShopOffer; heroIds: readonly string[]; held: boolean; buy: ReactNode; onPeekHero: (heroId: string) => void }) {
  return (
    <div className={`star-shop-offer star-shop-bundle${held ? ' is-held' : ''}`}>
      <div className="star-shop-offer-body">
        <span className="star-shop-offer-name">{offer.name}</span>
        <span className="star-shop-offer-desc">{offer.description}</span>
        <FaceRow heroIds={heroIds} onPeekHero={onPeekHero} />
      </div>
      {buy}
    </div>
  );
}
