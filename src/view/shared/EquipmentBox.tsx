import type { CSSProperties, PointerEvent, ReactNode } from 'react';
import type { StatKey } from '../../engine/content';
import type { EquipmentDefinition, EquipmentLoadout, EquipmentRarity } from '../../run/equipment';
import { ENCHANTMENTS, RARITY_ORDER, parseEquipmentId } from '../../run/equipment';
import { StatGlyph, STAT_LABELS } from './StatBars';
import { RelicGlyph } from './relicIcons';
import { EquipmentFormGlyph } from './equipmentIcons';
import { useLongPress } from './MoveTile';
import { GEAR_SLOT_ATTR } from './useGearDrag';
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

/**
 * The element an enchant feeds, or null for a plain item. Read off the id rather than off the
 * granted Force status: an enchant IS the third segment of the id (`sword.epic.blazing`), while a
 * Unique may grant a Force without being enchanted.
 */
export function enchantTypeOf(item: EquipmentDefinition | null): string | null {
  if (!item) return null;
  const { enchantId } = parseEquipmentId(item.id);
  return enchantId ? (ENCHANTMENTS[enchantId] ?? null) : null;
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
  /** Tap. Where a surface has no other verb this is "show me what this is". */
  onTap?: () => void;
  /** Hold. Used where tap already means something else (Manage Roster's move). */
  onLongPress?: () => void;
  /** Extra state classes: selected / drop-target / drag-over / target. */
  className?: string;
  /**
   * Overrides the delegated click sound (audio/uiSfx.ts). Pass "none" where the caller plays its
   * own cue for what the tap DID — otherwise a move fires the default tap under the equip sound
   * and the two smear together.
   */
  sfx?: string;
  /**
   * The board's key for this slot, stamped as `data-gear-slot`. It is what a carried piece
   * hit-tests against (useGearDrag) — pass it and the box is a drop target; omit it and the box
   * is inert scenery. NOT the same thing as being draggable FROM: an empty socket takes a piece
   * and cannot give one.
   */
  slotKey?: string;
  /** Starts the carry gesture (useGearDrag `handleProps`). */
  onPointerDown?: (e: PointerEvent) => void;
  /** Marks laid over the socket that belong to the BOARD rather than to the item — the merge pair flag. */
  children?: ReactNode;
  /** Merged over the rarity var, so a caller can hand the socket a colour of its own (the merge pair's up-tier). */
  style?: CSSProperties;
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
  onTap,
  onLongPress,
  className,
  sfx,
  slotKey,
  onPointerDown,
  children,
  style,
}: ItemBoxProps) {
  const longPress = useLongPress(onLongPress, onTap);
  return (
    <button
      type="button"
      className={`item-box${item ? ' filled' : ' empty'}${className ? ` ${className}` : ''}`}
      style={{ ...(item ? ({ '--rarity-color': RARITY_COLOR_VARS[item.rarity] } as CSSProperties) : null), ...style }}
      aria-label={item ? itemSummaryLine(item) : 'Empty item slot'}
      data-sfx={sfx}
      title={item ? itemSummaryLine(item) : undefined}
      {...{ [GEAR_SLOT_ATTR]: slotKey }}
      {...longPress}
      onPointerDown={(e) => {
        onPointerDown?.(e);
        longPress.onPointerDown(e);
      }}
    >
      <ItemPiece item={item} />
      {children}
    </button>
  );
}

/**
 * The piece itself, apart from the socket it sits in (2026-09-10, per user direction). It was the
 * button's own face; splitting it out is what lets the SAME object be drawn under the finger while
 * it is carried, which is the whole of "gear is a game piece rather than a table cell".
 *
 * A filled piece is a cut chit — bevel, facet sheen, tier pips along its foot; an empty one draws
 * nothing at all, because an empty socket is a hole and the socket's own styling is the hole.
 */
export function ItemPiece({ item }: { item: EquipmentDefinition | null }) {
  const enchantType = enchantTypeOf(item);
  if (!item) return <EquipmentIcon item={null} className="item-box-icon" />;
  return (
    <span className="item-piece" style={{ '--rarity-color': RARITY_COLOR_VARS[item.rarity] } as CSSProperties}>
      <span className="item-piece-facet" aria-hidden="true" />
      <EquipmentIcon item={item} className="item-box-icon" />
      {/* Which element the enchant feeds. The name says it ("Blazing Sword") and the box prints
          no name, so without this an enchanted item and a plain one are the same silhouette. */}
      {enchantType && (
        <span className="item-box-enchant" style={{ color: getTypeColor(enchantType) }}>
          <ElementGlyph type={enchantType} />
        </span>
      )}
      <TierPips rarity={item.rarity} />
    </span>
  );
}

/**
 * The item's tier as a count of marks, 1 for Common through 5 for Mythic (2026-09-07, per user
 * direction). Rarity colour alone says "these two differ"; it does not say WHICH is better, and
 * since item names dropped their tier adjective two Swords of different tiers are otherwise
 * identical in a bag grid — which reads as a bug when they refuse to merge.
 *
 * Counted rather than coloured because a count is orderable without a legend. Derived from
 * RARITY_ORDER so a sixth tier would need no second table.
 */
function TierPips({ rarity }: { rarity: EquipmentRarity }) {
  const filled = RARITY_ORDER.indexOf(rarity) + 1;
  return (
    <span className="item-box-pips" aria-hidden="true">
      {Array.from({ length: filled }, (_, i) => (
        <i key={i} />
      ))}
    </span>
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

interface EquipmentSlotGridProps {
  loadout: EquipmentLoadout;
  capacity: number;
  equipmentLookup: Record<string, EquipmentDefinition>;
  /** Tap on a filled slot — the caller opens its ItemDetailOverlay (ItemDossier.tsx). */
  onInspect: (itemId: string) => void;
  /** Slot index to mark with the .target outline — where an incoming item would land. */
  highlightIndex?: number | null;
}

/**
 * A hero's slots as icon boxes, one per slot it has. Read-only: the only interaction is a tap,
 * which shows what the item does — routed to the caller's own popup, which already holds moves
 * and passives (HeroPreviewOverlay, HeroDetailOverlay).
 */
export function EquipmentSlotGrid({ loadout, capacity, equipmentLookup, onInspect, highlightIndex }: EquipmentSlotGridProps) {
  return (
    <div className="equip-slot-row">
      {slotBoxes(loadout, capacity).map((itemId, index) => {
        const item = itemId ? (equipmentLookup[itemId] ?? null) : null;
        return (
          <ItemBox
            key={index}
            item={item}
            className={index === highlightIndex ? 'target' : undefined}
            onTap={item ? () => onInspect(item.id) : undefined}
          />
        );
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

/**
 * One held item spelled out in full: its icon and tier, every stat it grants, and the whole
 * description of every passive and Elemental Force it carries. The list form of
 * `ItemDetailCard` (ItemDossier.tsx) — the hero sheet's Gear page shows these outright rather than making each
 * held item a button that has to be tapped before it says anything.
 */
export function ItemReadout({ item }: { item: EquipmentDefinition }) {
  const grants = (Object.entries(item.statGrants) as [StatKey, number][]).filter(([, amount]) => amount);
  return (
    <div className="item-readout" style={{ '--rarity-color': RARITY_COLOR_VARS[item.rarity] } as CSSProperties}>
      <div className="item-readout-head">
        <EquipmentIcon item={item} className="item-readout-icon" />
        <span className="item-readout-name">{item.name}</span>
        <span className="item-readout-rarity">{RARITY_LABELS[item.rarity]}</span>
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
      <EquipmentEffectList item={item} />
    </div>
  );
}
