import { useState, type CSSProperties } from 'react';
import type { HeroDefinition, StatKey } from '../../engine/content';
import type { RosterEntry } from '../../run/state';
import type { EquipmentDefinition } from '../../run/equipment';
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
import { EquipmentIcon, RARITY_COLOR_VARS } from '../shared/EquipmentBox';
import { PassiveGlyph } from '../shared/passiveIcons';

/**
 * One hero as a row of the forced-equip comparison table: who, what they hold, and the diff
 * (src/run/equipCompare.ts). Chips are transitions — `ATK 5→15`, a bare `+15` / `−5` when one
 * side is zero, and no chip at all when an effect is unchanged. Tap equips; hold or `i` opens the sheet.
 *
 * Slots are uncategorised, so what a tap MEANS depends on the hero: a free slot takes the item
 * outright, one held item is a straight swap, and a hero holding two or more with no room has to
 * be asked which one goes — that case, and only that case, expands into a per-item picker.
 */
interface EquipCompareRowProps {
  hero: HeroDefinition;
  entry: RosterEntry;
  /** Every item this hero holds, in slot order. */
  held: readonly EquipmentDefinition[];
  /** The hero's slot count (itemSlotsFor) — `held.length` short of it means a free slot. */
  capacity: number;
  offered: EquipmentDefinition;
  /** Undefined lands the item in the free slot; a number replaces the item in that slot. */
  onEquip: (replaceIndex?: number) => void;
  /** True from the tap until the item is applied — see EQUIP_ANIM_MS. */
  isEquipping: boolean;
  /** True while another row is mid-animation. */
  locked: boolean;
  /** This hero already holds the offered item. A hero never holds two copies, so the row is inert. */
  alreadyHeld?: boolean;
  onPreview: () => void;
}

/** `−` is U+2212, not a hyphen: at 9px a hyphen-minus next to a digit reads as a word break. */
function fmtAmount(n: number): string {
  return n > 0 ? `+${n}` : `−${Math.abs(n)}`;
}

