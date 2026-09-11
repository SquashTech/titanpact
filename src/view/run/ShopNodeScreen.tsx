import { useState, type CSSProperties } from 'react';
import type { RunState } from '../../run/state';
import type { GuildHallOffers } from '../../run/shop';
import type { GuildHallOffer } from '../../run/recruitment';
import { GuildHallPanel, guildHallTabs, type GuildHallTab } from './GuildHallPanel';
import { RosterPeek } from './RosterPeek';
import { NodeHeader, NodePurse, NodeSky, NODE_TINT_MANA } from '../shared/NodeStage';
import { TabStrip } from '../shared/TabStrip';

interface Props {
  run: RunState;
  offers: GuildHallOffers;
  /** Carried on the `shop` Screen (App.tsx) because a purchase unmounts this screen through the equip gate. */
  soldOutEquipmentIds: readonly string[];
  onRunChange: (next: RunState) => void;
  onBuyEquipment: (itemId: string) => void;
  onRequestRosterReplace: (offer: GuildHallOffer) => void;
  onContinue: () => void;
  /** Act 6's Vigil: the last node of the run, and the one that musters rather than sells. */
  muster?: boolean;
}

// The `shop` node. Continue stands down while the panel has a modal open —
// otherwise two identical gold CTAs sit on screen for two different commitments.
export function ShopNodeScreen({
  run,
  offers,
  soldOutEquipmentIds,
  onRunChange,
  onBuyEquipment,
  onRequestRosterReplace,
  onContinue,
  muster = false,
}: Props) {
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [tab, setTab] = useState<GuildHallTab>('heroes');
  return (
    <div className="node-screen shop-node-screen" style={{ '--node-rgb': NODE_TINT_MANA } as CSSProperties}>
      <NodeSky />
      {/* Full Manage Roster behind the glyph, not the read-only peek — a shop's
          question is "do I already have something better in that slot". */}
      <RosterPeek run={run} onRunChange={onRunChange} />
      <NodePurse gold={run.gold} />

      {/* The panel used to open with its own `<h2>Guild Hall</h2>` over a rule, which made this
          the one node screen in the run that named itself in a masthead instead of in the
          NodeHeader every other one uses. */}
      <NodeHeader
        compact
        eyebrow={muster ? 'The Last Muster' : 'The Guild Hall'}
        title={muster ? 'The Vigil' : 'Who Will You Take'}
        readout={muster ? 'The last shelf, and the last hands.' : 'People and gear — for gold.'}
      />

      {/* Above the scroll, not in it: the two counters (2026-09-10, per user direction) are a
          control the thumb comes back to, and one that scrolled away with the shelf was not. */}
      <TabStrip className="guild-hall-tabs" tabs={guildHallTabs(run, offers, muster)} active={tab} onSelect={setTab} />

      <div className="screen-scroll">
        <GuildHallPanel
          run={run}
          offers={offers}
          soldOutEquipmentIds={soldOutEquipmentIds}
          onRunChange={onRunChange}
          onBuyEquipment={onBuyEquipment}
          onRequestRosterReplace={onRequestRosterReplace}
          onOverlayChange={setOverlayOpen}
          tab={tab}
          freeRecruits={muster}
        />
      </div>
      {!overlayOpen && (
        <button className="resolve-button" onClick={onContinue}>
          {muster ? 'Walk on' : 'Continue'}
        </button>
      )}
    </div>
  );
}
