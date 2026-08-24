import { useState, type DragEvent } from 'react';
import { heroes } from '../../data/heroes';
import { equipment } from '../../data/equipment';
import { relics } from '../../data/relics';
import { passives } from '../../data/passives';
import type { HeroDefinition, StatKey } from '../../engine/content';
import { relicTeamStatModifiers } from '../../run/relics';
import { relicTeamPassiveGrants } from '../../run/passives';
import { relicStatContribution } from '../../run/entryStats';
import { STAT_ICONS, STAT_LABELS } from '../shared/StatBars';
import type { RunState, RosterEntry } from '../../run/state';
import type { EquipmentDefinition, EquipmentSlot } from '../../run/equipment';
import { swapEquipment, RunProgressError } from '../../run/runProgress';
import { rosterEntryTypes } from '../../run/progression';
import { getTypeColor } from '../combat/typeColors';
import { useLongPress } from '../shared/MoveTile';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { TypeBadge } from '../shared/TypeBadge';
import { HeroPortrait } from '../shared/HeroPortrait';
import { EQUIP_SLOT_ORDER, EQUIP_SLOT_LABELS, EquipmentIcon, EquipmentInfoPanel } from '../shared/EquipmentBox';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  onClose: () => void;
}

interface EquipSlotButtonProps {
  item: EquipmentDefinition | null;
  slot: EquipmentSlot;
  isSelectedSource: boolean;
  isDropTarget: boolean;
  isDragOver: boolean;
  onClick: () => void;
  onLongPress: () => void;
  onDragStart: (e: DragEvent) => void;
  onDragOver: (e: DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent) => void;
}

interface RosterMgmtHeadProps {
  hero: HeroDefinition;
  entry: RosterEntry;
  onInspect: () => void;
}

/**
 * One hero's name/types row — pulled out of the roster .map() below
 * because useLongPress is a hook (same reason EquipSlotButton is its own
 * component). A tap does nothing here (the "i" button is the discoverable
 * way in); a hold opens the same HeroPreviewOverlay sheet, matching the
 * "hold a hero to review it" language this app now uses everywhere a hero
 * card sits inside a bigger tappable/draggable surface.
 */
function RosterMgmtHead({ hero, entry, onInspect }: RosterMgmtHeadProps) {
  const longPress = useLongPress(onInspect);
  return (
    <div className="roster-mgmt-head" {...longPress}>
      <HeroPortrait heroId={hero.id} className="roster-mgmt-portrait" />
      <div className="roster-mgmt-name">{hero.name}</div>
      <div className="roster-card-types">
        {rosterEntryTypes(hero, entry).map((t) => (
          <TypeBadge key={t} type={t} />
        ))}
      </div>
      <button className="info-button roster-mgmt-info-button" onClick={onInspect} aria-label={`View ${hero.name} details`}>
        i
      </button>
    </div>
  );
}

/**
 * One hero's equip slot. Pulled out of the roster .map() below because
 * useLongPress is a hook — it can't be called from inside a loop body, only
 * from a component's own top level (same reason LevelUpScreen's
 * ReplaceMoveCard is its own component rather than an inline callback). Tap
 * still does the select/move dance (handled by the caller); holding shows
 * the item's description instead of a persistent selected-item banner.
 */
