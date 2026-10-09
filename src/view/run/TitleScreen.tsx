import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { CollectionScreen } from './CollectionScreen';
import type { Deck } from '../../run/deck';
import { LocationSelectOverlay } from './LocationSelectOverlay';
import { ReferenceOverlay } from '../shared/ReferenceOverlay';
import { RecordsScreen } from './RecordsScreen';
import { StarShopScreen } from './StarShopScreen';
import { HUB_TABS, HubNav, type HubTab } from './HubNav';
import { starShopCatalog } from '../../data/starShop';
import { starBalance, type StarShopOffer } from '../../run/starShop';
import { TitanColossus, TitanRidge } from './titanArt';
import { SealArt } from '../shared/SealArt';
import { HubGlyph } from '../shared/nodeIcons';
import { FIRST_CYCLE } from '../../run/cycles';
import { chronicleBand, chronicleLines, chronicleWovenTipId, pendingWeave } from '../../run/chronicle';
import { heroes } from '../../data/heroes';
import { CycleTapestry } from './CycleTapestry';
import { AudioSettings } from '../shared/AudioSettings';
import type { SaveSummary } from '../../run/save';
import type { Profile } from '../../run/profile';
import { isConstructedOpen } from '../../run/constructed';
import { isGauntletOpen } from '../../run/gauntlet';
import recordsArt from '../../../art/ui/records.png';
import { ModeArrows, ModeLight, ModeRail, ModeStage, PactButton, TITLE_MODES, type TitleMode } from './TitleModes';

interface Props {
  /** Lifetime figures and hero stars. Re-read by App whenever this screen is entered. */
  profile: Profile;
  /** Pulls a fresh profile before Records opens, so playtime is not as of screen entry. */
  onRefreshProfile: () => void;
  onEraseAllData: () => void;
  /** Spends stars on a Constellation offer (run/starShop.ts buyOffer) and re-reads the profile. */
  onBuyOffer: (offer: StarShopOffer) => void;
  /** One Starfall (run/starShop.ts starfall), written to the profile; returns the hero drawn. */
  onStarfall: () => string;
  /** Writes the edited deck to the profile (run/deck.ts) and re-reads it. */
  onChangeDeck: (deck: Deck) => void;
  /** The parked run a Continue would resume, or null when there is none. */
  parkedRun: SaveSummary | null;
  /** Set when a stored run was refused on load — shown once so a vanished Continue is explained, not just missing. */
  staleSaveReason: string | null;
  /** A line about the save the player can act on or should know: restored from a backup, or storage full. */
  saveNotice?: string | null;
  onContinueRun: () => void;
  /** Start a run on the given Cycle (run/cycles.ts). */
  onStartRun: (cycle: number) => void;
  /** The highest Cycle the profile may start on; Cycle I until a run has been cleared. */
  openCycle: number;
  /** Records a seen-once beat (the Chronicle weave) in the profile. */
  onSeeTip: (id: string) => void;
  /** Forgets every first-time tip seen, and the lore card, so each shows again (docs/tutorial.md). */
  onResetTips: () => void;
  /** TEMPORARY DEV/TEST — App.tsx handleGrantDevStars: +50 stars to test the Constellation and the stakes. */
  onGrantDevStars: () => void;
  onQuickBattle: () => void;
  onOpenSandbox: () => void;
  onOpenTrials: () => void;
  /** The teambuilder; `unlockAll` from the dev corner only. Offered once a Classic run has been won. */
  onOpenConstructed: (unlockAll?: boolean) => void;
  /** The Gauntlet (docs/gauntlet.md), offered from the same win as the Trials. */
  onOpenGauntlet: () => void;
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

/** How far a drag must run sideways, and how much straighter than it is tall, to turn the page. */
const SWIPE_MIN_PX = 48;
const SWIPE_SLOPE = 1.4;

/** How long a locked door's note floats before it goes. */
const LOCKED_NOTE_MS = 2200;

export function TitleScreen({
  profile,
  onRefreshProfile,
  onEraseAllData,
  onBuyOffer,
  onStarfall,
  onChangeDeck,
  parkedRun,
  staleSaveReason,
  saveNotice = null,
  onContinueRun,
  onStartRun,
  openCycle,
  onSeeTip,
  onResetTips,
  onGrantDevStars,
  onQuickBattle,
  onOpenSandbox,
  onOpenTrials,
  onOpenConstructed,
  onOpenGauntlet,
  onVisitLocation,
  onStartLevel4TestRun,
  onStartCrucibleTestRun,
  onStartStatusTestFight,
  onStartTitanEyesTestRun,
}: Props) {
  const [showRecords, setShowRecords] = useState(false);
  const [tab, setTab] = useState<HubTab>('play');
  /** Which way the page slid in: +1 from the left, -1 from the right. */
  const [slide, setSlide] = useState(0);
  const [freshHeroId, setFreshHeroId] = useState<string | null>(null);
  const [collectionSeen, setCollectionSeen] = useState(true);
  const [showReference, setShowReference] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showLocations, setShowLocations] = useState(false);
  const [showDev, setShowDev] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [confirmingNewRun, setConfirmingNewRun] = useState(false);
  // The weave is chosen as the tapestry opens and held, since marking it seen re-renders the profile.
  const [pickingCycle, setPickingCycle] = useState<{ weave?: number } | null>(null);
  const [staleNoteDismissed, setStaleNoteDismissed] = useState(false);
  const [mode, setMode] = useState<TitleMode>('pact');
  /** Which way the mode page slid in: +1 from the right, -1 from the left. */
  const [modeSlide, setModeSlide] = useState(0);
  /** A locked door's note, keyed so a second tap restarts its float. */
  const [lockedNote, setLockedNote] = useState<{ text: string; key: number } | null>(null);
  const swipe = useRef<{ x: number; y: number; id: number } | null>(null);
  /** Set when a drag turned the page, so the click that ends it does not also press what it ended on. */
  const swiped = useRef(false);

