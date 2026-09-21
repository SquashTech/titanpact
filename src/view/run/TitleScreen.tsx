import { useState, type CSSProperties } from 'react';
import { CompendiumScreen } from './CompendiumScreen';
import { LocationSelectOverlay } from './LocationSelectOverlay';
import { ReferenceOverlay } from '../shared/ReferenceOverlay';
import { RecordsScreen } from './RecordsScreen';
import { STAR_SHOP_NAME, StarShopScreen } from './StarShopScreen';
import { starShopCatalog } from '../../data/starShop';
import { starBalance, type StarShopOffer } from '../../run/starShop';
import { TitanColossus, TitanRidge } from './titanArt';
import { SealArt } from '../shared/SealArt';
import { HubGlyph } from '../shared/nodeIcons';
import { AudioSettings } from '../shared/AudioSettings';
import type { SaveSummary } from '../../run/save';
import type { Profile } from '../../run/profile';

interface Props {
  /** Lifetime figures and hero stars. Re-read by App whenever this screen is entered. */
  profile: Profile;
  /** Pulls a fresh profile before Records opens, so playtime is not as of screen entry. */
  onRefreshProfile: () => void;
  onEraseAllData: () => void;
  /** Spends stars on a Constellation offer (run/starShop.ts buyOffer) and re-reads the profile. */
  onBuyOffer: (offer: StarShopOffer) => void;
  /** Equips a held Starter Pack for the next run (run/starterPacks.ts equipPack) and re-reads the profile. */
  onEquipPack: (packId: string) => void;
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
  /** TEMPORARY DEV/TEST — App.tsx createTitanEyesTestRun. Remove with its Dev-menu row. */
  onStartTitanEyesTestRun: () => void;
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

// The fourth sigil is the one that has gone out (SealArt.tsx): the binding is failing at the
// moment the player picks it up, which is the entire premise, and it is cheaper to say once in
// a dead sigil than in copy.
const BROKEN_SIGIL = 3;

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
  onBuyOffer,
  onEquipPack,
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
  onStartTitanEyesTestRun,
}: Props) {
  const [showCompendium, setShowCompendium] = useState(false);
  const [showRecords, setShowRecords] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showReference, setShowReference] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
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

  /** With a run parked, starting over deletes it — so it asks first. */
  function handleStart() {
    if (parkedRun) {
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
          <SealArt brokenIndex={BROKEN_SIGIL} />
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

      {/* One entry: play. Everything else on this screen is a lookup tool or
          scaffolding, and all of it is pushed to the bottom edge so the middle
          of the screen is the seal and the press that leaves it. A parked run
          takes the primary slot: coming back to a run in progress is the
          likelier intent. */}
      <div className="title-buttons">
        {parkedRun ? (
          <>
            <PactButton label="Continue Run" disabled={launching} onClick={() => launch(onContinueRun)} />
            <button className="title-newrun-button" onClick={handleStart} disabled={launching}>
              Start a New Run
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
      </div>

      {/* The three places a player goes BETWEEN runs (2026-09-16, per user direction — they were
          three 36px circles in the corner, which is what a lookup tool deserves and a shop does
          not): the Compendium, the shop with its star balance on it, and Records. Labelled tiles
          under the one real action, quieter than it and louder than the corner. */}
      <div className="title-hub">
        <button className="title-hub-tile" onClick={() => setShowCompendium(true)}>
          <span className="title-hub-glyph" aria-hidden="true">
            <HubGlyph name="codex" />
          </span>
          <span className="title-hub-label">Compendium</span>
        </button>
        <button
          className="title-hub-tile is-shop"
          onClick={() => {
            onRefreshProfile();
            setShowShop(true);
          }}
        >
          <span className="title-hub-glyph" aria-hidden="true">
            <HubGlyph name="star" />
          </span>
          {/* Without its article: the tile is a place-name on a sign, the panel header the full name. */}
          <span className="title-hub-label">{STAR_SHOP_NAME.replace(/^The /, '')}</span>
          <span className="title-hub-badge" title={`${starBalance(profile, starShopCatalog)} stars to spend`}>
            ★ {starBalance(profile, starShopCatalog)}
          </span>
        </button>
        <button
          className="title-hub-tile"
          onClick={() => {
            onRefreshProfile();
            setShowRecords(true);
          }}
        >
          <span className="title-hub-glyph" aria-hidden="true">
            <HubGlyph name="trophy" />
          </span>
          <span className="title-hub-label">Records</span>
        </button>
      </div>

      {/* Reference and Options stay corner glyphs: a lookup mid-thought and a dial, not somewhere you go. */}
      <div className="title-icon-row">
        <button className="title-icon-button" onClick={() => setShowReference(true)} aria-label="Reference" title="Reference">
          <HubGlyph name="reference" />
        </button>
        <button className="title-icon-button" onClick={() => setShowOptions(true)} aria-label="Options" title="Options">
          <HubGlyph name="menu" />
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
            <button className="title-dev-item" onClick={() => runDev(onStartTitanEyesTestRun)}>
              👁️ Test: Titan's Eyes
            </button>
          </div>
        )}
      </div>

      {/* Plain <div>, so the delegated sfx listener leaves a dismissing tap silent. */}
      {showDev && <div className="title-dev-backdrop" onClick={() => setShowDev(false)} />}

      {/* Starting over with a run parked deletes it, so it asks — a sheet, not a
          re-labelled button, because a button that changes what it says under
          the thumb is the one that gets pressed twice by accident. */}
      {confirmingNewRun && (
        <div className="log-overlay" onClick={() => setConfirmingNewRun(false)}>
          <div className="log-panel title-confirm-panel" onClick={(e) => e.stopPropagation()}>
            <div className="title-confirm-title">Start a new run?</div>
            <p className="title-confirm-copy">
              The parked run is deleted — its roster, gear and progress are gone for good.
            </p>
            <button
              className="options-item options-item-danger"
              onClick={() => {
                setConfirmingNewRun(false);
                launch(onStartRun);
              }}
            >
              <span className="options-item-glyph" aria-hidden="true">
                <HubGlyph name="discard" />
              </span>
              Discard it and start over
            </button>
            <button className="options-item" onClick={() => setConfirmingNewRun(false)}>
              Keep the run
            </button>
          </div>
        </div>
      )}

      {showLocations && <LocationSelectOverlay onPick={onVisitLocation} onClose={() => setShowLocations(false)} />}
      {showCompendium && <CompendiumScreen profile={profile} onClose={() => setShowCompendium(false)} />}
      {showRecords && (
        <RecordsScreen profile={profile} onEraseAllData={onEraseAllData} onClose={() => setShowRecords(false)} />
      )}
      {showReference && <ReferenceOverlay onClose={() => setShowReference(false)} />}
      {/* Same markup as the map's and FightScreen's Options panel, without the run rows. */}
      {showOptions && (
        <div className="log-overlay" onClick={() => setShowOptions(false)}>
          <div className="log-panel options-panel" onClick={(e) => e.stopPropagation()}>
            <div className="log-panel-header">
              <span>Options</span>
              <button className="log-close-button" onClick={() => setShowOptions(false)}>
                ✕
              </button>
            </div>
            <div className="options-list">
              <AudioSettings />
              <button className="options-item" onClick={() => setShowOptions(false)}>
                <span className="options-item-glyph" aria-hidden="true">
                  ▶
                </span>
                Back
              </button>
            </div>
          </div>
        </div>
      )}
      {showShop && <StarShopScreen profile={profile} onBuy={onBuyOffer} onEquipPack={onEquipPack} onClose={() => setShowShop(false)} />}
    </div>
  );
}
