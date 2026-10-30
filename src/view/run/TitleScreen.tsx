import { useEffect, useState, type CSSProperties } from 'react';
import { CollectionScreen } from './CollectionScreen';
import type { Deck } from '../../run/deck';
import { LocationSelectOverlay } from './LocationSelectOverlay';
import { ReferenceOverlay } from '../shared/ReferenceOverlay';
import { RecordsScreen } from './RecordsScreen';
import { StarShopScreen } from './StarShopScreen';
import { HUB_TABS, HubNav, type HubTab } from './HubNav';
import { starShopCatalog } from '../../data/starShop';
import { canCallStarfall, stardustBalance, type StarShopOffer } from '../../run/starShop';
import { isConstellationLit, isDrawnInByPlay, skyLightingTipId } from '../../run/sky';
import { sky } from '../../data/sky';
import { GuideHand } from '../story/GuideHand';
import { GalaxySky } from './GalaxySky';
import { TitleLogo } from './TitleLogo';
import { HubGlyph } from '../shared/nodeIcons';
import { FIRST_CYCLE } from '../../run/cycles';
import { pendingWeave } from '../../run/chronicle';
import { AudioSettings } from '../shared/AudioSettings';
import type { SaveSummary } from '../../run/save';
import type { Profile } from '../../run/profile';
import recordsArt from '../../../art/ui/records.png';
import { PactButton } from './PactButton';
import { SEAT, SkyChart, type SkyPlay } from './SkyChart';
import { BlipGuide } from './BlipGuide';
import type { ThoughtDefinition } from '../../run/thoughts';
import { readEnemyIntent, writeEnemyIntent } from '../combat/enemyIntent';

/** First Light's tour (docs/the-sky.md §2e), each step remembered once an account. */
const TOUR_STARFALL = 'tour.firstLight.starfall';
const TOUR_DONE = 'tour.firstLight.done';
/** To the Observatory's tab, its Call, the Starfall playing, back to Play, Blip home to its seat; `infinite` closes it. */
type TourStep = 'toObservatory' | 'pulling' | 'falling' | 'fallen' | 'home' | 'infinite';
/** Where Blip and the hand point at each step that waits on a tap. */
const TOUR_TARGETS: Partial<Record<TourStep, string>> = {
  toObservatory: '.hub-nav-tab.is-sky',
  pulling: '.sky-call',
  fallen: '.hub-nav-play',
};

/** Owed once First Light is drawn in by play and its finale has played; the Starfall is skipped when it cannot be afforded. */
function owedTour(profile: Profile): TourStep | null {
  const firstLight = sky.constellations.firstLight;
  if (!isDrawnInByPlay(profile, firstLight) || !profile.seenTipIds.includes(skyLightingTipId(firstLight.id)) || profile.seenTipIds.includes(TOUR_DONE)) return null;
  return profile.seenTipIds.includes(TOUR_STARFALL) ? 'infinite' : 'toObservatory';
}

interface Props {
  /** Lifetime figures and hero stars. Re-read by App whenever this screen is entered. */
  profile: Profile;
  /** Pulls a fresh profile before Records opens, so playtime is not as of screen entry. */
  onRefreshProfile: () => void;
  onEraseAllData: () => void;
  /** Spends stars on a Observatory offer (run/starShop.ts buyOffer) and re-reads the profile. */
  onBuyOffer: (offer: StarShopOffer) => void;
  /** A Starfall of one or ten (run/starShop.ts), written to the profile; returns the heroes drawn. */
  onStarfall: (count: 1 | 10) => string[];
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
  /** How the Infinite run just played ended, for Blip to react to once; null otherwise. */
  skyReturn?: 'win' | 'loss' | null;
  onSkyReturnSeen?: () => void;
  /** One of Blip's firsts, thought: kept once an account (run/thoughts.ts). */
  onSeeThought?: (thought: ThoughtDefinition) => void;
  /** A First Light lesson, by its scenario id (data/sky.ts). */
  onPlayLesson?: (scenarioId: string) => void;
  /** A card is up over the title: the sky holds its beats, the opening among them, until it closes. */
  held?: boolean;
  /** Forgets every first-time tip seen, and the lore card, so each shows again (docs/tutorial.md). */
  onResetTips: () => void;
  /** TEMPORARY DEV/TEST — App.tsx handleGrantDevStars: +2,500 Stardust to test the Observatory and the stakes. */
  onGrantDevStars: () => void;
  onQuickBattle: () => void;
  onOpenSandbox: () => void;
  onOpenTrials: () => void;
  /** The teambuilder; `unlockAll` from the dev corner only. Offered once a Classic run has been won. */
  onOpenConstructed: (unlockAll?: boolean) => void;
  /** The Gauntlet (docs/gauntlet.md), offered from the same win as the Trials. */
  onOpenGauntlet: () => void;
  onOpenVersus: (local: boolean) => void;
  /** Opens the chosen Location directly with a random party — App.tsx createLocationVisitRun. */
  onVisitLocation: (locationId: string) => void;
  /** TEMPORARY DEV/TEST — App.tsx createLevel4TestRun. Remove with its Dev-menu row. */
  onStartLevel4TestRun: () => void;
  /** TEMPORARY DEV/TEST — App.tsx handleStartAcademyTestRun. Remove with its Dev-menu row. */
  onStartAcademyTestRun: () => void;
  /** TEMPORARY DEV/TEST — src/run/statusTestFight.ts. */
  onStartStatusTestFight: () => void;
  /** TEMPORARY DEV/TEST — App.tsx createTitanEyesTestRun. Remove with its Dev-menu row. */
  onStartTitanEyesTestRun: () => void;
}

