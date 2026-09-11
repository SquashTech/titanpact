import type { CSSProperties } from 'react';
import type { EquipmentDefinition } from '../../run/equipment';
import { EquipmentIcon, ItemEffectChips, RARITY_COLOR_VARS, RARITY_LABELS } from '../shared/EquipmentBox';
import { ItemDetailCard } from '../shared/ItemDossier';
import { useLongPress } from '../shared/MoveTile';

interface EquipChoiceCardProps {
  item: EquipmentDefinition;
  picked?: boolean;
  /** Omit for a card that is shown rather than chosen (the Loot Pile): it renders as a static surface that still holds-to-inspect. */
  onPick?: () => void;
  onInspect?: () => void;
  /** Staggers this card's fade-in behind whatever revealed it. */
  revealDelayMs: number;
}

export function EquipChoiceCard({ item, picked, onPick, onInspect, revealDelayMs }: EquipChoiceCardProps) {
  const longPress = useLongPress(onInspect, onPick);
  return (
    <button
      type="button"
      className={`equip-cache-card equip-cache-reveal-in${picked ? ' picked' : ''}${onPick ? '' : ' is-static'}`}
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
          <ItemEffectChips item={item} />
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
 * A plain inspect from a reward or event pick. Same card as every other item hold
 * (ItemDossier.tsx), with the tier stripe so it reads as the same thing opening. The Guild Hall's
 * buy sheet grew out of this and is its own component now (EquipBuyOverlay.tsx).
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
