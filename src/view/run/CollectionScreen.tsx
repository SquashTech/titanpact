import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { heroes } from '../../data/heroes';
import { TYPES } from '../../data/typechart';
import { progressionTable } from '../../data/progression';
import { starShopCatalog } from '../../data/starShop';
import type { HeroDefinition, TypeId } from '../../engine/content';
import type { Profile } from '../../run/profile';
import { draftableTypes } from '../../run/deck';
import { ownsHero } from '../../run/recruitment';
import { canBuy, offerPrice, stardustBalance, type StarShopOffer } from '../../run/starShop';
import { playSfx } from '../../audio/sfx';
import { getTypeColor, getTypeColorRgb } from '../combat/typeColors';
import { ElementGlyph } from '../shared/elementIcons';
import { EvolutionStar } from '../shared/EvolutionStar';
import { HeroPortrait } from '../shared/HeroPortrait';
import { HeroDossierOverlay } from './HeroDossierOverlay';
import { createPortal } from 'react-dom';
import { overlayHost } from '../shared/overlayHost';
import { HubPageHead } from './hubChrome';

interface Props {
  profile: Profile;
  /** Spends stars on the bundle a locked hero comes in (run/starShop.ts buyOffer). */
  onBuy: (offer: StarShopOffer) => void;
  /** Heroes fallen this session, each tagged New until it is tapped. */
  freshHeroIds: readonly string[];
  onAcknowledge: (heroId: string) => void;
}

const typeIndex = (type: TypeId) => TYPES.indexOf(type as (typeof TYPES)[number]);
const TYPE_ORDER: TypeId[] = draftableTypes(heroes).sort((a, b) => typeIndex(a) - typeIndex(b));

/** Every hero of a type in the catalog, owned or not, in catalog order. */
const HEROES_BY_TYPE: Record<TypeId, HeroDefinition[]> = Object.fromEntries(TYPE_ORDER.map((type) => [type, Object.values(heroes).filter((hero) => hero.types[0] === type)]));

/** The dossier's arrows walk the whole catalog in the page's own order, a type at a time. */
const DOSSIER_CYCLE: HeroDefinition[] = TYPE_ORDER.flatMap((type) => HEROES_BY_TYPE[type]);

/** What a hero only the Starfall draws is labelled with, in place of a price. */
const CONSTELLATION_LABEL = 'Observatory';

/** The bundle a hero comes in, or undefined for one only the Starfall draws. */
function bundleOf(heroId: string): StarShopOffer | undefined {
  const offer = starShopCatalog[heroes[heroId]?.unlock ?? ''];
  return offer?.grant.kind === 'heroBundle' ? offer : undefined;
}

/**
 * The Collection (docs/worlds.md §2.2): every hero a type at a time, the owned first and the rest
 * after. The Library reads every hero, so nothing here changes a run. The rail on the right edge
 * jumps the page to a type and lights the one in view. A tap hangs a card's verbs under it — Info,
 * and a locked hero's bundle to buy (no hero is sold singly).
 */
