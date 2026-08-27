import type { CSSProperties } from 'react';
import type { StatKey } from '../../engine/content';
import type { EquipmentDefinition, EquipmentLoadout, EquipmentRarity, EquipmentSlot } from '../../run/equipment';
import { StatGlyph, STAT_LABELS } from './StatBars';
import { IconsetGlyph } from './RunGlyph';
import { useLongPress } from './MoveTile';
import { passives } from '../../data/passives';
import { passiveEmoji } from './passiveIcons';
import { statuses } from '../../data/statuses';

export const EQUIP_SLOT_ORDER: EquipmentSlot[] = ['weapon', 'armor', 'accessory'];

/** Generic per-slot glyph — only shown for an empty slot, or for an item without its own art in itemArt.ts (EquipmentIcon below prefers the item-specific icon whenever one exists). */
export const EQUIP_SLOT_ICONS: Record<EquipmentSlot, number> = {
  weapon: 97,
  armor: 81,
  accessory: 84,
};

/** 2500+ icon-sheet indices for the authored equipment catalogue. */
const EQUIPMENT_ICON_INDICES: Partial<Record<string, number>> = {
  ironBlade: 97,
  dagger: 96,
  arcaneFocus: 70,
  oakenArmor: 81,
  guardianPlate: 83,
  swiftBoots: 86,
  vitalCharm: 84,
};

/** 2500+ icon-sheet indices for the authored relic catalogue. */
const RELIC_ICON_INDICES: Partial<Record<string, number>> = {
  ironStandard: 81,
  warHorn: 77,
  sagesLantern: 70,
  windcallersBanner: 66,
  deepWellstone: 68,
  bulwarkCore: 83,
};

interface EquipmentIconProps {
  item: EquipmentDefinition | null;
  slot: EquipmentSlot;
  className?: string;
}

/** Renders the item's 2500+ sprite glyph, preserving a distinctive silhouette for each item. */
export function EquipmentIcon({ item, slot, className }: EquipmentIconProps) {
  return <IconsetGlyph index={item ? (EQUIPMENT_ICON_INDICES[item.id] ?? EQUIP_SLOT_ICONS[slot]) : EQUIP_SLOT_ICONS[slot]} className={`equip-icon-img ${className ?? ''}`} />;
}

interface RelicIconProps {
  relicId: string;
  className?: string;
}

/** Same 2500+ sprite treatment for relics; the gem is the neutral fallback. */
export function RelicIcon({ relicId, className }: RelicIconProps) {
  return <IconsetGlyph index={RELIC_ICON_INDICES[relicId] ?? 3} className={`equip-icon-img ${className ?? ''}`} />;
}

export const EQUIP_SLOT_LABELS: Record<EquipmentSlot, string> = {
  weapon: 'Weapon',
  armor: 'Armor',
  accessory: 'Accessory',
};

/** Gray/blue/purple/gold/red — the tier palette (styles.css :root --tier-*), referenced by CSS var so every rarity-colored element (cards, borders, glows) stays in sync from one source. */
export const RARITY_COLOR_VARS: Record<EquipmentRarity, string> = {
  common: 'var(--tier-common)',
  rare: 'var(--tier-rare)',
  epic: 'var(--tier-epic)',
  legendary: 'var(--tier-legendary)',
  mythic: 'var(--tier-mythic)',
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
  /** Long-press on a filled slot — opens the shared item-detail popup (matches the "hold a move or item to inspect it" standard, e.g. RosterManagementScreen's EquipSlotButton). Omit for an inert, non-inspectable grid. */
  onInspect?: (itemId: string) => void;
  /** Slot to mark with the .target outline — the slot an incoming item would land in (ForceEquipScreen). */
  highlightSlot?: EquipmentSlot | null;
}

interface EquipSlotBoxProps {
  slot: EquipmentSlot;
  item: EquipmentDefinition | null;
  onInspect?: (itemId: string) => void;
  highlighted?: boolean;
}

/**
 * One slot box — pulled out of EquipmentSlotGrid's .map() because
 * useLongPress is a hook and can't be called from inside a loop body (same
 * reason RosterManagementScreen's EquipSlotButton is its own component).
 * Tap does nothing here (this grid is inspection-only); a ~500ms hold opens
 * the shared item-detail popup, mirroring MoveTile's "hold for details" rule
 * so moves and equipment share one interaction language everywhere a hero's
 * loadout is shown. The rarity tint on a filled box's left edge (borrowed
 * from the Equipment Cache/Relic Shrine's --rarity-color convention) lets a
 * player clock an item's tier before ever opening the popup.
 */
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

/**
 * Read-only rectangular equip-slot boxes — the same equip-slot-box visual
 * convention RosterManagementScreen established for its equip/unequip grid
 * (.equip-slot-row/.equip-slot-box, styles.css), reused here for stat-block
 * contexts (HeroDetailOverlay, HeroPreviewOverlay) where a filled box's only
 * interaction is a long-press to inspect it. Empty slots are inert.
 */
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

interface EquipmentInfoPanelProps {
  item: EquipmentDefinition | null;
  placeholder?: string;
}

/**
 * Fixed detail readout paired with EquipmentSlotGrid — mirrors MoveInfoPanel's
 * fixed-box-regardless-of-content convention (MoveTile.tsx doc comment,
 * shared .move-info-panel styling) so tapping a slot never reflows the panel
 * beneath it.
 */
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
                    {passiveEmoji[passiveId] ? `${passiveEmoji[passiveId]} ` : ''}
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
