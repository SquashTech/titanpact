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
  /** TEMPORARY DEV/TEST — App.tsx createLevel4TestRun. Remove with its Dev-menu row. */
  onStartLevel4TestRun: () => void;
  /** TEMPORARY DEV/TEST — src/run/statusTestFight.ts. */
  onStartStatusTestFight: () => void;
}

const MOTE_COUNT = 26;

/** Hold before handing off to the draft. Matched to `ui.launch` in sounds.ts — change either and re-check both. */
const LAUNCH_ANIM_MS = 620;

// Golden-angle scatter: stable across renders, no seed to store. Slow and long-lived — these
// are drifting ash, not sparks; anything under ~12s reads as energy rather than as decay.
const MOTES = Array.from({ length: MOTE_COUNT }, (_, i) => {
  const seed = i * 137.51;
  return {
    left: seed % 100,
    delay: (seed * 1.7) % 18,
    duration: 14 + ((seed * 0.37) % 12),
    size: 1.6 + ((seed * 0.13) % 3.4),
    drift: ((seed * 0.53) % 60) - 30,
    sway: ((seed * 0.29) % 34) - 17,
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
  const [showDev, setShowDev] = useState(false);
  const [launching, setLaunching] = useState(false);

  // The sound already plays from the delegated pointerdown listener (audio/uiSfx.ts).
  function handleStart() {
    if (launching) return;
    setLaunching(true);
    window.setTimeout(onStartRun, LAUNCH_ANIM_MS);
  }

  /** Every Dev row leaves the title, so none of them needs the menu left standing. */
  function runDev(action: () => void) {
    setShowDev(false);
    action();
  }

  return (
    <div className={`title-screen${launching ? ' is-launching' : ''}`}>
      <div className="title-fog" aria-hidden="true">
        <span className="title-fog-band title-fog-a" />
        <span className="title-fog-band title-fog-b" />
        <span className="title-fog-band title-fog-c" />
      </div>

      <div className="title-motes" aria-hidden="true">
        {MOTES.map((m, i) => (
          <span
            key={i}
            className="title-mote"
            style={
              {
                left: `${m.left}%`,
                width: `${m.size}px`,
                height: `${m.size}px`,
                animationDelay: `${m.delay}s`,
                animationDuration: `${m.duration}s`,
                '--drift': `${m.drift}px`,
                '--sway': `${m.sway}px`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <span className="title-grain" aria-hidden="true" />
      <span className="title-vignette" aria-hidden="true" />

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

      {/* Two entries only. Everything else on this screen is either a lookup
          tool (Reference) or scaffolding (Dev), and both are pushed to a corner
          so the choice here reads as "play" or "read". */}
      <div className="title-buttons">
        <button className="resolve-button title-cta" onClick={handleStart} disabled={launching}>
          Start a Run
        </button>
        <button className="title-compendium-button" onClick={() => setShowCompendium(true)}>
          <span className="title-compendium-icon" aria-hidden="true">
            📖
          </span>
          <span className="title-compendium-text">
            <span className="title-compendium-label">Compendium</span>
            <span className="title-compendium-sub">Heroes, moves, relics</span>
          </span>
        </button>
      </div>

      <div className="title-icon-row">
        <button className="title-icon-button" onClick={() => setShowReference(true)} aria-label="Reference" title="Reference">
          📜
        </button>
      </div>

      {/* ⚠️ TEMPORARY DEV/TEST — the whole corner. Quick/Sandbox Battle and Visit
          Location are authoring tools; the two 🧪 rows are throwaway fixtures. */}
      <div className={`title-dev${showDev ? ' is-open' : ''}`}>
        <button className="title-dev-button" onClick={() => setShowDev((open) => !open)} aria-expanded={showDev}>
          Dev
        </button>

        {showDev && (
          <div className="title-dev-menu" role="menu">
            <button className="title-dev-item" onClick={() => runDev(onQuickBattle)}>
              Quick Battle
            </button>
            <button className="title-dev-item" onClick={() => runDev(onOpenSandbox)}>
              Sandbox Battle
            </button>
            <button className="title-dev-item" onClick={() => runDev(() => setShowLocations(true))}>
              Visit Location
            </button>
            <button className="title-dev-item" onClick={() => runDev(onStartLevel4TestRun)}>
              🧪 Test: Lv4 Squad
            </button>
            <button className="title-dev-item" onClick={() => runDev(onStartStatusTestFight)}>
              🧪 Test: Status FX
            </button>
          </div>
        )}
      </div>

      {/* Plain <div>, so the delegated sfx listener leaves a dismissing tap silent. */}
      {showDev && <div className="title-dev-backdrop" onClick={() => setShowDev(false)} />}

      {showLocations && <LocationSelectOverlay onPick={onVisitLocation} onClose={() => setShowLocations(false)} />}
      {showCompendium && <CompendiumScreen onClose={() => setShowCompendium(false)} />}
      {showReference && <ReferenceOverlay onClose={() => setShowReference(false)} />}
    </div>
  );
}
