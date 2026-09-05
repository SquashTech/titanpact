import { useState, type CSSProperties } from 'react';
import type { RunState } from '../../run/state';
import type { GuildHallOffers } from '../../run/shop';
import type { GuildHallOffer } from '../../run/recruitment';
import { GuildHallPanel } from './GuildHallPanel';
import { RosterPeek } from './RosterPeek';
import { NodeSky, NODE_TINT_MANA } from '../shared/NodeStage';

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
  return (
    <div className="node-screen shop-node-screen" style={{ '--node-rgb': NODE_TINT_MANA } as CSSProperties}>
      <NodeSky />
      {/* Full Manage Roster behind the glyph, not the read-only peek — a shop's
          question is "do I already have something better in that slot". */}
      <RosterPeek run={run} onRunChange={onRunChange} />
      <div className="screen-scroll">
        <GuildHallPanel
          run={run}
          offers={offers}
          soldOutEquipmentIds={soldOutEquipmentIds}
          onRunChange={onRunChange}
          onBuyEquipment={onBuyEquipment}
          onRequestRosterReplace={onRequestRosterReplace}
          onOverlayChange={setOverlayOpen}
          title={muster ? 'The Vigil' : 'Guild Hall'}
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
