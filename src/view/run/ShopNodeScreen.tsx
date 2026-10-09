import { useState, type CSSProperties } from 'react';
import type { RunState } from '../../run/state';
import type { GuildHallOffers } from '../../run/shop';
import type { ConsumableKind } from '../../run/consumables';
import type { GuildHallOffer } from '../../run/recruitment';
import { GuildHallPanel, guildHallTabs, type GuildHallTab } from './GuildHallPanel';
import { useAmbientLocation } from '../shared/LocationContext';
import { locationBackdrop } from '../shared/locationBackdrops';
import { RosterPeek } from './RosterPeek';
import { NodeHeader, NodePurse, NodeSky, NODE_TINT_HEARTH } from '../shared/NodeStage';
import { HallSigns } from './guildHallArt';
import { readGuildHallTab, writeGuildHallTab } from './guildHallTabMemory';
import { rosterHeroes } from '../../data/content';
import { useMasteryFlow } from './masteryFlow';
import { EvolutionScreen } from './EvolutionScreen';
import { MoveOfferOverlay } from './MoveOfferOverlay';
import { MasteredInnateOverlay } from './MasteredInnateOverlay';

interface Props {
  run: RunState;
  offers: GuildHallOffers;
  /** Shelf Gems sold this visit (offers.gems indices), carried on the `shop` Screen (App.tsx) because a purchase unmounts this screen through the who screen. */
  gemsBought: readonly number[];
  revivesBought: number;
  /** Tavern rerolls this visit (run/shop.ts tavernRerollCost). */
  rerolls: number;
  /** Gear-counter slots sold this visit. */
  itemsBought: readonly number[];
  onRunChange: (next: RunState) => void;
  onBuyGem: (slot: number, rosterId: string) => RunState | null;
  onBuyItem: (slot: number, rosterId: string) => RunState | null;
  onReroll: () => void;
  onBuyConsumable: (kind: ConsumableKind) => void;
  onBuyMend: () => void;
  onRequestRosterReplace: (offer: GuildHallOffer) => void;
  onContinue: () => void;
  /** The Vigil: the last node of the run — the Gems, the Gear and the Smithy, and nobody hired. */
  muster?: boolean;
}

// The `shop` node. Continue stands down while the panel has a modal open —
// otherwise two identical gold CTAs sit on screen for two different commitments.
//
// The header names the place and nothing else (2026-09-11, per user direction): the keeper, the
// name, and lantern light (the keeper replaced a hung sign 2026-09-27). "Who Will You Take" / "People and gear — for gold" were a question and
// a price list over a screen that is plainly both, and every line under a section mark went with
// them — what a hire is and what a full roster asks are said on the hero's own sheet.
export function ShopNodeScreen({
  run,
  offers,
  gemsBought,
  revivesBought,
  rerolls,
  itemsBought,
  onRunChange,
  onBuyGem,
  onBuyItem,
  onReroll,
  onBuyConsumable,
  onBuyMend,
  onRequestRosterReplace,
  onContinue,
  muster = false,
}: Props) {
  const [overlayOpen, setOverlayOpen] = useState(false);
  // The counter the player was last at this visit, across a who-screen's unmount; a visit opens on the Tavern.
  const location = useAmbientLocation();
  const hall = location ? locationBackdrop(location.id, 'hall') : undefined;
  const tabs = guildHallTabs(run, offers, muster);
  const [tab, setTab] = useState<GuildHallTab>(() => {
    const held = readGuildHallTab(tabs[0].id);
    return tabs.some((t) => t.id === held) ? held : tabs[0].id;
  });
  const selectTab = (next: GuildHallTab) => {
    setTab(next);
    writeGuildHallTab(next);
  };
  // What a bought Gem's pip opens — the Evolution at five, the mastered innate at ten — raised here, over the hall.
  const flow = useMasteryFlow(run, onRunChange);

  const evolvingEntry = flow.evolving ? (run.roster.find((r) => r.rosterId === flow.evolving!.rosterId) ?? null) : null;
  if (flow.evolving && evolvingEntry) {
    return (
      <EvolutionScreen
        hero={rosterHeroes[evolvingEntry.heroId]}
        entry={evolvingEntry}
        node={flow.evolving.node}
        run={run}
        onChoose={flow.chooseEvolution}
      />
    );
  }
  const overflowEntry = flow.overflow ? (run.roster.find((r) => r.rosterId === flow.overflow!.rosterId) ?? null) : null;
  const masteredEntry = flow.mastered ? (run.roster.find((r) => r.rosterId === flow.mastered!.rosterId) ?? null) : null;
  return (
    <div className={`node-screen shop-node-screen is-${tab}`} style={{ '--node-rgb': NODE_TINT_HEARTH } as CSSProperties}>
      {/* Inside, where a hall is painted for this Location; the act's sky and a lamp-lit hearth where not. */}
      {hall ? (
        <div className="guild-hall-interior" aria-hidden="true">
          <img src={hall} alt="" draggable={false} />
        </div>
      ) : (
        <>
          <NodeSky />
          <div className="guild-hall-hearth" aria-hidden="true" />
        </>
      )}
      <RosterPeek run={run} />
      {/* Contracts beside the gold wherever one can be bought or spent — every hall but the Vigil's, which has no Tavern. */}
      <NodePurse gold={run.gold} contracts={muster ? undefined : run.recruitContracts} />

      {/* The Smithy's own forge is its sign: six benches fit under the anvil only once the hall's is off the top. */}
      {tab !== 'smithy' && (
        <NodeHeader compact eyebrow="Welcome to" title="The Guild Hall" />
      )}

      <div className="screen-scroll">
        <GuildHallPanel
          run={run}
          offers={offers}
          gemsBought={gemsBought}
          revivesBought={revivesBought}
          rerolls={rerolls}
          itemsBought={itemsBought}
          onRunChange={onRunChange}
          onBuyGem={onBuyGem}
          onGemPlaced={(rosterId, landed, fromMastery) => flow.raise(rosterId, landed, fromMastery)}
          onBuyItem={onBuyItem}
          onReroll={onReroll}
          onBuyConsumable={onBuyConsumable}
          onBuyMend={onBuyMend}
          onRequestRosterReplace={onRequestRosterReplace}
          onOverlayChange={setOverlayOpen}
          tab={tab}
        />
      </div>

      {/* At the foot, over Continue (2026-09-11, per user direction): the counters are the
          control the thumb comes back to, and the foot is where the thumb already is. */}
      <HallSigns tabs={tabs} active={tab} onSelect={selectTab} />
      {!overlayOpen && !flow.busy && (
        <button className="resolve-button" onClick={onContinue}>
          {muster ? 'Walk on' : 'Continue'}
        </button>
      )}

      {flow.mastered && masteredEntry && <MasteredInnateOverlay entry={masteredEntry} turn={flow.mastered.turn} onClose={flow.closeMastered} />}
      {flow.overflow && overflowEntry && (
        <MoveOfferOverlay
          run={run}
          entry={overflowEntry}
          moveId={flow.overflow.queue[0]}
          eyebrow={flow.overflow.eyebrow ?? 'The Evolution grants a move, and the kit is full'}
          onResolve={flow.resolveOverflow}
        />
      )}
    </div>
  );
}
