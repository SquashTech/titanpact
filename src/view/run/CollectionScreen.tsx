import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { heroes } from '../../data/heroes';
import { TYPES } from '../../data/typechart';
import { progressionTable } from '../../data/progression';
import { starShopCatalog } from '../../data/starShop';
import type { HeroDefinition, TypeId } from '../../engine/content';
import type { Profile } from '../../run/profile';
import { draftableTypes, profileDeck, reserveOfType, swapIntoDeck, type Deck } from '../../run/deck';
import { heroOfferId, ownsHero } from '../../run/recruitment';
import { canBuy, starBalance, type StarShopOffer } from '../../run/starShop';
import { getTypeColor, getTypeColorRgb } from '../combat/typeColors';
import { ElementGlyph } from '../shared/elementIcons';
import { EvolutionStar } from '../shared/EvolutionStar';
import { HeroPortrait } from '../shared/HeroPortrait';
import { HubGlyph } from '../shared/nodeIcons';
import { HeroDossierOverlay } from './HeroDossierOverlay';

interface Props {
  profile: Profile;
  /** Writes the edited deck to the profile. */
  onChangeDeck: (deck: Deck) => void;
  /** Spends stars on a single hero's offer (run/starShop.ts buyOffer). */
  onBuy: (offer: StarShopOffer) => void;
  onClose: () => void;
}

const typeIndex = (type: TypeId) => TYPES.indexOf(type as (typeof TYPES)[number]);
const TYPE_ORDER: TypeId[] = draftableTypes(heroes).sort((a, b) => typeIndex(a) - typeIndex(b));

/** Every hero of a type in the catalog, owned or not, in catalog order. */
const HEROES_BY_TYPE: Record<TypeId, HeroDefinition[]> = Object.fromEntries(TYPE_ORDER.map((type) => [type, Object.values(heroes).filter((hero) => hero.types[0] === type)]));

type CardState = 'decked' | 'reserve' | 'locked';

/**
 * The Collection (docs/collection.md §2): one long page, a section a type, every hero of the type
 * in it — the three decked first, then the owned rest, then the ones still to buy, greyed with
 * their price. The rail on the right edge jumps the page to a type and lights the one in view.
 * Tapping a hero opens Info (the dossier) and one verb: Equip for an owned hero out of the deck —
 * the row's three light, and the one tapped is replaced — or Buy for a locked one.
 */
