import { useEffect, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { heroes } from '../../data/heroes';
import { equipment } from '../../data/equipment';
import type { HeroDefinition } from '../../engine/content';
import { MAX_ITEM_SLOTS } from '../../run/equipment';
import type { RosterEntry, RunState } from '../../run/state';
import { buyItemSlot, slotQuote, RunProgressError } from '../../run/runProgress';
import { HeroSlotCard, HeroSlotGrid } from '../shared/HeroSlotCard';
import { NodeHeader, NodeSky } from '../shared/NodeStage';
import { ResourceGlyph } from '../shared/RunGlyph';
import { HubGlyph } from '../shared/nodeIcons';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { ItemServicesSection } from './ItemServicesSection';
import { RosterPeek } from './RosterPeek';

/** Matches the Blacksmith's map colour (MapScreen NODE_COLORS blacksmith), as bare `r, g, b`. */
const NODE_TINT_BLACKSMITH = '198, 122, 76';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  onContinue: () => void;
}

/**
 * The Blacksmith (2026-09-08, per user direction): the paid counterpart to the Forge, and from
 * act 3 the other half of the funnel row's fork. Three verbs, all of them about gear the player
 * already owns — buy a hero another item slot, lift an item a tier at the Anvil, or bind an
 * element at the Enchanter. The Guild Hall beside it trades in heroes and new gear instead.
 *
 * The slot is the dear one on purpose (shop.ts SLOT_PRICE_BY_TARGET). It is the same grant the
 * Forge hands out free on the reward row, and the reward row keeps that node at its lowest
 * weight to make slots scarce — so gold buys past that scarcity only at a price that costs most
 * of an act.
 */
export function BlacksmithScreen({ run, onRunChange, onContinue }: Props) {
  const [previewEntry, setPreviewEntry] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);

  useEffect(() => {
    playSfx('shrine', { pitch: 0.62, delay: 0.12 });
  }, []);

  function handleBuySlot(rosterId: string) {
    try {
      onRunChange(buyItemSlot(run, rosterId, heroes));
      playSfx('equip');
    } catch (err) {
      if (!(err instanceof RunProgressError)) throw err;
    }
  }

  return (
    <div className="node-screen shop-node-screen" style={{ '--node-rgb': NODE_TINT_BLACKSMITH } as CSSProperties}>
      <NodeSky />
      <RosterPeek run={run} onRunChange={onRunChange} />

      <NodeHeader
        compact
        eyebrow="The Blacksmith"
        title="Work On What You Carry"
        readout="Slots, tiers and elements — for gold."
      />

      <div className="screen-scroll">
        <div className="guild-hall">
          <div className="guild-hall-header">
            <h2>Blacksmith</h2>
            <span className="guild-hall-gold">
              <ResourceGlyph kind="gold" /> {run.gold}
            </span>
          </div>

          <div className="guild-hall-section">
            <div className="guild-hall-section-head">
              <span className="guild-hall-section-title">
                <HubGlyph name="hand" /> Item Slots
              </span>
              <span className="guild-hall-section-hint">Permanent — hold a hero to review its sheet</span>
            </div>
            <HeroSlotGrid>
              {run.roster.map((entry) => {
                const hero = heroes[entry.heroId];
                const quote = slotQuote(run, entry.rosterId, heroes);
                const affordable = !!quote && run.gold >= quote.cost;
                return (
                  <HeroSlotCard
                    key={entry.rosterId}
                    hero={hero}
                    entry={entry}
                    equipmentLookup={equipment}
                    onHeadLongPress={() => setPreviewEntry({ hero, entry })}
                    headLabel={`${hero.name} — hold to review`}
                    footer={
                      <button
                        className="blacksmith-slot-button"
                        disabled={!affordable}
                        onClick={() => handleBuySlot(entry.rosterId)}
                      >
                        {quote ? (
                          <>
                            <span className="blacksmith-slot-gain">
                              {quote.target - 1} → {quote.target} slots
                            </span>
                            <span className="blacksmith-slot-price">
                              <ResourceGlyph kind="gold" /> {quote.cost}
                            </span>
                          </>
                        ) : (
                          <span className="blacksmith-slot-gain">At the {MAX_ITEM_SLOTS}-slot cap</span>
                        )}
                      </button>
                    }
                    slotProps={() => ({ sfx: 'none' })}
                  />
                );
              })}
            </HeroSlotGrid>
            {/* Whether a slot is worth its price is a question about the bag, not the hero. */}
            <p className="hint">A slot is worth whatever the best item you are not carrying is worth.</p>
          </div>

          <ItemServicesSection run={run} onRunChange={onRunChange} />
        </div>
      </div>

      <button className="resolve-button" onClick={onContinue}>
        Continue
      </button>

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
