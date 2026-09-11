import type { CSSProperties } from 'react';
import { equipment } from '../../data/equipment';
import { heroes } from '../../data/heroes';
import { actAllowsRarity, canMergeItems, mergeResultId, nextRarity, type EquipmentDefinition } from '../../run/equipment';
import type { RunState } from '../../run/state';
import { ItemPiece, RARITY_COLOR_VARS, RARITY_LABELS, RARITY_RGB_VARS } from '../shared/EquipmentBox';
import { ItemDetailCard } from '../shared/ItemDossier';
import { ResourceGlyph } from '../shared/RunGlyph';

interface Props {
  item: EquipmentDefinition;
  run: RunState;
  cost: number;
  onBuy: () => void;
  onClose: () => void;
}

/** One thing the bought item could merge with: what it is, where it is, and the tier the pair reaches. */
interface MergePartner {
  partner: EquipmentDefinition;
  result: EquipmentDefinition;
  /** Where the partner sits — the bag, or the hero wearing it. */
  where: string;
  /** Identical copies in that place, so two bag Daggers are one row rather than two. */
  copies: number;
  /** Whether the merge can be made without first taking something off a hero. */
  ready: boolean;
}

/**
 * Every legal merge the purchase would open (2026-09-11, per user direction): the same family at
 * the same tier, and a next tier the act allows — the rule `mergeablePairIndices` reads. Bag
 * partners are ready to merge; a partner a hero is wearing is listed too, because the family match
 * is what the shelf price is being weighed against, but it says who has to take it off first.
 */
function mergePartners(item: EquipmentDefinition, run: RunState): MergePartner[] {
  const up = nextRarity(item.rarity);
  if (!up || !actAllowsRarity(run.actNumber, up)) return [];
  const rows = new Map<string, MergePartner>();
  const consider = (partnerId: string, where: string, ready: boolean) => {
    const partner = equipment[partnerId];
    if (!partner || !canMergeItems(item, partner)) return;
    const result = equipment[mergeResultId(item, item.enchantId ?? partner.enchantId) ?? ''];
    if (!result) return;
    const key = `${partnerId}|${where}`;
    const existing = rows.get(key);
    if (existing) existing.copies += 1;
    else rows.set(key, { partner, result, where, copies: 1, ready });
  };
  for (const stashId of run.stash) consider(stashId, 'in your bag', true);
  for (const entry of run.roster) {
    for (const wornId of entry.equipment) consider(wornId, `worn by ${heroes[entry.heroId]?.name ?? entry.heroId}`, false);
  }
  return [...rows.values()].sort((a, b) => Number(b.ready) - Number(a.ready));
}

/**
 * The Guild Hall's buy sheet: the item dossier, the merges buying it would open, and the price as
 * a ledger. On the dossier chassis (`.detail-panel`) rather than the `.log-panel` box it used to
 * be, so it is the same object as every other item hold in the run — with a footer, which is why
 * taps on the panel do not close it. The roster's slot holdings came off it (2026-09-11, per user
 * direction): who carries a purchase is decided in the Roster, and a wall of six cards was
 * answering a question the sheet no longer asks.
 */
export function EquipBuyOverlay({ item, run, cost, onBuy, onClose }: Props) {
  const affordable = run.gold >= cost;
  const partners = mergePartners(item, run);
  const rarityColor = RARITY_COLOR_VARS[item.rarity];

  return (
    <div className="detail-overlay" onClick={onClose}>
      <div
        className="detail-panel move-detail-panel item-detail-panel equip-buy-panel"
        style={{ borderTopColor: rarityColor, '--move-type-rgb': RARITY_RGB_VARS[item.rarity] } as CSSProperties}
        onClick={(e) => e.stopPropagation()}
      >
        <ItemDetailCard item={item} />

        <section className="equip-buy-merges">
          <div className="move-detail-label">Merges</div>
          {partners.length === 0 ? (
            <p className="equip-buy-merges-none">Nothing you carry merges with it.</p>
          ) : (
            <ul className="equip-buy-merge-list">
              {partners.map((row) => (
                <li
                  key={`${row.partner.id}|${row.where}`}
                  className={`equip-buy-merge-row${row.ready ? ' is-ready' : ''}`}
                  style={{ '--merge-color': RARITY_COLOR_VARS[row.result.rarity] } as CSSProperties}
                >
                  <span className="equip-buy-merge-piece">
                    <ItemPiece item={row.partner} />
                  </span>
                  <span className="equip-buy-merge-text">
                    <span className="equip-buy-merge-name">
                      {row.partner.name}
                      {row.copies > 1 && <span className="equip-buy-merge-copies">×{row.copies}</span>}
                    </span>
                    <span className="equip-buy-merge-where">{row.where}</span>
                  </span>
                  <span className="equip-buy-merge-arrow" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="merge-mark" focusable="false">
                      <path d="M0 3.5 8 12l-8 8.5Z" />
                      <path d="M24 3.5 16 12l8 8.5Z" />
                      <circle cx="12" cy="12" r="3.4" />
                    </svg>
                  </span>
                  <span className="equip-buy-merge-piece is-result">
                    <ItemPiece item={row.result} />
                  </span>
                  <span className="equip-buy-merge-result">{RARITY_LABELS[row.result.rarity]}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="equip-buy-footer">
          <div className={`equip-buy-ledger${affordable ? '' : ' is-short'}`} aria-label={`Gold ${run.gold} to ${run.gold - cost}`}>
            <ResourceGlyph kind="gold" />
            <span className="equip-buy-ledger-now">{run.gold}</span>
            <span className="equip-buy-ledger-arrow" aria-hidden="true">
              →
            </span>
            <span className="equip-buy-ledger-next">{affordable ? run.gold - cost : `short by ${cost - run.gold}`}</span>
          </div>
          <button className="resolve-button equip-buy-button" disabled={!affordable} onClick={onBuy}>
            <span className="equip-buy-button-label">Buy</span>
            <span className="equip-buy-button-price">
              <ResourceGlyph kind="gold" /> {cost}
            </span>
          </button>
          <button className="detail-action-cancel" data-sfx="ui.back" onClick={onClose}>
            Leave it
          </button>
        </div>
      </div>
    </div>
  );
}
