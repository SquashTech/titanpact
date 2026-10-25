import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { sky } from '../../data/sky';
import { THOUGHTS } from '../../data/thoughts';
import { trials } from '../../data/trials';
import { cycleOf } from '../../run/cycles';
import type { Profile } from '../../run/profile';
import { constellationState, findStar, isConstellationLit, isStarLit, starScenario, type ConstellationDefinition, type ConstellationState, type SkyStar } from '../../run/sky';
import { revealedFirst, revealedThought, thoughtFor, zoomThought, type ThoughtDefinition, type ThoughtMoment } from '../../run/thoughts';
import { PlateButton } from '../shared/PlateButton';
import { Blip, type BlipHandle } from './Blip';
import { BlipBeat } from './BlipBeat';
import { canvasPoint } from '../shared/overlayHost';
import './skyChart.css';

// The title as the sky (docs/the-sky.md §2; stacked bands, picked 2026-10-24 over the zoom sky, which
// didn't fit a portrait screen): one full-width band of sky a constellation, scrolled through and
// snapping, each drawn big with its stars named and its own press. It opens on the band a press would
// play next. Blip sits in a seat under the logo and talks there, about the band in view.

const SEAT = { x: 26, y: 28 };
/** The band's own drawing box; the constellation sits in the middle with room round it for names. */
const VIEW_W = 360;
const VIEW_H = 280;
const SHAPE = 150;
const CENTRE = { x: VIEW_W / 2, y: VIEW_H / 2 };

/** Where a star sits in its band. */
function place(star: SkyStar): { x: number; y: number } {
  return { x: CENTRE.x - SHAPE / 2 + star.x * SHAPE, y: CENTRE.y - SHAPE / 2 + star.y * SHAPE };
}

/** What a constellation's press does, read off the kind of star it holds. */
export type SkyPlay = 'infinite' | 'trials' | 'gauntlet';

function playOf(c: ConstellationDefinition): SkyPlay | null {
  switch (c.stars[0]?.light.kind) {
    case 'cycleCleared':
      return 'infinite';
    case 'trialBeaten':
      return 'trials';
    case 'gauntletCleared':
      return 'gauntlet';
    default:
      return null;
  }
}

const PLAY_LABELS: Record<SkyPlay, string> = {
  infinite: 'Enter the Infinite',
  trials: 'Open the Trials',
  gauntlet: 'Enter the Gauntlet',
};

const ORDINALS = ['First', 'Second', 'Third', 'Fourth', 'Fifth'];

function starName(star: SkyStar): string {
  const scenario = starScenario(sky, star);
  if (scenario) return scenario.name;
  switch (star.light.kind) {
    case 'cycleCleared': {
      const cycle = cycleOf(star.light.cycle);
      return `${cycle.numeral} · ${cycle.name}`;
    }
    case 'trialBeaten':
      return trials[star.light.trialId]?.name ?? star.light.trialId;
    case 'gauntletCleared':
      return `${ORDINALS[star.light.count - 1] ?? star.light.count} clear`;
    default:
      return star.id;
  }
}

/** Idle thoughts a visit, at most: Blip leans on firsts and keeps its pool small (docs/the-sky.md §7). */
const IDLE_THOUGHTS_A_VISIT = 3;
const ARRIVE_MS = 900;
const IDLE_MS = [9000, 16000] as const;
/** How long a band must sit in view before Blip says its piece about it. */
const SETTLE_MS = 700;

interface Props {
  profile: Profile;
  disabled?: boolean;
  /** Off, the sky is not on screen (another page, a launch): Blip stops and says nothing. */
  active?: boolean;
  /** A parked run's own presses stand under the sky; the Infinite's would say the same thing again. */
  pressHidden?: boolean;
  /** How the last Infinite run ended, when the player has just come back from it; Blip reacts once. */
  returned?: 'win' | 'loss' | null;
  onReturnedSeen?: () => void;
  /** A first Blip has thought, to keep once an account. */
  onSeeThought?: (thought: ThoughtDefinition) => void;
  onPlay: (play: SkyPlay) => void;
  /** A First Light lesson, by its scenario id. */
  onPlayLesson?: (scenarioId: string) => void;
}

