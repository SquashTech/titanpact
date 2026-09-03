import type { CSSProperties } from 'react';
import type { StatKey } from '../../engine/content';
import type { EquipmentDefinition, EquipmentLoadout, EquipmentRarity, EquipmentSlot } from '../../run/equipment';
import { StatGlyph, STAT_LABELS } from './StatBars';
import { IconsetGlyph } from './RunGlyph';
import { EquipmentFormGlyph } from './equipmentIcons';
import { useLongPress } from './MoveTile';
import { passives } from '../../data/passives';
import { PassiveGlyph } from './passiveIcons';
import { statuses } from '../../data/statuses';

export const EQUIP_SLOT_ORDER: EquipmentSlot[] = ['weapon', 'armor', 'accessory'];

/** 2500+ icon-sheet indices for the authored relic catalogue. */
const RELIC_ICON_INDICES: Partial<Record<string, number>> = {
  ironStandard: 81,
  warHorn: 77,
  sagesLantern: 70,
  windcallersBanner: 66,
  deepWellstone: 68,
  bulwarkCore: 83,
  // Guardian's Banners: heart / mana orb / cycle arrows, the resource each grants.
  bannerOfVitality: 84,
  bannerOfTheWellspring: 165,
  bannerOfTheEverflow: 75,
};

interface EquipmentIconProps {
  item: EquipmentDefinition | null;
  slot: EquipmentSlot;
  className?: string;
}

/** The item's silhouette, derived from its name (equipmentIcons.tsx) rather than an id table. */
export function EquipmentIcon({ item, slot, className }: EquipmentIconProps) {
  return <EquipmentFormGlyph item={item} slot={slot} className={className} />;
}

interface RelicIconProps {
  relicId: string;
  className?: string;
}

/** Gem (index 3) is the fallback. */
export function RelicIcon({ relicId, className }: RelicIconProps) {
  return <IconsetGlyph index={RELIC_ICON_INDICES[relicId] ?? 3} className={`equip-icon-img ${className ?? ''}`} />;
}

export const EQUIP_SLOT_LABELS: Record<EquipmentSlot, string> = {
  weapon: 'Weapon',
  armor: 'Armor',
  accessory: 'Accessory',
};

/** Tier palette as CSS vars (styles.css :root --tier-*). */
export const RARITY_COLOR_VARS: Record<EquipmentRarity, string> = {
  common: 'var(--tier-common)',
  rare: 'var(--tier-rare)',
  epic: 'var(--tier-epic)',
  legendary: 'var(--tier-legendary)',
  mythic: 'var(--tier-mythic)',
};

/** Same tiers as bare `r, g, b` triples, for rgba() consumers (the node sky). */
export const RARITY_RGB_VARS: Record<EquipmentRarity, string> = {
  common: 'var(--tier-common-rgb)',
  rare: 'var(--tier-rare-rgb)',
  epic: 'var(--tier-epic-rgb)',
  legendary: 'var(--tier-legendary-rgb)',
  mythic: 'var(--tier-mythic-rgb)',
};

export const RARITY_LABELS: Record<EquipmentRarity, string> = {
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
  mythic: 'Mythic',
};

export function fmtGrant(amount: number): string {
  return amount > 0 ? `+${amount}` : `${amount}`;
}

interface EquipmentSlotGridProps {
  loadout: EquipmentLoadout;
  equipmentLookup: Record<string, EquipmentDefinition>;
  /** Long-press on a filled slot. Omit for an inert grid. */
  onInspect?: (itemId: string) => void;
  /** Slot to mark with the .target outline — where an incoming item would land. */
  highlightSlot?: EquipmentSlot | null;
}

interface EquipSlotBoxProps {
  slot: EquipmentSlot;
  item: EquipmentDefinition | null;
  onInspect?: (itemId: string) => void;
  highlighted?: boolean;
}

