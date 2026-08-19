import { useState } from 'react';
import { CompendiumScreen } from './CompendiumScreen';
import { ReferenceOverlay } from '../shared/ReferenceOverlay';

interface Props {
  onStartRun: () => void;
  onQuickBattle: () => void;
  /** ⚠️ TEMPORARY DEV/TEST — see App.tsx createLevel4TestRun. Remove this prop and its button together when Evolution work no longer needs a fast-forward. */
  onStartLevel4TestRun: () => void;
  /** ⚠️ TEMPORARY DEV/TEST — see App.tsx createConditionsTestEncounter. Remove this prop and its button together once Conduct/Poison/Haunt/Stealth no longer need a dedicated browser playtest. */
  onStartConditionsTest: () => void;
}

/**
 * Landing screen. "Quick Battle" skips the run/map/squad-select loop
 * entirely and drops straight into a randomized 4v4 — a fast loop for
 * iterating on combat/UI without playing through a run each time.
 * "Compendium" opens a read-only hero browser (CompendiumScreen) — no run
 * state involved, so it's toggled locally rather than routed through App.tsx.
 */
export function TitleScreen({ onStartRun, onQuickBattle, onStartLevel4TestRun, onStartConditionsTest }: Props) {
  const [showCompendium, setShowCompendium] = useState(false);
  const [showReference, setShowReference] = useState(false);

  return (
    <div className="title-screen">
      <div className="title-logo">TITANPACT</div>
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
        <button className="title-secondary-button" onClick={() => setShowReference(true)}>
          Reference
        </button>
        <button className="title-debug-button" onClick={onStartLevel4TestRun}>
          🧪 Test: Lv4 Squad <span className="title-debug-tag">temp</span>
        </button>
        <button className="title-debug-button" onClick={onStartConditionsTest}>
          🧪 Test: Conditions <span className="title-debug-tag">temp</span>
        </button>
      </div>

      {showCompendium && <CompendiumScreen onClose={() => setShowCompendium(false)} />}
      {showReference && <ReferenceOverlay onClose={() => setShowReference(false)} />}
    </div>
  );
}
