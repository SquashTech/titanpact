import { useEffect, useState, type DragEvent } from 'react';
import { heroes } from '../../data/heroes';
import { equipment } from '../../data/equipment';
import type { HeroDefinition } from '../../engine/content';
import type { RunState, RosterEntry } from '../../run/state';
import type { EquipmentDefinition } from '../../run/equipment';
import type { EnchantmentId } from '../../run/equipment';
import { actAllowsRarity, canMergeItems, enchantLabel, mergeEnchantChoices, nextRarity, unseenCount } from '../../run/equipment';
import { equipFromStash, markStashItemSeen, mergeFromStash, moveEquipment, unequipToStash, RunProgressError } from '../../run/runProgress';
import { itemSlotsFor } from '../../run/progression';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { ItemBox, ItemReadout, ItemSummaryPopup, slotBoxes } from '../shared/EquipmentBox';
import { HeroSlotCard, HeroSlotGrid } from '../shared/HeroSlotCard';
import { EquipSwapScreen } from './EquipSwapScreen';
import { RunRelicsPanel } from './RunRelicsPanel';
import { MasteryBoard } from './MasteryBoard';
import { TabStrip, type TabSpec } from '../shared/TabStrip';
import { ResourceGlyph } from '../shared/RunGlyph';
import { playSfx } from '../../audio/sfx';

const DRAG_KEY = 'text/titanpact-equip-move';

/** Seating jolt length (styles.css `equip-seat-jolt`). Cosmetic only — the equip has already landed. */
const EQUIP_SEAT_MS = 420;

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  /** Which board to land on. Gear unless the caller has a reason. */
  initialBoard?: BoardId;
  onClose: () => void;
}

type BoardId = 'gear' | 'mastery';

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

/**
 * Manage Roster: where gear moves. Every slot — a hero's or one of the bag's — is both a source
 * and a destination, so one tap-then-tap (or one drag) covers equipping, unequipping, handing an
 * item to another hero, and swapping two. Slots are uncategorised, so anything goes anywhere: an
 * empty slot just takes the item, a filled one trades.
 *
 * Nothing here SPENDS anything (2026-09-07, per user direction). Selling used to live on the bag
 * and no longer does: this is the screen the player opens between every node, and the one
 * irreversible verb on it was one mis-tap from the gesture everything else uses.
 */
