import { useState, type CSSProperties } from 'react';
import { heroes } from '../../data/heroes';
import { TYPES, typeChart } from '../../data/typechart';
import { equipment, EQUIPMENT_DROP_POOL, UNIQUE_EQUIPMENT } from '../../data/equipment';
import type { HeroDefinition, TypeId } from '../../engine/content';
import type { EquipmentDefinition, EquipmentRarity } from '../../run/equipment';
import { RARITY_ORDER } from '../../run/equipment';
import { getTypeAbbr, getTypeColor, getTypeColorRgb } from '../combat/typeColors';
import { ElementGlyph } from '../shared/elementIcons';
import { HeroPortrait } from '../shared/HeroPortrait';
import { HubGlyph } from '../shared/nodeIcons';
import { TabStrip, type TabSpec } from '../shared/TabStrip';
import { TypeBadge } from '../shared/TypeBadge';
import { TypeWheel } from '../shared/TypeWheel';
import { EquipmentIcon, ItemEffectChips, RARITY_COLOR_VARS, RARITY_LABELS } from '../shared/EquipmentBox';
import { ItemDetailOverlay } from '../shared/ItemDossier';
import { EvolutionStar } from '../shared/EvolutionStar';
import { pathTintStyle } from '../shared/pathTint';
import { progressionTable } from '../../data/progression';
import { HeroDossierOverlay } from './HeroDossierOverlay';

interface Props {
  onClose: () => void;
}

// Primary type in type-chart order (TYPES); a stable sort keeps same-type heroes in authoring order.
function byPrimaryType(a: HeroDefinition, b: HeroDefinition): number {
  return TYPES.indexOf(a.types[0] as (typeof TYPES)[number]) - TYPES.indexOf(b.types[0] as (typeof TYPES)[number]);
}
const STARTER_HEROES = Object.values(heroes).filter((hero) => hero.starter).sort(byPrimaryType);
const RECRUIT_HEROES = Object.values(heroes).filter((hero) => !hero.starter).sort(byPrimaryType);
// Rarity, then authoring order — items are uncategorised, so the tier is the only grouping left,
// and the page is laid out as one shelf per tier.
const EQUIPMENT_SHELVES = RARITY_ORDER.map((rarity) => ({
  rarity,
  items: [...EQUIPMENT_DROP_POOL, ...UNIQUE_EQUIPMENT].filter((item) => item.rarity === rarity),
})).filter((shelf) => shelf.items.length > 0);

/** A hero's Evolution paths in authored order — exactly three, one star's worth each. */
function evolutionPathsOf(hero: HeroDefinition) {
  return (progressionTable.evolutions[hero.id] ?? []).flatMap((node) => node.paths);
}

/**
 * Roster row: sprite, name and types on the first line, and under them the hero's three
 * Evolution paths as cells — the path's name over its star, lit when a run has been cleared in
 * that form (profile.ts `evolutionStars`), each cell washed in the path's own tint
 * (shared/pathTint.ts, the same colour the Evolution choice and the dossier card wear). A row
 * rather than a tile (2026-09-16, per user direction) because the stars are the point of the
 * screen now. The whole hero is one tap away in HeroDossierOverlay.
 */
function CompendiumHeroRow({ hero, onOpen }: { hero: HeroDefinition; onOpen: () => void }) {
  const paths = evolutionPathsOf(hero);
  return (
    <button
      type="button"
      className="compendium-row"
      style={{ '--type-rgb': getTypeColorRgb(hero.types[0]) } as CSSProperties}
      onClick={onOpen}
      aria-label={`${hero.name} — view details`}
    >
      <span className="compendium-row-head">
        <span className="compendium-row-figure">
          <span className="pick-ground" aria-hidden="true" />
          <HeroPortrait heroId={hero.id} className="compendium-row-portrait" />
        </span>
        <span className="compendium-row-body">
          <span className="compendium-row-name">{hero.name}</span>
          <span className="pick-types compendium-row-types">
            {hero.types.map((t) => (
              <span key={t} className="pick-type-code" style={{ color: getTypeColor(t) }} title={t}>
                <ElementGlyph type={t} />
                {getTypeAbbr(t)}
              </span>
            ))}
          </span>
        </span>
      </span>
      <span className="compendium-row-paths">
        {paths.map((path) => (
          <span key={path.id} className="compendium-path-cell" style={pathTintStyle(hero, path)}>
            <span className="compendium-path-name">{path.name}</span>
            <EvolutionStar path={path} className="compendium-path-star" />
          </span>
        ))}
      </span>
    </button>
  );
}

