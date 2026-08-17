import { useState } from 'react';
import { heroes } from '../../data/heroes';
import { equipment } from '../../data/equipment';
import type { HeroDefinition } from '../../engine/content';
import type { RunState, RosterEntry } from '../../run/state';
import type { EquipmentSlot } from '../../run/equipment';
import { equipFromInventory, unequipToInventory, RunProgressError } from '../../run/runProgress';
import { rosterEntryTypes } from '../../run/progression';
import { getTypeColor } from '../combat/typeColors';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { TypeBadge } from '../shared/TypeBadge';
import { HeroPortrait } from '../shared/HeroPortrait';
import { EQUIP_SLOT_ICONS, EQUIP_SLOT_ORDER } from '../shared/EquipmentBox';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  onClose: () => void;
}

/** Counts each distinct item id in the inventory, so duplicates render as one box with a count badge instead of a wall of identical boxes. */
function groupInventory(inventory: readonly string[]): { itemId: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const id of inventory) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts.entries()].map(([itemId, count]) => ({ itemId, count }));
}

/**
 * The Manage Roster screen (map-node-reachable, not a fight-blocking flow —
 * that's LevelUpScreen now). Condensed hero rows (name/level/types + an Info
 * button opening the full StatBars readout via HeroPreviewOverlay) each show
 * their 3 equipment slots underneath, empty by default. Equipping now goes
 * through a real inventory (RunState.inventory, runProgress.ts) rather than
 * hero-to-hero swapping: tap an inventory box to select it (or drag it) then
 * tap/drop it onto a compatible slot; tap a filled slot with nothing selected
 * to send that item back to the inventory.
 */
export function RosterManagementScreen({ run, onRunChange, onClose }: Props) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [inspecting, setInspecting] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);

  function selectInventoryItem(itemId: string) {
    setSelectedItemId((prev) => (prev === itemId ? null : itemId));
  }

  function equipSelectedOnto(rosterId: string, slot: EquipmentSlot) {
    if (!selectedItemId) return;
    if (equipment[selectedItemId].slot !== slot) return;
    try {
      onRunChange(equipFromInventory(run, rosterId, selectedItemId, equipment));
    } catch (err) {
      if (!(err instanceof RunProgressError)) throw err;
    }
    setSelectedItemId(null);
  }

  function handleSlotClick(rosterId: string, slot: EquipmentSlot, filled: boolean) {
    if (selectedItemId) {
      equipSelectedOnto(rosterId, slot);
      return;
    }
    if (!filled) return;
    try {
      onRunChange(unequipToInventory(run, rosterId, slot));
    } catch (err) {
      if (!(err instanceof RunProgressError)) throw err;
    }
  }

  function handleDrop(rosterId: string, slot: EquipmentSlot, itemId: string) {
    setDragOverKey(null);
    if (equipment[itemId].slot !== slot) return;
    try {
      onRunChange(equipFromInventory(run, rosterId, itemId, equipment));
    } catch (err) {
      if (!(err instanceof RunProgressError)) throw err;
    }
    setSelectedItemId(null);
  }

  const inventoryGroups = groupInventory(run.inventory);

  return (
    <div className="log-overlay roster-mgmt-overlay" onClick={onClose}>
      <div className="log-panel roster-panel" onClick={(e) => e.stopPropagation()}>
        <div className="log-panel-header">
          <span>Manage Roster</span>
          <button className="log-close-button" onClick={onClose}>
            ✕
          </button>
        </div>
        {selectedItemId && <p className="hint">{`${equipment[selectedItemId].name} selected — tap a matching slot to equip it.`}</p>}
        <div className="screen-scroll">
          <div className="roster-mgmt-list">
            {run.roster.map((entry) => {
              const hero = heroes[entry.heroId];
              return (
                <div key={entry.rosterId} className="roster-mgmt-card" style={{ borderLeftColor: getTypeColor(hero.types[0]) }}>
                  <div className="roster-mgmt-head">
                    <HeroPortrait heroId={hero.id} className="roster-mgmt-portrait" />
                    <div className="roster-mgmt-name">
                      {hero.name} <span className="hint">Lv {entry.level}</span>
                    </div>
                    <div className="roster-card-types">
                      {rosterEntryTypes(hero, entry).map((t) => (
                        <TypeBadge key={t} type={t} />
                      ))}
                    </div>
                    <button
                      className="info-button roster-mgmt-info-button"
                      onClick={() => setInspecting({ hero, entry })}
                      aria-label={`View ${hero.name} details`}
                    >
                      i
                    </button>
                  </div>

                  <div className="equip-slot-row">
                    {EQUIP_SLOT_ORDER.map((slot) => {
                      const itemId = entry.equipment[slot];
                      const item = itemId ? equipment[itemId] : null;
                      const dragKey = `${entry.rosterId}:${slot}`;
                      const isDropTarget = selectedItemId ? equipment[selectedItemId].slot === slot : false;
                      const isDragOver = dragOverKey === dragKey;
                      return (
                        <button
                          key={slot}
                          className={`equip-slot-box${item ? ' filled' : ' empty'}${isDropTarget ? ' drop-target' : ''}${
                            isDragOver ? ' drag-over' : ''
                          }`}
                          onClick={() => handleSlotClick(entry.rosterId, slot, !!item)}
                          onDragOver={(e) => {
                            if (e.dataTransfer.types.includes('text/titanpact-item')) {
                              e.preventDefault();
                              setDragOverKey(dragKey);
                            }
                          }}
                          onDragLeave={() => setDragOverKey((k) => (k === dragKey ? null : k))}
                          onDrop={(e) => {
                            e.preventDefault();
                            const itemId = e.dataTransfer.getData('text/titanpact-item');
                            if (itemId) handleDrop(entry.rosterId, slot, itemId);
                          }}
                        >
                          <span className="equip-slot-icon">{EQUIP_SLOT_ICONS[slot]}</span>
                          <span className="equip-slot-item">{item ? item.name : 'Empty'}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="inventory-section">
            <div className="detail-section-title">Inventory</div>
            {inventoryGroups.length > 0 ? (
              <div className="inventory-grid">
                {inventoryGroups.map(({ itemId, count }) => {
                  const item = equipment[itemId];
                  const isSelected = selectedItemId === itemId;
                  return (
                    <button
                      key={itemId}
                      className={`inventory-box${isSelected ? ' selected' : ''}`}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/titanpact-item', itemId);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onClick={() => selectInventoryItem(itemId)}
                    >
                      <span className="equip-slot-icon">{EQUIP_SLOT_ICONS[item.slot]}</span>
                      <span className="inventory-box-name">{item.name}</span>
                      {count > 1 && <span className="inventory-box-count">×{count}</span>}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="detail-empty">No unequipped items — find gear at equipment nodes.</div>
            )}
          </div>
        </div>
      </div>

      {inspecting && (
        <HeroPreviewOverlay
          hero={inspecting.hero}
          entry={inspecting.entry}
          equipmentLookup={equipment}
          onClose={() => setInspecting(null)}
        />
      )}
    </div>
  );
}