interface ChangeChipProps {
  change: EquipChange;
}

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
        {def ? <PassiveGlyph passiveId={change.key} className="equip-chip-glyph" /> : null}
        <span className="equip-chip-label">{name}</span>
      </span>
    );
  }

  if (change.kind === 'status') {
    const def = statuses[change.key];
    // Elemental Force is worth its magnitude only to a hero of that type, so the chip is drawn in
    // the type's colour to be checked against the type codes two columns left.
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

function ChangeChips({ changes }: { changes: readonly EquipChange[] }) {
  if (changes.length === 0) return <span className="equip-chip is-neutral">No change</span>;
  return (
    <>
      {changes.map((change) => (
        <ChangeChip key={`${change.kind}:${change.key}`} change={change} />
      ))}
    </>
  );
}

function spokenChanges(changes: readonly EquipChange[]): string {
  return changes
    .map((c) => {
      const label =
        c.kind === 'stat'
          ? STAT_LABELS[c.key as StatKey]
          : c.kind === 'status'
            ? (statuses[c.key]?.name ?? c.key)
            : (passives[c.key]?.name ?? c.key);
      if (c.kind === 'passive') return `${c.delta > 0 ? 'gains' : 'loses'} ${label}`;
      return `${label} ${c.from} to ${c.to}`;
    })
    .join(', ');
}

/** One held item inside an expanded row: what giving it up costs, and the button that does it. */
function ReplaceOption({
  current,
  offered,
  onPick,
}: {
  current: EquipmentDefinition;
  offered: EquipmentDefinition;
  onPick: () => void;
}) {
  const changes = compareEquipment(current, offered);
  return (
    <button
      type="button"
      className="equip-replace-option"
      aria-label={`Replace ${current.name}. ${spokenChanges(changes) || 'No change'}`}
      onClick={(e) => {
        e.stopPropagation();
        onPick();
      }}
    >
      <EquipmentIcon item={current} className="equip-replace-icon" />
      <span className="equip-replace-name" style={{ color: RARITY_COLOR_VARS[current.rarity] } as CSSProperties}>
        {current.name}
      </span>
      <span className="equip-replace-changes">
        <ChangeChips changes={changes} />
      </span>
    </button>
  );
}

export function EquipCompareRow({
  hero,
  entry,
  held,
  capacity,
  offered,
  onEquip,
  isEquipping,
  locked: lockedProp,
  alreadyHeld,
  onPreview,
}: EquipCompareRowProps) {
  /** Only ever true for a full hero holding two or more — every other case resolves on the first tap. */
  const [expanded, setExpanded] = useState(false);

  const locked = lockedProp || !!alreadyHeld;
  const freeSlots = capacity - held.length;
  const mustChoose = freeSlots <= 0 && held.length > 1;
  const replaced = freeSlots > 0 ? null : (held[0] ?? null);

  function act() {
    if (locked) return;
    if (mustChoose) {
      setExpanded((v) => !v);
      return;
    }
    onEquip(freeSlots > 0 ? undefined : 0);
  }

  const longPress = useLongPress(onPreview, act);
  // Against the one item that would go, or against nothing when a slot is free. An expanded row
  // has no single answer, so it shows the offer's own grants and each option carries its own diff.
  const changes = compareEquipment(mustChoose ? null : replaced, offered);

  const summary = alreadyHeld
    ? `already holds `
    : mustChoose
    ? `full — choose which of ${held.length} items to replace`
    : replaced
      ? `replace ${replaced.name}`
      : `equip into a free slot, ${freeSlots} of ${capacity} open`;

  return (
    <div
      className={[
        'equip-row',
        isEquipping ? 'is-equipping' : '',
        locked ? 'is-locked' : '',
        expanded ? 'is-expanded' : '',
        held.length > 0 ? 'is-filled' : 'is-empty',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ '--type-rgb': getTypeColorRgb(hero.types[0]) } as CSSProperties}
      role="button"
      tabIndex={locked ? -1 : 0}
      aria-disabled={locked}
      aria-expanded={mustChoose ? expanded : undefined}
      aria-label={`${hero.name}, level ${entry.level} — ${summary}. ${spokenChanges(changes) || 'No change'}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          act();
        }
      }}
      {...longPress}
    >
      {/* Mounted only while seating, so mounting is what starts the animation. */}
      {isEquipping && <span className="equip-seat-flare" aria-hidden="true" />}

      <div className="equip-row-figure">
        <span className="equip-row-ground" aria-hidden="true" />
        <HeroPortrait heroId={hero.id} className="equip-row-portrait" />
      </div>

      <div className="equip-row-body">
        <div className="equip-row-who">
          <span className="equip-row-name">{hero.name}</span>
          <span className="equip-row-level">Lv{entry.level}</span>
          {rosterEntryTypes(hero, entry).map((t) => (
            <span key={t} className="equip-row-type" style={{ color: getTypeColor(t) }} title={t}>
              <ElementGlyph type={t} />
              {getTypeAbbr(t)}
            </span>
          ))}
        </div>

        <div className={`equip-row-held${held.length > 0 ? ' is-filled' : ' is-empty'}`}>
          {held.map((item) => (
            <span key={item.id} className="equip-row-held-item">
              <EquipmentIcon item={item} className="equip-row-held-icon" />
              <span className="equip-row-held-name" style={{ color: RARITY_COLOR_VARS[item.rarity] } as CSSProperties}>
                {item.name}
              </span>
            </span>
          ))}
          {freeSlots > 0 && (
            <span className="equip-row-held-item is-free">
              <EquipmentIcon item={null} className="equip-row-held-icon" />
              <span className="equip-row-held-name">
                {freeSlots} free {freeSlots === 1 ? 'slot' : 'slots'}
              </span>
            </span>
          )}
        </div>

        {expanded ? (
          <div className="equip-row-replace-list">
            {held.map((item, index) => (
              <ReplaceOption key={item.id} current={item} offered={offered} onPick={() => onEquip(index)} />
            ))}
          </div>
        ) : (
          <div className="equip-row-changes">
            <ChangeChips changes={changes} />
          </div>
        )}
      </div>

      <div className="equip-row-act">
        <span className="equip-row-cta">{alreadyHeld ? 'Held' : freeSlots > 0 ? 'Equip' : mustChoose ? (expanded ? 'Close' : 'Replace…') : 'Replace'}</span>
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