/**
 * One item on its shelf: the glyph on a rarity-tinted plate, the name, and the effect chips —
 * the rarity is the shelf's heading, so the row does not repeat it. Read-only: tap opens the
 * detail popup, no select-then-claim.
 */
function CompendiumItemRow({ item, onInspect }: { item: EquipmentDefinition; onInspect: () => void }) {
  return (
    <button
      type="button"
      className="compendium-item-row"
      style={{ '--rarity-color': RARITY_COLOR_VARS[item.rarity] } as CSSProperties}
      onClick={onInspect}
      aria-label={`${item.name} — view details`}
    >
      <span className="compendium-item-plate">
        <EquipmentIcon item={item} className="compendium-item-icon" />
      </span>
      <span className="compendium-item-body">
        <span className="compendium-item-name">{item.name}</span>
        <span className="compendium-item-chips">
          <ItemEffectChips item={item} />
        </span>
      </span>
    </button>
  );
}

function EquipmentShelf({ rarity, items, onInspect }: { rarity: EquipmentRarity; items: EquipmentDefinition[]; onInspect: (id: string) => void }) {
  return (
    <>
      <div className="tab-subhead compendium-shelf-head" style={{ '--rarity-color': RARITY_COLOR_VARS[rarity] } as CSSProperties}>
        {RARITY_LABELS[rarity]}
      </div>
      <div className="compendium-shelf">
        {items.map((item) => (
          <CompendiumItemRow key={item.id} item={item} onInspect={() => onInspect(item.id)} />
        ))}
      </div>
    </>
  );
}

type CompendiumTab = 'starters' | 'recruitable' | 'equipment' | 'types';

const TABS: readonly TabSpec<CompendiumTab>[] = [
  { id: 'starters', label: 'Starters', glyph: 'heroes' },
  { id: 'recruitable', label: 'Recruitable', glyph: 'recruit' },
  { id: 'equipment', label: 'Equipment', glyph: 'equipment' },
  { id: 'types', label: 'Types', glyph: 'matchups' },
];

/** The dial's box on the Types page, px: the page well's inner width on the narrowest phone. */
const CHART_WHEEL = 300;

/** One row of the readout: every type on one side of a cell, or nothing. */
function ReadoutRow({ label, types, onPick }: { label: string; types: readonly TypeId[]; onPick: (type: TypeId) => void }) {
  return (
    <div className="type-readout-row">
      <span className="type-readout-label">{label}</span>
      <span className="type-readout-types">
        {types.length > 0 ? (
          types.map((t) => (
            <button key={t} type="button" className="type-readout-pick" data-sfx="ui.select" onClick={() => onPick(t)}>
              <TypeBadge type={t} />
            </button>
          ))
        ) : (
          <span className="matchup-none">None</span>
        )}
      </span>
    </div>
  );
}

/**
 * The type chart as the dial (shared/TypeWheel.tsx), tappable. Tap a glyph and the dial lights
 * that type both ways — the chords it strikes along in its own colour, the chords that strike it
 * in theirs — and the readout under it spells the cell out in both directions, every badge a way
 * to the next type. Ancient has no seat on the dial (it strikes nothing for 2×), so it is reached
 * through the readout, where it sits in every type's ½× row: the wall, found by running into it.
 */
