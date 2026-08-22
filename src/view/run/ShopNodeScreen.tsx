import type { RunState } from '../../run/state';
import type { GuildHallOffers } from '../../run/shop';
import type { GuildHallOffer } from '../../run/recruitment';
import { GuildHallPanel } from './GuildHallPanel';

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
 */
export function ShopNodeScreen({ run, offers, onRunChange, onBuyEquipment, onRequestRosterReplace, onContinue }: Props) {
  return (
    <div className="node-screen">
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
