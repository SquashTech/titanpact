import type { CSSProperties } from 'react';
import type { HeroDefinition, StatKey } from '../../engine/content';
import type { RosterEntry } from '../../run/state';
import type { EquipmentDefinition, EquipmentSlot } from '../../run/equipment';
import type { EquipChange } from '../../run/equipCompare';
import { compareEquipment } from '../../run/equipCompare';
import { rosterEntryTypes } from '../../run/progression';
import { passives } from '../../data/passives';
import { statuses } from '../../data/statuses';
import { getTypeAbbr, getTypeColor, getTypeColorRgb } from '../combat/typeColors';
import { ElementGlyph } from '../shared/elementIcons';
import { HeroPortrait } from '../shared/HeroPortrait';
import { useLongPress } from '../shared/MoveTile';
import { StatGlyph, STAT_LABELS } from '../shared/StatBars';
import { EQUIP_SLOT_LABELS, EquipmentIcon, RARITY_COLOR_VARS } from '../shared/EquipmentBox';
import { passiveEmoji } from '../shared/passiveIcons';

/**
 * One hero as a line of a comparison table, replacing the hero *card* the
 * forced-equip screen used to draw (2026-08-31, per user report: by the
 * middle of a run "there's no way of knowing if the piece of equipment you
 * have now is better or worse than what your heroes already have equipped …
 * you have to go through multiple informational menus/overlays").
 *
 * The card was the wrong instrument, not a badly-filled one. A HeroPickCard
 * is for choosing a hero by *identity* — a figure standing on type-tinted
 * ground, with one line saying what the tap buys — and it has exactly that
 * one line to spare. What this screen actually asks is a numeric question
 * asked six times over, and the answer to a numeric question asked six times
 * is a table: same columns, same order, scanned down rather than hunted
 * across. Three columns, left to right:
 *
 *   1. WHO — the figure (48px at 1x, 96px at 2x for a roster of four or
 *      fewer; never a fractional downscale, see docs/visual-language.md),
 *      then name, level and types. Types are load-bearing here and not
 *      decoration: an Elemental Force grant is worth its full magnitude to a
 *      hero of that type and nothing at all to anyone else, so "is this hero
 *      Fire?" is half of several of these decisions.
 *   2. WHAT THEY HOLD — the item in the matching slot, named and tinted by
 *      its own rarity, or the slot standing empty.
 *   3. WHAT WOULD CHANGE — the diff (src/run/equipCompare.ts), one chip per
 *      effect that actually differs.
 *
 * The chips are the heart of it and they are written as TRANSITIONS —
 * `ATK 5→15`, not `ATK +10` — because that single form answers both halves of
 * the complaint at once: the left number is what the hero's current item is
 * doing (the thing that used to need an overlay), the right is what it would
 * become. Where one side is zero the arrow is dropped for a bare `+15` /
 * `−5`, since `0→15` spends three characters saying nothing. Green is a gain,
 * red a loss, and no chip at all means that effect is unchanged — an item
 * granting +10 Attack replacing one that grants +10 Attack has nothing to say
 * about Attack, and saying it anyway is what buries the two lines that matter.
 *
 * Tap equips (the row is the button, as the card was); the `i` opens the full
 * hero sheet, and so does a hold — the "hold to inspect" language moves,
 * items and heroes share everywhere else.
 */
interface EquipCompareRowProps {
  hero: HeroDefinition;
  entry: RosterEntry;
  slot: EquipmentSlot;
  /** What is in this hero's matching slot right now — the thing being compared against, and the thing that gets bumped back onto the queue if the player taps. */
  currentItem: EquipmentDefinition | null;
  /** The item being offered. */
  offered: EquipmentDefinition;
  /** True from the tap until the item is actually applied — see EQUIP_ANIM_MS. */
  isEquipping: boolean;
  /** True while ANOTHER row is mid-animation: the table is briefly inert. */
  locked: boolean;
  onEquip: () => void;
  onPreview: () => void;
}

/** `−` is U+2212, not a hyphen: at 9px a hyphen-minus next to a digit reads as a word break. */
function fmtAmount(n: number): string {
  return n > 0 ? `+${n}` : `−${Math.abs(n)}`;
}

interface ChangeChipProps {
  change: EquipChange;
}

/**
 * One line of the diff. Its glyph and label come from whichever of the three
 * grant kinds it is, but the value half is identical across all three, which
 * is what lets a row of mixed chips be read as one list instead of three.
 */
function ChangeChip({ change }: ChangeChipProps) {
  const tone = change.delta > 0 ? 'is-gain' : 'is-loss';

  if (change.kind === 'passive') {
    const def = passives[change.key];
    const name = def?.name ?? change.key;
    return (
      <span className={`equip-chip is-effect ${tone}`} title={def?.description ?? name}>
        <span className="equip-chip-mark" aria-hidden="true">
          {change.delta > 0 ? '+' : '−'}
        </span>
        {passiveEmoji[change.key] ? <span aria-hidden="true">{passiveEmoji[change.key]}</span> : null}
        <span className="equip-chip-label">{name}</span>
      </span>
    );
  }

  if (change.kind === 'status') {
    const def = statuses[change.key];
    // Elemental Force is the only status equipment grants today, and it is
    // the one grant whose worth depends on the hero rather than the item —
    // so it is drawn in its own type's colour, matching the type codes two
    // columns to the left. A player checks those two against each other.
    const forceType = def?.forceType;
    const label = forceType ? getTypeAbbr(forceType) : (def?.name ?? change.key);
    return (
      <span
        className={`equip-chip ${tone}`}
        style={forceType ? ({ '--chip-tint': getTypeColor(forceType) } as CSSProperties) : undefined}
        title={forceType ? `${def?.name}: flat Base Power on ${forceType} moves` : def?.name}
      >
        {forceType ? <ElementGlyph type={forceType} className="equip-chip-glyph" /> : null}
        <span className="equip-chip-label">{label}</span>
        <ChipValue change={change} />
      </span>
    );
  }

  const stat = change.key as StatKey;
  return (
    <span className={`equip-chip ${tone}`}>
      <StatGlyph stat={stat} className="equip-chip-glyph" />
      <span className="equip-chip-label">{STAT_LABELS[stat]}</span>
      <ChipValue change={change} />
    </span>
  );
}

