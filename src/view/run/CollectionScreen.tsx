import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { heroes } from '../../data/heroes';
import { TYPES } from '../../data/typechart';
import { progressionTable } from '../../data/progression';
import { starShopCatalog } from '../../data/starShop';
import type { HeroDefinition, TypeId } from '../../engine/content';
import type { Profile } from '../../run/profile';
import { draftableTypes, profileDeck, reserveOfType, swapIntoDeck, type Deck } from '../../run/deck';
import { ownsHero } from '../../run/recruitment';
import { canBuy, offerPrice, starBalance, type StarShopOffer } from '../../run/starShop';
import { playSfx } from '../../audio/sfx';
import { getTypeColor, getTypeColorRgb } from '../combat/typeColors';
import { ElementGlyph } from '../shared/elementIcons';
import { EvolutionStar } from '../shared/EvolutionStar';
import { HeroPortrait } from '../shared/HeroPortrait';
import { HubGlyph } from '../shared/nodeIcons';
import { HeroDossierOverlay } from './HeroDossierOverlay';
import { STARFALL_NAME } from './Starfall';
import { HubPageHead, HubSubtabs, type SubtabSpec } from './hubChrome';
import { DeckView, bundleOf } from './DeckView';

interface Props {
  profile: Profile;
  /** Writes the edited deck to the profile. */
  onChangeDeck: (deck: Deck) => void;
  /** Spends stars on the bundle a locked hero comes in (run/starShop.ts buyOffer). */
  onBuy: (offer: StarShopOffer) => void;
  /** A hero fallen this session: tagged New until the Collection has been seen. */
  freshHeroId: string | null;
}

type View = 'deck' | 'all';

const typeIndex = (type: TypeId) => TYPES.indexOf(type as (typeof TYPES)[number]);
const TYPE_ORDER: TypeId[] = draftableTypes(heroes).sort((a, b) => typeIndex(a) - typeIndex(b));

/** Every hero of a type in the catalog, owned or not, in catalog order. */
const HEROES_BY_TYPE: Record<TypeId, HeroDefinition[]> = Object.fromEntries(TYPE_ORDER.map((type) => [type, Object.values(heroes).filter((hero) => hero.types[0] === type)]));

/** The dossier's arrows walk the whole catalog in the page's own order, a type at a time. */
const DOSSIER_CYCLE: HeroDefinition[] = TYPE_ORDER.flatMap((type) => HEROES_BY_TYPE[type]);

/** How long a card is held before it lifts off the page to be dragged. */
const PICK_UP_MS = 320;
/** A finger that travels this far before the hold lands is scrolling, not picking up. */
const PICK_UP_SLOP_PX = 8;
const SETTLE_MS = 260;

type CardState = 'decked' | 'reserve' | 'locked';

interface Drag {
  heroId: string;
  pointerId: number;
  originX: number;
  originY: number;
  /** Screen px to canvas px: the design canvas is transform-scaled. */
  scale: number;
}

/**
 * The Collection (docs/collection.md §2), a hub page in two views. Deck is the run's pools at a
 * glance (DeckView.tsx). All heroes is one long page, a section a type. Each section's deck
 * sits in a gilt alcove at its head; the owned rest and the ones still to buy are under it. The
 * rail on the right edge jumps the page to a type and lights the one in view.
 *
 * A tap lifts a card and hangs its verbs under it — Info, and Equip (a reserve hero), Swap (a
 * decked one with a reserve to trade) or its bundle to buy (no hero is sold singly). Equip and
 * Swap light the other side of the section to be tapped. A held card lifts off the page and is
 * dropped on the hero it trades places with.
 */
