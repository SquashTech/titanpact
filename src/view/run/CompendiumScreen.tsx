import { useState, type CSSProperties } from 'react';
import { heroes } from '../../data/heroes';
import { TYPES } from '../../data/typechart';
import { equipment } from '../../data/equipment';
import { passives } from '../../data/passives';
import { statuses } from '../../data/statuses';
import type { HeroDefinition, StatKey } from '../../engine/content';
import type { EquipmentDefinition } from '../../run/equipment';
import { RARITY_ORDER } from '../../run/equipment';
import { getTypeColor } from '../combat/typeColors';
import { StatBars, STAT_ICONS, STAT_LABELS } from '../shared/StatBars';
import { TypeBadge } from '../shared/TypeBadge';
import { HeroPortrait } from '../shared/HeroPortrait';
import { EQUIP_SLOT_LABELS, EQUIP_SLOT_ORDER, EquipmentIcon, fmtGrant, RARITY_COLOR_VARS, RARITY_LABELS } from '../shared/EquipmentBox';
import { passiveEmoji } from '../shared/passiveIcons';

interface Props {
  onClose: () => void;
}

/**
 * Read-only hero browser, reachable from the title screen before a run even
 * starts. Shows every authored HeroDefinition's base stats — unlike
 * HeroPreviewOverlay, there's no RosterEntry here (no level, no Evolution
 * grants, no equipment): this is the hero as designed, not a specific run's
 * build of it.
 */
function CompendiumHeroCard({ hero }: { hero: HeroDefinition }) {
  return (
    <div className="roster-mgmt-card" style={{ borderLeftColor: getTypeColor(hero.types[0]) }}>
      <span className={`roster-card-badge ${hero.starter ? 'badge-ally' : 'badge-recruit'}`}>
        {hero.starter ? 'STARTER' : 'RECRUIT ONLY'}
      </span>
      <div className="roster-mgmt-head">
        <HeroPortrait heroId={hero.id} className="roster-mgmt-portrait" />
        <div className="roster-mgmt-name">{hero.name}</div>
        <div className="roster-card-types">
          {hero.types.map((t) => (
            <TypeBadge key={t} type={t} />
          ))}
        </div>
      </div>

      <div className="detail-section-title">Stats</div>
      <StatBars baseStats={hero.baseStats} />
    </div>
  );
}

/** "+10 Attack, +20 HP, Fire Force +10" — mirrors NodeRewardScreen's itemHighlights, folding passive/status grants in alongside raw stats so a stat-less item (e.g. an Elemental Force accessory) never reads as blank on the card face. */
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

/** Read-only version of NodeRewardScreen's EquipCacheCard — same card visual (rarity-tinted left border, icon badge, one-line highlight summary) but tap just opens the detail popup, no select-then-claim step. */
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

export function CompendiumScreen({ onClose }: Props) {
  /** Starters is the default tab; Recruitable and Equipment are additional tabs the player has to select — the hero pools mirror the draft vs. Guild Hall split (HeroDefinition.starter, src/data/heroes.ts), Equipment is every authored item regardless of drop source. */
  const [tab, setTab] = useState<CompendiumTab>('starters');
  const [inspectItemId, setInspectItemId] = useState<string | null>(null);
  // Ordered by the hero's primary type's position in the 15-type chart
  // (src/data/typechart.ts TYPES), not authoring order — a stable sort keeps
  // same-primary-type heroes (e.g. Warden/Valor, both Iron) in their existing
  // relative order instead of reshuffling them further.
  const heroList = Object.values(heroes)
    .filter((hero) => (tab === 'starters' ? hero.starter : !hero.starter))
    .sort((a, b) => TYPES.indexOf(a.types[0] as (typeof TYPES)[number]) - TYPES.indexOf(b.types[0] as (typeof TYPES)[number]));

  // Weapon, then armor, then accessory (EQUIP_SLOT_ORDER); within a slot, common through mythic (RARITY_ORDER); a stable sort keeps same-slot-same-rarity items in their authoring order.
  const equipmentList = Object.values(equipment).sort(
    (a, b) => EQUIP_SLOT_ORDER.indexOf(a.slot) - EQUIP_SLOT_ORDER.indexOf(b.slot) || RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity)
  );
  const inspectItem = inspectItemId ? equipment[inspectItemId] : null;

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
              {equipmentList.map((item) => (
                <CompendiumEquipmentCard key={item.id} item={item} onInspect={() => setInspectItemId(item.id)} />
              ))}
            </div>
          ) : (
            <div className="roster-mgmt-list">
              {heroList.map((hero) => (
                <CompendiumHeroCard key={hero.id} hero={hero} />
              ))}
            </div>
          )}
        </div>
      </div>

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
                          {STAT_ICONS[stat]} {STAT_LABELS[stat]} {fmtGrant(amount)}
                        </span>
                      ))}
                    </div>
                  )}
                  {(grantedPassives.length > 0 || grantedStatuses.length > 0) && (
                    <div className="equip-spotlight-passives">
                      {grantedPassives.map((passiveId) => {
                        const def = passives[passiveId];
                        if (!def) return null;
                        return (
                          <div key={passiveId} className="equip-spotlight-passive">
                            <span className="equip-spotlight-passive-name">
                              {passiveEmoji[passiveId] ? `${passiveEmoji[passiveId]} ` : ''}
                              {def.name}
                            </span>
                            <span className="equip-spotlight-passive-desc">{def.description}</span>
                          </div>
                        );
                      })}
                      {grantedStatuses.map(({ statusId, magnitude }) => {
                        const def = statuses[statusId];
                        if (!def) return null;
                        return (
                          <div key={statusId} className="equip-spotlight-passive">
                            <span className="equip-spotlight-passive-name">
                              {def.name} +{magnitude}
                            </span>
                            <span className="equip-spotlight-passive-desc">{def.description}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
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
