import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { sky, TUTORIAL_STAR } from '../../data/sky';
import { THOUGHTS } from '../../data/thoughts';
import type { Profile } from '../../run/profile';
import { constellationState, findStar, isConstellationLit, isDrawInUnshown, isStarLit, skyLightingTipId } from '../../run/sky';
import { revealedFirst, revealedThought, thoughtFor, type ThoughtDefinition, type ThoughtMoment } from '../../run/thoughts';
import { PlateButton } from '../shared/PlateButton';
import { canvasPoint } from '../shared/overlayHost';
import { Blip, type BlipHandle } from './Blip';
import { BlipBeat } from './BlipBeat';
import { InfiniteView } from './InfiniteView';
import { TitleLogo } from './TitleLogo';
import deskArt from '../../../art/title/book/desk.png';
import libraryArt from '../../../art/title/book/library.png';
import storyArt from '../../../art/title/book/story.png';
import './bookTitle.css';

// The title as an open book on a desk (docs/worlds.md §3.7, per user direction 2026-11-24): the
// Library on the top page, Your Story on the bottom, the Gauntlet and the Trials as ribbon bookmarks,
// and Blip the bookworm in the gutter between the pages.

/** Where Blip rests inside its seat, in the seat's own pixels (BlipGuide flies home to it). */
export const SEAT = { x: 26, y: 28 };

/** What a press on the book plays. */
export type SkyPlay = 'infinite' | 'trials' | 'gauntlet';

const RIBBONS = [
  { id: 'gauntlet', play: 'gauntlet', label: 'Gauntlet', tone: 'is-red' },
  { id: 'trials', play: 'trials', label: 'Trials', tone: 'is-blue' },
] as const;

const ARRIVE_MS = 900;

interface Props {
  profile: Profile;
  disabled?: boolean;
  /** Off, the book is not on screen (another page, a launch): Blip stops. */
  active?: boolean;
  /** A parked run: the Library's page offers to carry on with it, or to start over. */
  parked?: { onContinue: () => void; onNewRun: () => void } | null;
  /** How the last run or lesson ended, when the player has just come back from it; Blip reacts once. */
  returned?: 'win' | 'loss' | null;
  onReturnedSeen?: () => void;
  onSeeThought?: (thought: ThoughtDefinition) => void;
  /** The tutorial's lighting played, to keep once an account (`skyLightingTipId`). */
  onSeeLighting?: (tipId: string) => void;
  /** The Cycle sheet opened or closed: the title clears the rest of the screen for it. */
  onZoomChange?: (zoomed: boolean) => void;
  /** The highest Cycle open to play: past I, the Library's Enter asks which. */
  openCycle?: number;
  /** Bumped to open the Cycle sheet from outside (Start a New Run past Cycle I). */
  infiniteRequest?: number;
  /** A new account before the tutorial: the book offers the tutorial and nothing else. */
  onlyFirstLight?: boolean;
  /** Something else has the screen (the tour after the tutorial): Blip's firsts wait. */
  quiet?: boolean;
  /** The tutorial has just been won: the tour that follows is the title's. */
  onFirstLightDone?: () => void;
  onPlay: (play: SkyPlay, cycle?: number) => void;
  onPlayLesson?: (scenarioId: string) => void;
}

