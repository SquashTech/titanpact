import type { CSSProperties } from 'react';
import type { StatKey } from '../../engine/content';
import type { EquipmentDefinition, EquipmentLoadout, EquipmentRarity, EquipmentSlot } from '../../run/equipment';
import { StatGlyph, STAT_LABELS } from './StatBars';
import { IconsetGlyph } from './RunGlyph';
import { EquipmentFormGlyph } from './equipmentIcons';
import { useLongPress } from './MoveTile';
import { passives } from '../../data/passives';
import { passiveEmoji } from './passiveIcons';
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
};

interface EquipmentIconProps {
  item: EquipmentDefinition | null;
  slot: EquipmentSlot;
  className?: string;
}

/**
 * The item's silhouette (equipmentIcons.tsx) — a bow draws as a bow, boots as
 * boots, a necklace as a necklace, derived from the item's own name rather
 * than from a hand-kept id table.
 *
 * That derivation is the point of the change. This used to be three iconset
 * cells and a seven-entry override map, which meant the other 48 items in
 * src/data/equipment.ts shared one generic sword, one shield and one sparkle
 * between them — a roster screen showed the same sword for a greatsword, a
 * maul and a scythe. `equipmentForm` reads the noun the item is already named
 * after, so new gear is drawn correctly the moment it is written.
 */
export function EquipmentIcon({ item, slot, className }: EquipmentIconProps) {
  return <EquipmentFormGlyph item={item} slot={slot} className={className} />;
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

/** The same five tiers as bare `r, g, b` triples (styles.css :root --tier-*-rgb) — for the rgba() consumers, chiefly the node stage's sky, which tints a whole screen in the dropped item's tier. */
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