/** `5→15` when both sides carry the effect; a bare `+15` / `−5` when one side is nothing. */
function ChipValue({ change }: { change: EquipChange }) {
  if (change.from === 0 || change.to === 0) return <span className="equip-chip-value">{fmtAmount(change.delta)}</span>;
  return (
    <span className="equip-chip-value">
      <span className="equip-chip-was">{change.from}</span>
      <span className="equip-chip-arrow" aria-hidden="true">
        →
      </span>
      {change.to}
    </span>
  );
}

export function EquipCompareRow({
  hero,
  entry,
  slot,
  currentItem,
  offered,
  isEquipping,
  locked,
  onEquip,
  onPreview,
}: EquipCompareRowProps) {
  const longPress = useLongPress(onPreview, locked ? undefined : onEquip);
  const changes = compareEquipment(currentItem, offered);

  const summary = currentItem ? `replace ${currentItem.name}` : `equip into the empty ${slot} slot`;
  const spoken = changes
    .map((c) => {
      const label = c.kind === 'stat' ? STAT_LABELS[c.key as StatKey] : c.kind === 'status' ? (statuses[c.key]?.name ?? c.key) : (passives[c.key]?.name ?? c.key);
      if (c.kind === 'passive') return `${c.delta > 0 ? 'gains' : 'loses'} ${label}`;
      return `${label} ${c.from} to ${c.to}`;
    })
    .join(', ');

  return (
    <div
      className={['equip-row', isEquipping ? 'is-equipping' : '', locked ? 'is-locked' : '', currentItem ? 'is-filled' : 'is-empty']
        .filter(Boolean)
        .join(' ')}
      style={{ '--type-rgb': getTypeColorRgb(hero.types[0]) } as CSSProperties}
      role="button"
      tabIndex={locked ? -1 : 0}
      aria-disabled={locked}
      aria-label={`${hero.name}, level ${entry.level} — ${summary}. ${spoken || 'No change'}`}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !locked) {
          e.preventDefault();
          onEquip();
        }
      }}
      {...longPress}
    >
      {/* Mounted only while the strap is being pulled tight, so mounting it is
          what starts it — same reason LevelUpScreen's charge is an overlay
          rather than a class on the card. */}
      {isEquipping && <span className="equip-seat-flare" aria-hidden="true" />}

      <div className="equip-row-figure">
        <span className="equip-row-ground" aria-hidden="true" />
        <HeroPortrait heroId={hero.id} className="equip-row-portrait" />
      </div>

      {/* Three lines, which is not a layout choice so much as an arithmetic
          one: the 48px portrait beside them already sets the row's height, so
          three lines of text is exactly what fits inside it for free. Held
          item gets a line of its own rather than sharing with the name
          because "Mantle of the Archmage" beside a name and two type codes
          truncates, and the item's name is the one thing on this row a player
          cannot afford to have cut off. */}
      <div className="equip-row-body">
        <div className="equip-row-who">
          <span className="equip-row-name">{hero.name}</span>
          <span className="equip-row-level">Lv{entry.level}</span>
          {/* Chromeless coloured codes, the `.move-type-code` idiom — and the
              thing an Elemental Force chip below is checked against. */}
          {rosterEntryTypes(hero, entry).map((t) => (
            <span key={t} className="equip-row-type" style={{ color: getTypeColor(t) }} title={t}>
              <ElementGlyph type={t} />
              {getTypeAbbr(t)}
            </span>
          ))}
        </div>

        <div className={`equip-row-held${currentItem ? ' is-filled' : ' is-empty'}`}>
          <EquipmentIcon item={currentItem} slot={slot} className="equip-row-held-icon" />
          <span
            className="equip-row-held-name"
            style={currentItem ? ({ color: RARITY_COLOR_VARS[currentItem.rarity] } as CSSProperties) : undefined}
          >
            {currentItem ? currentItem.name : `${EQUIP_SLOT_LABELS[slot]} slot empty`}
          </span>
        </div>

        <div className="equip-row-changes">
          {changes.length > 0 ? (
            changes.map((change) => <ChangeChip key={`${change.kind}:${change.key}`} change={change} />)
          ) : (
            <span className="equip-chip is-neutral">No change</span>
          )}
        </div>
      </div>

      <div className="equip-row-act">
        <span className="equip-row-cta">{currentItem ? 'Replace' : 'Equip'}</span>
        <button
          type="button"
          className="equip-row-info"
          onClick={(e) => {
            e.stopPropagation();
            onPreview();
          }}
          aria-label={`View ${hero.name} details`}
        >
          i
        </button>
      </div>
    </div>
  );
}