export function CollectionScreen({ profile, onChangeDeck, onBuy, onClose }: Props) {
  const deck = profileDeck(profile, heroes);
  const balance = starBalance(profile, starShopCatalog);
  const [selected, setSelected] = useState<string | null>(null);
  const [equipping, setEquipping] = useState<string | null>(null);
  const [dossierHeroId, setDossierHeroId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<TypeId>(TYPE_ORDER[0]);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Partial<Record<TypeId, HTMLElement>>>({});
  const railRef = useRef<HTMLDivElement>(null);
  const dossierHero = dossierHeroId ? heroes[dossierHeroId] : null;

  const stateOf = (heroId: string): CardState => {
    const hero = heroes[heroId];
    if (!ownsHero(heroId, hero, profile.purchases)) return 'locked';
    return deck[hero.types[0]]?.includes(heroId) ? 'decked' : 'reserve';
  };

  function select(heroId: string) {
    setEquipping(null);
    setSelected(selected === heroId ? null : heroId);
  }

  function replace(outId: string) {
    if (!equipping) return;
    onChangeDeck(swapIntoDeck(deck, heroes, profile.purchases, equipping, outId));
    setEquipping(null);
    setSelected(null);
  }

  /** The type whose section holds the top of the well. */
  function syncActiveType() {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const top = scroller.scrollTop + 12;
    let current = TYPE_ORDER[0];
    for (const type of TYPE_ORDER) {
      const section = sectionRefs.current[type];
      if (section && section.offsetTop <= top) current = type;
    }
    setActiveType(current);
  }

  function jumpTo(type: TypeId, smooth: boolean) {
    const scroller = scrollerRef.current;
    const section = sectionRefs.current[type];
    if (!scroller || !section) return;
    scroller.scrollTo({
      top: section.offsetTop - 4,
      behavior: smooth ? 'smooth' : 'auto',
    });
    setActiveType(type);
  }

  /** A tap or a drag down the rail: the glyph under the finger is the type jumped to. */
  function railTypeAt(clientY: number): TypeId {
    const rect = railRef.current!.getBoundingClientRect();
    const at = Math.floor(((clientY - rect.top) / rect.height) * TYPE_ORDER.length);
    return TYPE_ORDER[Math.max(0, Math.min(TYPE_ORDER.length - 1, at))];
  }

  function onRailDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    jumpTo(railTypeAt(e.clientY), false);
  }

  function onRailMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const type = railTypeAt(e.clientY);
    if (type !== activeType) jumpTo(type, false);
  }

  useEffect(syncActiveType, []);

  return (
    <div className="detail-overlay is-sheet compendium-overlay" onClick={onClose}>
      <div className="detail-panel is-hero-sheet compendium-sheet collection-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="detail-header is-hero compendium-head">
          <span className="detail-portrait-plate compendium-head-plate" aria-hidden="true">
            <HubGlyph name="roster" className="compendium-head-glyph" />
          </span>
          <span className="detail-name compendium-head-title">Collection</span>
          <span className="collection-balance" aria-label={`${balance} ${balance === 1 ? 'star' : 'stars'}`}>
            <HubGlyph name="star" />
            {balance}
          </span>
        </div>

        <div className="collection-frame">
          <div ref={scrollerRef} className="detail-tab-body compendium-body collection-body" onScroll={syncActiveType}>
            {TYPE_ORDER.map((type) => {
              const all = HEROES_BY_TYPE[type];
              const decked = deck[type] ?? [];
              const reserve = reserveOfType(deck, heroes, profile.purchases, type);
              const locked = all.filter((hero) => stateOf(hero.id) === 'locked').map((hero) => hero.id);
              const cards = [...decked, ...reserve, ...locked];
              const picked = selected && cards.includes(selected) ? selected : null;
              const equippingHere = equipping && reserve.includes(equipping) ? equipping : null;
              return (
                <section
                  key={type}
                  ref={(el) => {
                    if (el) sectionRefs.current[type] = el;
                  }}
                  className={`collection-row${equippingHere ? ' is-equipping' : ''}`}
                  style={{ '--type-rgb': getTypeColorRgb(type) } as CSSProperties}
                >
                  <div className="collection-row-head" style={{ color: getTypeColor(type) }}>
                    <ElementGlyph type={type} />
                    {type}
                  </div>
                  {equippingHere && (
                    <div className="collection-equip-bar">
                      <span>Replace which for {heroes[equippingHere].name}?</span>
                      <button type="button" className="collection-action" onClick={() => setEquipping(null)}>
                        Cancel
                      </button>
                    </div>
                  )}
                  <div className="collection-cards">
                    {cards.map((heroId) => (
                      <CollectionCard
                        key={heroId}
                        hero={heroes[heroId]}
                        state={stateOf(heroId)}
                        selected={picked === heroId || equippingHere === heroId}
                        replaceable={!!equippingHere && decked.includes(heroId)}
                        price={starShopCatalog[heroOfferId(heroId)]?.cost}
                        onTap={() => (equippingHere ? (decked.includes(heroId) ? replace(heroId) : setEquipping(null)) : select(heroId))}
                      />
                    ))}
                  </div>
                  {picked && !equippingHere && (
                    <CardActions
                      heroId={picked}
                      state={stateOf(picked)}
                      offer={starShopCatalog[heroOfferId(picked)]}
                      affordable={!!starShopCatalog[heroOfferId(picked)] && canBuy(profile, starShopCatalog, starShopCatalog[heroOfferId(picked)])}
                      onInfo={() => setDossierHeroId(picked)}
                      onEquip={() => setEquipping(picked)}
                      onBuy={onBuy}
                    />
                  )}
                </section>
              );
            })}
          </div>

          <div ref={railRef} className="collection-rail" role="navigation" aria-label="Jump to a type" onPointerDown={onRailDown} onPointerMove={onRailMove}>
            {TYPE_ORDER.map((type) => (
              <span key={type} className={`collection-rail-type${type === activeType ? ' is-active' : ''}`} style={{ color: getTypeColor(type) }} title={type}>
                <ElementGlyph type={type} />
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="sheet-footer" onClick={(e) => e.stopPropagation()}>
        <button className="resolve-button sheet-close-button" onClick={onClose}>
          Close
        </button>
      </div>

      {dossierHero && <HeroDossierOverlay hero={dossierHero} onClose={() => setDossierHeroId(null)} />}
    </div>
  );
}

/** A hero's Evolution paths in authored order — three, one star each. */
function evolutionPathsOf(hero: HeroDefinition) {
  return (progressionTable.evolutions[hero.id] ?? []).flatMap((node) => node.paths);
}

function CollectionCard({
  hero,
  state,
  selected,
  replaceable,
  price,
  onTap,
}: {
  hero: HeroDefinition;
  state: CardState;
  selected: boolean;
  replaceable: boolean;
  price: number | undefined;
  onTap: () => void;
}) {
  return (
    <button
      type="button"
      className={`collection-card is-${state}${selected ? ' is-selected' : ''}${replaceable ? ' is-replaceable' : ''}`}
      onClick={onTap}
      aria-label={`${hero.name}${state === 'decked' ? ', in deck' : state === 'locked' ? ', not owned' : ''}`}
    >
      {state === 'decked' && <span className="collection-card-slot">{replaceable ? 'Replace' : 'In deck'}</span>}
      <HeroPortrait heroId={hero.id} className="collection-card-portrait" />
      <span className="collection-card-name">{hero.name}</span>
      {state === 'locked' ? (
        <span className="collection-card-price">★ {price ?? '—'}</span>
      ) : (
        <span className="collection-card-stars">
          {evolutionPathsOf(hero).map((path) => (
            <EvolutionStar key={path.id} path={path} />
          ))}
        </span>
      )}
    </button>
  );
}

function CardActions({
  heroId,
  state,
  offer,
  affordable,
  onInfo,
  onEquip,
  onBuy,
}: {
  heroId: string;
  state: CardState;
  offer: StarShopOffer | undefined;
  affordable: boolean;
  onInfo: () => void;
  onEquip: () => void;
  onBuy: (offer: StarShopOffer) => void;
}) {
  return (
    <div className="collection-actions">
      <button type="button" className="collection-action" onClick={onInfo}>
        Info
      </button>
      {state === 'reserve' && (
        <button type="button" className="collection-action is-primary" onClick={onEquip}>
          Equip
        </button>
      )}
      {state === 'locked' && offer && (
        <button
          type="button"
          className="collection-action is-primary"
          data-sfx={affordable ? 'ui.commit' : 'none'}
          disabled={!affordable}
          onClick={() => onBuy(offer)}
          aria-label={affordable ? `Buy ${heroes[heroId].name} for ${offer.cost} stars` : `${heroes[heroId].name} costs ${offer.cost} stars — not enough`}
        >
          Buy · ★ {offer.cost}
        </button>
      )}
    </div>
  );
}
