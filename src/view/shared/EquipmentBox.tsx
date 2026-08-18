import type { StatKey } from '../../engine/content';
import type { EquipmentDefinition, EquipmentLoadout, EquipmentRarity, EquipmentSlot } from '../../run/equipment';
import { STAT_ICONS, STAT_LABELS } from './StatBars';

export const EQUIP_SLOT_ORDER: EquipmentSlot[] = ['weapon', 'armor', 'accessory'];

export const EQUIP_SLOT_ICONS: Record<EquipmentSlot, string> = {
  weapon: '⚔️',
  armor: '🛡️',
  accessory: '💍',
};

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

function fmtGrant(amount: number): string {
  return amount > 0 ? `+${amount}` : `${amount}`;
}

interface EquipmentSlotGridProps {
  loadout: EquipmentLoadout;
  equipmentLookup: Record<string, EquipmentDefinition>;
  /** Which item id (if any) is currently loaded into the paired EquipmentInfoPanel, for the .selected highlight. */
  viewedItemId?: string | null;
  onSelect?: (itemId: string) => void;
}

/**
 * Read-only rectangular equip-slot boxes — the same equip-slot-box visual
 * convention RosterManagementScreen established for its equip/unequip grid
 * (.equip-slot-row/.equip-slot-box, styles.css), reused here for stat-block
 * contexts (HeroDetailOverlay, HeroPreviewOverlay) where a filled box is
 * tappable to load its effect into the paired EquipmentInfoPanel below,
 * instead of equipping/unequipping. Empty slots are inert.
 */
export function EquipmentSlotGrid({ loadout, equipmentLookup, viewedItemId, onSelect }: EquipmentSlotGridProps) {
  return (
    <div className="equip-slot-row">
      {EQUIP_SLOT_ORDER.map((slot) => {
        const itemId = loadout[slot];
        const item = itemId ? equipmentLookup[itemId] : null;
        return (
          <button
            key={slot}
            type="button"
            className={`equip-slot-box${item ? ' filled' : ' empty'}${item && viewedItemId === item.id ? ' selected' : ''}`}
            onClick={(e) => {
              // Only a filled box's own item lookup counts as "interacting with
              // equipment" — stop the click from bubbling to the enclosing
              // detail-panel's close-on-click-elsewhere handler. An empty slot
              // has nothing to inspect, so its tap falls through and closes
              // the panel like any other non-item area.
              if (!item) return;
              e.stopPropagation();
              onSelect?.(item.id);
            }}
            aria-label={item ? `View ${item.name} details` : `${EQUIP_SLOT_LABELS[slot]} slot, empty`}
          >
            <span className="equip-slot-icon">{EQUIP_SLOT_ICONS[slot]}</span>
            <span className="equip-slot-item">{item ? item.name : 'Empty'}</span>
          </button>
        );
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
  return (
    <div className="move-info-panel">
      {item ? (
        <>
          <div className="move-info-head">
            <span className="move-info-name">{item.name}</span>
            <span className="move-info-kind">{EQUIP_SLOT_LABELS[item.slot]}</span>
          </div>
          {grants.length > 0 ? (
            <div className="detail-modifier-list">
              {grants.map(([stat, amount]) => (
                <span key={stat} className={`detail-modifier-chip ${amount > 0 ? 'stat-buff' : 'stat-debuff'}`}>
                  {STAT_ICONS[stat]} {STAT_LABELS[stat]} {fmtGrant(amount)}
                </span>
              ))}
            </div>
          ) : (
            <div className="move-info-placeholder">No stat effects.</div>
          )}
        </>
      ) : (
        <div className="move-info-placeholder">{placeholder}</div>
      )}
    </div>
  );
}