function TypeChartTab() {
  const [selected, setSelected] = useState<TypeId | null>(null);
  const attacks = selected ? typeChart[selected] : null;
  const strikes = attacks ? TYPES.filter((d) => attacks[d] > 1) : [];
  const glances = attacks ? TYPES.filter((d) => attacks[d] < 1) : [];
  const weakTo = selected ? TYPES.filter((a) => typeChart[a][selected] > 1) : [];
  const resists = selected ? TYPES.filter((a) => typeChart[a][selected] < 1) : [];

  return (
    <div className="type-chart-tab">
      <TypeWheel
        className="type-chart-wheel"
        size={CHART_WHEEL}
        focus={selected ? [selected] : undefined}
        focusIncoming
        clearCentre={false}
        ring
        onPickType={(t) => setSelected(t === selected ? null : t)}
      />
      {selected ? (
        <div className="type-readout" style={{ '--type-rgb': getTypeColorRgb(selected), '--type-color': getTypeColor(selected) } as CSSProperties}>
          <div className="type-readout-head">
            <span className="type-readout-glyph">
              <ElementGlyph type={selected} />
            </span>
            <span className="type-readout-name">{selected}</span>
          </div>
          <div className="type-readout-side">Attacking</div>
          <ReadoutRow label="Strikes 2×" types={strikes} onPick={setSelected} />
          <ReadoutRow label="Only ½×" types={glances} onPick={setSelected} />
          <div className="type-readout-side">Defending</div>
          <ReadoutRow label="Weak to" types={weakTo} onPick={setSelected} />
          <ReadoutRow label="Resists" types={resists} onPick={setSelected} />
        </div>
      ) : (
        <p className="type-chart-hint">Tap a type to read its matchups. Every line is a 2× hit, running from the striker to the struck.</p>
      )}
    </div>
  );
}

/**
 * The same sheet as the hero dossier it opens (HeroDossierOverlay — title bar, page well, the
 * strip as the bottom band, Close under the panel), cut in the accent gold rather than a hero's
 * colour: the book and the page it opens to should not be two designs, and on a phone held
 * one-handed the page switch belongs in the thumb's arc, not at the top edge. The panel is full
 * height so the strip sits in the same place on every page.
 */
export function CompendiumScreen({ onClose }: Props) {
  const [tab, setTab] = useState<CompendiumTab>('starters');
  const [inspectItemId, setInspectItemId] = useState<string | null>(null);
  const [dossierHeroId, setDossierHeroId] = useState<string | null>(null);
  const heroList = tab === 'starters' ? STARTER_HEROES : RECRUIT_HEROES;
  const inspectItem = inspectItemId ? equipment[inspectItemId] : null;
  const dossierHero = dossierHeroId ? heroes[dossierHeroId] : null;

  return (
    <div className="detail-overlay is-sheet compendium-overlay" onClick={onClose}>
      <div className="detail-panel is-tabbed is-hero-sheet compendium-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="detail-header is-hero compendium-head">
          <span className="detail-portrait-plate compendium-head-plate" aria-hidden="true">
            <HubGlyph name="codex" className="compendium-head-glyph" />
          </span>
          <span className="detail-name compendium-head-title">Compendium</span>
        </div>

        {/* Keyed on the page so a switch scrolls the well back to its top. */}
        <div key={tab} className="detail-tab-body compendium-body" role="tabpanel">
          {tab === 'types' ? (
            <TypeChartTab />
          ) : tab === 'equipment' ? (
            EQUIPMENT_SHELVES.map((shelf) => <EquipmentShelf key={shelf.rarity} rarity={shelf.rarity} items={shelf.items} onInspect={setInspectItemId} />)
          ) : (
            <div className="compendium-list">
              {heroList.map((hero) => (
                <CompendiumHeroRow key={hero.id} hero={hero} onOpen={() => setDossierHeroId(hero.id)} />
              ))}
            </div>
          )}
        </div>

        <TabStrip tabs={TABS} active={tab} onSelect={setTab} />
      </div>

      <div className="sheet-footer" onClick={(e) => e.stopPropagation()}>
        <button className="resolve-button sheet-close-button" onClick={onClose}>
          Close
        </button>
      </div>

      {dossierHero && <HeroDossierOverlay hero={dossierHero} onClose={() => setDossierHeroId(null)} />}

      <ItemDetailOverlay item={inspectItem} onClose={() => setInspectItemId(null)} />
    </div>
  );
}
