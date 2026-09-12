import { useState, type CSSProperties } from 'react';
import type { RunState } from '../../run/state';
import type { GuildHallOffers } from '../../run/shop';
import type { GuildHallOffer } from '../../run/recruitment';
import { GuildHallPanel, guildHallTabs, type GuildHallTab } from './GuildHallPanel';
import { GuildSign } from './guildHallArt';
import { RosterPeek } from './RosterPeek';
import { NodeHeader, NodePurse, NodeSky, NODE_TINT_HEARTH } from '../shared/NodeStage';
import { TabStrip } from '../shared/TabStrip';

interface Props {
  run: RunState;
  offers: GuildHallOffers;
  /** Carried on the `shop` Screen (App.tsx) because a purchase unmounts this screen through the equip gate. */
  soldOutEquipmentIds: readonly string[];
  /** Scroll bundles bought this visit, carried the same way. */
  scrollsBought: number;
  onRunChange: (next: RunState) => void;
  onBuyEquipment: (itemId: string) => void;
  onBuyScrolls: () => void;
  onRequestRosterReplace: (offer: GuildHallOffer) => void;
  onContinue: () => void;
  /** Act 6's Vigil: the last node of the run, and the one that musters rather than sells. */
  muster?: boolean;
}

// The `shop` node. Continue stands down while the panel has a modal open —
// otherwise two identical gold CTAs sit on screen for two different commitments.
//
// The header names the place and nothing else (2026-09-11, per user direction): the sign, the
// name, and lantern light. "Who Will You Take" / "People and gear — for gold" were a question and
// a price list over a screen that is plainly both, and every line under a section mark went with
// them — what a hire is and what a full roster asks are said on the hero's own sheet.
export function ShopNodeScreen({
  run,
  offers,
  soldOutEquipmentIds,
  scrollsBought,
  onRunChange,
  onBuyEquipment,
  onBuyScrolls,
  onRequestRosterReplace,
  onContinue,
  muster = false,
}: Props) {
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [tab, setTab] = useState<GuildHallTab>('heroes');
  return (
    <div className="node-screen shop-node-screen" style={{ '--node-rgb': NODE_TINT_HEARTH } as CSSProperties}>
      <NodeSky />
      <div className="guild-hall-hearth" aria-hidden="true" />
      {/* Full Manage Roster behind the glyph, not the read-only peek — a shop's
          question is "do I already have something better in that slot". */}
      <RosterPeek run={run} onRunChange={onRunChange} />
      <NodePurse gold={run.gold} />

      <NodeHeader compact art={<GuildSign />} eyebrow={muster ? 'The Last Muster' : 'Welcome to'} title={muster ? 'The Vigil' : 'The Guild Hall'} />

      <div className="screen-scroll">
        <GuildHallPanel
          run={run}
          offers={offers}
          soldOutEquipmentIds={soldOutEquipmentIds}
          scrollsBought={scrollsBought}
          onRunChange={onRunChange}
          onBuyEquipment={onBuyEquipment}
          onBuyScrolls={onBuyScrolls}
          onRequestRosterReplace={onRequestRosterReplace}
          onOverlayChange={setOverlayOpen}
          tab={tab}
          freeRecruits={muster}
        />
      </div>

      {/* At the foot, over Continue (2026-09-11, per user direction): the two counters are the
          control the thumb comes back to, and the foot is where the thumb already is. */}
      <TabStrip className="guild-hall-tabs" tabs={guildHallTabs(run, offers, muster)} active={tab} onSelect={setTab} />
      {!overlayOpen && (
        <button className="resolve-button" onClick={onContinue}>
          {muster ? 'Walk on' : 'Continue'}
        </button>
      )}
    </div>
  );
}
