import type { RunState } from '../../run/state';
import { GuildHallPanel } from './GuildHallPanel';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  onContinue: () => void;
}

/**
 * A `shop` map node (docs/run-loop.md): the existing GuildHallPanel, which
 * previously only ever lived inside SquadSelectScreen and had no exit of its
 * own, wrapped with a Continue button so it can stand alone as a node.
 */
export function ShopNodeScreen({ run, onRunChange, onContinue }: Props) {
  return (
    <div className="node-screen">
      <div className="screen-scroll">
        <GuildHallPanel run={run} onRecruit={onRunChange} />
        <p className="hint">Spend your gold, then continue.</p>
      </div>
      <button className="resolve-button" onClick={onContinue}>
        Continue
      </button>
    </div>
  );
}
