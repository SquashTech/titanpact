import { useLayoutEffect, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { heroes } from '../../data/heroes';
import { equipment } from '../../data/equipment';
import type { HeroDefinition, StatKey } from '../../engine/content';
import type { EquipmentDefinition } from '../../run/equipment';
import { STASH_CAPACITY, stashIsFull } from '../../run/equipment';
import type { RosterEntry, RunState } from '../../run/state';
import { equipToRoster, grantCurrencyReward, stashItem, RunProgressError } from '../../run/runProgress';
import { sellValueFor } from '../../run/shop';
import { itemSlotsFor } from '../../run/progression';
import { NodeHeader, NodeSky } from '../shared/NodeStage';
import { StatGlyph, STAT_LABELS } from '../shared/StatBars';
import { EquipmentEffectList, EquipmentIcon, ItemSummaryPopup, fmtGrant, RARITY_COLOR_VARS, RARITY_LABELS, RARITY_RGB_VARS } from '../shared/EquipmentBox';
import { HeroSlotCard, HeroSlotGrid } from '../shared/HeroSlotCard';
import { EquipSwapScreen } from './EquipSwapScreen';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { RosterManagementScreen } from './RosterManagementScreen';
import { RosterPeek } from './RosterPeek';

interface Props {
  run: RunState;
  /** Item ids awaiting a decision, in order. The Loot Pile hands over three at once. */
  queue: string[];
  onRunChange: (next: RunState) => void;
  onDone: () => void;
}

/** Seating animation length (styles.css equip-seat-*); the equip is applied after it, as LevelUpScreen defers on LEVEL_UP_ANIM_MS. */
const EQUIP_ANIM_MS = 420;

/** Whether anybody on the roster has somewhere to put an item without giving one up. */
export function rosterHasFreeSlot(run: RunState): boolean {
  return run.roster.some((entry) => {
    const hero = heroes[entry.heroId];
    return !!hero && entry.equipment.length < itemSlotsFor(hero, entry);
  });
}

/**
 * What a found item opens: seat it now, or drop it in the bag and decide when the matchup is
 * known. The screen appears only when somebody has a free slot (2026-09-07, per user direction) —
 * with the whole roster full its one honest answer was "keep it in the bag", so the item goes
 * there and the decision waits for Manage Roster. The exception is a bag with no room, which has
 * to be equipped past, sold past, or made room in before the run moves on.
 */
export function ItemFoundScreen({ run, queue: initialQueue, onRunChange, onDone }: Props) {
  const [queue, setQueue] = useState<string[]>(initialQueue);
  const [previewEntry, setPreviewEntry] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);
  /** Roster id whose card is mid seating animation; every other card is inert until it finishes. */
  const [seatingRosterId, setSeatingRosterId] = useState<string | null>(null);
  /** A held item's readout, opened by holding one of a hero's item boxes. */
  const [summaryItem, setSummaryItem] = useState<EquipmentDefinition | null>(null);
  /** The bag, opened over this screen so a full one can be emptied without leaving the item behind. */
  const [managing, setManaging] = useState(false);
  /** A full hero the player tapped — the swap window owns the "which one goes" decision. */
  const [swappingRosterId, setSwappingRosterId] = useState<string | null>(null);

  const itemId = queue[0];
  const itemLookup = itemId ? equipment[itemId] : undefined;
  const bagFull = stashIsFull(run.stash);
  // Nobody can take it and the bag can: it banks silently rather than spending a screen on it.
  const skip = !!itemLookup && !bagFull && !rosterHasFreeSlot(run);

  // Layout, not effect: the skip commits before paint, so a banked item never flashes a screen.
  useLayoutEffect(() => {
    if (!itemLookup) {
      onDone();
      return;
    }
    if (!skip) return;
    try {
      advance(stashItem(run, itemLookup.id, equipment));
    } catch (err) {
      if (!(err instanceof RunProgressError)) throw err;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, skip]);

  if (!itemId || !itemLookup || skip) return null;
  // Re-bound so the closures below see a narrowed EquipmentDefinition.
  const item = itemLookup;

  function advance(next: RunState) {
    onRunChange(next);
    const rest = queue.slice(1);
    setQueue(rest);
    if (rest.length === 0) onDone();
  }

  /** Every action here is legal-or-inert: the button that would throw is disabled, so a refusal is a no-op. */
  function attempt(change: () => RunState) {
    try {
      advance(change());
    } catch (err) {
      if (!(err instanceof RunProgressError)) throw err;
    }
  }

  // The sound is the press's own feedback, so it fires now rather than after the seat.
  function handleEquip(rosterId: string, replaceIndex?: number) {
    if (seatingRosterId) return;
    setSwappingRosterId(null);
    playSfx('equip');
    setSeatingRosterId(rosterId);
    window.setTimeout(() => {
      setSeatingRosterId(null);
      attempt(() => equipToRoster(run, rosterId, item.id, equipment, heroes, replaceIndex));
    }, EQUIP_ANIM_MS);
  }

  const grants = (Object.entries(item.statGrants) as [StatKey, number][]).filter(([, amount]) => amount);
  const swapping = swappingRosterId ? run.roster.find((e) => e.rosterId === swappingRosterId) : undefined;

  return (
    <div
      className="node-screen force-equip-screen"
      style={{ '--rarity-color': RARITY_COLOR_VARS[item.rarity], '--node-rgb': RARITY_RGB_VARS[item.rarity] } as CSSProperties}
    >
      <NodeSky />

      <RosterPeek run={run} />

      {/* The absolute reading of the item; the squad below answers who can take it. */}
      <NodeHeader
        compact
        eyebrow="New Item"
        glyph={<EquipmentIcon item={item} className="equip-spotlight-icon" />}
        title={item.name}
        readout={`${RARITY_LABELS[item.rarity]} — ${bagFull ? 'your bag is full; equip it, sell it, or make room' : 'tap a hero, or keep it in your bag'}`}
      >
        {/* Capped and internally scrolling so the squad below sits at the same height for every item. */}
        <div className="node-item-effects">
          {grants.length > 0 && (
            <div className="detail-modifier-list">
              {grants.map(([stat, amount]) => (
                <span key={stat} className={`detail-modifier-chip ${amount > 0 ? 'stat-buff' : 'stat-debuff'}`}>
                  <StatGlyph stat={stat} tone="inherit" /> {STAT_LABELS[stat]} {fmtGrant(amount)}
                </span>
              ))}
            </div>
          )}
          <EquipmentEffectList item={item} />
        </div>
      </NodeHeader>

      {/* The same 2x3 squad Manage Roster shows (2026-09-07, per user direction), so "where does
          gear live" is one picture the player already knows how to read. */}
      <div className="screen-scroll equip-squad-scroll">
        <HeroSlotGrid>
          {run.roster.map((entry) => {
            const hero = heroes[entry.heroId];
            const held = entry.equipment.flatMap((id) => (equipment[id] ? [equipment[id]] : []));
            const free = itemSlotsFor(hero, entry) - held.length;
            const alreadyHeld = entry.equipment.includes(item.id);
            // A swap has to put the displaced item somewhere, so a full bag locks every full hero.
            const locked =
              alreadyHeld || (!!seatingRosterId && seatingRosterId !== entry.rosterId) || (bagFull && free <= 0);
            return (
              <HeroSlotCard
                key={entry.rosterId}
                hero={hero}
                entry={entry}
                equipmentLookup={equipment}
                className={[
                  free > 0 && !locked ? 'can-take' : '',
                  locked ? 'is-locked' : '',
                  seatingRosterId === entry.rosterId ? 'is-equipping' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                headLabel={
                  alreadyHeld
                    ? `${hero.name} already holds ${item.name}`
                    : free > 0
                      ? `Give ${item.name} to ${hero.name}`
                      : `${hero.name} is full — choose what ${item.name} replaces`
                }
                onHeadTap={
                  locked
                    ? undefined
                    : free > 0
                      ? () => handleEquip(entry.rosterId)
                      : () => setSwappingRosterId(entry.rosterId)
                }
                // Tap is spent on the equip here, so the hero sheet is the hold.
                onHeadLongPress={() => setPreviewEntry({ hero, entry })}
                badge={
                  <span className="equip-card-verdict">
                    {alreadyHeld ? 'Held' : free > 0 ? `${free} free` : bagFull ? 'Full' : 'Swap'}
                  </span>
                }
                slotProps={(_, boxItem) => ({
                  sfx: 'none',
                  onTap: boxItem
                    ? () => setSummaryItem(boxItem)
                    : locked
                      ? undefined
                      : () => handleEquip(entry.rosterId),
                })}
              />
            );
          })}
        </HeroSlotGrid>
      </div>

      {/* Inert while seating: the deferred equip holds a snapshot of this queue, and resolving
          its head mid-animation would resolve the same item twice. */}
      <div className="item-found-actions">
        {bagFull ? (
          <>
            <button className="secondary-button" disabled={!!seatingRosterId} onClick={() => setManaging(true)}>
              🎒 Bag Full — Make Room
            </button>
            <button
              className="secondary-button"
              disabled={!!seatingRosterId}
              onClick={() => attempt(() => grantCurrencyReward(run, sellValueFor(item)))}
            >
              Sell for {sellValueFor(item)}g
            </button>
          </>
        ) : (
          <button className="resolve-button" disabled={!!seatingRosterId} onClick={() => attempt(() => stashItem(run, item.id, equipment))}>
            🎒 Keep in Bag ({run.stash.length}/{STASH_CAPACITY})
          </button>
        )}
      </div>

      {swapping && (
        <EquipSwapScreen
          hero={heroes[swapping.heroId]}
          entry={swapping}
          held={swapping.equipment.flatMap((id) => (equipment[id] ? [equipment[id]] : []))}
          offered={item}
          onReplace={(index) => handleEquip(swapping.rosterId, index)}
          onCancel={() => setSwappingRosterId(null)}
        />
      )}

      <ItemSummaryPopup item={summaryItem} onClose={() => setSummaryItem(null)} />

      {managing && <RosterManagementScreen run={run} onRunChange={onRunChange} onClose={() => setManaging(false)} />}

      {previewEntry && (
        <HeroPreviewOverlay
          hero={previewEntry.hero}
          entry={previewEntry.entry}
          equipmentLookup={equipment}
          relicIds={run.relics}
          onClose={() => setPreviewEntry(null)}
        />
      )}
    </div>
  );
}
