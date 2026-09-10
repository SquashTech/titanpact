import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { heroes } from '../../data/heroes';
import { equipment } from '../../data/equipment';
import type { HeroDefinition } from '../../engine/content';
import type { RunState, RosterEntry } from '../../run/state';
import type { EquipmentDefinition } from '../../run/equipment';
import type { EnchantmentId } from '../../run/equipment';
import {
  actAllowsRarity,
  canMergeItems,
  enchantLabel,
  mergeEnchantChoices,
  mergeablePairIndices,
  mergeResultId,
  nextRarity,
  unseenCount,
} from '../../run/equipment';
import { equipFromStash, markStashItemSeen, mergeFromStash, moveEquipment, unequipToStash, RunProgressError } from '../../run/runProgress';
import { itemSlotsFor } from '../../run/progression';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { ItemBox, ItemEffectChips, ItemPiece, ItemSummaryPopup, RARITY_COLOR_VARS, slotBoxes } from '../shared/EquipmentBox';
import { HeroSlotCard, HeroSlotGrid } from '../shared/HeroSlotCard';
import { EquipSwapScreen } from './EquipSwapScreen';
import { MergeBurst } from './MergeBurst';
import { HubGlyph } from '../shared/nodeIcons';
import { ResourceGlyph } from '../shared/RunGlyph';
import { useGearDrag } from '../shared/useGearDrag';
import { playSfx } from '../../audio/sfx';

/** Seating jolt length (styles.css `equip-seat-jolt`). Cosmetic only — the equip has already landed. */
const EQUIP_SEAT_MS = 420;

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  onClose: () => void;
}

/** Either end of a move: a hero's slot, or one of the bag's. */
type SlotRef = { kind: 'hero'; rosterId: string; index: number } | { kind: 'stash'; index: number };

/** A hero-side ref with no slot named — "wherever it fits on this hero". What a whole card is as a target. */
const AUTO_SLOT = -1;

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
 * and a destination, so one tap-then-tap (or one CARRY) covers equipping, unequipping, handing an
 * item to another hero, and swapping two. Slots are uncategorised, so anything goes anywhere: an
 * empty slot just takes the item, a filled one trades.
 *
 * The carry is pointer-driven (useGearDrag), not HTML5 drag-and-drop (2026-09-10, per user
 * direction). The old plumbing worked only under a mouse — `dragstart` does not exist on touch —
 * so on the device this game is actually played on, gear could only ever be tapped from box to
 * box. Now the piece leaves its socket and follows the finger, and every socket that would take
 * it lights up under it.
 *
 * Nothing here SPENDS anything (2026-09-07, per user direction). Selling used to live on the bag
 * and no longer does: this is the screen the player opens between every node, and the one
 * irreversible verb on it was one mis-tap from the gesture everything else uses.
 */