export function CollectionScreen({ profile, onChangeDeck, onBuy, freshHeroId }: Props) {
  const deck = profileDeck(profile, heroes);
  const balance = starBalance(profile, starShopCatalog);
  const [view, setView] = useState<View>('deck');
  const ownedCount = Object.values(heroes).filter((hero) => ownsHero(hero.id, hero, profile.purchases)).length;
  const views: readonly SubtabSpec<View>[] = [
    { id: 'deck', label: 'Deck' },
    { id: 'all', label: 'All heroes', count: ownedCount },
  ];
  const [selected, setSelected] = useState<string | null>(null);
  const [swapping, setSwapping] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [landed, setLanded] = useState<string | null>(null);
  const [dossierHeroId, setDossierHeroId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<TypeId>(TYPE_ORDER[0]);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Partial<Record<TypeId, HTMLElement>>>({});
  const cardRefs = useRef<Record<string, HTMLElement>>({});
  const railRef = useRef<HTMLDivElement>(null);
  const holdRef = useRef<{ heroId: string; pointerId: number; x: number; y: number; timer: number } | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const dropRef = useRef<string | null>(null);
  const swallowClick = useRef(false);
  const pendingFlip = useRef<Record<string, DOMRect> | null>(null);
  const dossierHero = dossierHeroId ? heroes[dossierHeroId] : null;

  const stateOf = (heroId: string): CardState => {
    const hero = heroes[heroId];
    if (!ownsHero(heroId, hero, profile.purchases)) return 'locked';
    return deck[hero.types[0]]?.includes(heroId) ? 'decked' : 'reserve';
  };

  /** The heroes `heroId` can trade places with: the reserve for a decked hero, the deck for a reserve one. */
  function counterparts(heroId: string): readonly string[] {
    const type = heroes[heroId].types[0];
    const state = stateOf(heroId);
    if (state === 'decked') return reserveOfType(deck, heroes, profile.purchases, type);
    if (state === 'reserve') return deck[type] ?? [];
    return [];
  }

  /** Where every card stands now, so the next render can slide each from here to its new seat. */
  function captureFlip() {
    const rects: Record<string, DOMRect> = {};
    for (const [id, el] of Object.entries(cardRefs.current)) rects[id] = el.getBoundingClientRect();
    pendingFlip.current = rects;
  }

  function swap(a: string, b: string) {
    const [inId, outId] = stateOf(a) === 'reserve' ? [a, b] : [b, a];
    captureFlip();
    onChangeDeck(swapIntoDeck(deck, heroes, profile.purchases, inId, outId));
    playSfx('ui.commit');
    setLanded(inId);
    setSelected(null);
    setSwapping(null);
  }

  useLayoutEffect(() => {
    const before = pendingFlip.current;
    if (!before) return;
    pendingFlip.current = null;
    for (const [id, el] of Object.entries(cardRefs.current)) {
      const from = before[id];
      if (!from) continue;
      const to = el.getBoundingClientRect();
      const scale = to.width / (el.offsetWidth || to.width) || 1;
      const dx = (from.left - to.left) / scale;
      const dy = (from.top - to.top) / scale;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], { duration: SETTLE_MS, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1.15)' });
    }
  });

  useEffect(() => {
    if (!landed) return;
    const timer = window.setTimeout(() => setLanded(null), 700);
    return () => clearTimeout(timer);
  }, [landed]);

  function tapCard(heroId: string) {
    if (swallowClick.current) {
      swallowClick.current = false;
      return;
    }
    // Sounded here, not on the press: the press may be the start of a scroll or a hold.
    playSfx('ui.pick');
    if (swapping) {
      if (counterparts(swapping).includes(heroId)) return swap(swapping, heroId);
      setSwapping(null);
      setSelected(heroId === swapping ? null : heroId);
      return;
    }
    setSelected(selected === heroId ? null : heroId);
  }

  // --- Pick up and drop. ---

  function cancelHold() {
    if (holdRef.current) clearTimeout(holdRef.current.timer);
    holdRef.current = null;
  }

  function onCardPointerDown(heroId: string, e: ReactPointerEvent<HTMLElement>) {
    swallowClick.current = false;
    if (e.button !== 0 || !counterparts(heroId).length) return;
    const el = cardRefs.current[heroId];
    const { pointerId, clientX: x, clientY: y } = e;
    cancelHold();
    holdRef.current = {
      heroId,
      pointerId,
      x,
      y,
      timer: window.setTimeout(() => {
        holdRef.current = null;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const next: Drag = { heroId, pointerId, originX: x, originY: y, scale: rect.width / (el.offsetWidth || rect.width) || 1 };
        dragRef.current = next;
        swallowClick.current = true;
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(12);
        playSfx('ui.select');
        setSelected(null);
        setSwapping(null);
        setDragOffset({ x: 0, y: 0 });
        setDrag(next);
      }, PICK_UP_MS),
    };
  }

  useEffect(() => {
    function onMove(e: PointerEvent) {
      const hold = holdRef.current;
      if (hold && hold.pointerId === e.pointerId && Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > PICK_UP_SLOP_PX) cancelHold();
      const d = dragRef.current;
      if (!d || d.pointerId !== e.pointerId) return;
      setDragOffset({ x: (e.clientX - d.originX) / d.scale, y: (e.clientY - d.originY) / d.scale });
      const under = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-hero-card]');
      const id = under?.dataset.heroCard ?? null;
      const target = id && counterparts(d.heroId).includes(id) ? id : null;
      if (target !== dropRef.current) {
        dropRef.current = target;
        setDropTarget(target);
        if (target) playSfx('ui.target');
      }
    }

    function onEnd(e: PointerEvent) {
      if (holdRef.current?.pointerId === e.pointerId) cancelHold();
      const d = dragRef.current;
      if (!d || d.pointerId !== e.pointerId) return;
      const target = e.type === 'pointerup' ? dropRef.current : null;
      dragRef.current = null;
      dropRef.current = null;
      // The drop's own click, if the browser sends one, lands in this task; nothing after it is spent.
      window.setTimeout(() => (swallowClick.current = false));
      if (target) swap(d.heroId, target);
      else captureFlip();
      setDrag(null);
      setDropTarget(null);
      setDragOffset({ x: 0, y: 0 });
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };
  });

  // A lifted card owns the finger: the well must not scroll under it. Registered for the screen's
  // life and non-passive, since a listener added mid-gesture cannot cancel the gesture's moves.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const block = (e: TouchEvent) => {
      if (dragRef.current) e.preventDefault();
    };
    scroller.addEventListener('touchmove', block, { passive: false });
    return () => scroller.removeEventListener('touchmove', block);
  }, [view]);

  useEffect(() => cancelHold, []);

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
  useEffect(syncActiveType, [view]);

  // A lifted card's verbs hang below it; bring them into view if the card sat low in the well.
  useEffect(() => {
    if (!selected) return;
    const tray = cardRefs.current[selected]?.parentElement?.querySelector('.coll-tray');
    tray?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selected]);

  const armed = swapping ?? drag?.heroId ?? null;
  const armedTargets = armed ? counterparts(armed) : [];

  function renderCard(heroId: string, column: number) {
    const state = stateOf(heroId);
    const offer = bundleOf(heroId);
    const price = offer && offerPrice(profile, offer);
    const isDragged = drag?.heroId === heroId;
    const isSelected = selected === heroId || swapping === heroId;
    const isTarget = armedTargets.includes(heroId);
    const canTrade = counterparts(heroId).length > 0;
    const classes = [
      'coll-slot',
      `is-col-${column}`,
      isSelected ? 'is-selected' : '',
      isDragged ? 'is-dragged' : '',
      isTarget ? 'is-target' : '',
      dropTarget === heroId ? 'is-over' : '',
      armed && !isTarget && armed !== heroId ? 'is-muted' : '',
      landed === heroId ? 'is-landed' : '',
    ];
    return (
      <div key={heroId} className={classes.filter(Boolean).join(' ')} style={isDragged ? ({ '--drag-x': `${dragOffset.x}px`, '--drag-y': `${dragOffset.y}px` } as CSSProperties) : undefined}>
        <button
          type="button"
          ref={(el) => {
            if (el) cardRefs.current[heroId] = el;
            else delete cardRefs.current[heroId];
          }}
          className={`coll-card is-${state}`}
          data-hero-card={heroId}
          data-sfx="none"
          onPointerDown={(e) => onCardPointerDown(heroId, e)}
          onContextMenu={(e) => e.preventDefault()}
          onClick={() => tapCard(heroId)}
          aria-pressed={isSelected}
          aria-label={`${heroes[heroId].name}${state === 'decked' ? ', in deck' : state === 'locked' ? ', not owned' : ''}`}
        >
          <span className="coll-card-light" aria-hidden="true" />
          <HeroPortrait heroId={heroId} className="coll-card-portrait" />
          <span className="coll-card-name">{heroes[heroId].name}</span>
          {heroId === freshHeroId && <span className="coll-card-new">New</span>}
          {state === 'locked' ? (
            <span className="coll-card-price">{price === undefined ? STARFALL_NAME : `★ ${price}`}</span>
          ) : (
            <span className="coll-card-stars">
              {evolutionPathsOf(heroes[heroId]).map((path) => (
                <EvolutionStar key={path.id} path={path} />
              ))}
            </span>
          )}
          {isTarget && (
            <span className="coll-card-swap" aria-hidden="true">
              ⇄
            </span>
          )}
        </button>

        {selected === heroId && !swapping && (
          <div className="coll-tray">
            {state === 'locked' && <span className="coll-tray-note">{offer ? offer.name : `Falls only in the ${STARFALL_NAME}`}</span>}
            <button type="button" className="coll-tray-button" onClick={() => setDossierHeroId(heroId)}>
              Info
            </button>
            {state !== 'locked' && canTrade && (
              <button type="button" className="coll-tray-button is-primary" data-sfx="ui.select" onClick={() => setSwapping(heroId)}>
                {state === 'reserve' ? 'Equip' : 'Swap'}
              </button>
            )}
            {state === 'locked' && offer && (
              <button
                type="button"
                className="coll-tray-button is-primary"
                data-sfx={canBuy(profile, starShopCatalog, offer) ? 'ui.commit' : 'none'}
                disabled={!canBuy(profile, starShopCatalog, offer)}
                onClick={() => onBuy(offer)}
                aria-label={canBuy(profile, starShopCatalog, offer) ? `Buy ${offer.name} for ${price} stars` : `${offer.name} costs ${price} stars — not enough`}
              >
                Buy ★ {price}
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
      <HubSubtabs tabs={views} active={view} onSelect={setView} />

      {view === 'deck' ? (
        <DeckView profile={profile} deck={deck} freshHeroId={freshHeroId} onChangeDeck={onChangeDeck} onPeekHero={setDossierHeroId} />
      ) : (
        <div className="collection-frame">
          <div
            ref={scrollerRef}
            className={`detail-tab-body compendium-body collection-body${drag ? ' is-dragging' : ''}`}
            onScroll={syncActiveType}
            onClick={(e) => {
              if ((e.target as Element).closest('.coll-slot')) return;
              setSelected(null);
              setSwapping(null);
            }}
          >
            {TYPE_ORDER.map((type) => {
              const decked = deck[type] ?? [];
              const reserve = reserveOfType(deck, heroes, profile.purchases, type);
              const locked = HEROES_BY_TYPE[type].filter((hero) => stateOf(hero.id) === 'locked').map((hero) => hero.id);
              const rest = [...reserve, ...locked];
              const deckArmed = !!armed && armedTargets.some((id) => decked.includes(id));
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

                  <div className={`coll-deck${deckArmed ? ' is-armed' : ''}`}>
                    <span className="coll-deck-label">In deck</span>
                    <div className="coll-grid">{decked.map((id, i) => renderCard(id, i))}</div>
                  </div>

                  {rest.length > 0 && (
                    <div className="coll-grid is-reserve">
                      {rest.map((id, i) => renderCard(id, i % 3))}
                    </div>
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
      )}

      {dossierHero && <HeroDossierOverlay hero={dossierHero} cycle={DOSSIER_CYCLE} onClose={() => setDossierHeroId(null)} />}
    </div>
  );
}

/** A hero's Evolution paths in authored order — three, one star each. */
function evolutionPathsOf(hero: HeroDefinition) {
  return (progressionTable.evolutions[hero.id] ?? []).flatMap((node) => node.paths);
}
