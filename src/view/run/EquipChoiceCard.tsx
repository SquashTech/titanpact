import type { CSSProperties } from 'react';
import type { EquipmentDefinition } from '../../run/equipment';
import { EquipmentIcon, ItemEffectChips, ItemStatTiles, RARITY_COLOR_VARS, RARITY_LABELS } from '../shared/EquipmentBox';
import { ItemDetailCard } from '../shared/ItemDossier';
import { useLongPress } from '../shared/MoveTile';
import { playSfx } from '../../audio/sfx';

interface EquipChoiceCardProps {
  item: EquipmentDefinition;
  picked?: boolean;
  /** Omit for a card that is shown rather than chosen (the Loot Pile): it renders as a static surface that still holds-to-inspect. */
  onPick?: () => void;
  onInspect?: () => void;
  /** Staggers this card's fade-in behind whatever revealed it. */
  revealDelayMs: number;
  /** Spell the grants out beside their glyphs (the who-screen, where the piece has the face for it). */
  labelled?: boolean;
  /** The incoming piece as a reward: the icon large under its tier's glow, the name over coloured stat tiles, an Awakening as its own band. */
  showcase?: boolean;
}

export function EquipChoiceCard({ item, picked, onPick, onInspect, revealDelayMs, labelled, showcase }: EquipChoiceCardProps) {
  // Sounded on the pick, not the press: the same pointerdown starts the hold that only inspects.
  const longPress = useLongPress(onInspect, onPick ? () => { playSfx('ui.pick'); onPick(); } : undefined);
  if (showcase) {
    return (
      <button
        type="button"
        className={`equip-showcase equip-cache-reveal-in${picked ? ' picked' : ''}${onPick ? '' : ' is-static'}`}
        data-sfx={onPick ? 'none' : undefined}
        style={{ '--rarity-color': RARITY_COLOR_VARS[item.rarity], animationDelay: `${revealDelayMs}ms` } as CSSProperties}
        {...longPress}
      >
        <span className="equip-showcase-glow" aria-hidden="true" />
        <span className="equip-showcase-head">
          <EquipmentIcon item={item} className="equip-showcase-icon" />
          <span className="equip-showcase-words">
            <span className="equip-showcase-name">{item.name}</span>
            <span className="equip-showcase-tier">{item.familyId ? RARITY_LABELS[item.rarity] : `Unique · ${RARITY_LABELS[item.rarity]}`}</span>
          </span>
        </span>
        <ItemStatTiles item={item} />
      </button>
    );
  }
  return (
    <button
      type="button"
      className={`equip-cache-card equip-cache-reveal-in${picked ? ' picked' : ''}${onPick ? '' : ' is-static'}`}
      data-sfx={onPick ? 'none' : undefined}
      style={{ '--rarity-color': RARITY_COLOR_VARS[item.rarity], animationDelay: `${revealDelayMs}ms` } as CSSProperties}
      {...longPress}
    >
      <div className="equip-cache-card-icon-badge">
        <EquipmentIcon item={item} className="equip-cache-card-icon" />
      </div>
      <div className="equip-cache-card-body">
        <div className="equip-cache-card-name">{item.name}</div>
        <div className="equip-cache-card-meta">
          <span className="equip-cache-card-rarity">{RARITY_LABELS[item.rarity]}</span>
        </div>
        <div className="equip-cache-card-stats">
          <ItemEffectChips item={item} labelled={labelled} />
        </div>
      </div>
    </button>
  );
}

interface EquipInspectOverlayProps {
  item: EquipmentDefinition;
  onClose: () => void;
}

/**
 * A plain inspect from a reward, event or who-screen pick. Same card as every other item hold
 * (ItemDossier.tsx), with the tier stripe so it reads as the same thing opening.
 */
export function EquipInspectOverlay({ item, onClose }: EquipInspectOverlayProps) {
  return (
    <div className="log-overlay" onClick={onClose}>
      <div
        className="log-panel move-popup-panel equip-inspect-panel"
        style={{ borderTopColor: RARITY_COLOR_VARS[item.rarity] } as CSSProperties}
        onClick={(e) => e.stopPropagation()}
      >
        <ItemDetailCard item={item} />
        <div className="move-popup-hint">Tap anywhere to close</div>
      </div>
    </div>
  );
}
