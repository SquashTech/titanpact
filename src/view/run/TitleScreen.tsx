import { useState } from 'react';
import { CompendiumScreen } from './CompendiumScreen';
import { TypeChartOverlay } from '../shared/TypeChartOverlay';

interface Props {
  onStartRun: () => void;
  onQuickBattle: () => void;
}

/**
 * Landing screen. "Quick Battle" skips the run/map/squad-select loop
 * entirely and drops straight into a randomized 4v4 — a fast loop for
 * iterating on combat/UI without playing through a run each time.
 * "Compendium" opens a read-only hero browser (CompendiumScreen) — no run
 * state involved, so it's toggled locally rather than routed through App.tsx.
 */
export function TitleScreen({ onStartRun, onQuickBattle }: Props) {
  const [showCompendium, setShowCompendium] = useState(false);
  const [showTypeChart, setShowTypeChart] = useState(false);

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
        <button className="title-secondary-button" onClick={() => setShowCompendium(true)}>
          Compendium
        </button>
        <button className="title-secondary-button" onClick={() => setShowTypeChart(true)}>
          Type Chart
        </button>
      </div>

      {showCompendium && <CompendiumScreen onClose={() => setShowCompendium(false)} />}
      {showTypeChart && <TypeChartOverlay onClose={() => setShowTypeChart(false)} />}
    </div>
  );
}
