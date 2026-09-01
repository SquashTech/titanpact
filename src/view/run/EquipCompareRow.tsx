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
 * One hero as a row of the forced-equip comparison table: who, what they hold in the slot, and
 * the diff (src/run/equipCompare.ts). Chips are transitions — `ATK 5→15`, a bare `+15` / `−5` when
 * one side is zero, and no chip at all when an effect is unchanged. Tap equips; hold or `i` opens the sheet.
 */
interface EquipCompareRowProps {
  hero: HeroDefinition;
  entry: RosterEntry;
  slot: EquipmentSlot;
  /** What is in this hero's matching slot now — compared against, and bumped back onto the queue on tap. */
  currentItem: EquipmentDefinition | null;
  offered: EquipmentDefinition;
  /** True from the tap until the item is applied — see EQUIP_ANIM_MS. */
  isEquipping: boolean;
  /** True while another row is mid-animation. */
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
