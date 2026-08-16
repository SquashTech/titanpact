interface Props {
  onStartRun: () => void;
  onQuickBattle: () => void;
}

/**
 * Landing screen. "Quick Battle" skips the run/map/squad-select loop
 * entirely and drops straight into a randomized 4v4 — a fast loop for
 * iterating on combat/UI without playing through a run each time.
 */
export function TitleScreen({ onStartRun, onQuickBattle }: Props) {
  return (
    <div className="title-screen">
      <div className="title-logo">TITANPACT</div>
      <p className="hint title-tagline">Doubles tactical roguelike</p>
      <div className="title-buttons">
        <button className="resolve-button" onClick={onStartRun}>
          Start a Run
        </button>
        <button className="title-secondary-button" onClick={onQuickBattle}>
          Quick Battle
        </button>
      </div>
    </div>
  );
}
