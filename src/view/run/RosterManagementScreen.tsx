import { useMemo, useState, type DragEvent } from 'react';
import { heroes } from '../../data/heroes';
import { equipment } from '../../data/equipment';
import { relics } from '../../data/relics';
import { passives } from '../../data/passives';
import type { HeroDefinition, StatKey } from '../../engine/content';
import { relicTeamStatModifiers } from '../../run/relics';
import { relicTeamPassiveGrants } from '../../run/passives';
import { relicStatContribution } from '../../run/entryStats';
import { StatGlyph, STAT_LABELS } from '../shared/StatBars';
import type { RunState, RosterEntry } from '../../run/state';
import type { EquipmentDefinition } from '../../run/equipment';
import { moveEquipment, RunProgressError } from '../../run/runProgress';
import { itemSlotsFor, rosterEntryTypes } from '../../run/progression';
import { getTypeColor } from '../combat/typeColors';
import { useLongPress } from '../shared/MoveTile';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { TypeBadge } from '../shared/TypeBadge';
import { HeroPortrait } from '../shared/HeroPortrait';
import { ItemBox, ItemSummaryPopup, slotBoxes } from '../shared/EquipmentBox';

const DRAG_KEY = 'text/titanpact-equip-move';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  onClose: () => void;
}

/** A hero's slot, addressed the way every handler here needs it. */
interface SlotRef {
  rosterId: string;
  index: number;
}

interface RosterMgmtHeadProps {
  hero: HeroDefinition;
  entry: RosterEntry;
  onInspect: () => void;
}

/** Own component because useLongPress is a hook. Tap does nothing; hold (or the "i") opens the sheet. */
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
 * Manage Roster: reassigns gear that is already equipped somewhere (there is no unequipped stash —
 * ForceEquipScreen resolves every new item on the spot). Tap a filled slot then any slot on another
 * hero, or drag. Slots are uncategorised, so anything can go anywhere: an empty slot just takes the
 * item, and a filled one trades — the two items change places.
 */
export function RosterManagementScreen({ run, onRunChange, onClose }: Props) {
  const [selected, setSelected] = useState<SlotRef | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [inspecting, setInspecting] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);
  const [viewedItemId, setViewedItemId] = useState<string | null>(null);
  /** Banner-only: the relic grants are already applied wherever stats are read. */
  const relicGrants = useMemo(
    () =>
      Object.entries(
        relicStatContribution(relicTeamStatModifiers(run.relics, relics), relicTeamPassiveGrants(run.relics, relics), passives)
      ) as [StatKey, number][],
    [run.relics]
  );

  function applyMove(from: SlotRef, to: SlotRef) {
    if (from.rosterId === to.rosterId) return;
    try {
      // `toIndex` only matters when the destination is full; moveEquipment ignores it otherwise,
      // so an empty box and a filled one on the same hero can share this one call.
      onRunChange(moveEquipment(run, from.rosterId, from.index, to.rosterId, heroes, to.index).run);
    } catch (err) {
      if (!(err instanceof RunProgressError)) throw err;
    }
  }

  function handleSlotClick(ref: SlotRef, filled: boolean) {
    if (selected) {
      if (selected.rosterId !== ref.rosterId) applyMove(selected, ref);
      setSelected(null);
      return;
    }
    if (!filled) return;
    setSelected(ref);
  }

  function handleDrop(to: SlotRef, from: SlotRef) {
    setDragOverKey(null);
    applyMove(from, to);
    setSelected(null);
  }

  return (
    <div
      className="log-overlay roster-mgmt-overlay"
      onClick={() => {
        // The long-press item popup mounts mid-gesture, so the release click's mousedown and
        // mouseup targets differ and the browser dispatches it on their common ancestor — this
        // overlay — bypassing the popup's own stopPropagation. Treat that click as closing the popup.
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
                  <StatGlyph stat={stat} /> {STAT_LABELS[stat]} {amount > 0 ? `+${amount}` : amount}
                </span>
              ))}
              <span className="relic-active-banner-note">Already included in every hero's stats below.</span>
            </div>
          )}
          <div className="roster-mgmt-list">
            {run.roster.map((entry) => {
              const hero = heroes[entry.heroId];
              const selectedItemId = selected
                ? (run.roster.find((r) => r.rosterId === selected.rosterId)?.equipment[selected.index] ?? null)
                : null;
              return (
                <div key={entry.rosterId} className="roster-mgmt-card" style={{ borderLeftColor: getTypeColor(hero.types[0]) }}>
                  <RosterMgmtHead hero={hero} entry={entry} onInspect={() => setInspecting({ hero, entry })} />

                  <div className="equip-slot-row">
                    {slotBoxes(entry.equipment, itemSlotsFor(hero, entry)).map((itemId, index) => {
                      const item = itemId ? (equipment[itemId] ?? null) : null;
                      const dragKey = `${entry.rosterId}:${index}`;
                      const ref: SlotRef = { rosterId: entry.rosterId, index };
                      const isSelectedSource = selected?.rosterId === entry.rosterId && selected.index === index;
                      // Every slot on another hero is a target — but not one already holding the
                      // moving item, since a hero never holds two copies.
                      const isDropTarget = !!selected && selected.rosterId !== entry.rosterId && itemId !== selectedItemId;
                      return (
                        <ItemBox
                          key={index}
                          item={item}
                          className={[isSelectedSource ? 'selected' : '', isDropTarget ? 'drop-target' : '', dragOverKey === dragKey ? 'drag-over' : '']
                            .filter(Boolean)
                            .join(' ')}
                          // Tap is taken here — it selects and moves gear, which is this screen's
                          // whole job — so holding is what reads an item out.
                          onTap={() => handleSlotClick(ref, !!item)}
                          onLongPress={item ? () => setViewedItemId(item.id) : undefined}
                          draggable={!!item}
                          onDragStart={(e) => {
                            if (!item) return;
                            e.dataTransfer.setData(DRAG_KEY, dragKey);
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onDragOver={(e) => {
                            if (e.dataTransfer.types.includes(DRAG_KEY)) {
                              e.preventDefault();
                              setDragOverKey(dragKey);
                            }
                          }}
                          onDragLeave={() => setDragOverKey((k) => (k === dragKey ? null : k))}
                          onDrop={(e) => {
                            e.preventDefault();
                            const raw = e.dataTransfer.getData(DRAG_KEY);
                            if (!raw) return;
                            const [fromRosterId, fromIndex] = raw.split(':');
                            handleDrop(ref, { rosterId: fromRosterId, index: Number(fromIndex) });
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

      <ItemSummaryPopup item={viewedItemId ? (equipment[viewedItemId] ?? null) : null} onClose={() => setViewedItemId(null)} />
    </div>
  );
}
