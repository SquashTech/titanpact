import { useState, type CSSProperties } from 'react';
import { heroes } from '../../data/heroes';
import { equipment } from '../../data/equipment';
import type { StatKey } from '../../engine/content';
import type { RunState } from '../../run/state';
import { equipToRoster, RunProgressError } from '../../run/runProgress';
import { rosterEntryTypes } from '../../run/progression';
import { getTypeColor } from '../combat/typeColors';
import { TypeBadge } from '../shared/TypeBadge';
import { HeroPortrait } from '../shared/HeroPortrait';
import { STAT_ICONS, STAT_LABELS } from '../shared/StatBars';
import { EQUIP_SLOT_ICONS, EQUIP_SLOT_LABELS, RARITY_COLOR_VARS, RARITY_LABELS } from '../shared/EquipmentBox';

interface Props {
  run: RunState;
  /** Item ids awaiting a decision, in order. Seeded by the caller (App.tsx) with whatever was just granted — usually one item, but a bumped item gets appended here too (see below). */
  queue: string[];
  onRunChange: (next: RunState) => void;
  onDone: () => void;
}

interface QueueEntry {
  itemId: string;
  /** True once this item has already been displaced from a hero by a prior choice this screen — changes the headline copy so the player understands why they're being asked again. */
  bumped: boolean;
}

function fmtGrant(amount: number): string {
  return amount > 0 ? `+${amount}` : `${amount}`;
}

/**
 * Forced resolution gate (CLAUDE.md-style "instantly allocated before the run
 * continues", same pattern as LevelUpScreen): every piece of equipment
 * obtained must be equipped to a hero or trashed before the run advances —
 * there is no unequipped stash to defer the choice into anymore (per user
 * direction, replacing the old RosterManagementScreen inventory). Equipping
 * onto a hero that already has an item in that slot bumps the old item back
 * onto the front of this same queue, so the player resolves it too before
 * Continue is possible — recursing until every displaced item has a home or
 * is trashed.
 */
export function ForceEquipScreen({ run, queue: initialQueue, onRunChange, onDone }: Props) {
  const [queue, setQueue] = useState<QueueEntry[]>(() => initialQueue.map((itemId) => ({ itemId, bumped: false })));
  const [confirmRosterId, setConfirmRosterId] = useState<string | null>(null);
  const [confirmTrash, setConfirmTrash] = useState(false);

  const current = queue[0];
  const itemLookup = current ? equipment[current.itemId] : undefined;

  if (!current || !itemLookup) {
    onDone();
    return null;
  }
  // Reassigned to a definitely-EquipmentDefinition-typed binding so the
  // closures below (handleEquip et al.) don't need a redundant narrowing
  // check on every use — TS can't carry the guard above's narrowing into a
  // function declared after it.
  const item = itemLookup;

  function advance(nextQueue: QueueEntry[]) {
    setQueue(nextQueue);
    setConfirmRosterId(null);
    setConfirmTrash(false);
    if (nextQueue.length === 0) onDone();
  }

  function handleEquip(rosterId: string) {
    try {
      const { run: nextRun, bumpedItemId } = equipToRoster(run, rosterId, item.id, equipment);
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

  const confirmEntry = confirmRosterId ? run.roster.find((r) => r.rosterId === confirmRosterId) : null;
  const confirmHero = confirmEntry ? heroes[confirmEntry.heroId] : null;
  const confirmCurrentId = confirmEntry ? confirmEntry.equipment[item.slot] : null;
  const confirmCurrentItem = confirmCurrentId ? equipment[confirmCurrentId] : null;

  const grants = Object.entries(item.statGrants) as [StatKey, number][];

  return (
    <div className="node-screen force-equip-screen">
      <div className="screen-scroll">
        <div className="equip-spotlight" style={{ '--rarity-color': RARITY_COLOR_VARS[item.rarity] } as CSSProperties}>
          <div className="equip-spotlight-glow" aria-hidden="true" />
          <div className="equip-spotlight-header">
            <span className="equip-spotlight-icon">{EQUIP_SLOT_ICONS[item.slot]}</span>
            <div>
              <div className="equip-spotlight-name">{item.name}</div>
              <div className="equip-spotlight-rarity">
                {RARITY_LABELS[item.rarity]} · {EQUIP_SLOT_LABELS[item.slot]}
              </div>
            </div>
          </div>
          {grants.length > 0 && (
            <div className="detail-modifier-list">
              {grants
                .filter(([, amount]) => amount)
                .map(([stat, amount]) => (
                  <span key={stat} className={`detail-modifier-chip ${amount > 0 ? 'stat-buff' : 'stat-debuff'}`}>
                    {STAT_ICONS[stat]} {STAT_LABELS[stat]} {fmtGrant(amount)}
                  </span>
                ))}
            </div>
          )}
          <p className="hint">
            {current.bumped
              ? `${item.name} was unequipped — give it to another hero, or trash it for good.`
              : `You found ${item.name}! Choose a hero to equip it, or trash it for good.`}
          </p>
        </div>

        <div className="equip-target-list">
          {run.roster.map((entry) => {
            const hero = heroes[entry.heroId];
            const currentId = entry.equipment[item.slot];
            const currentItem = currentId ? equipment[currentId] : null;
            return (
              <button
                key={entry.rosterId}
                className="equip-target-card"
                style={{ borderLeftColor: getTypeColor(hero.types[0]) }}
                onClick={() => setConfirmRosterId(entry.rosterId)}
              >
                <HeroPortrait heroId={hero.id} className="roster-mgmt-portrait" />
                <div className="equip-target-info">
                  <div className="equip-target-name">
                    {hero.name} <span className="hint">Lv {entry.level}</span>
                  </div>
                  <div className="roster-card-types">
                    {rosterEntryTypes(hero, entry).map((t) => (
                      <TypeBadge key={t} type={t} />
                    ))}
                  </div>
                  <div className="equip-target-current">
                    {currentItem ? (
                      <>
                        Currently: <strong>{currentItem.name}</strong>
                      </>
                    ) : (
                      'Slot empty'
                    )}
                  </div>
                </div>
                <span className="equip-target-cta">{currentItem ? 'Replace' : 'Equip'}</span>
              </button>
            );
          })}
        </div>
      </div>

      <button className="secondary-button trash-button" onClick={() => setConfirmTrash(true)}>
        🗑️ Trash {item.name}
      </button>

      {confirmRosterId && confirmEntry && confirmHero && (
        <div className="log-overlay" onClick={() => setConfirmRosterId(null)}>
          <div className="log-panel" onClick={(e) => e.stopPropagation()}>
            <div className="log-panel-header">
              <span>Confirm Equip</span>
            </div>
            <div className="level-up-confirm-body">
              <HeroPortrait heroId={confirmHero.id} className="level-up-confirm-portrait" />
              <div>
                <div className="level-up-confirm-name">{confirmHero.name}</div>
                <div className="level-up-confirm-sub">
                  {confirmCurrentItem ? `Replaces ${confirmCurrentItem.name}` : `Equips into an empty ${EQUIP_SLOT_LABELS[item.slot]} slot`}
                </div>
              </div>
            </div>
            <div className="reward-panel-actions">
              <button className="secondary-button" onClick={() => setConfirmRosterId(null)}>
                Cancel
              </button>
              <button className="resolve-button" onClick={() => handleEquip(confirmRosterId)}>
                Confirm — Equip {item.name}
              </button>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
}
