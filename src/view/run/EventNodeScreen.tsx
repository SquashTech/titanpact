interface Props {
  onContinue: () => void;
}

/**
 * Placeholder for the `event` map node (CLAUDE.md — "Introduce a node for
 * Events but don't create any yet, we will design these when it's time").
 * Grants nothing and has no content yet; just acknowledges the node exists
 * and lets the player continue. Replace with real event content later.
 */
export function EventNodeScreen({ onContinue }: Props) {
  return (
    <div className="node-screen">
      <div className="screen-scroll">
        <div className="reward-panel">
          <h2>❓ ???</h2>
          <p className="hint">Nothing to see here yet — Events are still being written.</p>
        </div>
      </div>
      <button className="resolve-button" onClick={onContinue}>
        Continue
      </button>
    </div>
  );
}
