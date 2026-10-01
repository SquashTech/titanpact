import { useEffect, useState, type CSSProperties } from 'react';
import { heroes } from '../../data/heroes';
import { TYPES } from '../../data/typechart';
import { starShopCatalog } from '../../data/starShop';
import type { TypeId } from '../../engine/content';
import type { Profile } from '../../run/profile';
import { draftableTypes, reserveOfType, swapIntoDeck, type Deck } from '../../run/deck';
import { ownsHero } from '../../run/recruitment';
import { offerPrice, type StarShopOffer } from '../../run/starShop';
import { playSfx } from '../../audio/sfx';
import { getTypeColor, getTypeColorRgb } from '../combat/typeColors';
import { ElementGlyph } from '../shared/elementIcons';
import { HeroPortrait } from '../shared/HeroPortrait';
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
            <div className="deck-sheet-head">
              <span className="deck-sheet-figure">
                <HeroPortrait heroId={pickedHero.id} className="deck-sheet-portrait" />
              </span>
              <span className="deck-sheet-title">
                <span className="deck-sheet-kicker">
                  <ElementGlyph type={pickedType} />
                  {pickedType} · in deck
                </span>
                <span className="deck-sheet-name">{pickedHero.name}</span>
              </span>
              <button type="button" className="deck-sheet-info" onClick={() => onPeekHero(pickedHero.id)}>
                Info
              </button>
            </div>

            <div className="deck-sheet-label">{bench.length > 0 ? 'Swap in' : `No other ${pickedType} hero to swap in`}</div>
            <div className="deck-sheet-bench">
              {bench.map((id) => (
                <div key={id} className={`deck-bench-card${id === freshHeroId ? ' is-fresh' : ''}`}>
                  <button type="button" className="deck-bench-face" data-sfx="none" onClick={() => trade(id)} aria-label={`Swap ${heroes[id].name} in for ${pickedHero.name}`}>
                    <HeroPortrait heroId={id} className="deck-bench-portrait" />
                    <span className="deck-bench-name">{heroes[id].name}</span>
                    <span className="deck-bench-verb">⇄ Swap in</span>
                    {id === freshHeroId && <span className="coll-card-new">New</span>}
                  </button>
                  <button type="button" className="deck-bench-info" onClick={() => onPeekHero(id)} aria-label={`${heroes[id].name} — view details`}>
                    i
                  </button>
                </div>
              ))}
              {unowned.map((hero) => {
                const offer = bundleOf(hero.id);
                return (
                  <button key={hero.id} type="button" className="deck-bench-card is-locked" onClick={() => onPeekHero(hero.id)} aria-label={`${hero.name} — not owned`}>
                    <span className="deck-bench-face">
                      <HeroPortrait heroId={hero.id} className="deck-bench-portrait" />
                      <span className="deck-bench-name">{hero.name}</span>
                      <span className="deck-bench-verb">{offer ? `★ ${offerPrice(profile, offer)} · ${offer.name}` : STARFALL_NAME}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