export function BookTitle({
  profile,
  disabled = false,
  active = true,
  parked = null,
  returned = null,
  onReturnedSeen,
  onSeeThought,
  onSeeLighting,
  onZoomChange,
  openCycle = 1,
  infiniteRequest = 0,
  onlyFirstLight = false,
  quiet = false,
  onFirstLightDone,
  onPlay,
  onPlayLesson,
}: Props) {
  const firstLight = sky.constellations.firstLight;
  const firstLightDone = isConstellationLit(profile, firstLight);
  const [paysNow] = useState(() => isDrawInUnshown(profile, firstLight));
  const quietRef = useRef(quiet);
  quietRef.current = quiet;
  const [calling, setCalling] = useState<string | null>(null);
  const [cycleOpen, setCycleOpen] = useState(false);
  const blip = useRef<BlipHandle>(null);
  const seatRef = useRef<HTMLDivElement>(null);
  const [beat, setBeat] = useState<{ thought: ThoughtDefinition; next: ThoughtDefinition | null } | null>(null);

  const sayThought = (thought: ThoughtDefinition | null, onDone?: () => void) => {
    if (!thought) return false;
    if (thought.scene) {
      setBeat({ thought, next: thought.showsNext ? revealedFirst(profile, THOUGHTS, thought.showsNext) : null });
      return true;
    }
    onSeeThought?.(thought);
    onDone?.();
    return true;
  };
  const show = (id: string, thought: ThoughtDefinition, later: (ms: number, fn: () => void) => void) => {
    setCalling(id);
    later(600, () => {
      blip.current?.react('chirp');
      sayThought(thought);
    });
  };
  const say = (moment: ThoughtMoment, later: (ms: number, fn: () => void) => void) => {
    const thought = thoughtFor(profile, THOUGHTS, moment);
    const next = thought?.showsNext ? revealedFirst(profile, THOUGHTS, thought.showsNext) : null;
    return sayThought(thought, next ? () => show(thought!.showsNext!, next, later) : undefined);
  };
  const endBeat = () => {
    if (!beat) return;
    const { thought, next } = beat;
    setBeat(null);
    onSeeThought?.(thought);
    if (next) onSeeThought?.(next);
    const lesson = thought.plays ? findStar(sky, thought.plays) : null;
    if (lesson && !isStarLit(profile, lesson.constellation, lesson.star)) onPlayLesson?.(lesson.star.id);
    else if (thought.showsNext) setCalling(thought.showsNext);
  };
  const blipPoint = () => {
    const rect = seatRef.current?.getBoundingClientRect();
    if (!rect) return undefined;
    const corner = canvasPoint(rect.left, rect.top);
    return { x: corner.x + SEAT.x, y: corner.y + SEAT.y };
  };

  // On arriving: the tutorial just won hands over to the tour; otherwise one beat — a run's end, the
  // first visit, a mode seen open for the first time.
  useEffect(() => {
    if (!active) return;
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    at(ARRIVE_MS, () => {
      if (paysNow && !profile.seenTipIds.includes(skyLightingTipId(firstLight.id))) {
        blip.current?.react('win');
        onReturnedSeen?.();
        onSeeLighting?.(skyLightingTipId(firstLight.id));
        at(900, () => onFirstLightDone?.());
        return;
      }
      if (quietRef.current) return;
      if (returned) {
        blip.current?.react(returned === 'win' ? 'win' : 'lose');
        onReturnedSeen?.();
        return;
      }
      if (say({ kind: 'firstSky' }, at)) return;
      const reveal = revealedThought(profile, sky, THOUGHTS);
      if (reveal) show(reveal.constellationId, reveal.thought, at);
    });
    return () => timers.forEach(window.clearTimeout);
    // A visit is one mount while active; the profile changing under it must not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    if (infiniteRequest > 0) setCycleOpen(true);
  }, [infiniteRequest]);
  useEffect(() => {
    onZoomChange?.(cycleOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycleOpen]);

  const libraryState = constellationState(profile, sky, 'infinite');
  const libraryOpen = firstLightDone && (libraryState === 'open' || libraryState === 'lit');
  const enter = () => {
    setCalling(null);
    if (openCycle > 1) setCycleOpen(true);
    else onPlay('infinite', 1);
  };

  return (
    <div className={`book-title${cycleOpen ? ' is-zoomed' : ''}`} style={{ '--desk': `url(${deskArt})` } as CSSProperties}>
      <div className="book-spread">
        <img className="book-desk" src={deskArt} alt="" draggable={false} />
        <div className="book-logo-seat">
          <TitleLogo />
        </div>

        <div className={`book-leaf is-top${calling === 'infinite' ? ' is-calling' : ''}`}>
          <img className="book-leaf-art" src={libraryArt} alt="" draggable={false} />
          <div className="book-leaf-words">
            <b className="book-leaf-name">{firstLightDone ? 'The Library' : 'How to Play'}</b>
            {!firstLightDone ? (
              <PlateButton compact className="book-leaf-press" onClick={() => onPlayLesson?.(TUTORIAL_STAR)} disabled={disabled} data-sfx="ui.commit">
                Begin
              </PlateButton>
            ) : parked ? (
              <>
                <PlateButton compact className="book-leaf-press" onClick={parked.onContinue} disabled={disabled} data-sfx="ui.commit">
                  Continue
                </PlateButton>
                <button type="button" className="book-leaf-link" onClick={parked.onNewRun} disabled={disabled}>
                  New run
                </button>
              </>
            ) : (
              libraryOpen && (
                <PlateButton compact className="book-leaf-press" onClick={enter} disabled={disabled} data-sfx="ui.commit">
                  Enter
                </PlateButton>
              )
            )}
          </div>
        </div>

        <div className="book-leaf is-bottom is-soon">
          <img className="book-leaf-art" src={storyArt} alt="" draggable={false} />
          <div className="book-leaf-words">
            <b className="book-leaf-name">Your Story</b>
            <span className="book-leaf-note">Coming soon</span>
          </div>
        </div>

        {!onlyFirstLight && (
          <div className="book-ribbons">
            {RIBBONS.map((r) => {
              const state = constellationState(profile, sky, r.id);
              if (state === 'hidden') return null;
              const locked = state === 'glimpsed';
              return (
                <button
                  key={r.id}
                  type="button"
                  className={`book-ribbon ${r.tone}${locked ? ' is-locked' : ''}${calling === r.id ? ' is-calling' : ''}`}
                  disabled={disabled || locked}
                  data-sfx={locked ? 'none' : 'ui.commit'}
                  onClick={() => {
                    setCalling(null);
                    onPlay(r.play);
                  }}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        )}

        <div ref={seatRef} className={`sky-seat book-seat${beat ? ' is-empty' : ''}`}>
          <Blip ref={blip} home={SEAT} active={active && !beat} />
        </div>
      </div>

      {cycleOpen && (
        <div className="book-cycles">
          <div className="book-cycles-card">
            <InfiniteView openCycle={openCycle} cleared={profile.cyclesCleared} disabled={disabled} onEnter={(cycle) => onPlay('infinite', cycle)} />
          </div>
          <button type="button" className="sky-detail-back" data-sfx="ui.back" onClick={() => setCycleOpen(false)}>
            <span className="sky-detail-back-arrow" aria-hidden="true">
              ‹
            </span>
            Back
          </button>
        </div>
      )}

      {beat && active && <BlipBeat scene={beat.thought.scene} onDone={endBeat} from={blipPoint()} />}
    </div>
  );
}
