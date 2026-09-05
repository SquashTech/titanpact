import { useState, type CSSProperties } from 'react';
import { CompendiumScreen } from './CompendiumScreen';
import { LocationSelectOverlay } from './LocationSelectOverlay';
import { ReferenceOverlay } from '../shared/ReferenceOverlay';
import { RecordsScreen } from './RecordsScreen';
import { locations } from '../../data/locations';
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

const ACT_ROMAN = ['I', 'II', 'III', 'IV', 'V'];

/** Coarse on purpose: the point is "is this the run I remember", not a timestamp. */
function savedAgo(savedAt: number, now = Date.now()): string {
  const minutes = Math.floor((now - savedAt) / 60_000);
  if (!Number.isFinite(minutes) || minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'yesterday' : `${days}d ago`;
}

function parkedRunLabel(parked: SaveSummary): string {
  const act = `Act ${ACT_ROMAN[parked.actNumber - 1] ?? parked.actNumber}`;
  const place = parked.locationId ? locations[parked.locationId]?.name : undefined;
  const heroes = `${parked.rosterSize} ${parked.rosterSize === 1 ? 'hero' : 'heroes'}`;
  return [act, place, heroes].filter(Boolean).join(' · ');
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
          so the choice here reads as "play" or "read". A parked run takes the
          primary slot: coming back to a run in progress is the likelier intent. */}
      <div className="title-buttons">
        {parkedRun && (
          <button className="resolve-button title-cta" onClick={() => launch(onContinueRun)} disabled={launching}>
            <span className="title-cta-label">Continue Run</span>
            {/* Two lines, not one wrapping one: where it breaks is then the same at every act and place. */}
            <span className="title-cta-sub">{parkedRunLabel(parkedRun)}</span>
            <span className="title-cta-sub">saved {savedAgo(parkedRun.savedAt)}</span>
          </button>
        )}
        <button
          className={
            parkedRun ? `title-newrun-button${confirmingNewRun ? ' armed' : ''}` : 'resolve-button title-cta'
          }
          onClick={handleStart}
          disabled={launching}
        >
          {parkedRun
            ? confirmingNewRun
              ? 'Tap again — this discards the parked run'
              : 'Start a New Run'
            : 'Start a Run'}
        </button>
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
