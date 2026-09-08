import { useState, type CSSProperties } from 'react';
import { equipment } from '../../data/equipment';
import { heroes } from '../../data/heroes';
import { passives } from '../../data/passives';
import { statuses } from '../../data/statuses';
import type { StatKey } from '../../engine/content';
import type { EquipmentDefinition } from '../../run/equipment';
import { itemSlotsFor } from '../../run/progression';
import type { RosterEntry } from '../../run/state';
import {
  EquipmentEffectList,
  EquipmentIcon,
  ItemEffectChips,
  ItemSummaryPopup,
  fmtGrant,
  RARITY_COLOR_VARS,
  RARITY_LABELS,
} from '../shared/EquipmentBox';
import { HeroSlotCard, HeroSlotGrid } from '../shared/HeroSlotCard';
import { StatGlyph } from '../shared/StatBars';
import { STAT_FULL_LABELS } from '../shared/relicStacks';
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

/**
 * Who has room and who is full — the half of the buy decision the item's own card can't answer
 * ("is there anywhere to put this that doesn't cost me something?"). The same squad grid Manage
 * Roster uses (2026-09-07, per user direction): item names are icons here too, so the shelf, the
 * bag and the buy sheet are one picture rather than three notations.
 *
 * Read-only, and now purely informational: a purchase goes to the bag, and who carries it is
 * decided in the Roster whenever the player likes.
 */
function SlotOwners({ roster }: { roster: readonly RosterEntry[] }) {
  const [summaryItem, setSummaryItem] = useState<EquipmentDefinition | null>(null);
  return (
    <div className="equip-owners">
      <div className="equip-owners-head">Roster — item slots</div>
      <HeroSlotGrid className="is-compact">
        {roster.map((entry) => {
          const hero = heroes[entry.heroId];
          if (!hero) return null;
          const free = itemSlotsFor(hero, entry) - entry.equipment.length;
          return (
            <HeroSlotCard
              key={entry.rosterId}
              hero={hero}
              entry={entry}
              equipmentLookup={equipment}
              className={free > 0 ? 'can-take' : ''}
              badge={<span className="equip-card-verdict">{free > 0 ? `${free} free` : 'Full'}</span>}
              slotProps={(_, item) => ({ onTap: item ? () => setSummaryItem(item) : undefined })}
            />
          );
        })}
      </HeroSlotGrid>
      <ItemSummaryPopup item={summaryItem} onClose={() => setSummaryItem(null)} />
    </div>
  );
}

interface EquipInspectOverlayProps {
  item: EquipmentDefinition;
  /** Adds the roster's item-slot holdings. Omit where the item isn't a purchase (the Loot Pile). */
  roster?: readonly RosterEntry[];
  /** Turns the sheet into a decision (the Guild Hall shelf): a confirm button plus Cancel. Omit for read-only inspects. */
  action?: {
    label: string;
    /** Rendered above the button — why it is inert, or what confirming will additionally cost. */
    note?: string;
    disabled?: boolean;
    onConfirm: () => void;
  };
  onClose: () => void;
}

export function EquipInspectOverlay({ item, roster, action, onClose }: EquipInspectOverlayProps) {
  const grants = Object.entries(item.statGrants).filter(([, amount]) => amount) as [StatKey, number][];
  const hasEffects = grants.length > 0 || (item.grantsPassiveIds?.length ?? 0) > 0 || (item.grantsStatusIds?.length ?? 0) > 0;
  return (
    <div className="log-overlay" onClick={onClose}>
      <div className="log-panel move-popup-panel" onClick={(e) => e.stopPropagation()}>
        <div className="move-info-panel" style={{ '--rarity-color': RARITY_COLOR_VARS[item.rarity] } as CSSProperties}>
          <div className="move-info-head">
            <span className="move-info-name">{item.name}</span>
            <span className="move-info-kind">
              {RARITY_LABELS[item.rarity]}
            </span>
          </div>
          {grants.length > 0 && (
            <div className="detail-modifier-list">
              {grants.map(([stat, amount]) => (
                <span key={stat} className={`detail-modifier-chip ${amount > 0 ? 'stat-buff' : 'stat-debuff'}`}>
                  <StatGlyph stat={stat} tone="inherit" /> {STAT_FULL_LABELS[stat]} {fmtGrant(amount)}
                </span>
              ))}
            </div>
          )}
          <EquipmentEffectList item={item} />
          {!hasEffects && <div className="move-info-placeholder">No effects.</div>}
        </div>
        {roster && roster.length > 0 && <SlotOwners roster={roster} />}
        {action ? (
          <div className="detail-action">
            {action.note && <div className="detail-action-note">{action.note}</div>}
            <button className="resolve-button" disabled={action.disabled} onClick={action.onConfirm}>
              {action.label}
            </button>
            <button className="detail-action-cancel" onClick={onClose}>
              Cancel
            </button>
          </div>
        ) : (
          <div className="move-popup-hint">Tap anywhere to close</div>
        )}
      </div>
    </div>
  );
}
