import { useState, type CSSProperties } from 'react';
import { CompendiumScreen } from './CompendiumScreen';
import { LocationSelectOverlay } from './LocationSelectOverlay';
import { ReferenceOverlay } from '../shared/ReferenceOverlay';
import { RecordsScreen } from './RecordsScreen';
import { TitanColossus, TitanRidge } from './titanArt';
import type { SaveSummary } from '../../run/save';
import type { Profile } from '../../run/profile';

interface Props {
  /** Lifetime figures and hero stars. Re-read by App whenever this screen is entered. */
  profile: Profile;
  /** Pulls a fresh profile before Records opens, so playtime is not as of screen entry. */
  onRefreshProfile: () => void;
  onEraseAllData: () => void;
  /** The parked run a Continue would resume, or null when there is none. */
  parkedRun: SaveSummary | null;
  /** Set when a stored run was refused on load — shown once so a vanished Continue is explained, not just missing. */
  staleSaveReason: string | null;
  onContinueRun: () => void;
  onStartRun: () => void;
  /** Replays the scripted first run whatever the profile says (docs/tutorial.md). */
  onReplayTutorial: () => void;
  onQuickBattle: () => void;
  onOpenSandbox: () => void;
  /** Opens the chosen Location directly with a random party — App.tsx createLocationVisitRun. */
  onVisitLocation: (locationId: string) => void;
  /** TEMPORARY DEV/TEST — App.tsx createLevel4TestRun. Remove with its Dev-menu row. */
  onStartLevel4TestRun: () => void;
  /** TEMPORARY DEV/TEST — App.tsx handleStartCrucibleTestRun. Remove with its Dev-menu row. */
  onStartCrucibleTestRun: () => void;
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

// The five seals, in the order PactSealScreen shows them (docs/lore.md §5). The fourth is
// the one that has gone out: the binding is failing at the moment the player picks it up,
// which is the entire premise, and it is cheaper to say once in a dead sigil than in copy.
// 0deg is straight UP, not along the x-axis — the CSS places a sigil with
// `rotate(a) translateY(-r)`, so the angle is measured off the vertical.
const SEAL_SIGILS = [0, 1, 2, 3, 4].map((i) => ({ angle: i * 72, broken: i === 3 }));

/**
 * The one press this screen is built around. The bezel and the specular sweep are separate
 * elements rather than shadows on the button because the plate is chamfered by a
 * `clip-path`, and a clip-path takes the box-shadow with it — so the glow lives on the
 * socket outside the clip and the sweep lives inside it.
 *
 * It carries no colour of its own: the metal is a set of custom properties declared on
 * `.title-screen` and inherited down (see `tone` in TitleScreen below).
 */
function PactButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <div className="title-cta-socket">
      <span className="title-cta-frame" aria-hidden="true" />
      <button className="resolve-button title-cta" onClick={onClick} disabled={disabled}>
        <span className="title-cta-sheen" aria-hidden="true" />
        <span className="title-cta-label">{label}</span>
      </button>
    </div>
  );
}

