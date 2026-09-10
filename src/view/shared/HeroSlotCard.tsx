import type { CSSProperties, ReactNode } from 'react';
import type { HeroDefinition } from '../../engine/content';
import type { EquipmentDefinition } from '../../run/equipment';
import { MAX_ITEM_SLOTS } from '../../run/equipment';
import { itemSlotsFor, rosterEntryTypes } from '../../run/progression';
import type { RosterEntry } from '../../run/state';
import { getTypeColor } from '../combat/typeColors';
import { HeroPortrait } from './HeroPortrait';
import { TypeBadge } from './TypeBadge';
import { ItemBox, slotBoxes } from './EquipmentBox';
import { useLongPress } from './MoveTile';
import { GEAR_SLOT_ATTR } from './useGearDrag';

/**
 * One hero as a squad card: who they are, then their item slots as icon boxes underneath.
 * Extracted from Manage Roster (2026-09-07, per user direction) so every screen that asks
 * "who carries this?" — Manage Roster, the found-item gate, the Guild Hall's buy sheet —
 * shows the same six cards in the same 2x3 grid rather than three different lists.
 *
 * The row is always three columns wide, MAX_ITEM_SLOTS, whatever the hero's own capacity is:
 * slots past it render as locked cavities, so the Forge's headroom is legible and six cards
 * line up their boxes instead of ragging on capacity.
 */
export interface SlotBoxProps {
  className?: string;
  sfx?: string;
  onTap?: () => void;
  onLongPress?: () => void;
  slotKey?: string;
  onPointerDown?: (e: React.PointerEvent) => void;
}

interface HeroSlotCardProps {
  hero: HeroDefinition;
  entry: RosterEntry;
  equipmentLookup: Record<string, EquipmentDefinition>;
  /** Extra state classes on the card — `can-take`, `is-locked`, `is-equipping`. */
  className?: string;
  /** What tapping the identity block means. Omit for a read-only card (the Guild Hall sheet). */
  onHeadTap?: () => void;
  /** Holding it. Where the tap is already spent on a verb, this is "who is this hero again?". */
  onHeadLongPress?: () => void;
  headLabel?: string;
  /** Per-slot wiring, index-addressed. Omit and the boxes are inert. */
  slotProps?: (index: number, item: EquipmentDefinition | null) => SlotBoxProps;
  /** Stamps the whole CARD as a landing pad for a carried piece (useGearDrag). Omit and only its sockets are. */
  dropKey?: string;
  /** Corner mark — the found-item gate's "Equip" / "Full" verdict. */
  badge?: ReactNode;
  /** Anything below the slot row. */
  footer?: ReactNode;
}

export function HeroSlotCard({
  hero,
  entry,
  equipmentLookup,
  className,
  onHeadTap,
  onHeadLongPress,
  headLabel,
  slotProps,
  dropKey,
  badge,
  footer,
}: HeroSlotCardProps) {
  const headPress = useLongPress(onHeadLongPress, onHeadTap);
  const capacity = itemSlotsFor(hero, entry);
  const boxes = slotBoxes(entry.equipment, capacity);
  // A hero over capacity (a save from a build that gave it more) still shows everything it holds.
  const locked = Math.max(0, MAX_ITEM_SLOTS - boxes.length);

  const head = (
    <>
      <HeroPortrait heroId={hero.id} className="roster-mgmt-portrait" />
      <span className="roster-mgmt-ident">
        <span className="roster-mgmt-name">{hero.name}</span>
        <span className="roster-card-types">
          {rosterEntryTypes(hero, entry).map((t) => (
            <TypeBadge key={t} type={t} />
          ))}
        </span>
      </span>
    </>
  );

  return (
    <div
      className={`roster-mgmt-card${className ? ` ${className}` : ''}`}
      {...{ [GEAR_SLOT_ATTR]: dropKey }}
      style={{ '--hero-color': getTypeColor(hero.types[0]), borderTopColor: getTypeColor(hero.types[0]) } as CSSProperties}
    >
      {badge}
      {onHeadTap || onHeadLongPress ? (
        <button type="button" className="roster-mgmt-head" data-sfx="none" aria-label={headLabel} {...headPress}>
          {head}
        </button>
      ) : (
        <div className="roster-mgmt-head is-static">{head}</div>
      )}

      {/* The sockets sit in a MOUNT — a recessed strip with corner brackets — rather than loose on
          the card (2026-09-10, per user direction). Three boxes floating on a panel read as table
          cells; the same three set into one piece of hardware read as a hero's rig, and the
          hardware is also what makes an empty socket look like a hole worth filling. */}
      <div className="equip-mount">
        <div className="equip-slot-row">
          {boxes.map((itemId, index) => {
            const item = itemId ? (equipmentLookup[itemId] ?? null) : null;
            return <ItemBox key={index} item={item} {...(slotProps ? slotProps(index, item) : {})} />;
          })}
          {/* Not a slot yet — the Forge is what turns one of these into a box. */}
          {Array.from({ length: locked }, (_, i) => (
            <span key={`locked-${i}`} className="item-box is-locked" aria-hidden="true" />
          ))}
        </div>
      </div>

      {footer}
    </div>
  );
}

/** The 2x3 squad grid every one of those screens lays its cards out in. */
export function HeroSlotGrid({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={`roster-mgmt-grid${className ? ` ${className}` : ''}`}>{children}</div>;
}
