import { useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { heroes } from '../../data/heroes';
import { equipment } from '../../data/equipment';
import type { HeroDefinition, StatKey } from '../../engine/content';
import type { EquipmentDefinition } from '../../run/equipment';
import type { RosterEntry, RunState } from '../../run/state';
import { equipToRoster, RunProgressError } from '../../run/runProgress';
import { itemSlotsFor } from '../../run/progression';
import { NodeHeader, NodeSky } from '../shared/NodeStage';
import { StatGlyph, STAT_LABELS } from '../shared/StatBars';
import { EquipmentEffectList, EquipmentIcon, ItemSummaryPopup, fmtGrant, RARITY_COLOR_VARS, RARITY_LABELS, RARITY_RGB_VARS } from '../shared/EquipmentBox';
import { EquipCompareRow } from './EquipCompareRow';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { RosterPeek } from './RosterPeek';

interface Props {
  run: RunState;
  /** Item ids awaiting a decision, in order. Seeded by App.tsx with what was just granted; bumped items get appended. */
  queue: string[];
  onRunChange: (next: RunState) => void;
  onDone: () => void;
}

interface QueueEntry {
  itemId: string;
  /** Displaced from a hero by a prior choice on this screen — changes the headline copy. */
  bumped: boolean;
}

/** Seating animation length (styles.css equip-seat-*); the equip is applied after it, as LevelUpScreen defers on LEVEL_UP_ANIM_MS. */
const EQUIP_ANIM_MS = 420;

/**
 * Forced resolution gate: every obtained item is equipped or trashed before the run advances (no
 * stash). Equipping over an occupied slot bumps the old item back onto this queue.
 */
export function ForceEquipScreen({ run, queue: initialQueue, onRunChange, onDone }: Props) {
  const [queue, setQueue] = useState<QueueEntry[]>(() => initialQueue.map((itemId) => ({ itemId, bumped: false })));
  const [confirmTrash, setConfirmTrash] = useState(false);
  const [previewEntry, setPreviewEntry] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);
  /** Roster id whose card is mid seating animation; every other card is inert until it finishes. */
  const [seatingRosterId, setSeatingRosterId] = useState<string | null>(null);
  /** A held item's readout, opened by holding one of a row's item boxes. */
  const [summaryItem, setSummaryItem] = useState<EquipmentDefinition | null>(null);

  const current = queue[0];
  const itemLookup = current ? equipment[current.itemId] : undefined;

  if (!current || !itemLookup) {
    onDone();
    return null;
  }
  // Re-bound so the closures below see a narrowed EquipmentDefinition.
  const item = itemLookup;

  function advance(nextQueue: QueueEntry[]) {
    setQueue(nextQueue);
    setConfirmTrash(false);
    if (nextQueue.length === 0) onDone();
  }

  // The sound is the press's own feedback, so it fires now rather than after the seat.
  function handleEquip(rosterId: string, replaceIndex?: number) {
    if (seatingRosterId) return;
    playSfx('equip');
    setSeatingRosterId(rosterId);
    window.setTimeout(() => {
      setSeatingRosterId(null);
      applyEquip(rosterId, replaceIndex);
    }, EQUIP_ANIM_MS);
  }

  function applyEquip(rosterId: string, replaceIndex?: number) {
    try {
      const { run: nextRun, bumpedItemId } = equipToRoster(run, rosterId, item.id, equipment, heroes, replaceIndex);
      onRunChange(nextRun);
      const rest = queue.slice(1);
      advance(bumpedItemId ? [...rest, { itemId: bumpedItemId, bumped: true }] : rest);
    } catch (err) {
      if (!(err instanceof RunProgressError)) throw err;
    }
  }

  function handleTrash() {
    advance(queue.slice(1));
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
        eyebrow={current.bumped ? 'Needs a New Home' : 'New Item'}
        glyph={<EquipmentIcon item={item} className="equip-spotlight-icon" />}
        title={item.name}
        readout={`${RARITY_LABELS[item.rarity]}${
          current.bumped ? ' — unequipped; give it to another hero, or trash it' : ' — tap a hero to hand it over'
        }`}
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
              locked={!!seatingRosterId && seatingRosterId !== entry.rosterId}
              alreadyHeld={entry.equipment.includes(item.id)}
              onEquip={(replaceIndex) => handleEquip(entry.rosterId, replaceIndex)}
              onPreview={() => setPreviewEntry({ hero, entry })}
              onInspectItem={setSummaryItem}
            />
          );
        })}
      </div>

      {/* Inert while seating: the deferred equip holds a snapshot of this queue, and trashing its
          head mid-animation would resolve the same item twice. */}
      <button className="secondary-button trash-button" disabled={!!seatingRosterId} onClick={() => setConfirmTrash(true)}>
        🗑️ Trash {item.name}
      </button>

      {confirmTrash && (
        <div className="log-overlay" onClick={() => setConfirmTrash(false)}>
          <div className="log-panel" onClick={(e) => e.stopPropagation()}>
            <div className="log-panel-header">
              <span>Confirm Trash</span>
            </div>
            <p className="hint">{`Trash ${item.name}? This cannot be undone — it's gone for good.`}</p>
            <div className="reward-panel-actions">
              <button className="secondary-button" onClick={() => setConfirmTrash(false)}>
                Cancel
              </button>
              <button className="resolve-button" onClick={handleTrash}>
                Trash It
              </button>
            </div>
          </div>
        </div>
      )}

      <ItemSummaryPopup item={summaryItem} onClose={() => setSummaryItem(null)} />

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
