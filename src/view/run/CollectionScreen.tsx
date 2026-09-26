import { useState, type CSSProperties } from 'react';
import { heroes } from '../../data/heroes';
import { TYPES } from '../../data/typechart';
import { STARTER_PACKS } from '../../data/starterPacks';
import type { TypeId } from '../../engine/content';
import type { Profile } from '../../run/profile';
import { applyPreset, makeStarter, presetApplied, profileDeck, reserveOfType, swapIntoDeck, type Deck } from '../../run/deck';
import { getTypeColor, getTypeColorRgb } from '../combat/typeColors';
import { ElementGlyph } from '../shared/elementIcons';
import { HeroPortrait } from '../shared/HeroPortrait';
import { HubGlyph } from '../shared/nodeIcons';
import { HeroDossierOverlay } from './HeroDossierOverlay';

interface Props {
  profile: Profile;
  /** Writes the edited deck to the profile. */
  onChangeDeck: (deck: Deck) => void;
  onClose: () => void;
}

const typeOrder = (a: TypeId, b: TypeId) => TYPES.indexOf(a as (typeof TYPES)[number]) - TYPES.indexOf(b as (typeof TYPES)[number]);

/**
 * The deck (docs/collection.md §2): a row a type, its starter first — the draft's pool — and its
 * two recruits after. Tapping a hero opens what can be done with it: stand it in the starter
 * slot, read its dossier, or trade it for an owned hero of its type the row has no room for.
 * The Compendium's sheet, without the tab strip.
 */
export function CollectionScreen({ profile, onChangeDeck, onClose }: Props) {
  const deck = profileDeck(profile, heroes);
  const [selected, setSelected] = useState<string | null>(null);
  const [dossierHeroId, setDossierHeroId] = useState<string | null>(null);
  const types = Object.keys(deck).sort(typeOrder);
  const dossierHero = dossierHeroId ? heroes[dossierHeroId] : null;

  function change(next: Deck) {
    onChangeDeck(next);
    setSelected(null);
  }

  return (
    <div className="detail-overlay is-sheet compendium-overlay" onClick={onClose}>
      <div className="detail-panel is-hero-sheet compendium-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="detail-header is-hero compendium-head">
          <span className="detail-portrait-plate compendium-head-plate" aria-hidden="true">
            <HubGlyph name="roster" className="compendium-head-glyph" />
          </span>
          <span className="detail-name compendium-head-title">Collection</span>
        </div>

        <div className="detail-tab-body compendium-body collection-body">
          <div className="collection-presets">
            {STARTER_PACKS.map((preset) => {
              const loaded = presetApplied(deck, preset.heroIds);
              return (
                <button
                  key={preset.id}
                  type="button"
                  className={`collection-preset${loaded ? ' is-loaded' : ''}`}
                  disabled={loaded}
                  onClick={() => change(applyPreset(deck, preset.heroIds))}
                >
                  {preset.name}
                </button>
              );
            })}
          </div>

          {types.map((type) => {
            const row = deck[type];
            const reserve = reserveOfType(deck, heroes, profile.purchases, type);
            const picked = selected && row.includes(selected) ? selected : null;
            return (
              <section key={type} className="collection-row" style={{ '--type-rgb': getTypeColorRgb(type) } as CSSProperties}>
                <div className="collection-row-head" style={{ color: getTypeColor(type) }}>
                  <ElementGlyph type={type} />
                  {type}
                </div>
                <div className="collection-cards">
                  {row.map((heroId, slot) => (
                    <button
                      key={heroId}
                      type="button"
                      className={`collection-card${slot === 0 ? ' is-starter' : ''}${picked === heroId ? ' is-selected' : ''}`}
                      onClick={() => setSelected(picked === heroId ? null : heroId)}
                    >
                      <span className="collection-card-slot">{slot === 0 ? 'Starter' : 'Recruit'}</span>
                      <HeroPortrait heroId={heroId} className="collection-card-portrait" />
                      <span className="collection-card-name">{heroes[heroId]?.name}</span>
                    </button>
                  ))}
                </div>
                {picked && (
                  <div className="collection-actions">
                    {row[0] !== picked && (
                      <button type="button" className="collection-action" onClick={() => change(makeStarter(deck, picked))}>
                        Make starter
                      </button>
                    )}
                    <button type="button" className="collection-action" onClick={() => setDossierHeroId(picked)}>
                      Details
                    </button>
                    {reserve.map((inId) => (
                      <button
                        key={inId}
                        type="button"
                        className="collection-action is-swap"
                        onClick={() => change(swapIntoDeck(deck, heroes, profile.purchases, inId, picked))}
                      >
                        Swap for {heroes[inId].name}
                      </button>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
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
