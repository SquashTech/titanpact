import { useState, type CSSProperties } from 'react';
import type { RunState } from '../../run/state';
import type { GuildHallOffers } from '../../run/shop';
import type { ConsumableKind } from '../../run/consumables';
import type { GuildHallOffer } from '../../run/recruitment';
import { GuildHallPanel, guildHallTabs, type GuildHallTab } from './GuildHallPanel';
import { GuildSign } from './guildHallArt';
import { RosterPeek } from './RosterPeek';
import { NodeHeader, NodePurse, NodeSky, NODE_TINT_HEARTH } from '../shared/NodeStage';
import { TabStrip } from '../shared/TabStrip';
import { readGuildHallTab, writeGuildHallTab } from './guildHallTabMemory';

interface Props {
  run: RunState;
  offers: GuildHallOffers;
  /** Mastery Scrolls bought this visit, carried on the `shop` Screen (App.tsx) because a purchase unmounts this screen through the who screen. */
  scrollsBought: number;
  revivesBought: number;
  /** Tavern rerolls this visit (run/shop.ts tavernRerollCost). */
  rerolls: number;
  onRunChange: (next: RunState) => void;
  onBuyScroll: () => void;
  onReroll: () => void;
  onBuyConsumable: (kind: ConsumableKind) => void;
  onBuyMend: () => void;
  onRequestRosterReplace: (offer: GuildHallOffer) => void;
  onContinue: () => void;
  /** Act 6's Vigil: the last node of the run, where nobody is hired — only goods, the mend and the Smithy. */
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
  scrollsBought,
  revivesBought,
  rerolls,
  onRunChange,
  onBuyScroll,
  onReroll,
  onBuyConsumable,
  onBuyMend,
  onRequestRosterReplace,
  onContinue,
  muster = false,
}: Props) {
  const [overlayOpen, setOverlayOpen] = useState(false);
  // The counter the player was last at, across a who-screen's unmount and across visits.
  const [tab, setTab] = useState<GuildHallTab>(() => readGuildHallTab(muster ? 'shop' : 'tavern'));
  const selectTab = (next: GuildHallTab) => {
    setTab(next);
    writeGuildHallTab(next);
  };
  return (
    <div className={`node-screen shop-node-screen is-${tab}`} style={{ '--node-rgb': NODE_TINT_HEARTH } as CSSProperties}>
      <NodeSky />
      <div className="guild-hall-hearth" aria-hidden="true" />
      <RosterPeek run={run} />
      <NodePurse gold={run.gold} />

      {/* The Smithy's own forge is its sign (2026-09-25, per user direction): six benches fit
          under the anvil without a scroll only once the hall's sign is off the top. */}
      {tab !== 'smithy' && (
        <NodeHeader compact art={<GuildSign />} eyebrow={muster ? 'The Last Muster' : 'Welcome to'} title={muster ? 'The Vigil' : 'The Guild Hall'} />
      )}

      <div className="screen-scroll">
        <GuildHallPanel
          run={run}
          offers={offers}
          scrollsBought={scrollsBought}
          revivesBought={revivesBought}
          rerolls={rerolls}
          onRunChange={onRunChange}
          onBuyScroll={onBuyScroll}
          onReroll={onReroll}
          onBuyConsumable={onBuyConsumable}
          onBuyMend={onBuyMend}
          onRequestRosterReplace={onRequestRosterReplace}
          onOverlayChange={setOverlayOpen}
          tab={tab}
          vigil={muster}
        />
      </div>

      {/* At the foot, over Continue (2026-09-11, per user direction): the counters are the
          control the thumb comes back to, and the foot is where the thumb already is. */}
      <TabStrip className="guild-hall-tabs" tabs={guildHallTabs(run, offers, muster)} active={tab} onSelect={selectTab} />
      {!overlayOpen && (
        <button className="resolve-button" onClick={onContinue}>
          {muster ? 'Walk on' : 'Continue'}
        </button>
      )}
    </div>
  );
}
