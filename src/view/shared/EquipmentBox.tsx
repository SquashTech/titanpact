import { useState, type CSSProperties, type DragEvent } from 'react';
import type { StatKey } from '../../engine/content';
import type { EquipmentDefinition, EquipmentLoadout, EquipmentRarity } from '../../run/equipment';
import { StatGlyph, STAT_LABELS } from './StatBars';
import { RelicGlyph } from './relicIcons';
import { EquipmentFormGlyph } from './equipmentIcons';
import { useLongPress } from './MoveTile';
import { passives } from '../../data/passives';
import { PassiveGlyph } from './passiveIcons';
import { statuses } from '../../data/statuses';
import { ElementGlyph } from './elementIcons';
import { getTypeColor } from '../combat/typeColors';

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

/** One line naming what an item does, for a tooltip or an aria-label — the text the box itself no longer prints. */
export function itemSummaryLine(item: EquipmentDefinition): string {
  const stats = (Object.entries(item.statGrants) as [StatKey, number][])
    .filter(([, amount]) => amount)
    .map(([stat, amount]) => `${STAT_LABELS[stat]} ${fmtGrant(amount)}`);
  const granted = (item.grantsPassiveIds ?? []).flatMap((id) => (passives[id] ? [passives[id].name] : []));
  const forces = (item.grantsStatusIds ?? []).flatMap(({ statusId, magnitude }) =>
    statuses[statusId] ? [`${statuses[statusId].name} +${magnitude}`] : []
  );
  const parts = [...stats, ...granted, ...forces];
  return `${item.name} — ${RARITY_LABELS[item.rarity]}${parts.length > 0 ? `, ${parts.join(', ')}` : ''}`;
}

