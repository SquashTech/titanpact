import { Fragment, useState } from 'react';
import { heroes } from '../../data/heroes';
import { equipment } from '../../data/equipment';
import type { StatKey } from '../../engine/content';
import type { RunState } from '../../run/state';
import type { EquipmentSlot } from '../../run/equipment';
import { equipmentStatModifiers } from '../../run/equipment';
import { moveEquipment, RunProgressError } from '../../run/runProgress';
import { mergeStatMods } from '../../run/statMods';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  onClose: () => void;
}

const STAT_ORDER: StatKey[] = ['hp', 'attack', 'defense', 'intelligence', 'wisdom', 'speed', 'manaPool', 'mpRegen'];

const STAT_LABELS: Record<StatKey, string> = {
  hp: 'HP',
  attack: 'Attack',
  defense: 'Defense',
  intelligence: 'Intelligence',
  wisdom: 'Wisdom',
  speed: 'Speed',
  manaPool: 'Mana Pool',
  mpRegen: 'MP Regen',
};

const EQUIP_SLOT_ORDER: EquipmentSlot[] = ['weapon', 'armor', 'accessory'];

const EQUIP_SLOT_LABELS: Record<EquipmentSlot, string> = {
  weapon: 'Weapon',
  armor: 'Armor',
  accessory: 'Accessory',
};

function fmtGrant(n: number): string {
  if (n === 0) return '—';
  return n > 0 ? `+${n}` : `${n}`;
}

/**
 * The Manage Roster screen (map-node-reachable, not a fight-blocking flow —
 * that's LevelUpScreen now). Read-only stat/loadout inspection outside of
 * combat (HeroDetailOverlay needs a live Combatant, which doesn't exist
 * here, so this computes the same base+grants+total shape directly from
 * RosterEntry) plus the one interactive feature: moving an equipped item
 * from one roster hero to another's matching slot.
 */
export function RosterManagementScreen({ run, onRunChange, onClose }: Props) {
  const [moving, setMoving] = useState<{ rosterId: string; slot: EquipmentSlot } | null>(null);

  function beginMove(rosterId: string, slot: EquipmentSlot) {
    setMoving((prev) => (prev?.rosterId === rosterId && prev.slot === slot ? null : { rosterId, slot }));
  }

  function handleMoveTarget(toRosterId: string) {
    if (!moving) return;
    try {
      onRunChange(moveEquipment(run, moving.rosterId, moving.slot, toRosterId, equipment));
    } catch (err) {
      if (!(err instanceof RunProgressError)) throw err;
    }
    setMoving(null);
  }

  const movingItemName = moving
    ? (() => {
        const fromEntry = run.roster.find((r) => r.rosterId === moving.rosterId);
        const itemId = fromEntry?.equipment[moving.slot];
        return itemId ? equipment[itemId].name : null;
      })()
    : null;

  return (
    <div className="log-overlay" onClick={onClose}>
      <div className="log-panel roster-panel" onClick={(e) => e.stopPropagation()}>
        <div className="log-panel-header">
          <span>Manage Roster</span>
          <button className="log-close-button" onClick={onClose}>
            ✕
          </button>
        </div>
        {moving && (
          <p className="hint">
            Moving {movingItemName} — tap a hero below to equip it there (replacing whatever they have in that slot), or tap "Cancel" to
            stop.
          </p>
        )}
        <div className="screen-scroll">
          {run.roster.map((entry) => {
            const hero = heroes[entry.heroId];
            const equipGrants = equipmentStatModifiers(entry.equipment, equipment);
            const totalGrants = mergeStatMods(entry.rankStatGrants, equipGrants);

            return (
              <div key={entry.rosterId} className="training-hero">
                <h3>
                  {hero.name} — Lv {entry.level} — {hero.types.join('/')}
                </h3>

                <div className="detail-stat-grid">
                  <span className="detail-stat-head">Stat</span>
                  <span className="detail-stat-head">Base</span>
                  <span className="detail-stat-head">Grants</span>
                  <span className="detail-stat-head">Total</span>
                  {STAT_ORDER.map((stat) => {
                    const grant = totalGrants[stat] ?? 0;
                    return (
                      <Fragment key={stat}>
                        <span>{STAT_LABELS[stat]}</span>
                        <span>{hero.baseStats[stat]}</span>
                        <span className={grant > 0 ? 'stat-buff' : grant < 0 ? 'stat-debuff' : ''}>{fmtGrant(grant)}</span>
                        <span>{hero.baseStats[stat] + grant}</span>
                      </Fragment>
                    );
                  })}
                </div>

                <div className="detail-equip-list">
                  {EQUIP_SLOT_ORDER.map((slot) => {
                    const itemId = entry.equipment[slot];
                    const item = itemId ? equipment[itemId] : null;
                    const isMovingThis = moving?.rosterId === entry.rosterId && moving.slot === slot;
                    // Only this item's own slot type is a valid drop target on another hero — equipItem places by the item's own slot regardless of which row is tapped, so any other slot row would silently do the wrong thing.
                    const isMoveTarget = !!moving && moving.slot === slot && moving.rosterId !== entry.rosterId;
                    return (
                      <div className="detail-equip-row" key={slot}>
                        <span className="detail-equip-slot">{EQUIP_SLOT_LABELS[slot]}</span>
                        <span className="detail-equip-item">{item ? item.name : '— empty —'}</span>
                        {item && !isMoveTarget && (
                          <button className="move-button" onClick={() => beginMove(entry.rosterId, slot)}>
                            {isMovingThis ? 'Cancel' : 'Move…'}
                          </button>
                        )}
                        {isMoveTarget && (
                          <button className="move-button" onClick={() => handleMoveTarget(entry.rosterId)}>
                            Move here
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
