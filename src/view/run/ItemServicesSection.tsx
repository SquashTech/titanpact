import { useState } from 'react';
import { heroes } from '../../data/heroes';
import { equipment } from '../../data/equipment';
import type { RunState } from '../../run/state';
import type { EnchantmentId } from '../../run/equipment';
import { ENCHANTMENTS, ENCHANTMENT_IDS, enchantLabel } from '../../run/equipment';
import { anvilQuote, anvilUpgrade, enchantItem, RunProgressError, type ItemRef } from '../../run/runProgress';
import { ENCHANT_PRICE_BY_RARITY } from '../../run/shop';
import { EquipmentFormGlyph } from '../shared/equipmentIcons';
import { NodeGlyph } from '../shared/nodeIcons';
import { StatGlyph } from '../shared/statIcons';
import { TypeBadge } from '../shared/TypeBadge';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
}

interface OwnedItem {
  key: string;
  ref: ItemRef;
  itemId: string;
  /** "Inventory", or the hero carrying it — the player picks the item, not the slot. */
  holder: string;
}

/** Everything the player owns, inventory first. Both services take equipped gear, so nothing comes off to be improved. */
function ownedItems(run: RunState): OwnedItem[] {
  const out: OwnedItem[] = run.stash.map((itemId, index) => ({
    key: `stash:${index}`,
    ref: { kind: 'stash', index },
    itemId,
    holder: 'Inventory',
  }));
  for (const entry of run.roster) {
    entry.equipment.forEach((itemId, index) => {
      out.push({
        key: `hero:${entry.rosterId}:${index}`,
        ref: { kind: 'hero', rosterId: entry.rosterId, index },
        itemId,
        holder: heroes[entry.heroId]?.name ?? entry.heroId,
      });
    });
  }
  return out;
}

/**
 * The Anvil and the Enchanter (docs/equipment.md §5). Both are Blacksmith services rather than
 * one-shot rewards: repeatable and unbounded so long as the player can pay. There is no free
 * map-node version of either — the reward row's spike in this space is the Forge, which grants
 * a slot rather than improving an item.
 *
 * The Anvil is deliberately dearer than buying that tier outright — you are paying to keep THIS
 * item, its family, its Awakening and its enchant. Merging is the efficient route, and it is free.
 */
export function ItemServicesSection({ run, onRunChange }: Props) {
  const [enchanting, setEnchanting] = useState<OwnedItem | null>(null);
  const owned = ownedItems(run);

  function apply(fn: () => RunState) {
    try {
      onRunChange(fn());
    } catch (err) {
      if (!(err instanceof RunProgressError)) throw err;
    }
  }

  if (owned.length === 0) {
    return (
      <div className="guild-hall-section">
        <div className="guild-hall-section-head">
          <span className="guild-hall-section-title">
            <NodeGlyph type="forgeReward" /> Anvil &amp; Enchanter
          </span>
        </div>
        <p className="hint">Nothing to work on yet.</p>
      </div>
    );
  }

  if (enchanting) {
    const item = equipment[enchanting.itemId];
    const cost = item ? ENCHANT_PRICE_BY_RARITY[item.rarity] : 0;
    return (
      <div className="guild-hall-section">
        <div className="guild-hall-section-head">
          <span className="guild-hall-section-title">
            <StatGlyph stat="intelligence" tone="inherit" /> Enchant {item?.name}
          </span>
          <span className="guild-hall-section-hint">{cost}g — one enchantment per item</span>
        </div>
        <div className="enchant-grid">
          {ENCHANTMENT_IDS.map((enchantId) => {
            const held = item?.enchantId === enchantId;
            return (
              <button
                key={enchantId}
                className={`enchant-option${held ? ' is-held' : ''}`}
                disabled={held || run.gold < cost}
                onClick={() => {
                  const target = enchanting;
                  setEnchanting(null);
                  apply(() => enchantItem(run, target.ref, enchantId, equipment));
                }}
              >
                <span className="enchant-option-name">{enchantLabel(enchantId)}</span>
                <TypeBadge type={ENCHANTMENTS[enchantId]} />
              </button>
            );
          })}
        </div>
        <button className="guild-hall-service-cancel" onClick={() => setEnchanting(null)}>
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="guild-hall-section">
      <div className="guild-hall-section-head">
        <span className="guild-hall-section-title">
            <NodeGlyph type="forgeReward" /> Anvil &amp; Enchanter
          </span>
        <span className="guild-hall-section-hint">Upgrade a tier, or bind an element</span>
      </div>
      <div className="item-service-list">
        {owned.map((owned) => {
          const item = equipment[owned.itemId];
          if (!item) return null;
          const quote = anvilQuote(run, owned.itemId, equipment);
          const enchantCost = ENCHANT_PRICE_BY_RARITY[item.rarity];
          return (
            <div key={owned.key} className={`item-service-row tier-${item.rarity}`}>
              <EquipmentFormGlyph item={item} className="item-service-glyph" />
              <span className="item-service-body">
                <span className="item-service-name">{item.name}</span>
                <span className="item-service-holder">{owned.holder}</span>
              </span>
              <button
                className="item-service-button"
                disabled={!quote || run.gold < quote.cost}
                title={quote ? `Upgrade to ${equipment[quote.targetId]?.name}` : 'Nothing above this'}
                onClick={() => quote && apply(() => anvilUpgrade(run, owned.ref, equipment))}
              >
                <NodeGlyph type="forgeReward" /> {quote ? `${quote.cost}g` : '—'}
              </button>
              <button
                className="item-service-button"
                disabled={run.gold < enchantCost}
                onClick={() => setEnchanting(owned)}
              >
                <StatGlyph stat="intelligence" tone="inherit" /> {enchantCost}g
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
