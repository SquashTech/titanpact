import { useEffect, useState, type CSSProperties } from 'react';
import { heroes } from '../../data/heroes';
import { TYPES } from '../../data/typechart';
import { starShopCatalog } from '../../data/starShop';
import type { StatKey, TypeId } from '../../engine/content';
import type { Profile } from '../../run/profile';
import { draftableTypes, reserveOfType, swapIntoDeck, type Deck } from '../../run/deck';
import { ownsHero } from '../../run/recruitment';
import { innatePassiveOf } from '../../run/innate';
import { offerPrice, type StarShopOffer } from '../../run/starShop';
import { playSfx } from '../../audio/sfx';
import { getTypeColor, getTypeColorRgb } from '../combat/typeColors';
import { ElementGlyph } from '../shared/elementIcons';
import { HeroPortrait } from '../shared/HeroPortrait';
import { TypeBadge } from '../shared/TypeBadge';
import { STARFALL_NAME } from './Starfall';

const typeIndex = (type: TypeId) => TYPES.indexOf(type as (typeof TYPES)[number]);
const TYPE_ORDER: TypeId[] = draftableTypes(heroes).sort((a, b) => typeIndex(a) - typeIndex(b));

/** The bundle a hero comes in, or undefined for one only the Starfall draws. */
export function bundleOf(heroId: string): StarShopOffer | undefined {
  const offer = starShopCatalog[heroes[heroId]?.unlock ?? ''];
  return offer?.grant.kind === 'heroBundle' ? offer : undefined;
}

interface Props {
  profile: Profile;
  deck: Deck;
  freshHeroId: string | null;
  onChangeDeck: (deck: Deck) => void;
  onPeekHero: (heroId: string) => void;
}

/**
 * The deck alone (docs/collection.md §2): fourteen rows of three, two types a line, so the whole
 * of what a run can draw is on one screen. Tapping a hero opens its row's bench under it — the
 * heroes of that type the account owns and has not decked, to trade in, and the ones still to
 * get, to look at.
 */
