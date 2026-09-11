import { createPortal } from 'react-dom';
import type { CSSProperties } from 'react';
import type { StatKey } from '../../engine/content';
import { STAT_ORDER } from '../../engine/content';
import type { EquipmentDefinition } from '../../run/equipment';
import { sellValueFor } from '../../run/shop';
import { passives } from '../../data/passives';
import { statuses } from '../../data/statuses';
import { STAT_LABELS } from './StatBars';
import { StatGlyph } from './statIcons';
import { ElementGlyph } from './elementIcons';
import { EquipmentIcon, RARITY_COLOR_VARS, RARITY_LABELS, RARITY_RGB_VARS, enchantTypeOf, fmtGrant } from './EquipmentBox';
import { PassiveGlyph, PassiveStatChips, passiveColor, passiveEffectSummary, passiveKindLabel } from './passiveIcons';
import { ResourceGlyph } from './RunGlyph';
import { getTypeColor } from '../combat/typeColors';
import { overlayHost } from './overlayHost';

/** The family noun, or what stands in for one on an item outside the ladder. */
function familyLabel(item: EquipmentDefinition): string {
  if (!item.familyId) return 'Unique';
  return item.familyId.charAt(0).toUpperCase() + item.familyId.slice(1);
}

/**
 * The item dossier: what a hold on any item box opens, everywhere an item can be held — the roster
 * board, the fight-result drop, the hero sheets, a reward pick. The same three facets as the move
 * dossier, in the same order: who it is (disc, name, tier · family · element), the numbers (every
 * stat grant as a figure), and the payload (every passive and every Elemental Force it carries,
 * each with its whole description — never "Grants: Sunder" and a name to go look up).
 *
 * Nothing inside is boxed; the facets separate on scored hairlines, the way the move dossier's do.
 */
export function ItemDetailCard({ item }: { item: EquipmentDefinition }) {
  const grants = STAT_ORDER.map((stat) => [stat, item.statGrants[stat] ?? 0] as [StatKey, number]).filter(([, amount]) => amount !== 0);
  const grantedPassives = (item.grantsPassiveIds ?? []).flatMap((id) => (passives[id] ? [passives[id]] : []));
  const forces = (item.grantsStatusIds ?? []).flatMap(({ statusId, magnitude }) =>
    statuses[statusId] ? [{ def: statuses[statusId], magnitude }] : []
  );
  const enchantType = enchantTypeOf(item);
  const rarityColor = RARITY_COLOR_VARS[item.rarity];

  return (
    <div className="item-detail-card" style={{ '--rarity-color': rarityColor, '--rarity-rgb': RARITY_RGB_VARS[item.rarity] } as CSSProperties}>
      <div className="move-detail-head">
        <span className="move-detail-disc item-detail-disc">
          <EquipmentIcon item={item} />
          {enchantType && (
            <span className="item-detail-enchant" style={{ color: getTypeColor(enchantType) }}>
              <ElementGlyph type={enchantType} />
            </span>
          )}
        </span>
        <div className="move-detail-titles">
          <div className="move-detail-name">{item.name}</div>
          <div className="move-detail-line">
            <span style={{ color: rarityColor }}>{RARITY_LABELS[item.rarity]}</span>
            <span className="move-detail-sep">·</span>
            <span>{familyLabel(item)}</span>
            {enchantType && (
              <>
                <span className="move-detail-sep">·</span>
                <span style={{ color: getTypeColor(enchantType) }}>{enchantType}</span>
              </>
            )}
          </div>
        </div>
        {/* What it fetches at a Guild Hall — the one number about an item that is not on its face. */}
        <span className="item-detail-sell" title="Sells for">
          <ResourceGlyph kind="gold" />
          <strong>{sellValueFor(item)}</strong>
          <span className="move-detail-unit">sell</span>
        </span>
      </div>

      <div className="move-detail-stats">
        {grants.map(([stat, amount]) => (
          <span key={stat} className={`move-detail-stat${amount < 0 ? ' is-loss' : ''}`}>
            <StatGlyph stat={stat} />
            <strong>{fmtGrant(amount)}</strong>
            <span className="move-detail-unit">{STAT_LABELS[stat]}</span>
          </span>
        ))}
      </div>

      {(grantedPassives.length > 0 || forces.length > 0) && (
        <div className="move-detail-effects item-detail-effects">
          {grantedPassives.map((def) => {
            const color = passiveColor(def.id);
            const summary = passiveEffectSummary(def);
            return (
              <div key={def.id} className="move-detail-effect-row item-detail-passive" style={{ color } as CSSProperties}>
                <span className="move-detail-effect-glyph">
                  <PassiveGlyph passiveId={def.id} />
                </span>
                <span className="move-detail-effect-text">
                  {def.name}
                  <span className="item-detail-passive-kind">{passiveKindLabel(def)}</span>
                  <span className="move-detail-effect-note">{def.description}</span>
                  <PassiveStatChips def={def} />
                  {summary && <span className="move-detail-effect-note item-detail-passive-meta">{summary}</span>}
                </span>
              </div>
            );
          })}
          {forces.map(({ def, magnitude }) => {
            const color = def.forceType ? getTypeColor(def.forceType) : undefined;
            return (
              <div key={def.id} className="move-detail-effect-row" style={color ? ({ color } as CSSProperties) : undefined}>
                <span className="move-detail-effect-glyph">{def.forceType ? <ElementGlyph type={def.forceType} /> : null}</span>
                <span className="move-detail-effect-text">
                  {def.name} +{magnitude}
                  <span className="move-detail-effect-note">{def.description}</span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * The item dossier on the same `.detail-overlay` / `.detail-panel` chassis as the move dossier —
 * tier colour on the stripe and the disc, "tap anywhere to close". Portalled into overlayHost(),
 * never document.body — see overlayHost.ts.
 */
export function ItemDetailOverlay({ item, onClose }: { item: EquipmentDefinition | null; onClose: () => void }) {
  if (!item) return null;

  function closeAndStop(e: { stopPropagation: () => void }) {
    e.stopPropagation();
    onClose();
  }

  return createPortal(
    <div className="detail-overlay" onClick={closeAndStop}>
      <div
        className="detail-panel move-detail-panel item-detail-panel"
        style={{ borderTopColor: RARITY_COLOR_VARS[item.rarity], '--move-type-rgb': RARITY_RGB_VARS[item.rarity] } as CSSProperties}
        onClick={closeAndStop}
      >
        <ItemDetailCard item={item} />
        <div className="detail-close-hint">Tap anywhere to close</div>
      </div>
    </div>,
    overlayHost()
  );
}
