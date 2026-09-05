import { useState, type CSSProperties } from 'react';
import { heroes } from '../../data/heroes';
import { TYPES } from '../../data/typechart';
import { equipment } from '../../data/equipment';
import { passives } from '../../data/passives';
import { statuses } from '../../data/statuses';
import type { HeroDefinition, StatKey } from '../../engine/content';
import type { EquipmentDefinition } from '../../run/equipment';
import { RARITY_ORDER } from '../../run/equipment';
import { getTypeAbbr, getTypeColor, getTypeColorRgb } from '../combat/typeColors';
import { StatGlyph, STAT_LABELS } from '../shared/StatBars';
import { ElementGlyph } from '../shared/elementIcons';
import { HeroPortrait } from '../shared/HeroPortrait';
import { EQUIP_SLOT_LABELS, EQUIP_SLOT_ORDER, EquipmentEffectList, EquipmentIcon, fmtGrant, RARITY_COLOR_VARS, RARITY_LABELS } from '../shared/EquipmentBox';
import { HeroDossierOverlay } from './HeroDossierOverlay';

interface Props {
  /** heroId -> runs cleared with that hero (src/run/profile.ts). Empty is normal, not a missing prop. */
  heroStars: Readonly<Record<string, number>>;
  onClose: () => void;
}

// Primary type in type-chart order (TYPES); a stable sort keeps same-type heroes in authoring order.
function byPrimaryType(a: HeroDefinition, b: HeroDefinition): number {
  return TYPES.indexOf(a.types[0] as (typeof TYPES)[number]) - TYPES.indexOf(b.types[0] as (typeof TYPES)[number]);
}
const STARTER_HEROES = Object.values(heroes).filter((hero) => hero.starter).sort(byPrimaryType);
const RECRUIT_HEROES = Object.values(heroes).filter((hero) => !hero.starter).sort(byPrimaryType);
// Slot order, then rarity; stable, so same-slot-same-rarity items keep authoring order.
const EQUIPMENT_LIST = Object.values(equipment).sort(
  (a, b) => EQUIP_SLOT_ORDER.indexOf(a.slot) - EQUIP_SLOT_ORDER.indexOf(b.slot) || RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity)
);

/**
 * Roster tile: sprite, name, types, nothing else — the whole hero is one tap away in
 * HeroDossierOverlay. Wears `.pick-card`'s clothes (the shared "pick a hero" card) minus the
 * level mark and CTA line, which need a RosterEntry the compendium deliberately does not have.
 */
function CompendiumHeroTile({ hero, stars, onOpen }: { hero: HeroDefinition; stars: number; onOpen: () => void }) {
  return (
    <button
      type="button"
      className="pick-card compendium-tile"
      style={{ '--type-rgb': getTypeColorRgb(hero.types[0]) } as CSSProperties}
      onClick={onOpen}
      aria-label={stars > 0 ? `${hero.name} — view details, ${stars} cleared` : `${hero.name} — view details`}
    >
      <div className="pick-figure">
        <span className="pick-ground" aria-hidden="true" />
        <HeroPortrait heroId={hero.id} className="pick-portrait" />
        {/* One star and a count rather than a row of them: the tally has no ceiling. */}
        {stars > 0 && (
          <span className="compendium-star" title={`${stars} ${stars === 1 ? 'run' : 'runs'} cleared`}>
            ★{stars > 1 && <span className="compendium-star-count">{stars}</span>}
          </span>
        )}
      </div>
      <span className="pick-name">{hero.name}</span>
      <span className="pick-types">
        {hero.types.map((t) => (
          <span key={t} className="pick-type-code" style={{ color: getTypeColor(t) }} title={t}>
            <ElementGlyph type={t} />
            {getTypeAbbr(t)}
          </span>
        ))}
      </span>
    </button>
  );
}

/** Card-face summary, folding passive/status grants in so a stat-less item never reads as blank. Uses the short STAT_LABELS, unlike EquipChoiceCard's full-word `itemHighlights` — not interchangeable. */
function itemHighlights(item: EquipmentDefinition): string[] {
  const statParts = Object.entries(item.statGrants)
    .filter(([, amount]) => amount)
    .map(([stat, amount]) => `${(amount as number) > 0 ? '+' : ''}${amount} ${STAT_LABELS[stat as StatKey] ?? stat}`);
  const passiveParts = (item.grantsPassiveIds ?? []).flatMap((id) => (passives[id] ? [passives[id].name] : []));
  const statusParts = (item.grantsStatusIds ?? []).flatMap(({ statusId, magnitude }) =>
    statuses[statusId] ? [`${statuses[statusId].name} +${magnitude}`] : []
  );
  return [...statParts, ...passiveParts, ...statusParts];
}