// Its own component because useLongPress is a hook. Tap does nothing; hold inspects.
function EquipSlotBox({ slot, item, onInspect, highlighted }: EquipSlotBoxProps) {
  const longPress = useLongPress(item && onInspect ? () => onInspect(item.id) : undefined);
  return (
    <button
      type="button"
      className={`equip-slot-box${item ? ' filled' : ' empty'}${highlighted ? ' target' : ''}`}
      style={item ? ({ '--rarity-color': RARITY_COLOR_VARS[item.rarity] } as CSSProperties) : undefined}
      aria-label={item ? `${EQUIP_SLOT_LABELS[slot]}: ${item.name}` : `${EQUIP_SLOT_LABELS[slot]} slot, empty`}
      {...longPress}
    >
      <EquipmentIcon item={item} slot={slot} className="equip-slot-icon" />
      <span className="equip-slot-item">{item ? item.name : 'Empty'}</span>
    </button>
  );
}

/** Read-only equip-slot boxes; a filled box's only interaction is a long-press to inspect. */
export function EquipmentSlotGrid({ loadout, equipmentLookup, onInspect, highlightSlot }: EquipmentSlotGridProps) {
  return (
    <div className="equip-slot-row">
      {EQUIP_SLOT_ORDER.map((slot) => {
        const itemId = loadout[slot];
        const item = itemId ? equipmentLookup[itemId] : null;
        return <EquipSlotBox key={slot} slot={slot} item={item} onInspect={onInspect} highlighted={slot === highlightSlot} />;
      })}
    </div>
  );
}

/** Every granted passive and status with its full description. Nothing for a stats-only item. */
export function EquipmentEffectList({ item }: { item: EquipmentDefinition | null }) {
  const grantedPassives = item?.grantsPassiveIds ?? [];
  const grantedStatuses = item?.grantsStatusIds ?? [];
  if (grantedPassives.length === 0 && grantedStatuses.length === 0) return null;
  return (
    <div className="equip-spotlight-passives">
      {grantedPassives.map((passiveId) => {
        const def = passives[passiveId];
        if (!def) return null;
        return (
          <div key={passiveId} className="equip-spotlight-passive">
            <span className="equip-spotlight-passive-name">
              <PassiveGlyph passiveId={passiveId} />{" "}
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
  );
}

interface EquipmentInfoPanelProps {
  item: EquipmentDefinition | null;
  placeholder?: string;
}

/** Fixed-size detail readout, same `.move-info-panel` box as MoveInfoPanel. */
export function EquipmentInfoPanel({ item, placeholder = 'Tap an equipped item to see what it does.' }: EquipmentInfoPanelProps) {
  const grants = item ? (Object.entries(item.statGrants) as [StatKey, number][]) : [];
  const grantedPassives = item?.grantsPassiveIds ?? [];
  const grantedStatuses = item?.grantsStatusIds ?? [];
  return (
    <div className="move-info-panel">
      {item ? (
        <>
          <div className="move-info-head">
            <span className="move-info-name">{item.name}</span>
            <span className="move-info-kind">{EQUIP_SLOT_LABELS[item.slot]}</span>
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
          {(grantedPassives.length > 0 || grantedStatuses.length > 0) && (
            <div className="detail-modifier-list">
              {grantedPassives.map((passiveId) => {
                const def = passives[passiveId];
                if (!def) return null;
                return (
                  <span key={passiveId} className="detail-modifier-chip">
                    <PassiveGlyph passiveId={passiveId} />{" "}
                    Grants: {def.name}
                  </span>
                );
              })}
              {grantedStatuses.map(({ statusId, magnitude }) => {
                const def = statuses[statusId];
                if (!def) return null;
                return (
                  <span key={statusId} className="detail-modifier-chip">
                    Grants: {def.name} +{magnitude}
                  </span>
                );
              })}
            </div>
          )}
          {grants.length === 0 && grantedPassives.length === 0 && grantedStatuses.length === 0 && (
            <div className="move-info-placeholder">No stat effects.</div>
          )}
        </>
      ) : (
        <div className="move-info-placeholder">{placeholder}</div>
      )}
    </div>
  );
}