  useEffect(() => {
    if (!lockedNote) return;
    const id = window.setTimeout(() => setLockedNote(null), LOCKED_NOTE_MS);
    return () => window.clearTimeout(id);
  }, [lockedNote]);

  function selectMode(next: TitleMode) {
    if (next === mode || launching) return;
    setModeSlide(Math.sign(TITLE_MODES.indexOf(next) - TITLE_MODES.indexOf(mode)));
    setMode(next);
    setLockedNote(null);
  }

  function stepMode(delta: number) {
    const next = TITLE_MODES[TITLE_MODES.indexOf(mode) + delta];
    if (next) selectMode(next);
  }

  function showLocked(text: string) {
    setLockedNote({ text, key: Date.now() });
  }

  /** Pages turn only on the bare title — never under a sheet or a menu standing over it. */
  const pagesTurn = tab === 'play' && !confirmingNewRun && !pickingCycle && !showRecords && !showReference && !showOptions && !showLocations && !showDev;

  function handlePointerDown(e: ReactPointerEvent) {
    swiped.current = false;
    swipe.current = pagesTurn && e.isPrimary ? { x: e.clientX, y: e.clientY, id: e.pointerId } : null;
  }

  function handlePointerUp(e: ReactPointerEvent) {
    const start = swipe.current;
    swipe.current = null;
    if (!start || start.id !== e.pointerId) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * SWIPE_SLOPE) return;
    swiped.current = true;
    // The click, if one follows, is dispatched in this same input task; a drag that ended off its
    // start element has none, and must not leave the flag to swallow the next real tap.
    window.setTimeout(() => (swiped.current = false), 0);
    stepMode(dx < 0 ? 1 : -1);
  }

  useEffect(() => {
    if (!pagesTurn) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') stepMode(-1);
      if (e.key === 'ArrowRight') stepMode(1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

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
    startFresh();
  }

  /** Nothing to ask until Cycle I is cleared; then the Cycle is the one question between the press and the draft. */
  function startFresh() {
    if (openCycle > FIRST_CYCLE) {
      const weave = pendingWeave(profile);
      if (weave) onSeeTip(chronicleWovenTipId(weave));
      setPickingCycle({ weave });
      return;
    }
    launch(() => onStartRun(FIRST_CYCLE));
  }

  function selectTab(next: HubTab) {
    setSlide(Math.sign(HUB_TABS.indexOf(next) - HUB_TABS.indexOf(tab)));
    setTab(next);
    if (next === 'constellation') onRefreshProfile();
    if (next === 'collection') setCollectionSeen(true);
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

  const balance = starBalance(profile, starShopCatalog);

  return (
    <div
      className={`title-screen is-${tone} is-mode-${mode}${launching ? ' is-launching' : ''}${tab !== 'play' ? ' is-away' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => (swipe.current = null)}
      onClickCapture={(e) => {
        if (!swiped.current) return;
        swiped.current = false;
        e.stopPropagation();
        e.preventDefault();
      }}
    >
      {/* The Play page is the title itself; its layers stay mounted under the other pages so coming
          back is instant, and display: contents keeps them in the screen's own flex and stacking. */}
      <div className="title-play">
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
          <SealArt />
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
          <PactButton label="Seal the Pact" disabled={launching} onClick={handleStart} />
        )}
        {/* The reason itself is developer-shaped ("roster[0].unlockedMoveIds references..."), so it
            goes to the console (App.tsx) and the player gets the one fact they can act on. */}
        {staleSaveReason && !staleNoteDismissed && (
          <button className="title-stale-note" onClick={() => setStaleNoteDismissed(true)}>
            A run saved by an earlier version of the game could not be loaded, and has been cleared. Tap to dismiss.
          </button>
        )}
        {!staleSaveReason && saveNotice && !staleNoteDismissed && (
          <button className="title-stale-note" onClick={() => setStaleNoteDismissed(true)}>
            {saveNotice} Tap to dismiss.
          </button>
        )}
        {/* The mode rail floats at the foot of the stack; this holds its place, so the seal does not move. */}
        <span className="title-mode-rail-seat" aria-hidden="true" />
      </div>

      {/* The other two doors (docs/gauntlet.md §7) are pages either side of this one. */}
      {mode !== 'pact' && <ModeLight mode={mode} />}
      {mode !== 'pact' && (
        <ModeStage
          mode={mode}
          profile={profile}
          open={mode === 'trials' ? isConstructedOpen(profile) : isGauntletOpen(profile)}
          disabled={launching}
          direction={modeSlide}
          onOpen={mode === 'trials' ? () => onOpenConstructed() : onOpenGauntlet}
          onLocked={() => showLocked(mode === 'trials' ? 'Win a run to open the Trials.' : 'Win a run to open the Gauntlet.')}
        />
      )}
      <ModeArrows mode={mode} onSelect={selectMode} />
      <ModeRail mode={mode} onSelect={selectMode} />
      {lockedNote && (
        <div key={lockedNote.key} className="title-locked-toast" role="status">
          {lockedNote.text}
        </div>
      )}

      {/* Records, Reference and Options are corner glyphs: a ledger, a lookup and a dial, not places. */}
      <button
        className="title-records-button"
        onClick={() => {
          onRefreshProfile();
          setShowRecords(true);
        }}
        aria-label="Records"
        title="Records"
      >
        <img src={recordsArt} alt="" draggable={false} />
      </button>
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
            <button className="title-dev-item" onClick={() => runDev(onOpenTrials)}>
              Trials
            </button>
            <button className="title-dev-item" onClick={() => runDev(() => onOpenConstructed(true))}>
              🧪 Constructed: every hero
            </button>
            <button className="title-dev-item" onClick={() => runDev(() => setShowLocations(true))}>
              Visit Location
            </button>
            <button className="title-dev-item" onClick={() => runDev(onGrantDevStars)}>
              ⭐ +50 Stars
            </button>
            <button className="title-dev-item" onClick={() => runDev(onResetTips)}>
              Reset Tips
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
      </div>

      {tab === 'collection' && (
        <div className="hub-slot" style={{ '--slide': slide } as CSSProperties}>
          <CollectionScreen profile={profile} onChangeDeck={onChangeDeck} onBuy={onBuyOffer} freshHeroId={freshHeroId} />
        </div>
      )}
      {tab === 'constellation' && (
        <div className="hub-slot" style={{ '--slide': slide } as CSSProperties}>
          <StarShopScreen
            profile={profile}
            onBuy={onBuyOffer}
            onStarfall={onStarfall}
            freshHeroId={freshHeroId}
            onHeroFallen={(heroId) => {
              setFreshHeroId(heroId);
              setCollectionSeen(false);
            }}
          />
        </div>
      )}

      <HubNav tab={tab} onSelect={selectTab} balance={balance} collectionFresh={!collectionSeen} disabled={launching} />

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
                startFresh();
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

      {/* The Cycles (docs/cycles.md §4) as the Chronicle: every open one selectable, the rest woven ahead as bare warp. */}
      {pickingCycle && (
        <CycleTapestry
          openCycle={openCycle}
          cleared={profile.cyclesCleared}
          wardens={chronicleBand(profile)}
          chronicle={chronicleLines(profile, (id) => heroes[id]?.name)}
          weaveCycle={pickingCycle.weave}
          onBegin={(cycle) => {
            setPickingCycle(null);
            launch(() => onStartRun(cycle));
          }}
          onClose={() => setPickingCycle(null)}
        />
      )}

      {showLocations && <LocationSelectOverlay onPick={onVisitLocation} onClose={() => setShowLocations(false)} />}
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
    </div>
  );
}
