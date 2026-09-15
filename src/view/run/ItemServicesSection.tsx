import { useState } from 'react';
import { rosterHeroes } from '../../data/content';
import { equipment } from '../../data/equipment';
import type { RunState } from '../../run/state';
import type { EnchantmentId } from '../../run/equipment';
import { ENCHANTMENTS, ENCHANTMENT_IDS, enchantLabel } from '../../run/equipment';
import { anvilQuote, anvilUpgrade, enchantItem, RunProgressError, type ItemRef } from '../../run/runProgress';
import { ENCHANT_PRICE_BY_RARITY } from '../../run/shop';
import { EquipmentFormGlyph } from '../shared/equipmentIcons';
import { HubGlyph } from '../shared/nodeIcons';
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
  /** The hero carrying it — the player picks the item, not the socket. */
  holder: string;
}

/** Everything the player owns is on a hero (docs/gear-absorption.md), and both services work on it there. */
function ownedItems(run: RunState): OwnedItem[] {
  const out: OwnedItem[] = [];
  for (const entry of run.roster) {
    entry.equipment.forEach((itemId, index) => {
      out.push({
        key: `hero:${entry.rosterId}:${index}`,
        ref: { rosterId: entry.rosterId, index },
        itemId,
        holder: rosterHeroes[entry.heroId]?.name ?? entry.heroId,
      });
    });
  }
  return out;
}

/**
 * The Anvil and the Enchanter (docs/equipment.md §5), the Guild Hall's smithy since the Blacksmith
 * folded back into it (docs/gear-absorption.md §6). Both are services rather than one-shot
 * rewards: repeatable and unbounded so long as the player can pay, over the gear the roster
 * already wears — the only gear there is. Merging is the free route up a tier; the Anvil is the
 * paid one for a piece with no duplicate coming.
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
            <HubGlyph name="anvil" /> Anvil &amp; Enchanter
          </span>
        </div>
        <p className="hint">Nobody is wearing anything yet.</p>
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
            <HubGlyph name="anvil" /> Anvil &amp; Enchanter
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
                <HubGlyph name="anvil" /> {quote ? `${quote.cost}g` : '—'}
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