interface CompendiumEquipmentCardProps {
  item: EquipmentDefinition;
  onInspect: () => void;
}

/** Read-only EquipChoiceCard: tap opens the detail popup, no select-then-claim. */
function CompendiumEquipmentCard({ item, onInspect }: CompendiumEquipmentCardProps) {
  const highlights = itemHighlights(item);
  return (
    <button
      type="button"
      className="equip-cache-card"
      style={{ '--rarity-color': RARITY_COLOR_VARS[item.rarity] } as CSSProperties}
      onClick={onInspect}
    >
      <div className="equip-cache-card-icon-badge">
        <EquipmentIcon item={item} slot={item.slot} className="equip-cache-card-icon" />
      </div>
      <div className="equip-cache-card-body">
        <div className="equip-cache-card-name">{item.name}</div>
        <div className="equip-cache-card-meta">
          <span className="equip-cache-card-rarity">{RARITY_LABELS[item.rarity]}</span>
          <span className="equip-cache-card-slot">{EQUIP_SLOT_LABELS[item.slot]}</span>
        </div>
        <div className="equip-cache-card-stats">{highlights.length > 0 ? highlights.join(' · ') : 'No effect'}</div>
      </div>
    </button>
  );
}

type CompendiumTab = 'starters' | 'recruitable' | 'equipment';

export function CompendiumScreen({ heroStars, onClose }: Props) {
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
        </div>
        <div className="screen-scroll">
          {tab === 'equipment' ? (
            <div className="equip-cache-list">
              {EQUIPMENT_LIST.map((item) => (
                <CompendiumEquipmentCard key={item.id} item={item} onInspect={() => setInspectItemId(item.id)} />
              ))}
            </div>
          ) : (
            <div className="pick-grid pick-cols-3 compendium-grid">
              {heroList.map((hero) => (
                <CompendiumHeroTile key={hero.id} hero={hero} stars={heroStars[hero.id] ?? 0} onOpen={() => setDossierHeroId(hero.id)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {dossierHero && <HeroDossierOverlay hero={dossierHero} onClose={() => setDossierHeroId(null)} />}

      {inspectItem &&
        (() => {
          const grants = Object.entries(inspectItem.statGrants).filter(([, amount]) => amount) as [StatKey, number][];
          const grantedPassives = inspectItem.grantsPassiveIds ?? [];
          const grantedStatuses = inspectItem.grantsStatusIds ?? [];
          const hasEffects = grants.length > 0 || grantedPassives.length > 0 || grantedStatuses.length > 0;
          return (
            <div className="log-overlay" onClick={(e) => { e.stopPropagation(); setInspectItemId(null); }}>
              <div className="log-panel move-popup-panel" onClick={(e) => e.stopPropagation()}>
                <div className="move-info-panel" style={{ '--rarity-color': RARITY_COLOR_VARS[inspectItem.rarity] } as CSSProperties}>
                  <div className="move-info-head">
                    <span className="move-info-name">{inspectItem.name}</span>
                    <span className="move-info-kind">
                      {RARITY_LABELS[inspectItem.rarity]} · {EQUIP_SLOT_LABELS[inspectItem.slot]}
                    </span>
                  </div>
                  {grants.length > 0 && (
                    <div className="detail-modifier-list">
                      {grants.map(([stat, amount]) => (
                        <span key={stat} className={`detail-modifier-chip ${amount > 0 ? 'stat-buff' : 'stat-debuff'}`}>
                          <StatGlyph stat={stat} tone="inherit" /> {STAT_LABELS[stat]} {fmtGrant(amount)}
                        </span>
                      ))}
                    </div>
                  )}
                  <EquipmentEffectList item={inspectItem} />
                  {!hasEffects && <div className="move-info-placeholder">No effects.</div>}
                </div>
                <div className="move-popup-hint">Tap anywhere to close</div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
