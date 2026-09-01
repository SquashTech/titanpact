import { useState, type CSSProperties } from 'react';
import { CompendiumScreen } from './CompendiumScreen';
import { LocationSelectOverlay } from './LocationSelectOverlay';
import { ReferenceOverlay } from '../shared/ReferenceOverlay';

interface Props {
  onStartRun: () => void;
  onQuickBattle: () => void;
  onOpenSandbox: () => void;
  /** Opens the chosen Location directly with a random party — App.tsx createLocationVisitRun. */
  onVisitLocation: (locationId: string) => void;
  /** TEMPORARY DEV/TEST — App.tsx createLevel4TestRun. Remove with its button. */
  onStartLevel4TestRun: () => void;
  /** TEMPORARY DEV/TEST — src/run/statusTestFight.ts. */
  onStartStatusTestFight: () => void;
}

const EMBER_COUNT = 18;

/** Hold before handing off to the draft. Matched to `ui.launch` in sounds.ts — change either and re-check both. */
const LAUNCH_ANIM_MS = 620;

// Golden-angle scatter: stable across renders, no seed to store.
const EMBERS = Array.from({ length: EMBER_COUNT }, (_, i) => {
  const seed = i * 137.51;
  return {
    left: seed % 100,
    delay: (seed * 1.7) % 10,
    duration: 7 + ((seed * 0.37) % 6),
    size: 2 + ((seed * 0.13) % 3),
    drift: ((seed * 0.53) % 44) - 22,
  };
});

export function TitleScreen({
  onStartRun,
  onQuickBattle,
  onOpenSandbox,
  onVisitLocation,
  onStartLevel4TestRun,
  onStartStatusTestFight,
}: Props) {
  const [showCompendium, setShowCompendium] = useState(false);
  const [showReference, setShowReference] = useState(false);
  const [showLocations, setShowLocations] = useState(false);
  const [launching, setLaunching] = useState(false);

  // The sound already plays from the delegated pointerdown listener (audio/uiSfx.ts).
  function handleStart() {
    if (launching) return;
    setLaunching(true);
    window.setTimeout(onStartRun, LAUNCH_ANIM_MS);
  }

  return (
    <div className={`title-screen${launching ? ' is-launching' : ''}`}>
      <div className="title-embers" aria-hidden="true">
        {EMBERS.map((e, i) => (
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

      {/* Mounted only while launching, so mounting starts them. The flash
          takes pointer events on purpose — it shields against a second press. */}
      {launching && (
        <>
          <span className="title-launch-ring" aria-hidden="true" />
          <span className="title-launch-flash" aria-hidden="true" />
        </>
      )}

      <div className="title-buttons">
        <button className="resolve-button title-cta" onClick={handleStart} disabled={launching}>
          Start a Run
        </button>
        <button className="title-secondary-button" onClick={onQuickBattle}>
          Quick Battle
        </button>
        <button className="title-secondary-button" onClick={onOpenSandbox}>
          Sandbox Battle
        </button>
        <button className="title-secondary-button" onClick={() => setShowLocations(true)}>
          Visit Location
        </button>
        <button className="title-debug-button" onClick={onStartLevel4TestRun}>
          🧪 Test: Lv4 Squad <span className="title-debug-tag">temp</span>
        </button>
        <button className="title-debug-button" onClick={onStartStatusTestFight}>
          🧪 Test: Status FX <span className="title-debug-tag">temp</span>
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

      {showLocations && <LocationSelectOverlay onPick={onVisitLocation} onClose={() => setShowLocations(false)} />}
      {showCompendium && <CompendiumScreen onClose={() => setShowCompendium(false)} />}
      {showReference && <ReferenceOverlay onClose={() => setShowReference(false)} />}
    </div>
  );
}
