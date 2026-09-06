import { type CSSProperties } from 'react';
import { equipment } from '../../data/equipment';
import { heroes } from '../../data/heroes';
import { passives } from '../../data/passives';
import { statuses } from '../../data/statuses';
import type { StatKey } from '../../engine/content';
import type { EquipmentDefinition, EquipmentSlot } from '../../run/equipment';
import type { RosterEntry } from '../../run/state';
import { HeroPortrait } from '../shared/HeroPortrait';
import {
  EQUIP_SLOT_LABELS,
  EquipmentEffectList,
  EquipmentIcon,
  fmtGrant,
  RARITY_COLOR_VARS,
  RARITY_LABELS,
} from '../shared/EquipmentBox';
import { StatGlyph } from '../shared/StatBars';
import { STAT_FULL_LABELS } from '../shared/relicStacks';
import { useLongPress } from '../shared/MoveTile';

/** Card-face summary ("+10 Attack · Ember Ward"), folding passive/status grants in so a stat-less item never reads as blank. */
export function itemHighlights(item: EquipmentDefinition): string[] {
  const statParts = Object.entries(item.statGrants)
    .filter(([, amount]) => amount)
    .map(([stat, amount]) => `${(amount as number) > 0 ? '+' : ''}${amount} ${STAT_FULL_LABELS[stat as StatKey] ?? stat}`);
  const passiveParts = (item.grantsPassiveIds ?? []).flatMap((id) => (passives[id] ? [passives[id].name] : []));
  const statusParts = (item.grantsStatusIds ?? []).flatMap(({ statusId, magnitude }) =>
    statuses[statusId] ? [`${statuses[statusId].name} +${magnitude}`] : []
  );
  return [...statParts, ...passiveParts, ...statusParts];
}

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
  const highlights = itemHighlights(item);
  return (
    <button
      type="button"
      className={`equip-cache-card equip-cache-reveal-in${picked ? ' picked' : ''}${onPick ? '' : ' is-static'}`}
      style={{ '--rarity-color': RARITY_COLOR_VARS[item.rarity], animationDelay: `${revealDelayMs}ms` } as CSSProperties}
      {...longPress}
    >
      <div className="equip-cache-card-icon-badge">
        <EquipmentIcon item={item} slot={item.slot} className="equip-cache-card-icon" />
      </div>
      <div className="equip-cache-card-body">
        <div className="equip-cache-card-name">{item.name}</div>
        <div className="equip-cache-card-meta">
          <span className="equip-cache-card-rarity">{RARITY_LABELS[item.rarity]}</span>
          <span className="equip-cache-card-slot">{EQUIP_SLOT_LABELS[item.slot]}</span>
        </div>
        <div className="equip-cache-card-stats">{highlights.length > 0 ? highlights.join(' · ') : 'No effect'}</div>
      </div>
    </button>
  );
}

/**
 * Who already holds what in one slot — the half of the buy decision the item's own card can't
 * answer ("do I have anywhere to put this?"). Read-only: the Guild Hall still routes the purchase
 * through ForceEquipScreen, which is where a hero is actually chosen.
 */
function SlotOwners({ roster, slot }: { roster: readonly RosterEntry[]; slot: EquipmentSlot }) {
  return (
    <div className="equip-owners">
      <div className="equip-owners-head">Roster — {EQUIP_SLOT_LABELS[slot]} slot</div>
      {roster.map((entry) => {
        const heldId = entry.equipment[slot];
        const held = heldId ? equipment[heldId] : null;
        return (
          <div key={entry.rosterId} className={`equip-owners-row${held ? '' : ' is-empty'}`}>
            <HeroPortrait heroId={entry.heroId} className="equip-owners-portrait" />
            <span className="equip-owners-name">{heroes[entry.heroId]?.name ?? entry.heroId}</span>
            <span
              className="equip-owners-item"
              style={held ? ({ color: RARITY_COLOR_VARS[held.rarity] } as CSSProperties) : undefined}
            >
              {held ? held.name : 'Empty'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

interface EquipInspectOverlayProps {
  item: EquipmentDefinition;
  /** Adds the roster's holdings in this item's slot. Omit where the item isn't a purchase (the Loot Pile). */
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
              {RARITY_LABELS[item.rarity]} · {EQUIP_SLOT_LABELS[item.slot]}
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
        {roster && roster.length > 0 && <SlotOwners roster={roster} slot={item.slot} />}
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