export function RosterManagementScreen({ run, onRunChange, initialBoard = 'gear', onClose }: Props) {
  /**
   * Gear and Mastery are two boards over one roster. Both answer "hand this out before the next
   * node", and both want the same six heroes in front of them — so they are one door with a
   * strip, not two buttons on the map (docs/growth-overhaul.md §10).
   */
  const [board, setBoard] = useState<BoardId>(initialBoard);
  const [selected, setSelected] = useState<SlotRef | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [inspecting, setInspecting] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);
  const [viewedItemId, setViewedItemId] = useState<string | null>(null);
  /** Raised only when BOTH halves of a merge carry an enchant and one has to be dropped. */
  const [pendingMerge, setPendingMerge] = useState<{ a: number; b: number; choices: EnchantmentId[] } | null>(null);
  /** A full hero the carried item was offered to — EquipSwapScreen owns the "which one goes" decision. */
  const [swappingRosterId, setSwappingRosterId] = useState<string | null>(null);
  /**
   * The card mid seating jolt. Inherited from the deleted item gate (2026-09-08), which was the
   * only screen that ever played it: handing a hero gear is the one grant in the run loop that
   * otherwise lands with no acknowledgement, the tap and the result being the same frame. Purely
   * cosmetic — unlike the gate's, this fires AFTER the equip, so nothing waits on it.
   */
  const [seatingRosterId, setSeatingRosterId] = useState<string | null>(null);

  useEffect(() => {
    if (!seatingRosterId) return;
    const timer = window.setTimeout(() => setSeatingRosterId(null), EQUIP_SEAT_MS);
    return () => window.clearTimeout(timer);
  }, [seatingRosterId]);

  function itemAt(ref: SlotRef): string | null {
    if (ref.kind === 'stash') return run.stash[ref.index] ?? null;
    return run.roster.find((r) => r.rosterId === ref.rosterId)?.equipment[ref.index] ?? null;
  }

  /** Whether two bag slots hold a mergeable pair — the act window included, so a blocked tier reads as "not a target". */
  function mergeableInBag(a: number, b: number): boolean {
    if (a === b) return false;
    const left = equipment[run.stash[a] ?? ''];
    const right = equipment[run.stash[b] ?? ''];
    if (!left || !right || !canMergeItems(left, right)) return false;
    return actAllowsRarity(run.actNumber, nextRarity(left.rarity)!);
  }

  const selectedItemId = selected ? itemAt(selected) : null;
  const selectedItem = selectedItemId ? (equipment[selectedItemId] ?? null) : null;
  const swapTarget = swappingRosterId ? run.roster.find((r) => r.rosterId === swappingRosterId) : undefined;

  /**
   * The four directions a move can run. A refusal is a no-op — the UI marks illegal targets
   * rather than reporting them — and each direction that lands carries its own cue: gear going
   * ONTO a hero is the `equip` buckle, coming off is a lighter shuffle, and a merge borrows the
   * discovery sting because it hands back something that did not exist a moment ago.
   */
  function applyMove(from: SlotRef, to: SlotRef) {
    try {
      if (from.kind === 'hero' && to.kind === 'hero') {
        if (from.rosterId === to.rosterId) return;
        // `to.index` only matters when the destination is full; moveEquipment ignores it otherwise,
        // so an empty box and a filled one on the same hero can share this one call.
        onRunChange(moveEquipment(run, from.rosterId, from.index, to.rosterId, heroes, to.index).run);
        playSfx('equip');
        setSeatingRosterId(to.rosterId);
      } else if (from.kind === 'hero' && to.kind === 'stash') {
        onRunChange(unequipToStash(run, from.rosterId, from.index));
        playSfx('ui.move');
      } else if (from.kind === 'stash' && to.kind === 'hero') {
        const entry = run.roster.find((r) => r.rosterId === to.rosterId);
        const hero = entry ? heroes[entry.heroId] : undefined;
        if (!entry || !hero) return;
        // A free slot takes it outright; a full hero gives up whatever box was tapped.
        const full = entry.equipment.length >= itemSlotsFor(hero, entry);
        onRunChange(equipFromStash(run, from.index, to.rosterId, equipment, heroes, full ? to.index : undefined));
        playSfx('equip');
        setSeatingRosterId(to.rosterId);
      } else if (from.kind === 'stash' && to.kind === 'stash') {
        // Bag-to-bag used to mean nothing; it now means MERGE (docs/equipment.md §5). Two enchanted
        // inputs are the one case that has to ask, so the choice is raised rather than resolved.
        if (!mergeableInBag(from.index, to.index)) return;
        const choices = mergeEnchantChoices(equipment[run.stash[from.index]], equipment[run.stash[to.index]]);
        if (choices.length > 1) {
          setPendingMerge({ a: from.index, b: to.index, choices });
          return;
        }
        onRunChange(mergeFromStash(run, from.index, to.index, equipment, choices[0]));
        playSfx('discovery');
      }
    } catch (err) {
      if (!(err instanceof RunProgressError)) throw err;
    }
  }

  /**
   * What tapping a hero means. With nothing in hand it opens the sheet; carrying an item it seats
   * it in the first free slot. Routing the tap through the whole card rather than the 48px box is
   * what makes the carry-and-place gesture usable on a phone.
   *
   * A FULL hero opens the swap window (2026-09-07, per user direction) rather than doing nothing:
   * only the player knows which item to give up, and that is a decision worth a screen. Tapping
   * one of the hero's boxes directly still swaps outright — that gesture already names the slot.
   */
  function handleHeroTap(entry: RosterEntry, hero: HeroDefinition) {
    if (!selected) {
      playSfx('ui.tap');
      setInspecting({ hero, entry });
      return;
    }
    if (entry.equipment.length < itemSlotsFor(hero, entry)) {
      applyMove(selected, { kind: 'hero', rosterId: entry.rosterId, index: entry.equipment.length });
      setSelected(null);
      return;
    }
    // A hero never holds two copies, and moving an item onto its own hero is not a swap.
    if (entry.equipment.includes(selectedItemId ?? '') || (selected.kind === 'hero' && selected.rosterId === entry.rosterId)) {
      setSelected(null);
      return;
    }
    playSfx('ui.select');
    setSwappingRosterId(entry.rosterId);
  }

  /**
   * Clears a bag item's unopened mark. Only the two gestures that LEAVE it in the bag need this
   * — picking it up and reading it out. Anything that moves it out drops the mark on its own,
   * since a mark cannot outlive the item it points at (`withStash`, runProgress.ts).
   */
  function seeStashItem(ref: SlotRef) {
    if (ref.kind !== 'stash') return;
    const itemId = run.stash[ref.index];
    if (itemId && run.unseenItemIds.includes(itemId)) onRunChange(markStashItemSeen(run, itemId));
  }

  function handleSlotClick(ref: SlotRef) {
    if (selected) {
      if (refKey(selected) !== refKey(ref)) applyMove(selected, ref);
      else playSfx('ui.back');
      setSelected(null);
      return;
    }
    if (!itemAt(ref)) return;
    playSfx('ui.select');
    seeStashItem(ref);
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
      sfx: 'none',
      onTap: () => handleSlotClick(ref),
      onLongPress: item
        ? () => {
            seeStashItem(ref);
            setViewedItemId(item.id);
          }
        : undefined,
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

  /**
   * The bag, declared here and rendered LAST (2026-09-07, per user direction): it sits under the
   * squad now rather than above it. The roster is what the screen is about; the bag is the tray
   * you draw from, and a tray belongs at the bottom of the reach.
   */
  const unopened = unseenCount(run.unseenItemIds, run.stash);
  const bagPanel = (
    <div className="stash-panel">
      <div className="stash-header">
        <span className="stash-label">🎒 Bag</span>
        {unopened > 0 && (
          <span className="stash-unseen" aria-label={`${unopened} unopened`}>
            {unopened} new
          </span>
        )}
        <span className="stash-count">{run.stash.length}</span>
        <span className="stash-gold">
          <ResourceGlyph kind="gold" /> {run.gold}
        </span>
      </div>
      <div className="stash-grid">
        {/* What it holds plus ONE empty landing box. The bag is uncapped, so the trailing box is
            the only thing saying "and there is room for more" — it is never a count of anything. */}
        {slotBoxes(run.stash, run.stash.length + 1).map((stashItemId, index) => {
          const item = stashItemId ? (equipment[stashItemId] ?? null) : null;
          const ref: SlotRef = { kind: 'stash', index };
          // An empty bag box takes anything a hero is holding. A filled one is a target for gear
          // coming off a hero, and for another bag item it MERGES with — the only meaning
          // bag-to-bag has (docs/equipment.md §5).
          const isDropTarget = !!selected && (selected.kind === 'hero' ? !item : mergeableInBag(selected.index, index));
          const props = slotProps(ref, item, isDropTarget);
          // The mark rides the box, not the slot: which ITEM is unopened is the question, and the
          // bag reshuffles indices every time something leaves it.
          const unseen = !!item && run.unseenItemIds.includes(item.id);
          return (
            <ItemBox key={index} item={item} {...props} className={`${props.className}${unseen ? ' is-new' : ''}`} />
          );
        })}
      </div>
      {pendingMerge && (
        <div className="stash-merge-choice">
          <span className="stash-hint-text">Both carry an enchantment. Keep which?</span>
          {pendingMerge.choices.map((choice) => (
            <button
              key={choice}
              className="stash-merge-button"
              onClick={() => {
                const { a, b } = pendingMerge;
                setPendingMerge(null);
                try {
                  onRunChange(mergeFromStash(run, a, b, equipment, choice));
                  playSfx('discovery');
                } catch (err) {
                  if (!(err instanceof RunProgressError)) throw err;
                }
              }}
            >
              {enchantLabel(choice)}
            </button>
          ))}
          <button className="stash-merge-button is-plain" onClick={() => setPendingMerge(null)}>
            Cancel
          </button>
        </div>
      )}
      {/* No hint row (2026-09-07, per user direction). "Tap an item, then tap where it goes" is a
          sentence a player reads once, and every state it described is already drawn: the held
          item glows, every slot that can take it outlines, and a mergeable match in the bag
          outlines with them. The room it held every visit now carries the Close button. */}
    </div>
  );


  /**
   * What the screen becomes while an item is in hand (2026-09-07, per user direction): the item
   * read out in full, and everything that is not about placing it recedes — the relic rails fade
   * under it, the bag's header dims, and a hero that cannot take it fades most of the way out.
   *
   * It is laid OVER the relic rails, in their exact footprint, rather than replacing them in the
   * flow: nothing on the screen may move when an item is picked up or when a different one is,
   * so the block that holds it has one height and the card fills it whatever the item carries.
   */
  const boards: TabSpec<BoardId>[] = [
    { id: 'gear', label: 'Gear', glyph: 'equipment', count: run.stash.length },
    { id: 'mastery', label: 'Mastery', glyph: 'mastery', count: run.masteryScrolls },
  ];

  const focusBar = selectedItem && (
    <div className="equip-focus-bar">
      <ItemReadout item={selectedItem} />
      <div className="equip-focus-actions">
        <span className="equip-focus-hint">Tap a hero, or a slot, to place it.</span>
        <button
          className="equip-focus-cancel"
          onClick={() => {
            playSfx('ui.back');
            setSelected(null);
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );

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
      <div className={`log-panel roster-panel${selected ? ' is-focused' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="log-panel-header">
          <span>Roster</span>
          <button className="log-close-button" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="screen-scroll">
          {board === 'mastery' ? (
            <MasteryBoard run={run} onRunChange={onRunChange} onInspect={(entry, hero) => setInspecting({ hero, entry })} />
          ) : (
          <div className="gear-board">
          <div className="roster-top-block">
            <RunRelicsPanel run={run} />
            {focusBar}
          </div>

          {/* Two across, three down: the roster reads as a squad at a glance rather than as a
              list to scroll, and each card gets a full card-width row underneath it for slots. */}
          <HeroSlotGrid>
            {run.roster.map((entry) => {
              const hero = heroes[entry.heroId];
              const capacity = itemSlotsFor(hero, entry);
              const takeable =
                !!selected &&
                !entry.equipment.includes(selectedItemId ?? '') &&
                (selected.kind === 'stash' || selected.rosterId !== entry.rosterId);
              return (
                <HeroSlotCard
                  key={entry.rosterId}
                  hero={hero}
                  entry={entry}
                  equipmentLookup={equipment}
                  // In focus mode a hero that cannot take the held item recedes entirely: the
                  // screen is down to "where does this go", and a card that is not an answer to
                  // that is noise.
                  className={[
                    takeable ? (entry.equipment.length < capacity ? 'can-take' : 'can-swap') : selected ? 'is-inert' : '',
                    seatingRosterId === entry.rosterId ? 'is-equipping' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onHeadTap={() => handleHeroTap(entry, hero)}
                  headLabel={selected ? `Give ${selectedItem?.name ?? 'item'} to ${hero.name}` : `View ${hero.name} details`}
                  slotProps={(index, item) => {
                    const ref: SlotRef = { kind: 'hero', rosterId: entry.rosterId, index };
                    return slotProps(ref, item, takeable && item?.id !== selectedItemId);
                  }}
                />
              );
            })}
          </HeroSlotGrid>

          {bagPanel}
          </div>
          )}
        </div>

        <TabStrip tabs={boards} active={board} onSelect={setBoard} className="is-boards" />

        {/* Outside the scroll, so it is pinned to the bottom of a full-height panel and always
            in thumb reach. The header ✕ stays — it is where every other overlay puts it — but
            on a 780px page it is the corner furthest from the hand doing the work. */}
        <button className="resolve-button roster-close-button" onClick={onClose}>
          Close
        </button>
      </div>

      {swapTarget && selected && selectedItem && (
        <EquipSwapScreen
          hero={heroes[swapTarget.heroId]}
          entry={swapTarget}
          held={swapTarget.equipment.flatMap((id) => (equipment[id] ? [equipment[id]] : []))}
          offered={selectedItem}
          onReplace={(index) => {
            setSwappingRosterId(null);
            applyMove(selected, { kind: 'hero', rosterId: swapTarget.rosterId, index });
            setSelected(null);
          }}
          onCancel={() => setSwappingRosterId(null)}
        />
      )}

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