function EquipSlotButton({
  item,
  slot,
  isSelectedSource,
  isDropTarget,
  isDragOver,
  onClick,
  onLongPress,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: EquipSlotButtonProps) {
  const longPress = useLongPress(item ? onLongPress : undefined, onClick);
  return (
    <button
      className={`equip-slot-box${item ? ' filled' : ' empty'}${isSelectedSource ? ' selected' : ''}${
        isDropTarget ? ' drop-target' : ''
      }${isDragOver ? ' drag-over' : ''}`}
      draggable={!!item}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      aria-label={item ? `${EQUIP_SLOT_LABELS[slot]}: ${item.name}` : `${EQUIP_SLOT_LABELS[slot]} slot, empty`}
      {...longPress}
    >
      <EquipmentIcon item={item} slot={slot} className="equip-slot-icon" />
      <span className="equip-slot-item">{item ? item.name : 'Empty'}</span>
    </button>
  );
}

/**
 * The Manage Roster screen (map-node-reachable, not a fight-blocking flow —
 * that's LevelUpScreen now). Condensed hero rows (name/types + an Info
 * button opening the full StatBars readout via HeroPreviewOverlay) each show
 * their 3 equipment slots underneath, empty by default. There is no
 * unequipped-item stash anymore (per user direction — every newly obtained
 * item is resolved on the spot by ForceEquipScreen): this screen only
 * reassigns gear that's already equipped somewhere. Tap a filled slot to
 * select it, then tap the matching slot on another hero to move it there
 * (swapping with whatever's already in that slot, if anything) — or drag it
 * directly. No banner or trash action clutters the screen for this — a
 * held press instead shows the item's description (EquipSlotButton above).
 */
export function RosterManagementScreen({ run, onRunChange, onClose }: Props) {
  const [selected, setSelected] = useState<{ rosterId: string; slot: EquipmentSlot } | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [inspecting, setInspecting] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);
  const [viewedItemId, setViewedItemId] = useState<string | null>(null);
  /** What the run's relics are currently adding to EVERY hero below (src/run/entryStats.ts) — banner-only, since the stats themselves are already applied wherever they're read. */
  const relicGrants = Object.entries(
    relicStatContribution(relicTeamStatModifiers(run.relics, relics), relicTeamPassiveGrants(run.relics, relics), passives)
  ) as [StatKey, number][];

  function selectSlot(rosterId: string, slot: EquipmentSlot) {
    setSelected((prev) => (prev && prev.rosterId === rosterId && prev.slot === slot ? null : { rosterId, slot }));
  }

  function moveSelectedTo(toRosterId: string, slot: EquipmentSlot) {
    if (!selected || selected.slot !== slot) return;
    if (selected.rosterId === toRosterId) {
      setSelected(null);
      return;
    }
    try {
      onRunChange(swapEquipment(run, selected.rosterId, toRosterId, slot));
    } catch (err) {
      if (!(err instanceof RunProgressError)) throw err;
    }
    setSelected(null);
  }

  function handleSlotClick(rosterId: string, slot: EquipmentSlot, filled: boolean) {
    if (selected) {
      moveSelectedTo(rosterId, slot);
      return;
    }
    if (!filled) return;
    selectSlot(rosterId, slot);
  }

  function handleDrop(toRosterId: string, slot: EquipmentSlot, fromRosterId: string, fromSlot: EquipmentSlot) {
    setDragOverKey(null);
    if (fromSlot !== slot || fromRosterId === toRosterId) return;
    try {
      onRunChange(swapEquipment(run, fromRosterId, toRosterId, slot));
    } catch (err) {
      if (!(err instanceof RunProgressError)) throw err;
    }
    setSelected(null);
  }

  return (
    <div
      className="log-overlay roster-mgmt-overlay"
      onClick={() => {
        // A long-press-opened item popup (below) is inserted mid-gesture,
        // while the pointer is still down over the equip-slot button —
        // release then fires a "click" whose mousedown target (the button)
        // and mouseup target (the popup, now covering that spot) differ. In
        // that case the browser dispatches the click on their nearest common
        // ancestor, which is THIS overlay, skipping right past the popup's
        // own stopPropagation and closing Manage Roster instead of just the
        // popup. Treat that click as dismissing the popup, not the screen.
        if (viewedItemId) {
          setViewedItemId(null);
          return;
        }
        onClose();
      }}
    >
      <div className="log-panel roster-panel" onClick={(e) => e.stopPropagation()}>
        <div className="log-panel-header">
          <span>Manage Roster</span>
          <button className="log-close-button" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="screen-scroll">
          {relicGrants.length > 0 && (
            <div className="relic-active-banner">
              <span className="relic-active-banner-label">🏺 Relics active</span>
              {relicGrants.map(([stat, amount]) => (
                <span key={stat} className="relic-contrib-chip">
                  <span aria-hidden="true">{STAT_ICONS[stat]}</span> {STAT_LABELS[stat]} {amount > 0 ? `+${amount}` : amount}
                </span>
              ))}
              <span className="relic-active-banner-note">Already included in every hero's stats below.</span>
            </div>
          )}
          <div className="roster-mgmt-list">
            {run.roster.map((entry) => {
              const hero = heroes[entry.heroId];
              return (
                <div key={entry.rosterId} className="roster-mgmt-card" style={{ borderLeftColor: getTypeColor(hero.types[0]) }}>
                  <RosterMgmtHead hero={hero} entry={entry} onInspect={() => setInspecting({ hero, entry })} />

                  <div className="equip-slot-row">
                    {EQUIP_SLOT_ORDER.map((slot) => {
                      const itemId = entry.equipment[slot];
                      const item = itemId ? equipment[itemId] : null;
                      const dragKey = `${entry.rosterId}:${slot}`;
                      const isSelectedSource = selected?.rosterId === entry.rosterId && selected.slot === slot;
                      const isDropTarget = selected ? selected.slot === slot && selected.rosterId !== entry.rosterId : false;
                      const isDragOver = dragOverKey === dragKey;
                      return (
                        <EquipSlotButton
                          key={slot}
                          item={item}
                          slot={slot}
                          isSelectedSource={isSelectedSource}
                          isDropTarget={isDropTarget}
                          isDragOver={isDragOver}
                          onClick={() => handleSlotClick(entry.rosterId, slot, !!item)}
                          onLongPress={() => item && setViewedItemId(item.id)}
                          onDragStart={(e) => {
                            if (!item) return;
                            e.dataTransfer.setData('text/titanpact-equip-move', `${entry.rosterId}:${slot}`);
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onDragOver={(e) => {
                            if (e.dataTransfer.types.includes('text/titanpact-equip-move')) {
                              e.preventDefault();
                              setDragOverKey(dragKey);
                            }
                          }}
                          onDragLeave={() => setDragOverKey((k) => (k === dragKey ? null : k))}
                          onDrop={(e) => {
                            e.preventDefault();
                            const raw = e.dataTransfer.getData('text/titanpact-equip-move');
                            if (!raw) return;
                            const [fromRosterId, fromSlot] = raw.split(':');
                            handleDrop(entry.rosterId, slot, fromRosterId, fromSlot as EquipmentSlot);
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {inspecting && (
        <HeroPreviewOverlay
          hero={inspecting.hero}
          entry={inspecting.entry}
          equipmentLookup={equipment}
          relicIds={run.relics}
          onClose={() => setInspecting(null)}
        />
      )}

      {viewedItemId && (
        <div
          className="log-overlay"
          onClick={(e) => {
            e.stopPropagation();
            setViewedItemId(null);
          }}
        >
          <div className="log-panel move-popup-panel">
            <EquipmentInfoPanel item={equipment[viewedItemId]} />
            <div className="move-popup-hint">Tap anywhere to close</div>
          </div>
        </div>
      )}
    </div>
  );
}
