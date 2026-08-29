import type { RunState } from '../../run/state';
import type { GuildHallOffers } from '../../run/shop';
import type { GuildHallOffer } from '../../run/recruitment';
import type { CSSProperties } from 'react';
import { GuildHallPanel } from './GuildHallPanel';
import { RosterPeek } from './RosterPeek';
import { NodeSky, NODE_TINT_MANA } from '../shared/NodeStage';

interface Props {
  run: RunState;
  offers: GuildHallOffers;
  onRunChange: (next: RunState) => void;
  /** Equipment purchases route through App.tsx's forced equip-or-trash gate — GuildHallPanel can't transition to that screen itself. */
  onBuyEquipment: (itemId: string) => void;
  /** Recruiting at a full roster routes through App.tsx's RosterReplaceScreen gate — same reason as onBuyEquipment. */
  onRequestRosterReplace: (offer: GuildHallOffer) => void;
  onContinue: () => void;
}

/**
 * A `shop` map node (docs/run-loop.md): the existing GuildHallPanel, which
 * previously only ever lived inside SquadSelectScreen and had no exit of its
 * own, wrapped with a Continue button so it can stand alone as a node.
 *
 * It carried `.node-screen` from the day it was written but never actually
 * stood on the stage — no sky, no tint — so it was the one node in the run
 * loop rendered on bare page background. Giving it the sky is what lets it
 * carry the act's Location like every other node screen (docs/locations.md
 * §5.5); the tint is `NODE_TINT_MANA`, which is the same blue the Guild Hall's
 * own tile wears on the map (MapScreen's NODE_COLORS), so arriving here looks
 * like arriving at the thing you tapped.
 */
export function ShopNodeScreen({ run, offers, onRunChange, onBuyEquipment, onRequestRosterReplace, onContinue }: Props) {
  return (
    <div className="node-screen shop-node-screen" style={{ '--node-rgb': NODE_TINT_MANA } as CSSProperties}>
      <NodeSky />
      <RosterPeek run={run} />
      <div className="screen-scroll">
        <GuildHallPanel
          run={run}
          offers={offers}
          onRunChange={onRunChange}
          onBuyEquipment={onBuyEquipment}
          onRequestRosterReplace={onRequestRosterReplace}
        />
      </div>
      <button className="resolve-button" onClick={onContinue}>
        Continue
      </button>
    </div>
  );
}
