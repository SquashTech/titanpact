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
import { EQUIP_SLOT_LABELS, EquipmentIcon, RARITY_COLOR_VARS, RARITY_LABELS } from '../shared/EquipmentBox';
import { passives } from '../../data/passives';
import { passiveEmoji } from '../shared/passiveIcons';
import { statuses } from '../../data/statuses';

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

  const grants = Object.entries(item.statGrants) as [StatKey, number][];
  const grantedPassives = item.grantsPassiveIds ?? [];
  const grantedStatuses = item.grantsStatusIds ?? [];

  return (
    <div className="node-screen force-equip-screen">
      <div className="screen-scroll">
        <div className="bottom-pinned">
          <div className="equip-spotlight" style={{ '--rarity-color': RARITY_COLOR_VARS[item.rarity] } as CSSProperties}>
            <div className="equip-spotlight-glow" aria-hidden="true" />
            <div className="equip-spotlight-header">
              <EquipmentIcon item={item} slot={item.slot} className="equip-spotlight-icon" />
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
            {/* Full passive/status description (not just the "Grants: Name"
                chip used elsewhere) — the more economical hero-grid below
                frees up room to spell out exactly what the item does. */}
            {(grantedPassives.length > 0 || grantedStatuses.length > 0) && (
              <div className="equip-spotlight-passives">
                {grantedPassives.map((passiveId) => {
                  const def = passives[passiveId];
                  if (!def) return null;
                  return (
                    <div key={passiveId} className="equip-spotlight-passive">
                      <span className="equip-spotlight-passive-name">
                        {passiveEmoji[passiveId] ? `${passiveEmoji[passiveId]} ` : ''}
                        {def.name}
                      </span>
                      <span className="equip-spotlight-passive-desc">{def.description}</span>
                    </div>
                  );
                })}
                {grantedStatuses.map(({ statusId, magnitude }) => {
                  const def = statuses[statusId];
                  if (!def) return null;
                  return (
                    <div key={statusId} className="equip-spotlight-passive">
                      <span className="equip-spotlight-passive-name">
                        {def.name} +{magnitude}
                      </span>
                      <span className="equip-spotlight-passive-desc">{def.description}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {current.bumped && <p className="hint">{`${item.name} was unequipped — give it to another hero, or trash it for good.`}</p>}
          </div>

          <div className="hero-grid">
            {run.roster.map((entry) => {
              const hero = heroes[entry.heroId];
              const currentId = entry.equipment[item.slot];
              const currentItem = currentId ? equipment[currentId] : null;
              return (
                <button
                  key={entry.rosterId}
                  className="hero-grid-card"
                  style={{ borderLeftColor: getTypeColor(hero.types[0]) }}
                  onClick={() => handleEquip(entry.rosterId)}
                >
                  <HeroPortrait heroId={hero.id} className="hero-grid-portrait" />
                  <div className="hero-grid-name-row">
                    <span className="hero-grid-name">{hero.name}</span>
                    <span className="training-hero-level">Lv {entry.level}</span>
                  </div>
                  <div className="hero-grid-types">
                    {rosterEntryTypes(hero, entry).map((t) => (
                      <TypeBadge key={t} type={t} />
                    ))}
                  </div>
                  <div className={`equip-slot-box target${currentItem ? ' filled' : ' empty'}`}>
                    <EquipmentIcon item={currentItem} slot={item.slot} className="equip-slot-icon" />
                    <span className="equip-slot-item">{currentItem ? currentItem.name : 'Empty'}</span>
                  </div>
                  <span className="hero-grid-cta">{currentItem ? 'Replace' : 'Equip'}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <button className="secondary-button trash-button" onClick={() => setConfirmTrash(true)}>
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
    </div>
  );
}
