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
import { STASH_CAPACITY, stashIsFull } from '../../run/equipment';
import { equipFromStash, moveEquipment, sellFromStash, unequipToStash, RunProgressError } from '../../run/runProgress';
import { sellValueFor } from '../../run/shop';
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

/** Either end of a move: a hero's slot, or one of the bag's. */
type SlotRef = { kind: 'hero'; rosterId: string; index: number } | { kind: 'stash'; index: number };

function refKey(ref: SlotRef): string {
  return ref.kind === 'hero' ? `hero:${ref.rosterId}:${ref.index}` : `stash:${ref.index}`;
}

function parseRefKey(raw: string): SlotRef | null {
  const parts = raw.split(':');
  if (parts[0] === 'stash' && parts.length === 2) return { kind: 'stash', index: Number(parts[1]) };
  if (parts[0] === 'hero' && parts.length === 3) return { kind: 'hero', rosterId: parts[1], index: Number(parts[2]) };
  return null;
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
 * Manage Roster: where gear moves. Every slot — a hero's or one of the bag's — is both a source
 * and a destination, so one tap-then-tap (or one drag) covers equipping, unequipping, handing an
 * item to another hero, and swapping two. Slots are uncategorised, so anything goes anywhere: an
 * empty slot just takes the item, a filled one trades. Selling is bag-only; equipped gear comes
 * off first, which keeps the irreversible verb one step away from a mis-tap.
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

  function itemAt(ref: SlotRef): string | null {
    if (ref.kind === 'stash') return run.stash[ref.index] ?? null;
    return run.roster.find((r) => r.rosterId === ref.rosterId)?.equipment[ref.index] ?? null;
  }

  const selectedItemId = selected ? itemAt(selected) : null;
  const selectedItem = selectedItemId ? (equipment[selectedItemId] ?? null) : null;

  /** The four directions a move can run. A refusal is a no-op — the UI marks illegal targets rather than reporting them. */
  function applyMove(from: SlotRef, to: SlotRef) {
    try {
      if (from.kind === 'hero' && to.kind === 'hero') {
        if (from.rosterId === to.rosterId) return;
        // `to.index` only matters when the destination is full; moveEquipment ignores it otherwise,
        // so an empty box and a filled one on the same hero can share this one call.
        onRunChange(moveEquipment(run, from.rosterId, from.index, to.rosterId, heroes, to.index).run);
      } else if (from.kind === 'hero' && to.kind === 'stash') {
        onRunChange(unequipToStash(run, from.rosterId, from.index));
      } else if (from.kind === 'stash' && to.kind === 'hero') {
        const entry = run.roster.find((r) => r.rosterId === to.rosterId);
        const hero = entry ? heroes[entry.heroId] : undefined;
        if (!entry || !hero) return;
        // A free slot takes it outright; a full hero gives up whatever box was tapped.
        const full = entry.equipment.length >= itemSlotsFor(hero, entry);
        onRunChange(equipFromStash(run, from.index, to.rosterId, equipment, heroes, full ? to.index : undefined));
      }
    } catch (err) {
      if (!(err instanceof RunProgressError)) throw err;
    }
  }

  function handleSlotClick(ref: SlotRef) {
    if (selected) {
      if (refKey(selected) !== refKey(ref)) applyMove(selected, ref);
      setSelected(null);
      return;
    }
    if (!itemAt(ref)) return;
    setSelected(ref);
  }

  function handleDrop(to: SlotRef, from: SlotRef) {
    setDragOverKey(null);
    applyMove(from, to);
    setSelected(null);
  }

  /** Shared by every box on the screen — a hero's slots and the bag's are the same affordance. */
  function slotProps(ref: SlotRef, item: EquipmentDefinition | null, isDropTarget: boolean) {
    const key = refKey(ref);
    const isSelectedSource = !!selected && refKey(selected) === key;
    return {
      className: [isSelectedSource ? 'selected' : '', isDropTarget ? 'drop-target' : '', dragOverKey === key ? 'drag-over' : '']
        .filter(Boolean)
        .join(' '),
      // Tap is taken here — it selects and moves gear, which is this screen's whole job — so
      // holding is what reads an item out.
      onTap: () => handleSlotClick(ref),
      onLongPress: item ? () => setViewedItemId(item.id) : undefined,
      draggable: !!item,
      onDragStart: (e: DragEvent) => {
        if (!item) return;
        e.dataTransfer.setData(DRAG_KEY, key);
        e.dataTransfer.effectAllowed = 'move';
      },
      onDragOver: (e: DragEvent) => {
        if (e.dataTransfer.types.includes(DRAG_KEY)) {
          e.preventDefault();
          setDragOverKey(key);
        }
      },
      onDragLeave: () => setDragOverKey((k) => (k === key ? null : k)),
      onDrop: (e: DragEvent) => {
        e.preventDefault();
        const from = parseRefKey(e.dataTransfer.getData(DRAG_KEY));
        if (from) handleDrop(ref, from);
      },
    };
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

          <div className={`stash-panel${stashIsFull(run.stash) ? ' is-full' : ''}`}>
            <div className="stash-header">
              <span className="stash-label">🎒 Bag</span>
              <span className="stash-count">
                {run.stash.length}/{STASH_CAPACITY}
              </span>
              <span className="stash-gold">{run.gold}g</span>
            </div>
            <div className="stash-grid">
              {slotBoxes(run.stash, STASH_CAPACITY).map((stashItemId, index) => {
                const item = stashItemId ? (equipment[stashItemId] ?? null) : null;
                const ref: SlotRef = { kind: 'stash', index };
                // An empty bag box takes anything a hero is holding; a filled one is only a
                // target for gear coming off a hero, since bag-to-bag means nothing.
                const isDropTarget = !!selected && selected.kind === 'hero' && !item;
                return <ItemBox key={index} item={item} {...slotProps(ref, item, isDropTarget)} />;
              })}
            </div>
            <div className="stash-hint">
              {selectedItem && selected?.kind === 'stash' ? (
                <>
                  <span className="stash-hint-text">Tap a hero's slot to equip {selectedItem.name}.</span>
                  <button
                    className="stash-sell-button"
                    onClick={() => {
                      const at = selected.index;
                      setSelected(null);
                      try {
                        onRunChange(sellFromStash(run, at, equipment));
                      } catch (err) {
                        if (!(err instanceof RunProgressError)) throw err;
                      }
                    }}
                  >
                    Sell {sellValueFor(selectedItem)}g
                  </button>
                </>
              ) : (
                <span className="stash-hint-text">
                  {selectedItem ? `Tap a bag slot to take ${selectedItem.name} off.` : 'Tap an item, then tap where it should go. Hold one to read it.'}
                </span>
              )}
            </div>
          </div>

          <div className="roster-mgmt-list">
            {run.roster.map((entry) => {
              const hero = heroes[entry.heroId];
              return (
                <div key={entry.rosterId} className="roster-mgmt-card" style={{ borderLeftColor: getTypeColor(hero.types[0]) }}>
                  <RosterMgmtHead hero={hero} entry={entry} onInspect={() => setInspecting({ hero, entry })} />

                  <div className="equip-slot-row">
                    {slotBoxes(entry.equipment, itemSlotsFor(hero, entry)).map((itemId, index) => {
                      const item = itemId ? (equipment[itemId] ?? null) : null;
                      const ref: SlotRef = { kind: 'hero', rosterId: entry.rosterId, index };
                      // A hero never holds two copies, so a slot already holding the moving item
                      // is not a target — nor is any slot on the hero the item is coming from.
                      const isDropTarget =
                        !!selected &&
                        itemId !== selectedItemId &&
                        (selected.kind === 'stash' || selected.rosterId !== entry.rosterId) &&
                        !entry.equipment.includes(selectedItemId ?? '');
                      return <ItemBox key={index} item={item} {...slotProps(ref, item, isDropTarget)} />;
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