export function RosterManagementScreen({ run, onRunChange, onClose }: Props) {
  const [selected, setSelected] = useState<SlotRef | null>(null);
  const [inspecting, setInspecting] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);
  const [viewedItemId, setViewedItemId] = useState<string | null>(null);
  /** Raised only when BOTH halves of a merge carry an enchant and one has to be dropped. */
  const [pendingMerge, setPendingMerge] = useState<{ a: number; b: number; choices: EnchantmentId[] } | null>(null);
  /** What a merge just produced. Purely a payoff beat — nothing waits on it. */
  const [mergedItem, setMergedItem] = useState<EquipmentDefinition | null>(null);
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
  const mergeableInBag = useCallback(
    (a: number, b: number): boolean => {
      if (a === b) return false;
      const left = equipment[run.stash[a] ?? ''];
      const right = equipment[run.stash[b] ?? ''];
      if (!left || !right || !canMergeItems(left, right)) return false;
      return actAllowsRarity(run.actNumber, nextRarity(left.rarity)!);
    },
    [run.stash, run.actNumber]
  );

  /**
   * Which bag slots have a partner sitting in the bag with them (2026-09-10, per user direction).
   * Merging used to announce itself only once an item was already in hand, which meant the player
   * had to pick things up to find out whether there was anything to find — so a bag holding a free
   * Epic looked exactly like a bag that did not. Now the pair marks itself at rest, and the map's
   * own footer button says so before the screen is even opened (`mergeablePairIndices`).
   */
  const mergePairs = useMemo(
    () => mergeablePairIndices(run.stash, equipment, run.actNumber),
    [run.stash, run.actNumber]
  );

  const selectedItemId = selected ? itemAt(selected) : null;
  const selectedItem = selectedItemId ? (equipment[selectedItemId] ?? null) : null;
  const swapTarget = swappingRosterId ? run.roster.find((r) => r.rosterId === swappingRosterId) : undefined;

  /**
   * The four directions a move can run, and whether each is legal. Split out from `applyMove`
   * because a carry has to know the answer BEFORE it lands — a socket that will refuse the piece
   * must not light up under the finger.
   */
  const canMove = useCallback(
    (from: SlotRef, to: SlotRef): boolean => {
      const itemId = from.kind === 'stash' ? run.stash[from.index] : run.roster.find((r) => r.rosterId === from.rosterId)?.equipment[from.index];
      if (!itemId) return false;
      if (to.kind === 'stash') return from.kind === 'hero' || mergeableInBag(from.index, to.index);
      const entry = run.roster.find((r) => r.rosterId === to.rosterId);
      if (!entry || !heroes[entry.heroId]) return false;
      if (from.kind === 'hero' && from.rosterId === to.rosterId) return false;
      // A hero never holds two copies. The box the item is already IN is not a destination either.
      return !entry.equipment.includes(itemId);
    },
    [run.stash, run.roster, mergeableInBag]
  );

  const canDropKey = useCallback(
    (fromKey: string, toKey: string) => {
      const from = parseRefKey(fromKey);
      const to = parseRefKey(toKey);
      return !!from && !!to && refKey(from) !== toKey && canMove(from, to);
    },
    [canMove]
  );

  /**
   * Runs a move. Returns false when the move handed off to a screen instead of landing — a full
   * hero raises the swap window, and the carried item has to stay in hand behind it.
   *
   * A refusal is a no-op: the UI marks illegal targets rather than reporting them. Each direction
   * that lands carries its own cue — gear going ONTO a hero is the `equip` buckle, coming off is a
   * lighter shuffle, and a merge borrows the discovery sting because it hands back something that
   * did not exist a moment ago.
   */
  function applyMove(from: SlotRef, to: SlotRef): boolean {
    try {
      if (to.kind === 'hero') {
        const entry = run.roster.find((r) => r.rosterId === to.rosterId);
        const hero = entry ? heroes[entry.heroId] : undefined;
        if (!entry || !hero) return true;
        const full = entry.equipment.length >= itemSlotsFor(hero, entry);
        // Dropped on the card rather than on a box: seat it where it fits, or ask which one goes.
        let index = to.index;
        if (index === AUTO_SLOT) {
          if (!full) index = entry.equipment.length;
          else {
            playSfx('ui.select');
            setSwappingRosterId(entry.rosterId);
            return false;
          }
        }
        if (from.kind === 'hero') {
          if (from.rosterId === to.rosterId) return true;
          // `index` only matters when the destination is full; moveEquipment ignores it otherwise,
          // so an empty box and a filled one on the same hero can share this one call.
          onRunChange(moveEquipment(run, from.rosterId, from.index, to.rosterId, heroes, index).run);
        } else {
          // A free slot takes it outright; a full hero gives up whatever box was tapped.
          onRunChange(equipFromStash(run, from.index, to.rosterId, equipment, heroes, full ? index : undefined));
        }
        playSfx('equip');
        setSeatingRosterId(to.rosterId);
      } else if (from.kind === 'hero') {
        onRunChange(unequipToStash(run, from.rosterId, from.index));
        playSfx('ui.move');
      } else {
        // Bag-to-bag used to mean nothing; it now means MERGE (docs/equipment.md §5). Two enchanted
        // inputs are the one case that has to ask, so the choice is raised rather than resolved.
        if (!mergeableInBag(from.index, to.index)) return true;
        const choices = mergeEnchantChoices(equipment[run.stash[from.index]], equipment[run.stash[to.index]]);
        if (choices.length > 1) {
          setPendingMerge({ a: from.index, b: to.index, choices });
          return true;
        }
        commitMerge(from.index, to.index, choices[0]);
      }
    } catch (err) {
      if (!(err instanceof RunProgressError)) throw err;
    }
    return true;
  }

  /** The one place a merge lands, so the payoff beat cannot be skipped by whichever route reached it. */
  function commitMerge(a: number, b: number, keepEnchantId?: EnchantmentId) {
    const input = equipment[run.stash[a]];
    try {
      onRunChange(mergeFromStash(run, a, b, equipment, keepEnchantId));
    } catch (err) {
      if (!(err instanceof RunProgressError)) throw err;
      return;
    }
    playSfx('discovery');
    const resultId = input ? mergeResultId(input, keepEnchantId) : null;
    if (resultId && equipment[resultId]) setMergedItem(equipment[resultId]);
  }

  /**
   * What tapping a hero means. With nothing in hand it opens the sheet; carrying an item it seats
   * it in the first free slot. Routing the tap through the whole card rather than the 46px box is
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
    const to: SlotRef = { kind: 'hero', rosterId: entry.rosterId, index: AUTO_SLOT };
    if (!canMove(selected, to)) {
      setSelected(null);
      return;
    }
    if (applyMove(selected, to)) setSelected(null);
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
      if (refKey(selected) === refKey(ref)) playSfx('ui.back');
      else if (!applyMove(selected, ref)) return;
      setSelected(null);
      return;
    }
    if (!itemAt(ref)) return;
    playSfx('ui.select');
    seeStashItem(ref);
    setSelected(ref);
  }

  // --- The carry ---------------------------------------------------------

  const onDropKey = useCallback(
    (fromKey: string, toKey: string) => {
      const from = parseRefKey(fromKey);
      const to = parseRefKey(toKey);
      if (!from || !to) return;
      if (applyMove(from, to)) setSelected(null);
    },
    // applyMove closes over `run`, which changes every move; a stale one would re-apply the
    // pre-move state. Re-made per render on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run]
  );

  const onLift = useCallback((fromKey: string) => {
    const from = parseRefKey(fromKey);
    if (!from) return;
    playSfx('ui.select');
    seeStashItem(from);
    setSelected(from);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);

  const renderCarried = useCallback(
    (fromKey: string) => {
      const from = parseRefKey(fromKey);
      const itemId = from ? itemAt(from) : null;
      return <ItemPiece item={itemId ? equipment[itemId] ?? null : null} />;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run]
  );

  const gearDrag = useGearDrag({ render: renderCarried, canDrop: canDropKey, onDrop: onDropKey, onLift });
  const carrying = !!gearDrag.drag;

  /** Shared by every box on the screen — a hero's slots and the bag's are the same affordance. */
  function slotProps(ref: SlotRef, item: EquipmentDefinition | null, isDropTarget: boolean) {
    const key = refKey(ref);
    const isSelectedSource = !!selected && refKey(selected) === key;
    return {
      className: [isSelectedSource ? 'selected' : '', isDropTarget ? 'drop-target' : '', gearDrag.slotClass(key).trim()]
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
      slotKey: key,
      ...gearDrag.handleProps(key, !!item),
    };
  }

  /**
   * The bag, rendered LAST (2026-09-07, per user direction): it sits under the squad rather than
   * above it. The roster is what the screen is about; the bag is the tray you draw from, and a
   * tray belongs at the bottom of the reach.
   */
  const unopened = unseenCount(run.unseenItemIds, run.stash);
  const bagPanel = (
    <div className={`stash-panel${mergePairs.size > 0 ? ' has-merge' : ''}`}>
      <div className="stash-header">
        <span className="stash-label">
          <HubGlyph name="bag" className="stash-label-glyph" />
          Bag
        </span>
        {unopened > 0 && (
          <span className="stash-unseen" aria-label={`${unopened} unopened`}>
            {unopened} new
          </span>
        )}
        {/* What the bag can DO, beside what it holds — the one thing on this screen that is free. */}
        {mergePairs.size > 0 && (
          <span className="stash-merge-flag" aria-label={`${mergePairs.size / 2} merge${mergePairs.size > 2 ? 's' : ''} available`}>
            <MergeMark />
            {mergePairs.size / 2}
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
          const merges = !!selected && selected.kind === 'stash' && mergeableInBag(selected.index, index);
          const isDropTarget = !!selected && (selected.kind === 'hero' ? !item : merges);
          const props = slotProps(ref, item, isDropTarget);
          // The mark rides the box, not the slot: which ITEM is unopened is the question, and the
          // bag reshuffles indices every time something leaves it.
          const unseen = !!item && run.unseenItemIds.includes(item.id);
          // A pair that is waiting, and a pair the carried piece would complete, are two states of
          // one fact — so the second is the first turned up rather than a different mark.
          const pairable = !selected && mergePairs.has(index);
          const upTier = item ? nextRarity(item.rarity) : null;
          return (
            <ItemBox
              key={index}
              item={item}
              {...props}
              className={`${props.className}${unseen ? ' is-new' : ''}${pairable ? ' can-merge' : ''}${merges ? ' merge-target' : ''}`}
              // The socket wears the tier the merge would REACH, not the tier it holds — the ring
              // and the badge are both offering the same thing, so they are cut in the same colour.
              style={upTier ? ({ '--merge-color': `var(--tier-${upTier})` } as CSSProperties) : undefined}
            >
              {(pairable || merges) && (
                <span className="item-box-merge" aria-hidden="true">
                  <MergeMark />
                </span>
              )}
            </ItemBox>
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
                commitMerge(a, b, choice);
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
        // Dead ground while an item is in hand PUTS IT DOWN rather than closing the sheet: the
        // gesture the whole screen is built on is tap-then-tap, and its miss must not be "you have
        // left the screen".
        if (selected) {
          playSfx('ui.back');
          setSelected(null);
          return;
        }
        onClose();
      }}
    >
      <div className={`log-panel roster-panel${selected ? ' is-focused' : ''}${carrying ? ' is-carrying' : ''}`} onClick={(e) => e.stopPropagation()}>
        {/* The header is where the carried item reads out (2026-09-10, per user direction). It used
            to be a card laid over the Banner rails; with the Banners gone to the map there is no
            block to lay it over, and reserving one would spend the room the Banners just freed on
            an empty rectangle. Nothing moves when a piece is lifted — the title is simply replaced
            by what is in hand, at the same height, which is also where the eye already is. */}
        <div className="log-panel-header roster-panel-header">
          {selectedItem ? (
            <span className="roster-held" style={{ '--rarity-color': RARITY_COLOR_VARS[selectedItem.rarity] } as CSSProperties}>
              <span className="roster-held-piece">
                <ItemPiece item={selectedItem} />
              </span>
              <span className="roster-held-name">{selectedItem.name}</span>
              <span className="roster-held-chips">
                <ItemEffectChips item={selectedItem} />
              </span>
            </span>
          ) : (
            <span>Roster</span>
          )}
          <button
            className="log-close-button"
            onClick={() => {
              if (selected) {
                playSfx('ui.back');
                setSelected(null);
              } else onClose();
            }}
            aria-label={selected ? 'Put it back' : 'Close'}
          >
            ✕
          </button>
        </div>
        <div className="screen-scroll">
          <div className="gear-board">
            {/* Two across, three down: the roster reads as a squad at a glance rather than as a
                list to scroll, and each card gets a full card-width row underneath it for slots. */}
            <HeroSlotGrid>
              {run.roster.map((entry) => {
                const hero = heroes[entry.heroId];
                const capacity = itemSlotsFor(hero, entry);
                const cardRef: SlotRef = { kind: 'hero', rosterId: entry.rosterId, index: AUTO_SLOT };
                const takeable = !!selected && canMove(selected, cardRef);
                const cardKey = refKey(cardRef);
                return (
                  <HeroSlotCard
                    key={entry.rosterId}
                    hero={hero}
                    entry={entry}
                    equipmentLookup={equipment}
                    // The whole card is a landing pad for a carried piece, not only its sockets —
                    // a 46px box under a moving thumb is a smaller target than the thing it sits on.
                    dropKey={takeable ? cardKey : undefined}
                    // In focus mode a hero that cannot take the held item recedes entirely: the
                    // screen is down to "where does this go", and a card that is not an answer to
                    // that is noise.
                    className={[
                      takeable ? (entry.equipment.length < capacity ? 'can-take' : 'can-swap') : selected ? 'is-inert' : '',
                      seatingRosterId === entry.rosterId ? 'is-equipping' : '',
                      gearDrag.drag?.overKey === cardKey && takeable ? 'is-over' : '',
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
        </div>

        {/* Outside the scroll, so it is pinned to the bottom of a full-height panel and always
            in thumb reach. The header ✕ stays — it is where every other overlay puts it — but
            on a 780px page it is the corner furthest from the hand doing the work. */}
        <button className="resolve-button roster-close-button" onClick={onClose}>
          Close
        </button>
      </div>

      {gearDrag.overlay}

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

      {mergedItem && <MergeBurst result={mergedItem} onDone={() => setMergedItem(null)} />}

      <ItemSummaryPopup item={viewedItemId ? (equipment[viewedItemId] ?? null) : null} onClose={() => setViewedItemId(null)} />
    </div>
  );
}

/**
 * Two halves closing on the spark between them. The whole vocabulary of merging on this screen is
 * this one mark — the bag's flag, the per-socket pair badge, and the target ring all wear it.
 *
 * Two solid heads pointing IN at a spark, drawn at 9px and nothing finer than 3 units — chevrons
 * were tried and at this size a pair of them is an ✗, which is the one thing this mark must never
 * say on a screen whose other corner badge means "unopened".
 */
function MergeMark() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="merge-mark" aria-hidden="true" focusable="false">
      <path d="M0 3.5 8 12l-8 8.5Z" />
      <path d="M24 3.5 16 12l8 8.5Z" />
      <circle cx="12" cy="12" r="3.4" />
    </svg>
  );
}
