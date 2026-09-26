import { useState, type CSSProperties } from 'react';
import { TYPES, typeChart } from '../../data/typechart';
import { equipment, EQUIPMENT_DROP_POOL, UNIQUE_EQUIPMENT } from '../../data/equipment';
import type { TypeId } from '../../engine/content';
import type { EquipmentDefinition, EquipmentRarity } from '../../run/equipment';
import { RARITY_ORDER } from '../../run/equipment';
import { getTypeColor, getTypeColorRgb } from '../combat/typeColors';
import { ElementGlyph } from './elementIcons';
import { TypeBadge } from './TypeBadge';
import { TypeWheel } from './TypeWheel';
import { EquipmentIcon, ItemEffectChips, RARITY_COLOR_VARS, RARITY_LABELS } from './EquipmentBox';
import { ItemDetailOverlay } from './ItemDossier';

// Reference pages that are more than a table: the type dial and the equipment catalog.

/** The dial's box, px: the reference panel's inner width on the narrowest phone. */
const CHART_WHEEL = 300;

/** One row of the readout: every type on one side of a cell, or nothing. */
function ReadoutRow({ label, types, onPick }: { label: string; types: readonly TypeId[]; onPick: (type: TypeId) => void }) {
  return (
    <div className="type-readout-row">
      <span className="type-readout-label">{label}</span>
      <span className="type-readout-types">
        {types.length > 0 ? (
          types.map((t) => (
            <button key={t} type="button" className="type-readout-pick" data-sfx="ui.select" onClick={() => onPick(t)}>
              <TypeBadge type={t} />
            </button>
          ))
        ) : (
          <span className="matchup-none">None</span>
        )}
      </span>
    </div>
  );
}

/**
 * The type chart as the dial (shared/TypeWheel.tsx), tappable. Tap a glyph and the dial lights
 * that type both ways — the chords it strikes along in its own colour, the chords that strike it
 * in theirs — and the readout under it spells the cell out in both directions, every badge a way
 * to the next type. Ancient has no seat on the dial (it strikes nothing for 2×), so it is reached
 * through the readout, where it sits in every type's ½× row: the wall, found by running into it.
 */
export function TypeDial() {
  const [selected, setSelected] = useState<TypeId | null>(null);
  const attacks = selected ? typeChart[selected] : null;
  const strikes = attacks ? TYPES.filter((d) => attacks[d] > 1) : [];
  const glances = attacks ? TYPES.filter((d) => attacks[d] < 1) : [];
  const weakTo = selected ? TYPES.filter((a) => typeChart[a][selected] > 1) : [];
  const resists = selected ? TYPES.filter((a) => typeChart[a][selected] < 1) : [];

  return (
    <div className="type-chart-tab">
      <TypeWheel
        className="type-chart-wheel"
        size={CHART_WHEEL}
        focus={selected ? [selected] : undefined}
        focusIncoming
        clearCentre={false}
        ring
        onPickType={(t) => setSelected(t === selected ? null : t)}
      />
      {selected ? (
        <div
          className="type-readout"
          style={
            {
              '--type-rgb': getTypeColorRgb(selected),
              '--type-color': getTypeColor(selected),
            } as CSSProperties
          }
        >
          <div className="type-readout-head">
            <span className="type-readout-glyph">
              <ElementGlyph type={selected} />
            </span>
            <span className="type-readout-name">{selected}</span>
          </div>
          <div className="type-readout-side">Attacking</div>
          <ReadoutRow label="Strikes 2×" types={strikes} onPick={setSelected} />
          <ReadoutRow label="Only ½×" types={glances} onPick={setSelected} />
          <div className="type-readout-side">Defending</div>
          <ReadoutRow label="Weak to" types={weakTo} onPick={setSelected} />
          <ReadoutRow label="Resists" types={resists} onPick={setSelected} />
        </div>
      ) : (
        <p className="type-chart-hint">Tap a type to read its matchups. Every line is a 2× hit, running from the striker to the struck.</p>
      )}
    </div>
  );
}

// Rarity, then authoring order — items are uncategorised, so the tier is the only grouping left,
// and the page is laid out as one shelf per tier.
const EQUIPMENT_SHELVES = RARITY_ORDER.map((rarity) => ({
  rarity,
  items: [...EQUIPMENT_DROP_POOL, ...UNIQUE_EQUIPMENT].filter((item) => item.rarity === rarity),
})).filter((shelf) => shelf.items.length > 0);

/**
 * One item on its shelf: the glyph on a rarity-tinted plate, the name, and the effect chips —
 * the rarity is the shelf's heading, so the row does not repeat it. Tap opens the detail popup.
 */
function ItemRow({ item, onInspect }: { item: EquipmentDefinition; onInspect: () => void }) {
  return (
    <button
      type="button"
      className="compendium-item-row"
      style={{ '--rarity-color': RARITY_COLOR_VARS[item.rarity] } as CSSProperties}
      onClick={onInspect}
      aria-label={`${item.name} — view details`}
    >
      <span className="compendium-item-plate">
        <EquipmentIcon item={item} className="compendium-item-icon" />
      </span>
      <span className="compendium-item-body">
        <span className="compendium-item-name">{item.name}</span>
        <span className="compendium-item-chips">
          <ItemEffectChips item={item} />
        </span>
      </span>
    </button>
  );
}

function EquipmentShelf({ rarity, items, onInspect }: { rarity: EquipmentRarity; items: EquipmentDefinition[]; onInspect: (id: string) => void }) {
  return (
    <>
      <div className="tab-subhead compendium-shelf-head" style={{ '--rarity-color': RARITY_COLOR_VARS[rarity] } as CSSProperties}>
        {RARITY_LABELS[rarity]}
      </div>
      <div className="compendium-shelf">
        {items.map((item) => (
          <ItemRow key={item.id} item={item} onInspect={() => onInspect(item.id)} />
        ))}
      </div>
    </>
  );
}

/** Every item the game can drop, one shelf a rarity. */
export function EquipmentCatalog() {
  const [inspectItemId, setInspectItemId] = useState<string | null>(null);
  return (
    <>
      {EQUIPMENT_SHELVES.map((shelf) => (
        <EquipmentShelf key={shelf.rarity} rarity={shelf.rarity} items={shelf.items} onInspect={setInspectItemId} />
      ))}
      <ItemDetailOverlay item={inspectItemId ? equipment[inspectItemId] : null} onClose={() => setInspectItemId(null)} />
    </>
  );
}