export function DeckView({ profile, deck, freshHeroId, onChangeDeck, onPeekHero }: Props) {
  const [picked, setPicked] = useState<string | null>(null);
  const [landed, setLanded] = useState<string | null>(null);

  useEffect(() => {
    if (!landed) return;
    const timer = window.setTimeout(() => setLanded(null), 800);
    return () => clearTimeout(timer);
  }, [landed]);

  const pickedHero = picked ? heroes[picked] : null;
  const pickedType = pickedHero?.types[0];
  const bench = pickedType ? reserveOfType(deck, heroes, profile.purchases, pickedType) : [];
  const unowned = pickedType ? Object.values(heroes).filter((h) => h.types[0] === pickedType && !ownsHero(h.id, h, profile.purchases)) : [];

  function trade(inId: string) {
    if (!picked) return;
    onChangeDeck(swapIntoDeck(deck, heroes, profile.purchases, inId, picked));
    playSfx('ui.commit');
    setLanded(inId);
    setPicked(null);
  }

  return (
    <div className="hub-body deck-view">
      <div className="deck-grid">
        {TYPE_ORDER.map((type) => {
          const row = deck[type] ?? [];
          const reserve = reserveOfType(deck, heroes, profile.purchases, type);
          const spare = reserve.length;
          return (
            <section key={type} className="deck-row" style={{ '--type-rgb': getTypeColorRgb(type), '--type-color': getTypeColor(type) } as CSSProperties}>
              <header className="deck-row-head">
                <span className="deck-row-sigil">
                  <ElementGlyph type={type} />
                </span>
                <span className="deck-row-name">{type}</span>
                {spare > 0 && (
                  <span className={`deck-row-spare${freshHeroId && reserve.includes(freshHeroId) ? ' is-fresh' : ''}`} title={`${spare} more to choose from`}>
                    +{spare}
                  </span>
                )}
              </header>
              <div className="deck-row-heroes">
                {row.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={`deck-hero${picked === id ? ' is-picked' : ''}${landed === id ? ' is-landed' : ''}`}
                    data-sfx="ui.pick"
                    onClick={() => setPicked(picked === id ? null : id)}
                    aria-label={`${heroes[id].name} — swap or view`}
                  >
                    <HeroPortrait heroId={id} className="deck-hero-portrait" />
                    <span className="deck-hero-name">{heroes[id].name}</span>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {pickedHero && pickedType && (
        <div className="deck-sheet-scrim" onClick={() => setPicked(null)}>
          <div className="deck-sheet" style={{ '--type-rgb': getTypeColorRgb(pickedType), '--type-color': getTypeColor(pickedType) } as CSSProperties} onClick={(e) => e.stopPropagation()}>
            <div className="deck-sheet-bar">
              <span className="deck-sheet-kicker">
                <ElementGlyph type={pickedType} />
                {pickedType} · swap out
              </span>
              <button type="button" className="deck-sheet-close" onClick={() => setPicked(null)} aria-label="Close">
                ✕
              </button>
            </div>

            <SwapRow heroId={pickedHero.id} current onInfo={() => onPeekHero(pickedHero.id)} />

            <div className="deck-sheet-label">{bench.length > 0 ? 'Swap in' : `No other ${pickedType} hero to swap in`}</div>
            <div className="deck-sheet-list">
              {bench.map((id) => (
                <SwapRow key={id} heroId={id} against={pickedHero.id} fresh={id === freshHeroId} onInfo={() => onPeekHero(id)} onSwap={() => trade(id)} />
              ))}
              {unowned.map((hero) => {
                const offer = bundleOf(hero.id);
                return <SwapRow key={hero.id} heroId={hero.id} locked={offer ? `★ ${offerPrice(profile, offer)} · ${offer.name}` : `Falls in the ${STARFALL_NAME}`} onInfo={() => onPeekHero(hero.id)} />;
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const COMPARE_STATS: readonly StatKey[] = ['hp', 'attack', 'defense', 'intelligence', 'wisdom', 'speed'];
const STAT_SHORT: Partial<Record<StatKey, string>> = { hp: 'HP', attack: 'ATK', defense: 'DEF', intelligence: 'INT', wisdom: 'WIS', speed: 'SPD' };

/**
 * One hero in the swap sheet: who it is, its innate, and its stats — each read against the hero
 * being swapped out, so the trade is judged on the page rather than from memory.
 */
function SwapRow({
  heroId,
  against,
  current,
  fresh,
  locked,
  onInfo,
  onSwap,
}: {
  heroId: string;
  against?: string;
  current?: boolean;
  fresh?: boolean;
  /** Not owned: how it is got. */
  locked?: string;
  onInfo: () => void;
  onSwap?: () => void;
}) {
  const hero = heroes[heroId];
  const innate = innatePassiveOf(hero);
  const base = against ? heroes[against].baseStats : null;
  return (
    <div className={`swap-row${current ? ' is-current' : ''}${locked ? ' is-locked' : ''}`}>
      {fresh && <span className="coll-card-new">New</span>}
      <button type="button" className="swap-row-figure" onClick={onInfo} aria-label={`${hero.name} — view details`}>
        <HeroPortrait heroId={heroId} className="swap-row-portrait" />
      </button>
      <div className="swap-row-body">
        <div className="swap-row-head">
          <span className="swap-row-name">{hero.name}</span>
          <span className="swap-row-types">
            {hero.types.map((t) => (
              <TypeBadge key={t} type={t} iconOnly />
            ))}
          </span>
        </div>
        {innate && (
          <div className="swap-row-innate">
            <span className="swap-row-innate-name">{innate.name}</span> {innate.description}
          </div>
        )}
        <div className="swap-row-stats">
          {COMPARE_STATS.map((stat) => {
            const value = hero.baseStats[stat];
            const delta = base ? value - base[stat] : 0;
            return (
              <span key={stat} className={`swap-stat${delta > 0 ? ' is-up' : delta < 0 ? ' is-down' : ''}`}>
                <span className="swap-stat-key">{STAT_SHORT[stat]}</span>
                <span className="swap-stat-value">{value}</span>
              </span>
            );
          })}
        </div>
        <div className="swap-row-actions">
          {locked ? (
            <span className="swap-row-locked">{locked}</span>
          ) : current ? (
            <span className="swap-row-locked">In deck</span>
          ) : (
            <button type="button" className="swap-row-swap" data-sfx="none" onClick={onSwap}>
              ⇄ Swap in
            </button>
          )}
          <button type="button" className="deck-sheet-info" onClick={onInfo}>
            Info
          </button>
        </div>
      </div>
    </div>
  );
}
