import { useState, type CSSProperties } from 'react';
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
import { EquipCompareRow } from './EquipCompareRow';
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

/**
 * What a found item opens: seat it now, or drop it in the bag and decide when the matchup is
 * known. Nothing here is forced — the one exception is a bag already at STASH_CAPACITY, which
 * has to be equipped past, sold past, or made room in before the run moves on.
 */
export function ItemFoundScreen({ run, queue: initialQueue, onRunChange, onDone }: Props) {
  const [queue, setQueue] = useState<string[]>(initialQueue);
  const [previewEntry, setPreviewEntry] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);
  /** Roster id whose card is mid seating animation; every other card is inert until it finishes. */
  const [seatingRosterId, setSeatingRosterId] = useState<string | null>(null);
  /** A held item's readout, opened by holding one of a row's item boxes. */
  const [summaryItem, setSummaryItem] = useState<EquipmentDefinition | null>(null);
  /** The bag, opened over this screen so a full one can be emptied without leaving the item behind. */
  const [managing, setManaging] = useState(false);

  const itemId = queue[0];
  const itemLookup = itemId ? equipment[itemId] : undefined;

  if (!itemId || !itemLookup) {
    onDone();
    return null;
  }
  // Re-bound so the closures below see a narrowed EquipmentDefinition.
  const item = itemLookup;
  const bagFull = stashIsFull(run.stash);

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
    playSfx('equip');
    setSeatingRosterId(rosterId);
    window.setTimeout(() => {
      setSeatingRosterId(null);
      attempt(() => equipToRoster(run, rosterId, item.id, equipment, heroes, replaceIndex));
    }, EQUIP_ANIM_MS);
  }

  const grants = (Object.entries(item.statGrants) as [StatKey, number][]).filter(([, amount]) => amount);

  return (
    <div
      className="node-screen force-equip-screen"
      style={{ '--rarity-color': RARITY_COLOR_VARS[item.rarity], '--node-rgb': RARITY_RGB_VARS[item.rarity] } as CSSProperties}
    >
      <NodeSky />

      <RosterPeek run={run} />

      {/* The absolute reading of the item; the table below is the relative one. */}
      <NodeHeader
        compact
        eyebrow="New Item"
        glyph={<EquipmentIcon item={item} className="equip-spotlight-icon" />}
        title={item.name}
        readout={`${RARITY_LABELS[item.rarity]} — ${bagFull ? 'your bag is full; equip it, sell it, or make room' : 'tap a hero, or keep it in your bag'}`}
      >
        {/* Capped and internally scrolling so the table below sits at the same height for every item. */}
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

      {/* Same >4 threshold as HeroPickGrid: dense rows for a full roster, doubled portraits for four or fewer. */}
      <div className={`equip-compare-table screen-scroll${run.roster.length > 4 ? '' : ' is-roomy'}`}>
        {run.roster.map((entry) => {
          const hero = heroes[entry.heroId];
          const held = entry.equipment.flatMap((id) => (equipment[id] ? [equipment[id]] : []));
          return (
            <EquipCompareRow
              key={entry.rosterId}
              hero={hero}
              entry={entry}
              held={held}
              capacity={itemSlotsFor(hero, entry)}
              offered={item}
              isEquipping={seatingRosterId === entry.rosterId}
              // A swap has to put the displaced item somewhere, so a full bag locks every row
              // that has no free slot to seat into.
              locked={(!!seatingRosterId && seatingRosterId !== entry.rosterId) || (bagFull && held.length >= itemSlotsFor(hero, entry))}
              alreadyHeld={entry.equipment.includes(item.id)}
              onEquip={(replaceIndex) => handleEquip(entry.rosterId, replaceIndex)}
              onPreview={() => setPreviewEntry({ hero, entry })}
              onInspectItem={setSummaryItem}
            />
          );
        })}
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
