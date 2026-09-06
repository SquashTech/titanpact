import type { CSSProperties } from 'react';
import type { StatKey } from '../../engine/content';
import type { EquipmentDefinition, EquipmentLoadout, EquipmentRarity } from '../../run/equipment';
import { StatGlyph, STAT_LABELS } from './StatBars';
import { RelicGlyph } from './relicIcons';
import { EquipmentFormGlyph } from './equipmentIcons';
import { useLongPress } from './MoveTile';
import { passives } from '../../data/passives';
import { PassiveGlyph } from './passiveIcons';
import { statuses } from '../../data/statuses';

interface EquipmentIconProps {
  item: EquipmentDefinition | null;
  className?: string;
}

/** The item's silhouette, derived from its name (equipmentIcons.tsx) rather than an id table. */
export function EquipmentIcon({ item, className }: EquipmentIconProps) {
  return <EquipmentFormGlyph item={item} className={className} />;
}

interface RelicIconProps {
  relicId: string;
  className?: string;
}

/** Form from the relic's name, colour from its grant (relicIcons.tsx). */
export function RelicIcon({ relicId, className }: RelicIconProps) {
  return <RelicGlyph relicId={relicId} className={className} />;
}

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

/** The held list padded out to `capacity` with nulls — the shape every slot row renders. A hero over capacity (a save from a build that gave it more) keeps showing every item it holds. */
export function slotBoxes(loadout: EquipmentLoadout, capacity: number): (string | null)[] {
  const boxes: (string | null)[] = [...loadout];
  while (boxes.length < capacity) boxes.push(null);
  return boxes;
}

interface EquipmentSlotGridProps {
  loadout: EquipmentLoadout;
  capacity: number;
  equipmentLookup: Record<string, EquipmentDefinition>;
  /** Long-press on a filled slot. Omit for an inert grid. */
  onInspect?: (itemId: string) => void;
  /** Slot index to mark with the .target outline — where an incoming item would land. */
  highlightIndex?: number | null;
}

interface EquipSlotBoxProps {
  index: number;
  item: EquipmentDefinition | null;
  onInspect?: (itemId: string) => void;
  highlighted?: boolean;
}

// Its own component because useLongPress is a hook. Tap does nothing; hold inspects.
function EquipSlotBox({ index, item, onInspect, highlighted }: EquipSlotBoxProps) {
  const longPress = useLongPress(item && onInspect ? () => onInspect(item.id) : undefined);
  return (
    <button
      type="button"
      className={`equip-slot-box${item ? ' filled' : ' empty'}${highlighted ? ' target' : ''}`}
      style={item ? ({ '--rarity-color': RARITY_COLOR_VARS[item.rarity] } as CSSProperties) : undefined}
      aria-label={item ? `Item slot ${index + 1}: ${item.name}` : `Item slot ${index + 1}, empty`}
      {...longPress}
    >
      <EquipmentIcon item={item} className="equip-slot-icon" />
      <span className="equip-slot-item">{item ? item.name : 'Empty'}</span>
    </button>
  );
}

/** Read-only item-slot boxes, one per slot the hero has; a filled box's only interaction is a long-press to inspect. */
export function EquipmentSlotGrid({ loadout, capacity, equipmentLookup, onInspect, highlightIndex }: EquipmentSlotGridProps) {
  return (
    <div className="equip-slot-row">
      {slotBoxes(loadout, capacity).map((itemId, index) => (
        <EquipSlotBox
          key={index}
          index={index}
          item={itemId ? (equipmentLookup[itemId] ?? null) : null}
          onInspect={onInspect}
          highlighted={index === highlightIndex}
        />
      ))}
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
export function EquipmentInfoPanel({ item, placeholder = 'Tap a held item to see what it does.' }: EquipmentInfoPanelProps) {
  const grants = item ? (Object.entries(item.statGrants) as [StatKey, number][]) : [];
  const grantedPassives = item?.grantsPassiveIds ?? [];
  const grantedStatuses = item?.grantsStatusIds ?? [];
  return (
    <div className="move-info-panel">
      {item ? (
        <>
          <div className="move-info-head">
            <span className="move-info-name">{item.name}</span>
            <span className="move-info-kind">{RARITY_LABELS[item.rarity]}</span>
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