export function CollectionScreen({ profile, onBuy, freshHeroIds, onAcknowledge }: Props) {
  const balance = stardustBalance(profile, starShopCatalog);
  const [selected, setSelected] = useState<string | null>(null);
  const [dossierHeroId, setDossierHeroId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<TypeId>(TYPE_ORDER[0]);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Partial<Record<TypeId, HTMLElement>>>({});
  const cardRefs = useRef<Record<string, HTMLElement>>({});
  const railRef = useRef<HTMLDivElement>(null);
  const dossierHero = dossierHeroId ? heroes[dossierHeroId] : null;
  const owns = (heroId: string) => ownsHero(heroId, heroes[heroId], profile.purchases);

  function tapCard(heroId: string) {
    playSfx('ui.pick');
    if (freshHeroIds.includes(heroId)) onAcknowledge(heroId);
    setSelected(selected === heroId ? null : heroId);
  }

  // --- The rail. ---

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
    scroller.scrollTo({ top: section.offsetTop - 4, behavior: smooth ? 'smooth' : 'auto' });
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(syncActiveType, []);

  // A lifted card's verbs hang below it; bring them into view if the card sat low in the well.
  useEffect(() => {
    if (!selected) return;
    const tray = cardRefs.current[selected]?.parentElement?.querySelector('.coll-tray');
    tray?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selected]);

  function renderCard(heroId: string, column: number) {
    const locked = !owns(heroId);
    const offer = bundleOf(heroId);
    const price = offer && offerPrice(profile, offer);
    const isSelected = selected === heroId;
    return (
      <div key={heroId} className={`coll-slot is-col-${column}${isSelected ? ' is-selected' : ''}`}>
        <button
          type="button"
          ref={(el) => {
            if (el) cardRefs.current[heroId] = el;
            else delete cardRefs.current[heroId];
          }}
          className={`coll-card ${locked ? 'is-locked' : 'is-reserve'}`}
          data-hero-card={heroId}
          data-sfx="none"
          onClick={() => tapCard(heroId)}
          aria-pressed={isSelected}
          aria-label={`${heroes[heroId].name}${locked ? ', not owned' : ''}`}
        >
          <span className="coll-card-light" aria-hidden="true" />
          <HeroPortrait heroId={heroId} className="coll-card-portrait" />
          <span className="coll-card-name">{heroes[heroId].name}</span>
          {freshHeroIds.includes(heroId) && <span className="coll-card-new">New</span>}
          {locked ? (
            <span className={`coll-card-price${price === undefined ? ' is-constellation' : ''}`}>{price === undefined ? CONSTELLATION_LABEL : `✦ ${price}`}</span>
          ) : (
            <span className="coll-card-stars">
              {evolutionPathsOf(heroes[heroId]).map((path) => (
                <EvolutionStar key={path.id} path={path} />
              ))}
            </span>
          )}
        </button>

        {isSelected && (
          <div className="coll-tray">
            {locked && <span className={`coll-tray-note${offer ? '' : ' is-constellation'}`}>{offer ? offer.name : CONSTELLATION_LABEL}</span>}
            <button type="button" className="coll-tray-button" onClick={() => setDossierHeroId(heroId)}>
              Info
            </button>
            {locked && offer && (
              <button
                type="button"
                className="coll-tray-button is-primary"
                data-sfx={canBuy(profile, starShopCatalog, offer) ? 'ui.commit' : 'none'}
                disabled={!canBuy(profile, starShopCatalog, offer)}
                onClick={() => onBuy(offer)}
                aria-label={canBuy(profile, starShopCatalog, offer) ? `Buy ${offer.name} for ${price} Pages` : `${offer.name} costs ${price} Pages — not enough`}
              >
                Buy ✦ {price}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="hub-page coll-page">
      <HubPageHead title="Collection" balance={balance} />
      <div className="collection-frame">
        <div
          ref={scrollerRef}
          className="detail-tab-body compendium-body collection-body"
          onScroll={syncActiveType}
          onClick={(e) => {
            if ((e.target as Element).closest('.coll-slot')) return;
            setSelected(null);
          }}
        >
          {TYPE_ORDER.map((type) => {
            const ofType = HEROES_BY_TYPE[type].map((hero) => hero.id);
            const ordered = [...ofType.filter(owns), ...ofType.filter((id) => !owns(id))];
            return (
              <section
                key={type}
                ref={(el) => {
                  if (el) sectionRefs.current[type] = el;
                }}
                className="coll-type"
                style={{ '--type-rgb': getTypeColorRgb(type), '--type-color': getTypeColor(type) } as CSSProperties}
              >
                <header className="coll-type-head">
                  <span className="coll-type-sigil">
                    <ElementGlyph type={type} />
                  </span>
                  <span className="coll-type-name">{type}</span>
                  <span className="coll-type-rule" aria-hidden="true" />
                </header>
                <div className="coll-grid is-reserve">{ordered.map((id, i) => renderCard(id, i % 3))}</div>
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

      {dossierHero && createPortal(<HeroDossierOverlay hero={dossierHero} cycle={DOSSIER_CYCLE} onClose={() => setDossierHeroId(null)} />, overlayHost())}
    </div>
  );
}

/** A hero's Evolution paths in authored order — three, one star each. */
function evolutionPathsOf(hero: HeroDefinition) {
  return (progressionTable.evolutions[hero.id] ?? []).flatMap((node) => node.paths);
}