export function SkyChart({ profile, disabled = false, active = true, pressHidden = false, returned = null, onReturnedSeen, onSeeThought, onPlay, onPlayLesson }: Props) {
  const bands = Object.values(sky.constellations)
    .map((c) => ({ c, state: constellationState(profile, sky, c.id) }))
    .filter((entry): entry is { c: ConstellationDefinition; state: Exclude<ConstellationState, 'hidden'> } => entry.state !== 'hidden');

  // The band a press would play next: the first open, unlit one with a press or charted lessons, else the Infinite.
  const focusId =
    bands.find(({ c, state }) => state === 'open' && !c.uncharted && !isConstellationLit(profile, c) && (playOf(c) || c.rail))?.c.id ?? 'infinite';

  const scrollRef = useRef<HTMLDivElement>(null);
  const bandRefs = useRef(new Map<string, HTMLElement>());
  const [inView, setInView] = useState(focusId);
  const inViewRef = useRef(inView);
  inViewRef.current = inView;

  const scrollTo = (id: string, smooth: boolean) => {
    const band = bandRefs.current.get(id);
    const scroller = scrollRef.current;
    if (!band || !scroller) return;
    scroller.scrollTo({ top: band.offsetTop - (scroller.clientHeight - band.offsetHeight) / 2, behavior: smooth ? 'smooth' : 'auto' });
  };

  // Opens on the focus band, without an animation.
  useLayoutEffect(() => {
    scrollTo(focusId, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The band in view is the one most of the scroller shows.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) setInView((entry.target as HTMLElement).dataset.id ?? inViewRef.current);
      },
      { root: scroller, threshold: 0.6 }
    );
    bandRefs.current.forEach((band) => observer.observe(band));
    return () => observer.disconnect();
  }, [bands.length]);

  const blip = useRef<BlipHandle>(null);
  // A forced thought standing over the sky; the first its showsNext leads to rides in the same beat.
  const [beat, setBeat] = useState<{ thought: ThoughtDefinition; next: ThoughtDefinition | null } | null>(null);
  const beatRef = useRef(beat);
  beatRef.current = beat;
  const sayThought = (thought: ThoughtDefinition | null, onDone?: () => void) => {
    if (!thought) return false;
    if (thought.forced) {
      setBeat({ thought, next: thought.showsNext ? revealedFirst(profile, THOUGHTS, thought.showsNext) : null });
      return true;
    }
    blip.current?.think(thought.lines, onDone, { guarded: !!thought.once });
    if (thought.once) onSeeThought?.(thought);
    return true;
  };
  const seatRef = useRef<HTMLDivElement>(null);
  /** Blip's seat in the canvas's px, where the beat's Blip flies out from. */
  const seatPoint = () => {
    const rect = seatRef.current?.getBoundingClientRect();
    if (!rect) return undefined;
    const corner = canvasPoint(rect.left, rect.top);
    return { x: corner.x + SEAT.x, y: corner.y + SEAT.y };
  };
  const endBeat = () => {
    if (!beat) return;
    const { thought, next } = beat;
    setBeat(null);
    if (thought.once) onSeeThought?.(thought);
    if (next?.once) onSeeThought?.(next);
    const lesson = thought.plays ? findStar(sky, thought.plays) : null;
    if (lesson && !isStarLit(profile, lesson.constellation, lesson.star)) onPlayLesson?.(lesson.star.id);
    else if (thought.showsNext) scrollTo(thought.showsNext, true);
  };
  /** Bring a constellation's band into view and say its first from the seat. */
  const show = (constellationId: string, thought: ThoughtDefinition, later: (ms: number, fn: () => void) => void) => {
    scrollTo(constellationId, true);
    later(600, () => {
      blip.current?.react('chirp');
      sayThought(thought);
    });
  };
  const say = (moment: ThoughtMoment, later?: (ms: number, fn: () => void) => void) => {
    const thought = thoughtFor(profile, THOUGHTS, moment, Math.random());
    const next = thought?.showsNext && later ? revealedFirst(profile, THOUGHTS, thought.showsNext) : null;
    return sayThought(thought, next && later ? () => show(thought!.showsNext!, next, later) : undefined);
  };

  // One thing to say on arriving — an Infinite run's end, the first sky, a constellation seen open
  // for the first time — then a few idle thoughts, spaced out.
  useEffect(() => {
    if (!active) return;
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    at(ARRIVE_MS, () => {
      if (returned) {
        blip.current?.react(returned === 'win' ? 'win' : 'lose');
        at(700, () => say({ kind: 'returned', outcome: returned }));
        onReturnedSeen?.();
        return;
      }
      if (say({ kind: 'firstSky' }, at)) return;
      const reveal = revealedThought(profile, sky, THOUGHTS);
      if (reveal) show(reveal.constellationId, reveal.thought, at);
    });
    let idle = 0;
    const next = () =>
      at(IDLE_MS[0] + Math.random() * (IDLE_MS[1] - IDLE_MS[0]), () => {
        // Never cut a thought short.
        if (!beatRef.current && !blip.current?.busy() && idle < IDLE_THOUGHTS_A_VISIT) {
          idle++;
          say({ kind: 'idle' });
        }
        next();
      });
    next();
    return () => timers.forEach(window.clearTimeout);
    // A visit is one mount while active; the profile changing under it (a first recorded) must not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // A band settled in view: Blip says its first about it, or one of its stars, if it has one left.
  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => {
      if (!beatRef.current && !blip.current?.busy()) sayThought(zoomThought(profile, sky, THOUGHTS, inView, Math.random()));
    }, SETTLE_MS + ARRIVE_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, active]);

  return (
    <div className="sky-chart">
      <div ref={seatRef} className={`sky-seat${beat ? ' is-empty' : ''}`}>
        <Blip
          ref={blip}
          home={SEAT}
          active={active && !beat}
          bubbleAt="beside"
          onPoke={(inARow) => {
            // A poke mid-first only giggles, so it never cuts one short.
            if (blip.current?.guarded()) return;
            if (inARow >= 5) say({ kind: 'pokedLots' });
            else if (inARow === 1 || inARow === 3) say({ kind: 'poked' });
          }}
        />
      </div>

      <div ref={scrollRef} className="sky-bands">
        {bands.map(({ c, state }) => (
          <SkyBand
            key={c.id}
            bandRef={(el) => {
              if (el) bandRefs.current.set(c.id, el);
              else bandRefs.current.delete(c.id);
            }}
            profile={profile}
            constellation={c}
            state={state}
            disabled={disabled}
            pressHidden={pressHidden && c.id === 'infinite'}
            away={inView !== c.id}
            onPlay={onPlay}
            onPlayLesson={onPlayLesson}
          />
        ))}
      </div>

      {beat && active && (
        <BlipBeat
          lines={beat.thought.scene ? beat.thought.lines : [...beat.thought.lines, ...(beat.next?.lines ?? [])]}
          scene={beat.thought.scene}
          sceneLines={beat.next?.lines}
          onDone={endBeat}
          from={seatPoint()}
        />
      )}

      {/* Where the scroll stands, a pip a band: a quiet mark, and a way to jump. */}
      <div className="sky-rail" aria-hidden="true">
        {bands.map(({ c, state }) => (
          <button
            key={c.id}
            type="button"
            tabIndex={-1}
            data-sfx="none"
            className={`sky-rail-pip is-${state}${inView === c.id ? ' is-here' : ''}`}
            onClick={() => scrollTo(c.id, true)}
          />
        ))}
      </div>
    </div>
  );
}

