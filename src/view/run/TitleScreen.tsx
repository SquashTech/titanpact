import { useMemo, useState, type CSSProperties } from 'react';
import { CompendiumScreen } from './CompendiumScreen';
import { LocationSelectOverlay } from './LocationSelectOverlay';
import { ReferenceOverlay } from '../shared/ReferenceOverlay';

interface Props {
  onStartRun: () => void;
  onQuickBattle: () => void;
  /** Opens SandboxBattleScreen — a permanent team-builder tool, not a temp dev shortcut like the one below. */
  onOpenSandbox: () => void;
  /** Opens the chosen Location directly, with a random party of six — see App.tsx createLocationVisitRun. */
  onVisitLocation: (locationId: string) => void;
  /** ⚠️ TEMPORARY DEV/TEST — see App.tsx createLevel4TestRun. Remove this prop and its button together when Evolution work no longer needs a fast-forward. */
  onStartLevel4TestRun: () => void;
  /** ⚠️ TEMPORARY DEV/TEST — see src/run/statusTestFight.ts. Unkillable heroes whose entire movepool is status moves, for looking at the status-effect UI without playing to it. */
  onStartStatusTestFight: () => void;
}

const EMBER_COUNT = 18;

/**
 * How long "Start a Run" holds the title screen before handing off to the
 * draft (styles.css `.title-screen.is-launching`, @keyframes
 * title-launch-*). Same deferred-commit shape as LevelUpScreen's
 * LEVEL_UP_ANIM_MS: the press starts an animation, and the state change it
 * causes waits for that animation instead of cutting it off.
 *
 * Matched to `ui.launch` in sounds.ts — the slam lands with the shockwave
 * leaving the button, the bell with the screen going white — so the two
 * halves of the gesture stay one gesture. Change either and re-check both.
 */
const LAUNCH_ANIM_MS = 620;

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
  /** True from the press of Start a Run until the handoff to the draft — see LAUNCH_ANIM_MS. */
  const [launching, setLaunching] = useState(false);
  const embers = useEmbers();

  /**
   * The gate opening. The sound is already playing (the delegated
   * pointerdown listener resolves `.title-cta` to `ui.launch` — see
   * audio/uiSfx.ts), so all that is left here is to run the shockwave and
   * hold the screen long enough for it to finish.
   */
  function handleStart() {
    if (launching) return;
    setLaunching(true);
    window.setTimeout(onStartRun, LAUNCH_ANIM_MS);
  }

  return (
    <div className={`title-screen${launching ? ' is-launching' : ''}`}>
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

      {/* The shockwave and the whiteout, mounted only while launching so
          mounting them IS what starts them — no stale animation state to
          reset, the same trick LevelUpScreen's `.growth-charge` uses. The
          flash also covers the whole screen and DOES take pointer events —
          it is the shield that stops a second press landing on anything
          during the hold, which is why `data-sfx` never fires for it (a bare
          span resolves to no sound at all). */}
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
