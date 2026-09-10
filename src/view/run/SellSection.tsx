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
  open: boolean;
  /** Lifted so the panel can fold this into its own `overlayOpen` and pull the host's bottom CTA. */
  onOpenChange: (open: boolean) => void;
}

/**
 * Selling, at the Guild Hall (2026-09-08, per user direction). It used to live on Manage Roster,
 * which is the screen opened between every node — one irreversible verb a mis-tap away from the
 * gesture everything else on that sheet uses. Here it is somewhere the player arrived to spend.
 *
 * A row that opens an overlay rather than the bag laid out inline (2026-09-08): the bag is the one
 * list here whose length is the player's, not the offer's, and a full one pushed the things they
 * came to buy off the bottom of the panel.
 *
 * Bag only, as before: equipped gear comes off first, which keeps the irreversible verb one
 * deliberate step from anything a hero is actually carrying.
 */
export function SellSection({ run, onRunChange, open, onOpenChange }: Props) {
  const empty = run.stash.length === 0;

  function sell(index: number) {
    try {
      onRunChange(sellFromStash(run, index, equipment));
    } catch (err) {
      if (!(err instanceof RunProgressError)) throw err;
    }
  }

  return (
    <div className="guild-hall-section">
      <button className="guild-hall-contract-row" disabled={empty} onClick={() => onOpenChange(true)}>
        <span className="guild-hall-contract-icon">
          <ResourceGlyph kind="gold" tone="inherit" />
        </span>
        <span className="guild-hall-contract-body">
          <span className="guild-hall-contract-name">Sell</span>
          <span className="guild-hall-contract-desc">
            {empty ? 'The bag is empty.' : 'Trade gear out of the bag — unequip first.'}
          </span>
        </span>
        <span className="guild-hall-contract-held">{run.stash.length} in bag</span>
      </button>

      {open && (
        <div className="log-overlay" onClick={() => onOpenChange(false)}>
          <div className="log-panel roster-peek-panel" onClick={(e) => e.stopPropagation()}>
            <div className="log-panel-header">
              <span>
                <ResourceGlyph kind="gold" /> Sell — {run.gold}g
              </span>
              <button className="log-close-button" onClick={() => onOpenChange(false)}>
                ✕
              </button>
            </div>

            <div className="screen-scroll">
              {empty ? (
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

            <div className="move-popup-hint">From the bag only — unequip at the Roster first</div>
          </div>
        </div>
      )}
    </div>
  );
}