interface BandProps {
  profile: Profile;
  constellation: ConstellationDefinition;
  state: Exclude<ConstellationState, 'hidden'>;
  disabled: boolean;
  pressHidden: boolean;
  onPlay: (play: SkyPlay) => void;
  onPlayLesson?: (scenarioId: string) => void;
  bandRef: (el: HTMLElement | null) => void;
  /** Not the band in view: it peeks, dimmed. */
  away: boolean;
}

/** One constellation's band: its name, its shape with its stars named, and its press. */
function SkyBand({ profile, constellation: c, state, disabled, pressHidden, onPlay, onPlayLesson, bandRef, away }: BandProps) {
  const lit = c.stars.map((star) => isStarLit(profile, c, star));
  // A lesson can be played once it is lit or the next to light; the press plays the next.
  const lessonOf = (i: number) => starScenario(sky, c.stars[i])?.lesson ?? null;
  const playableLesson = (i: number) => !!lessonOf(i) && !disabled && state !== 'glimpsed' && (lit[i] || i === 0 || lit[i - 1]);
  const nextLesson = c.stars.findIndex((_, i) => lessonOf(i) && !lit[i]);
  const play = playOf(c);
  const glimpsed = state === 'glimpsed';
  const uncharted = !!c.uncharted && !lit.every(Boolean);
  const reward = c.rewards.reduce((sum, r) => sum + r.amount, 0);
  const labelSize = c.stars.length > 8 ? 8.5 : 10;
  return (
    <section ref={bandRef} data-id={c.id} className={`sky-band is-${state}${away ? ' is-away' : ''}${c.uncharted ? ' is-uncharted' : ''}${c.id === 'infinite' ? ' is-main' : ''}`}>
      <h2 className="sky-band-name">{c.name}</h2>
      <svg className="sky-band-shape" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <defs>
          <filter id={`sky-glow-${c.id}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {c.lines.map(([a, b]) => {
          const p = place(c.stars[a]);
          const q = place(c.stars[b]);
          return <line key={`${a}-${b}`} className="sky-band-line" x1={p.x} y1={p.y} x2={q.x} y2={q.y} />;
        })}
        {c.stars.map((star, i) => {
          const p = place(star);
          return (
            <circle
              key={star.id}
              className={`sky-band-star${lit[i] ? ' is-lit' : ''}`}
              cx={p.x}
              cy={p.y}
              r={lit[i] ? 4.6 : 3}
              filter={lit[i] ? `url(#sky-glow-${c.id})` : undefined}
              style={{ '--twinkle': `${(i * 0.37) % 2.4}s` } as CSSProperties}
            />
          );
        })}
        {!glimpsed &&
          c.stars.map((star, i) => {
            // Out from the shape's centre, so a ring's names stand round it rather than on each other.
            const p = place(star);
            const dx = p.x - CENTRE.x;
            const dy = p.y - CENTRE.y;
            const d = Math.hypot(dx, dy) || 1;
            const anchor = Math.abs(dx) < SHAPE * 0.12 ? 'middle' : dx < 0 ? 'end' : 'start';
            return (
              <text
                key={`${star.id}-label`}
                className={`sky-band-label${lit[i] ? ' is-lit' : ''}${playableLesson(i) ? ' is-playable' : ''}`}
                role={playableLesson(i) ? 'button' : undefined}
                onClick={playableLesson(i) ? () => onPlayLesson?.(c.stars[i].id) : undefined}
                x={p.x + (dx / d) * 11}
                y={p.y + (dy / d) * 11 + labelSize * 0.35}
                textAnchor={anchor}
                fontSize={labelSize}
              >
                {starName(star)}
              </text>
            );
          })}
      </svg>
      <div className="sky-band-foot">
        {glimpsed ? (
          reward > 0 && <span className="sky-band-reward">✦ {reward}</span>
        ) : nextLesson >= 0 ? (
          <PlateButton compact onClick={() => onPlayLesson?.(c.stars[nextLesson].id)} disabled={disabled} data-sfx="ui.commit">
            {starName(c.stars[nextLesson])}
          </PlateButton>
        ) : uncharted ? (
          <PlateButton compact disabled onClick={() => undefined}>
            Not yet charted
          </PlateButton>
        ) : (
          play &&
          !pressHidden && (
            <PlateButton compact onClick={() => onPlay(play)} disabled={disabled} data-sfx="ui.commit">
              {PLAY_LABELS[play]}
            </PlateButton>
          )
        )}
      </div>
    </section>
  );
}
