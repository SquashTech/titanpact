import { useMemo, useState, type CSSProperties } from 'react';
import { CompendiumScreen } from './CompendiumScreen';
import { ReferenceOverlay } from '../shared/ReferenceOverlay';

interface Props {
  onStartRun: () => void;
  onQuickBattle: () => void;
  /** Opens SandboxBattleScreen — a permanent team-builder tool, not a temp dev shortcut like the one below. */
  onOpenSandbox: () => void;
  /** ⚠️ TEMPORARY DEV/TEST — see App.tsx createLevel4TestRun. Remove this prop and its button together when Evolution work no longer needs a fast-forward. */
  onStartLevel4TestRun: () => void;
}

const EMBER_COUNT = 18;

/**
 * Ember field for .title-embers. Positions/timings are derived from a
 * golden-angle sequence (not Math.random) so the scatter is stable across
 * re-renders — no seed to store, no useEffect, just a pure function of
 * index — while still reading as organic rather than a grid.
 */
function useEmbers() {
  return useMemo(
    () =>
      Array.from({ length: EMBER_COUNT }, (_, i) => {
        const seed = i * 137.51;
        return {
          left: seed % 100,
          delay: (seed * 1.7) % 10,
          duration: 7 + ((seed * 0.37) % 6),
          size: 2 + ((seed * 0.13) % 3),
          drift: ((seed * 0.53) % 44) - 22,
        };
      }),
    []
  );
}

/**
 * Landing screen. "Quick Battle" skips the run/map/squad-select loop
 * entirely and drops straight into a randomized 4v4 — a fast loop for
 * iterating on combat/UI without playing through a run each time.
 * "Compendium" opens a read-only hero browser (CompendiumScreen) — no run
 * state involved, so it's toggled locally rather than routed through App.tsx.
 */
export function TitleScreen({ onStartRun, onQuickBattle, onOpenSandbox, onStartLevel4TestRun }: Props) {
  const [showCompendium, setShowCompendium] = useState(false);
  const [showReference, setShowReference] = useState(false);
  const embers = useEmbers();

  return (
    <div className="title-screen">
      <div className="title-embers" aria-hidden="true">
        {embers.map((e, i) => (
          <span
            key={i}
            className="title-ember"
            style={
              {
                left: `${e.left}%`,
                width: `${e.size}px`,
                height: `${e.size}px`,
                animationDelay: `${e.delay}s`,
                animationDuration: `${e.duration}s`,
                '--drift': `${e.drift}px`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <div className="title-heading">
        <div className="title-logo">
          <span className="title-ray-burst" aria-hidden="true" />
          <span className="title-core-glow" aria-hidden="true" />
          <span className="title-logo-glow" aria-hidden="true">
            TITANPACT
          </span>
          TITANPACT
        </div>
        <div className="title-tagline">Draft. Battle. Ascend.</div>
      </div>

      <div className="title-buttons">
        <button className="resolve-button title-cta" onClick={onStartRun}>
          Start a Run
        </button>
        <button className="title-secondary-button" onClick={onQuickBattle}>
          Quick Battle
        </button>
        <button className="title-secondary-button" onClick={onOpenSandbox}>
          Sandbox Battle
        </button>
        <button className="title-debug-button" onClick={onStartLevel4TestRun}>
          🧪 Test: Lv4 Squad <span className="title-debug-tag">temp</span>
        </button>
      </div>

      <div className="title-icon-row">
        <button className="title-icon-button" onClick={() => setShowCompendium(true)} aria-label="Compendium" title="Compendium">
          📖
        </button>
        <button className="title-icon-button" onClick={() => setShowReference(true)} aria-label="Reference" title="Reference">
          📜
        </button>
      </div>

      {showCompendium && <CompendiumScreen onClose={() => setShowCompendium(false)} />}
      {showReference && <ReferenceOverlay onClose={() => setShowReference(false)} />}
    </div>
  );
}