/** Hold before handing off to the draft. Matched to `ui.launch` in sounds.ts — change either and re-check both. */
const LAUNCH_ANIM_MS = 620;

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
  skyReturn = null,
  onSkyReturnSeen,
  onSeeThought,
  onPlayLesson,
  held = false,
  onResetTips,
  onGrantDevStars,
  onQuickBattle,
  onOpenSandbox,
  onOpenTrials,
  onOpenConstructed,
  onOpenGauntlet,
  onOpenVersus,
  onVisitLocation,
  onStartLevel4TestRun,
  onStartAcademyTestRun,
  onStartStatusTestFight,
  onStartTitanEyesTestRun,
}: Props) {
  const [showRecords, setShowRecords] = useState(false);
  const [tab, setTab] = useState<HubTab>('play');
  // A new account sees First Light and nothing else until it is won; then the tour shows it the Observatory and the Infinite.
  const inFirstLight = !isConstellationLit(profile, sky.constellations.firstLight);
  const [tour, setTour] = useState<TourStep | null>(() => owedTour(profile));
  // Wordless and forced: Blip flies to each thing to tap, the hand on it, and nothing else answers.
  useEffect(() => {
    if (tour === 'toObservatory' && !canCallStarfall(profile, starShopCatalog)) {
      onSeeTip(TOUR_STARFALL);
      setTour('infinite');
    } else if (tour === 'infinite') {
      onSeeTip(TOUR_DONE);
      setTour(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour]);
  /** Which way the page slid in: +1 from the left, -1 from the right. */
  const [slide, setSlide] = useState(0);
  /** Play has just come back from another page: its layers fade in as the other pages do. */
  const [backToPlay, setBackToPlay] = useState(false);
  /** Heroes fallen this session the player has not yet tapped in the Collection. */
  const [freshHeroIds, setFreshHeroIds] = useState<readonly string[]>([]);
  const [collectionSeen, setCollectionSeen] = useState(true);
  const [showReference, setShowReference] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showLocations, setShowLocations] = useState(false);
  const [showDev, setShowDev] = useState(false);
  const [intentOn, setIntentOn] = useState(readEnemyIntent);
  const [launching, setLaunching] = useState(false);
  const [confirmingNewRun, setConfirmingNewRun] = useState(false);
  /** The Cycle the Infinite's Enter chose, held while a parked run's deletion is confirmed. */
  const [startCycle, setStartCycle] = useState(FIRST_CYCLE);
  /** Bumped to send the sky into the Infinite, where a Cycle is chosen. */
  const [infiniteRequest, setInfiniteRequest] = useState(0);
  const [staleNoteDismissed, setStaleNoteDismissed] = useState(false);
  /** Stardust the sky is still flying to the Observatory, kept off its badge until it lands. */
  const [heldDust, setHeldDust] = useState(0);
  /** A sky seat zoomed into: it takes the whole screen, the hub's bar and corners stepping away. */
  const [skyZoomed, setSkyZoomed] = useState(false);

  // The sound already plays from the delegated pointerdown listener (audio/uiSfx.ts).
  function launch(action: () => void) {
    if (launching) return;
    setLaunching(true);
    window.setTimeout(action, LAUNCH_ANIM_MS);
  }

  /** With a run parked, starting over deletes it — so it asks first. */
  function handleStart(cycle: number) {
    setStartCycle(cycle);
    if (parkedRun) {
      setConfirmingNewRun(true);
      return;
    }
    startFresh(cycle);
  }

  /** A new run beside a parked one: past Cycle I the Cycle is chosen in the Infinite first. */
  function handleNewRun() {
    if (openCycle > FIRST_CYCLE) setInfiniteRequest((n) => n + 1);
    else handleStart(FIRST_CYCLE);
  }

  /** A constellation's press (SkyChart.tsx): the Infinite starts a run on the Cycle chosen in it; the modes open their own screens. */
  function handleSkyPlay(play: SkyPlay, cycle: number = FIRST_CYCLE) {
    if (play === 'infinite') handleStart(cycle);
    else if (play === 'trials') onOpenConstructed();
    else onOpenGauntlet();
  }

  function startFresh(cycle: number) {
    launch(() => onStartRun(cycle));
  }

  function selectTab(next: HubTab) {
    setSlide(Math.sign(HUB_TABS.indexOf(next) - HUB_TABS.indexOf(tab)));
    setTab(next);
    if (next === 'constellation') onRefreshProfile();
    if (next === 'collection') setCollectionSeen(true);
    setBackToPlay(next === 'play' && tab !== 'play');
    if (tour === 'toObservatory' && next === 'constellation') setTour('pulling');
    if (tour === 'fallen' && next === 'play') setTour('home');
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

  const balance = stardustBalance(profile, starShopCatalog);
  const staleNote = !staleNoteDismissed ? (staleSaveReason ? 'A run saved by an earlier version of the game could not be loaded, and has been cleared.' : saveNotice) : null;
  /** The press row stands under the sky only when it holds something: a parked run, or a note about the save. */
  const pressRow = !!parkedRun || !!staleNote;

  return (
    <div
      className={`title-screen is-${tone}${pressRow ? ' has-parked-run' : ''}${launching ? ' is-launching' : ''}${tab !== 'play' ? ' is-away' : ''}${skyZoomed ? ' is-sky-zoomed' : ''}${inFirstLight ? ' is-first-light' : ''}${tour ? ' is-touring' : ''}${backToPlay ? ' is-back' : ''}`}
    >
      {/* The Play page is the title itself; its layers stay mounted under the other pages so coming
          back is instant, and display: contents keeps them in the screen's own flex and stacking. */}
      <div className="title-play">
      <GalaxySky active={tab === 'play' && !launching} />

      <span className="title-grain" aria-hidden="true" />
      <span className="title-vignette" aria-hidden="true" />

      <SkyChart
        profile={profile}
        disabled={launching || tour !== null}
        active={tab === 'play' && !launching && !held}
        pressHidden={!!parkedRun}
        returned={skyReturn}
        onReturnedSeen={onSkyReturnSeen}
        onSeeThought={onSeeThought}
        onSeeLighting={onSeeTip}
        onHoldStardust={setHeldDust}
        onZoomChange={setSkyZoomed}
        onlyFirstLight={inFirstLight}
        quiet={tour !== null}
        onFirstLightDone={() => setTour(owedTour(profile) ?? 'toObservatory')}
        openCycle={openCycle}
        infiniteRequest={infiniteRequest}
        onPlay={handleSkyPlay}
        onPlayLesson={(scenarioId) => onPlayLesson && launch(() => onPlayLesson(scenarioId))}
      />

      <div className="title-logo is-top">
        <TitleLogo />
      </div>

      {/* Mounted only while launching, so mounting starts them. The flash
          takes pointer events on purpose — it shields against a second press. */}
      {launching && (
        <>
          <span className="title-launch-ring" aria-hidden="true" />
          <span className="title-launch-flash" aria-hidden="true" />
        </>
      )}

      {/* The sky is the way in; a parked run keeps the one press under it, since coming back to a
          run in progress is the likelier intent. */}
      {pressRow && (
        <div className="title-buttons">
          {parkedRun && (
            <>
              <PactButton label="Continue Run" disabled={launching} onClick={() => launch(onContinueRun)} />
              <button className="title-newrun-button" onClick={handleNewRun} disabled={launching}>
                Start a New Run
              </button>
            </>
          )}
          {/* The reason itself is developer-shaped ("roster[0].unlockedMoveIds references..."), so it
              goes to the console (App.tsx) and the player gets the one fact they can act on. */}
          {staleNote && (
            <button className="title-stale-note" onClick={() => setStaleNoteDismissed(true)}>
              {staleNote} Tap to dismiss.
            </button>
          )}
        </div>
      )}

      {/* Records, Reference and Options are corner glyphs: a ledger, a lookup and a dial, not places. */}
      <button
        className={`title-records-button${pendingWeave(profile) ? ' is-fresh' : ''}`}
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
            <button className="title-dev-item" onClick={() => runDev(() => onOpenVersus(true))}>
              Versus (two tabs)
            </button>
            <button className="title-dev-item" onClick={() => runDev(() => onOpenVersus(false))}>
              Versus (online)
            </button>
            <button className="title-dev-item" onClick={() => runDev(() => setShowLocations(true))}>
              Visit Location
            </button>
            <button className="title-dev-item" onClick={() => runDev(onGrantDevStars)}>
              ✦ +2,500 Stardust
            </button>
            <button className="title-dev-item" onClick={() => runDev(onResetTips)}>
              Reset Tips
            </button>
            <button className="title-dev-item" onClick={() => runDev(onStartLevel4TestRun)}>
              🧪 Test: Lv4 Squad
            </button>
            <button
              className="title-dev-item"
              onClick={() => {
                writeEnemyIntent(!intentOn);
                setIntentOn(!intentOn);
              }}
            >
              🧪 Enemy intent: {intentOn ? 'on' : 'off'}
            </button>
            <button className="title-dev-item" onClick={() => runDev(onStartStatusTestFight)}>
              🧪 Test: Status FX
            </button>
            <button className="title-dev-item" onClick={() => runDev(onStartAcademyTestRun)}>
              🧪 Test: Academy
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
          <CollectionScreen
            profile={profile}
            onChangeDeck={onChangeDeck}
            onBuy={onBuyOffer}
            freshHeroIds={freshHeroIds}
            onAcknowledge={(heroId) => setFreshHeroIds((ids) => ids.filter((id) => id !== heroId))}
          />
        </div>
      )}
      {tab === 'constellation' && (
        <div className="hub-slot" style={{ '--slide': slide } as CSSProperties}>
          <StarShopScreen
            profile={profile}
            onBuy={onBuyOffer}
            onStarfall={(count) => {
              if (tour === 'pulling') setTour('falling');
              return onStarfall(count);
            }}
            freshHeroId={freshHeroIds[freshHeroIds.length - 1] ?? null}
            guided={tour === 'pulling' || tour === 'falling' || tour === 'fallen'}
            onHeroFallen={(heroId) => {
              if (tour === 'falling') {
                onSeeTip(TOUR_STARFALL);
                setTour('fallen');
              }
              setFreshHeroIds((ids) => [...ids.filter((id) => id !== heroId), heroId]);
              setCollectionSeen(false);
            }}
          />
        </div>
      )}

      <HubNav
        tab={tab}
        onSelect={selectTab}
        balance={balance - heldDust}
        collectionFresh={!collectionSeen}
        disabled={launching || tour !== null}
        only={tour === 'toObservatory' ? 'constellation' : tour === 'fallen' ? 'play' : undefined}
      />

      {tour && tour !== 'infinite' && (
        <BlipGuide
          target={tour === 'home' ? { selector: '.sky-seat', at: 'seat' } : { selector: TOUR_TARGETS[tour] ?? '.sky-call' }}
          seat={SEAT}
          hidden={tour === 'falling'}
          onArrive={
            tour === 'home'
              ? () => {
                  onSeeTip(TOUR_DONE);
                  setTour(null);
                }
              : undefined
          }
        />
      )}
      {tour && TOUR_TARGETS[tour] && <GuideHand key={tour} selector={TOUR_TARGETS[tour]!} />}
      {tour === 'falling' && <GuideHand selector=".summon.is-settled .summon-cheer" raised />}

      {/* Starting over with a run parked deletes it, so it asks — a sheet, not a
          re-labelled button, because a button that changes what it says under
          the thumb is the one that gets pressed twice by accident. */}
      {confirmingNewRun && (
        <div className="log-overlay" onClick={() => setConfirmingNewRun(false)}>
          <div className="log-panel title-confirm-panel is-gilt-sheet" onClick={(e) => e.stopPropagation()}>
            <h3 className="gilt-dialog-title">Start a new run?</h3>
            <p className="title-confirm-copy">
              The parked run is deleted — its roster, gear and progress are gone for good.
            </p>
            <button
              className="options-item options-item-danger"
              onClick={() => {
                setConfirmingNewRun(false);
                startFresh(startCycle);
              }}
            >
              <span className="options-item-glyph" aria-hidden="true">
                <HubGlyph name="discard" />
              </span>
              Discard it and start over
            </button>
            <button className="options-item" onClick={() => setConfirmingNewRun(false)}>
              <span className="options-item-glyph" aria-hidden="true">
                ▶
              </span>
              Keep the run
            </button>
          </div>
        </div>
      )}


      {showLocations && <LocationSelectOverlay onPick={onVisitLocation} onClose={() => setShowLocations(false)} />}
      {showRecords && (
        <RecordsScreen profile={profile} onEraseAllData={onEraseAllData} onSeeTip={onSeeTip} onClose={() => setShowRecords(false)} />
      )}
      {showReference && <ReferenceOverlay initialTab="howto" onClose={() => setShowReference(false)} />}
      {/* Same markup as the map's and FightScreen's Options panel, without the run rows. */}
      {showOptions && (
        <div className="log-overlay" onClick={() => setShowOptions(false)}>
          <div className="log-panel options-panel is-gilt-sheet" onClick={(e) => e.stopPropagation()}>
            <h3 className="gilt-dialog-title">Options</h3>
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