export function TitleScreen({
  profile,
  onRefreshProfile,
  onEraseAllData,
  parkedRun,
  staleSaveReason,
  onContinueRun,
  onStartRun,
  onReplayTutorial,
  onQuickBattle,
  onOpenSandbox,
  onVisitLocation,
  onStartLevel4TestRun,
  onStartCrucibleTestRun,
  onStartStatusTestFight,
}: Props) {
  const [showCompendium, setShowCompendium] = useState(false);
  const [showRecords, setShowRecords] = useState(false);
  const [showReference, setShowReference] = useState(false);
  const [showLocations, setShowLocations] = useState(false);
  const [showDev, setShowDev] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [confirmingNewRun, setConfirmingNewRun] = useState(false);
  const [staleNoteDismissed, setStaleNoteDismissed] = useState(false);

  // The sound already plays from the delegated pointerdown listener (audio/uiSfx.ts).
  function launch(action: () => void) {
    if (launching) return;
    setLaunching(true);
    window.setTimeout(action, LAUNCH_ANIM_MS);
  }

  /** With a run parked, starting over deletes it — so it arms first, like the in-run Abandon. */
  function handleStart() {
    if (parkedRun && !confirmingNewRun) {
      setConfirmingNewRun(true);
      return;
    }
    launch(onStartRun);
  }

  /** Every Dev row leaves the title, so none of them needs the menu left standing. */
  function runDev(action: () => void) {
    setShowDev(false);
    action();
  }

  // Which metal the whole screen is lit in: gold for a pact about to be struck, verdigris for
  // one already struck and being picked back up. It lives on the SCREEN rather than on the
  // button because the launch shockwave and white-out are siblings of the button, not children
  // of it — they can only inherit the palette from an ancestor both of them share.
  const tone = parkedRun ? 'verdigris' : 'gold';

  return (
    <div className={`title-screen is-${tone}${launching ? ' is-launching' : ''}`}>
      {/* Before the Titan, not after: the figure is a hole cut in this light. */}
      <span className="title-backlight" aria-hidden="true" />
      <TitanColossus />

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

      <TitanRidge />

      <span className="title-grain" aria-hidden="true" />
      <span className="title-vignette" aria-hidden="true" />

      <div className="title-heading">
        {/* The seal, the godrays and the bloom all hang off this wrapper rather than off
            the screen, so they track the wordmark's actual position instead of drifting
            into empty space whenever the stack below it changes. */}
        <div className="title-mark">
          <span className="title-seal" aria-hidden="true">
            <span className="title-seal-ring is-outer" />
            <span className="title-seal-ring is-mid" />
            <span className="title-seal-ring is-inner" />
            <span className="title-seal-sigils">
              {SEAL_SIGILS.map((s) => (
                <span
                  key={s.angle}
                  className={`title-seal-sigil${s.broken ? ' is-broken' : ''}`}
                  style={{ '--a': `${s.angle}deg` } as CSSProperties}
                />
              ))}
            </span>
          </span>
          <span className="title-ray-burst" aria-hidden="true" />
          <span className="title-core-glow" aria-hidden="true" />
          <div className="title-logo">
            <span className="title-logo-glow" aria-hidden="true">
              TITANPACT
            </span>
            TITANPACT
          </div>
        </div>
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
          so the choice here reads as "play" or "read". A parked run takes the
          primary slot: coming back to a run in progress is the likelier intent. */}
      <div className="title-buttons">
        {parkedRun ? (
          <>
            <PactButton label="Continue Run" disabled={launching} onClick={() => launch(onContinueRun)} />
            <button
              className={`title-newrun-button${confirmingNewRun ? ' armed' : ''}`}
              onClick={handleStart}
              disabled={launching}
            >
              {confirmingNewRun ? 'Tap again — this discards the parked run' : 'Start a New Run'}
            </button>
          </>
        ) : (
          <PactButton label="Start a Run" disabled={launching} onClick={handleStart} />
        )}
        {/* The reason itself is developer-shaped ("roster[0].unlockedMoveIds references..."), so it
            goes to the console (App.tsx) and the player gets the one fact they can act on. */}
        {staleSaveReason && !staleNoteDismissed && (
          <button className="title-stale-note" onClick={() => setStaleNoteDismissed(true)}>
            A run saved by an earlier version of the game could not be loaded, and has been cleared. Tap to dismiss.
          </button>
        )}
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
        <button
          className="title-icon-button"
          onClick={() => {
            onRefreshProfile();
            setShowRecords(true);
          }}
          aria-label="Records"
          title="Records"
        >
          🏆
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
            <button className="title-dev-item" onClick={() => runDev(onReplayTutorial)}>
              Replay Tutorial
            </button>
            <button className="title-dev-item" onClick={() => runDev(onStartLevel4TestRun)}>
              🧪 Test: Lv4 Squad
            </button>
            <button className="title-dev-item" onClick={() => runDev(onStartStatusTestFight)}>
              🧪 Test: Status FX
            </button>
            <button className="title-dev-item" onClick={() => runDev(onStartCrucibleTestRun)}>
              🧪 Test: Crucible
            </button>
          </div>
        )}
      </div>

      {/* Plain <div>, so the delegated sfx listener leaves a dismissing tap silent. */}
      {showDev && <div className="title-dev-backdrop" onClick={() => setShowDev(false)} />}

      {showLocations && <LocationSelectOverlay onPick={onVisitLocation} onClose={() => setShowLocations(false)} />}
      {showCompendium && <CompendiumScreen heroStars={profile.heroStars} onClose={() => setShowCompendium(false)} />}
      {showRecords && (
        <RecordsScreen profile={profile} onEraseAllData={onEraseAllData} onClose={() => setShowRecords(false)} />
      )}
      {showReference && <ReferenceOverlay onClose={() => setShowReference(false)} />}
    </div>
  );
}
