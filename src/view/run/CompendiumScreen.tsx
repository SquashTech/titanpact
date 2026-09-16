import { useState, type CSSProperties } from 'react';
import { heroes } from '../../data/heroes';
import { TYPES, typeChart } from '../../data/typechart';
import { equipment, EQUIPMENT_DROP_POOL, UNIQUE_EQUIPMENT } from '../../data/equipment';
import type { HeroDefinition, TypeId } from '../../engine/content';
import type { EquipmentDefinition } from '../../run/equipment';
import { RARITY_ORDER } from '../../run/equipment';
import { getTypeAbbr, getTypeColor, getTypeColorRgb } from '../combat/typeColors';
import { ElementGlyph } from '../shared/elementIcons';
import { HeroPortrait } from '../shared/HeroPortrait';
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
// Rarity, then authoring order — items are uncategorised, so the tier is the only grouping left.
const EQUIPMENT_LIST = [...EQUIPMENT_DROP_POOL, ...UNIQUE_EQUIPMENT].sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity));

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

interface CompendiumEquipmentCardProps {
  item: EquipmentDefinition;
  onInspect: () => void;
}

/** Read-only EquipChoiceCard: tap opens the detail popup, no select-then-claim. */
function CompendiumEquipmentCard({ item, onInspect }: CompendiumEquipmentCardProps) {
  return (
    <button
      type="button"
      className="equip-cache-card"
      style={{ '--rarity-color': RARITY_COLOR_VARS[item.rarity] } as CSSProperties}
      onClick={onInspect}
    >
      <div className="equip-cache-card-icon-badge">
        <EquipmentIcon item={item} className="equip-cache-card-icon" />
      </div>
      <div className="equip-cache-card-body">
        <div className="equip-cache-card-name">{item.name}</div>
        <div className="equip-cache-card-meta">
          <span className="equip-cache-card-rarity">{RARITY_LABELS[item.rarity]}</span>
        </div>
        <div className="equip-cache-card-stats">
          <ItemEffectChips item={item} />
        </div>
      </div>
    </button>
  );
}

type CompendiumTab = 'starters' | 'recruitable' | 'equipment' | 'types';

/** The dial's box on the Types tab, px: the panel's width less its padding. */
const CHART_WHEEL = 320;

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

export function CompendiumScreen({ onClose }: Props) {
  const [tab, setTab] = useState<CompendiumTab>('starters');
  const [inspectItemId, setInspectItemId] = useState<string | null>(null);
  const [dossierHeroId, setDossierHeroId] = useState<string | null>(null);
  const heroList = tab === 'starters' ? STARTER_HEROES : RECRUIT_HEROES;
  const inspectItem = inspectItemId ? equipment[inspectItemId] : null;
  const dossierHero = dossierHeroId ? heroes[dossierHeroId] : null;

  return (
    <div className="log-overlay roster-mgmt-overlay" onClick={onClose}>
      <div className="log-panel roster-panel" onClick={(e) => e.stopPropagation()}>
        <div className="log-panel-header">
          <span>Compendium</span>
          <button className="log-close-button" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="compendium-tabs">
          <button className={`compendium-tab${tab === 'starters' ? ' active' : ''}`} onClick={() => setTab('starters')}>
            Starters
          </button>
          <button className={`compendium-tab${tab === 'recruitable' ? ' active' : ''}`} onClick={() => setTab('recruitable')}>
            Recruitable
          </button>
          <button className={`compendium-tab${tab === 'equipment' ? ' active' : ''}`} onClick={() => setTab('equipment')}>
            Equipment
          </button>
          <button className={`compendium-tab${tab === 'types' ? ' active' : ''}`} onClick={() => setTab('types')}>
            Types
          </button>
        </div>
        <div className="screen-scroll">
          {tab === 'types' ? (
            <TypeChartTab />
          ) : tab === 'equipment' ? (
            <div className="equip-cache-list">
              {EQUIPMENT_LIST.map((item) => (
                <CompendiumEquipmentCard key={item.id} item={item} onInspect={() => setInspectItemId(item.id)} />
              ))}
            </div>
          ) : (
            <div className="compendium-list">
              {heroList.map((hero) => (
                <CompendiumHeroRow key={hero.id} hero={hero} onOpen={() => setDossierHeroId(hero.id)} />
              ))}
            </div>
          )}
        </div>

        {/* Outside the scroll and pinned to the foot, as on the gear sheet (RosterManagementScreen):
            the header ✕ stays where every overlay puts it, but on a phone it is the corner furthest
            from the thumb. */}
        <button className="resolve-button roster-close-button" onClick={onClose}>
          Close
        </button>
      </div>

      {dossierHero && <HeroDossierOverlay hero={dossierHero} onClose={() => setDossierHeroId(null)} />}

      <ItemDetailOverlay item={inspectItem} onClose={() => setInspectItemId(null)} />
    </div>
  );
}
