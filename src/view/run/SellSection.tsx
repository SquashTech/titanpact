import { equipment } from '../../data/equipment';
import type { RunState } from '../../run/state';
import { sellFromStash, RunProgressError } from '../../run/runProgress';
import { sellValueFor } from '../../run/shop';
import { EquipmentFormGlyph } from '../shared/equipmentIcons';
import { RARITY_LABELS } from '../shared/EquipmentBox';
import { ResourceGlyph } from '../shared/RunGlyph';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
}

/**
 * Selling, at the Guild Hall (2026-09-08, per user direction). It used to live on Manage Roster,
 * which is the screen opened between every node — one irreversible verb a mis-tap away from the
 * gesture everything else on that sheet uses. Here it is somewhere the player arrived to spend.
 *
 * Bag only, as before: equipped gear comes off first, which keeps the irreversible verb one
 * deliberate step from anything a hero is actually carrying.
 */
export function SellSection({ run, onRunChange }: Props) {
  function sell(index: number) {
    try {
      onRunChange(sellFromStash(run, index, equipment));
    } catch (err) {
      if (!(err instanceof RunProgressError)) throw err;
    }
  }

  return (
    <div className="guild-hall-section">
      <div className="guild-hall-section-head">
        <span className="guild-hall-section-title">🪙 Sell</span>
        <span className="guild-hall-section-hint">From the bag — unequip first</span>
      </div>
      {run.stash.length === 0 ? (
        <p className="hint">The bag is empty.</p>
      ) : (
        <div className="item-service-list">
          {run.stash.map((itemId, index) => {
            const item = equipment[itemId];
            if (!item) return null;
            return (
              <div key={`${itemId}-${index}`} className={`item-service-row tier-${item.rarity}`}>
                <EquipmentFormGlyph item={item} className="item-service-glyph" />
                <span className="item-service-body">
                  <span className="item-service-name">{item.name}</span>
                  <span className="item-service-holder">{RARITY_LABELS[item.rarity]}</span>
                </span>
                <button className="item-service-button is-sell" onClick={() => sell(index)}>
                  <ResourceGlyph kind="gold" /> {sellValueFor(item)}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