interface ItemBoxProps {
  item: EquipmentDefinition | null;
  /** Dense variant for a row inside another row (the equip compare table). */
  compact?: boolean;
  /** Tap. Where a surface has no other verb this is "show me what this is". */
  onTap?: () => void;
  /** Hold. Used where tap already means something else (Manage Roster's move). */
  onLongPress?: () => void;
  /** Extra state classes: selected / drop-target / drag-over / target. */
  className?: string;
  draggable?: boolean;
  onDragStart?: (e: DragEvent) => void;
  onDragOver?: (e: DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: (e: DragEvent) => void;
}

/**
 * How an item appears everywhere it is part of a HERO'S KIT: the icon, in a rarity-edged box,
 * and nothing written out (2026-09-06, per user direction). A hero can hold five now, and the
 * compare table shows six heroes at once, so printing a name per box cost more room than the
 * names were worth. The name and the full effect list are one tap away, and they stay in the
 * `aria-label` and the `title` so nothing is actually lost — only unprinted.
 *
 * Not used for an item that is the SUBJECT of a screen (the forced-equip spotlight) or the face
 * of a one-item choice (a reward card, the Guild Hall shelf) — those are read, not scanned.
 */
export function ItemBox({
  item,
  compact,
  onTap,
  onLongPress,
  className,
  draggable,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: ItemBoxProps) {
  const longPress = useLongPress(onLongPress, onTap);
  return (
    <button
      type="button"
      className={`item-box${compact ? ' is-compact' : ''}${item ? ' filled' : ' empty'}${className ? ` ${className}` : ''}`}
      style={item ? ({ '--rarity-color': RARITY_COLOR_VARS[item.rarity] } as CSSProperties) : undefined}
      aria-label={item ? itemSummaryLine(item) : 'Empty item slot'}
      title={item ? itemSummaryLine(item) : undefined}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      {...longPress}
    >
      <EquipmentIcon item={item} className="item-box-icon" />
    </button>
  );
}

/**
 * What an item does, as marks rather than words: a stat glyph and its number, an element glyph
 * for an Elemental Force, a passive's own glyph. The card face for an item that is being CHOSEN
 * (a reward pick, the Guild Hall shelf) — those cards can't drop to a bare box, because picking
 * one of three by silhouette is not a choice, but they don't need "+50 Attack · Sunder" spelled
 * out either. The full sentence is still one tap away.
 */
export function ItemEffectChips({ item }: { item: EquipmentDefinition }) {
  const stats = (Object.entries(item.statGrants) as [StatKey, number][]).filter(([, amount]) => amount);
  const forces = item.grantsStatusIds ?? [];
  const granted = item.grantsPassiveIds ?? [];
  if (stats.length === 0 && forces.length === 0 && granted.length === 0) {
    return <span className="item-chip is-neutral">No effect</span>;
  }
  return (
    <>
      {stats.map(([stat, amount]) => (
        <span key={stat} className={`item-chip ${amount > 0 ? 'is-gain' : 'is-loss'}`} title={`${STAT_LABELS[stat]} ${fmtGrant(amount)}`}>
          <StatGlyph stat={stat} className="item-chip-glyph" tone="inherit" />
          {fmtGrant(amount)}
        </span>
      ))}
      {forces.map(({ statusId, magnitude }) => {
        const def = statuses[statusId];
        if (!def) return null;
        // Force is worth its magnitude only to a hero of that type, so it wears the type's colour.
        return (
          <span
            key={statusId}
            className="item-chip is-gain"
            style={def.forceType ? ({ '--chip-tint': getTypeColor(def.forceType) } as CSSProperties) : undefined}
            title={`${def.name} +${magnitude}`}
          >
            {def.forceType ? <ElementGlyph type={def.forceType} className="item-chip-glyph" /> : null}+{magnitude}
          </span>
        );
      })}
      {granted.map((passiveId) => {
        const def = passives[passiveId];
        if (!def) return null;
        // A passive carries no number, and its glyph is derived from what it DOES — so an
        // Arcane Reservoir draws the same mana drop a +20 Mana grant would. The leading mark
        // is what separates "grants an effect" from "grants a stat" at a glance.
        return (
          <span key={passiveId} className="item-chip is-effect" title={`${def.name} — ${def.description}`}>
            <span className="item-chip-mark" aria-hidden="true">
              +
            </span>
            <PassiveGlyph passiveId={passiveId} className="item-chip-glyph" />
          </span>
        );
      })}
    </>
  );
}

/**
 * The tap target's payload: the full readout, dismissed by tapping anywhere. Every surface that
 * shows an ItemBox wires this, so "tap an item to see what it does" is one behaviour and not six.
 */
export function ItemSummaryPopup({ item, onClose }: { item: EquipmentDefinition | null; onClose: () => void }) {
  if (!item) return null;
  return (
    <div
      className="log-overlay"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div className="log-panel move-popup-panel">
        <EquipmentInfoPanel item={item} />
        <div className="move-popup-hint">Tap anywhere to close</div>
      </div>
    </div>
  );
}

interface EquipmentSlotGridProps {
  loadout: EquipmentLoadout;
  capacity: number;
  equipmentLookup: Record<string, EquipmentDefinition>;
  /** Tap on a filled slot. Omit and the grid summarises the item itself; pass it to route the tap somewhere else. */
  onInspect?: (itemId: string) => void;
  /** Slot index to mark with the .target outline — where an incoming item would land. */
  highlightIndex?: number | null;
}

/**
 * A hero's slots as icon boxes, one per slot it has. Read-only: the only interaction is a tap,
 * which shows what the item does — handled here unless `onInspect` routes it to the caller's own
 * popup (HeroPreviewOverlay already owns one for moves and relics).
 */
export function EquipmentSlotGrid({ loadout, capacity, equipmentLookup, onInspect, highlightIndex }: EquipmentSlotGridProps) {
  const [summaryId, setSummaryId] = useState<string | null>(null);
  return (
    <div className="equip-slot-row">
      {slotBoxes(loadout, capacity).map((itemId, index) => {
        const item = itemId ? (equipmentLookup[itemId] ?? null) : null;
        return (
          <ItemBox
            key={index}
            item={item}
            className={index === highlightIndex ? 'target' : undefined}
            onTap={item ? () => (onInspect ? onInspect(item.id) : setSummaryId(item.id)) : undefined}
          />
        );
      })}
      {!onInspect && <ItemSummaryPopup item={summaryId ? (equipmentLookup[summaryId] ?? null) : null} onClose={() => setSummaryId(null)} />}
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
