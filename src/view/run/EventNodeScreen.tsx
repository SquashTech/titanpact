import type { CSSProperties } from 'react';
import type { RunState } from '../../run/state';
import { NodeHeader, NodeSky, NODE_TINT_ARCANE } from '../shared/NodeStage';
import { RosterPeek } from './RosterPeek';

interface Props {
  run: RunState;
  onContinue: () => void;
}

/**
 * Placeholder for the `event` map node (CLAUDE.md — "Introduce a node for
 * Events but don't create any yet, we will design these when it's time").
 * Grants nothing and has no content yet; just acknowledges the node exists
 * and lets the player continue. Replace with real event content later.
 *
 * It stands on the shared node stage (docs/visual-language.md, ninth pass)
 * even while empty — a node with nothing in it should still read as a place
 * you walked into, and when the real content arrives it inherits the frame
 * every other node already uses.
 */
export function EventNodeScreen({ run, onContinue }: Props) {
  return (
    <div className="node-screen" style={{ '--node-rgb': NODE_TINT_ARCANE } as CSSProperties}>
      <NodeSky />
      <RosterPeek run={run} />
      <NodeHeader
        eyebrow="Something Stirs"
        title="???"
        readout="Nothing to see here yet — Events are still being written."
      />
      <div className="node-spacer" />
      <button className="resolve-button" onClick={onContinue}>
        Continue
      </button>
    </div>
  );
}
