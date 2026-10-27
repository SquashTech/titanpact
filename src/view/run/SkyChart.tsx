import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { sky } from '../../data/sky';
import { THOUGHTS } from '../../data/thoughts';
import { trials } from '../../data/trials';
import { cycleOf } from '../../run/cycles';
import type { Profile } from '../../run/profile';
import {
  constellationState,
  findStar,
  isConstellationLit,
  isDrawInUnshown,
  isStarLit,
  profileBeforeLightings,
  skyLightingTipId,
  starScenario,
  unshownLightings,
  type ConstellationDefinition,
  type ConstellationState,
  type SkyStar,
} from '../../run/sky';
import { revealedFirst, revealedThought, thoughtFor, zoomThought, type ThoughtDefinition, type ThoughtMoment } from '../../run/thoughts';
import { PlateButton } from '../shared/PlateButton';
import { Blip, type BlipHandle } from './Blip';
import { BlipBeat } from './BlipBeat';
import { canvasPoint, overlayHost } from '../shared/overlayHost';
import { InfiniteView } from './InfiniteView';
import './skyChart.css';

// The title as the Pact (docs/the-sky.md §2b): the Infinite in the middle, a ring round it with a seat
// on three of its points, and First Light climbing into the fourth from the bottom of the screen. Each
// lesson won is played back here: its star lights and the next one wakes. The last folds the trail
// into a clasp, pays its Stardust into the Observatory and closes the ring. A tapped seat zooms in to
// its constellation, drawn big with its stars named and its own press.

const SEAT = { x: 26, y: 28 };

/** The Pact's drawing box. */
const W = 394;
const H = 560;
const RING = { x: 197, y: 232, r: 132 };
/** Half the gap First Light climbs in through, in degrees either side of the ring's foot. */
const GAP_DEG = 15;
const INNER_R = 64;
const MEDALLION_R = 33;
const CLASP_R = 18;
/** How far the sealed Pact settles down the screen, to sit centred once the trail below it is gone. */
const SETTLE = 46;
const ZOOM = 3.4;

/** Where each constellation sits on the Pact, and how big it is drawn there. First Light's is its clasp. */
const SEATS: Record<string, { x: number; y: number; size: number }> = {
  infinite: { x: RING.x, y: RING.y, size: 104 },
  strange: { x: RING.x, y: RING.y - RING.r, size: 46 },
  gauntlet: { x: RING.x + RING.r, y: RING.y, size: 46 },
  trials: { x: RING.x - RING.r, y: RING.y, size: 46 },
  firstLight: { x: RING.x, y: RING.y + RING.r, size: 24 },
};
const RING_SEATS = ['strange', 'gauntlet', 'trials'] as const;

/** First Light before it is sealed: its stars climbing from the foot of the screen to the ring's gap. */
const TRAIL = [
  { x: 136, y: 528, side: 'start' },
  { x: 92, y: 468, side: 'end' },
  { x: 264, y: 452, side: 'start' },
  { x: 197, y: 404, side: 'start' },
] as const;

/** A detail card's own drawing box; the constellation sits in the middle with room round it for names. */
const VIEW_W = 360;
const VIEW_H = 320;
const SHAPE = 200;
const CENTRE = { x: VIEW_W / 2, y: VIEW_H / 2 };

function seatPoint(id: string, star: SkyStar): { x: number; y: number } {
  const seat = SEATS[id];
  return { x: seat.x - seat.size / 2 + star.x * seat.size, y: seat.y - seat.size / 2 + star.y * seat.size };
}

function cardPoint(star: SkyStar): { x: number; y: number } {
  return { x: CENTRE.x - SHAPE / 2 + star.x * SHAPE, y: CENTRE.y - SHAPE / 2 + star.y * SHAPE };
}

/** A point on the ring, by degrees clockwise from east. */
function onRing(deg: number, r = RING.r): { x: number; y: number } {
  const a = (deg * Math.PI) / 180;
  return { x: RING.x + r * Math.cos(a), y: RING.y + r * Math.sin(a) };
}

/** A four-pointed glint, for a lit star. */
function glint(r: number): string {
  const w = r * 0.2;
  return `M0,${-r} L${w},${-w} L${r},0 L${w},${w} L0,${r} L${-w},${w} L${-r},0 L${-w},${-w} Z`;
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

/** The press while First Light is unfinished: a lesson speaks for itself, so it is never named. */
function lessonLabel(index: number): string {
  return index === 0 ? 'Begin' : 'Next Lesson';
}

const ORDINALS =['First', 'Second', 'Third', 'Fourth', 'Fifth'];

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

const cardState = (state: ConstellationState): Exclude<ConstellationState, 'hidden'> => (state === 'hidden' ? 'glimpsed' : state);

const scenarioIdOf =(star: SkyStar) => (star.light.kind === 'scenario' ? star.light.scenarioId : star.id);

/** Idle thoughts a visit, at most: Blip leans on firsts and keeps its pool small (docs/the-sky.md §7). */
const IDLE_THOUGHTS_A_VISIT = 3;
const ARRIVE_MS = 900;
const IDLE_MS = [9000, 16000] as const;
const ZOOM_MS = 650;
/** Motes a constellation's Stardust flies to the Observatory in. */
const DUST_MOTES = 18;

/** What a beat is doing to the Pact this instant. */
interface Fx {
  charging?: number;
  /** A star bursting; `n` remounts the burst for each one. */
  burst?: { i: number; n: number };
  drawing?: number;
  waking?: number;
  /** A seat opening as the sky watches. */
  stirring?: string;
  /** How many of the trail's lines have flared gold. */
  flare?: number;
  crest?: 'in' | 'out';
  folding?: boolean;
  closing?: boolean;
  flash?: boolean;
  /** A seat the player should look at next. */
  calling?: string;
}

interface Props {
  profile: Profile;
  disabled?: boolean;
  /** Off, the sky is not on screen (another page, a launch): Blip stops and says nothing. */
  active?: boolean;
  /** A parked run's own presses stand under the sky; the Infinite's would say the same thing again. */
  pressHidden?: boolean;
  /** How the last run or lesson ended, when the player has just come back from it; Blip reacts once. */
  returned?: 'win' | 'loss' | null;
  onReturnedSeen?: () => void;
  /** A first Blip has thought, to keep once an account. */
  onSeeThought?: (thought: ThoughtDefinition) => void;
  /** A lighting played, to keep once an account (`skyLightingTipId`). */
  onSeeLighting?: (tipId: string) => void;
  /** Stardust already earned that the Observatory should not show yet: it is still flying there. */
  onHoldStardust?: (amount: number) => void;
  /** A seat zoomed into or backed out of: the title clears the rest of the screen for it. */
  onZoomChange?: (zoomed: boolean) => void;
  /** The highest Cycle open to play: past I, the Infinite's press opens the Infinite to choose one. */
  openCycle?: number;
  /** Bumped to zoom into the Infinite from outside (the title's Start a New Run). */
  infiniteRequest?: number;
  onPlay: (play: SkyPlay, cycle?: number) => void;
  /** A First Light lesson, by its scenario id. */
  onPlayLesson?: (scenarioId: string) => void;
}

export function SkyChart({
  profile,
  disabled = false,
  active = true,
  pressHidden = false,
  returned = null,
  onReturnedSeen,
  onSeeThought,
  onSeeLighting,
  onHoldStardust,
  onZoomChange,
  openCycle = 1,
  infiniteRequest = 0,
  onPlay,
  onPlayLesson,
}: Props) {
  const firstLight = sky.constellations.firstLight;

  // Lessons won but not yet played back here: the sky is drawn as if they were not won until each one
  // lights. A beat cut short (another page, a remount) picks up where it stood, since each step is recorded.
  const [pending, setPending] = useState<readonly string[]>(() => unshownLightings(profile, firstLight).map((i) => scenarioIdOf(firstLight.stars[i])));
  const pendingRef = useRef(pending);
  const shown = useMemo(() => profileBeforeLightings(profile, pending), [profile, pending]);
  const firstLightDone = isConstellationLit(profile, firstLight);
  /** First Light drawn in and its reward paid by play, its trail not yet folded on the title. */
  const [paysNow] = useState(() => isDrawInUnshown(profile, firstLight));
  const finaleRef = useRef(paysNow);
  const [folded, setFolded] = useState(() => firstLightDone && !paysNow);
  const foldedRef = useRef(folded);
  foldedRef.current = folded;
  const [settled, setSettled] = useState(folded);
  const [fx, setFx] = useState<Fx>({});
  const [beating, setBeating] = useState(() => pending.length > 0 || paysNow);
  const beatingRef = useRef(beating);
  beatingRef.current = beating;
  const [zoomed, setZoomed] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const crestDust = useRef<HTMLDivElement>(null);
  const motes = useRef<HTMLElement[]>([]);

  /** Held back from the Observatory until it has flown there. */
  const reward = firstLight.rewards.reduce((sum, r) => sum + r.amount, 0);
  useLayoutEffect(() => {
    if (paysNow) onHoldStardust?.(reward);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const states = useMemo(
    () => Object.fromEntries(Object.keys(sky.constellations).map((id) => [id, constellationState(shown, sky, id)])) as Record<string, ConstellationState>,
    [shown]
  );
  const trailLit = firstLight.stars.map((star) => isStarLit(shown, firstLight, star));

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
  const blipPoint = () => {
    const rect = seatRef.current?.getBoundingClientRect();
    if (!rect) return undefined;
    const corner = canvasPoint(rect.left, rect.top);
    return { x: corner.x + SEAT.x, y: corner.y + SEAT.y };
  };
  const callTo = (id: string) => setFx((f) => ({ ...f, calling: id }));
  const endBeat = () => {
    if (!beat) return;
    const { thought, next } = beat;
    setBeat(null);
    if (thought.once) onSeeThought?.(thought);
    if (next?.once) onSeeThought?.(next);
    const lesson = thought.plays ? findStar(sky, thought.plays) : null;
    if (lesson && !isStarLit(profile, lesson.constellation, lesson.star)) onPlayLesson?.(lesson.star.id);
    else if (thought.showsNext) callTo(thought.showsNext);
  };
  /** Point at a constellation and say its first from the seat. */
  const show = (constellationId: string, thought: ThoughtDefinition, later: (ms: number, fn: () => void) => void) => {
    callTo(constellationId);
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

  // On arriving: the lessons won are played back first, then one thing to say — an Infinite run's end,
  // the first sky, a constellation seen open for the first time — then a few idle thoughts, spaced out.
  useEffect(() => {
    if (!active) return;
    let alive = true;
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    const wait = (ms: number) =>
      new Promise<void>((resolve, reject) => timers.push(window.setTimeout(() => (alive ? resolve() : reject(new Error('left'))), ms)));

    const arrive = () => {
      if (returned) {
        blip.current?.react(returned === 'win' ? 'win' : 'lose');
        at(700, () => say({ kind: 'returned', outcome: returned }));
        onReturnedSeen?.();
        return;
      }
      if (say({ kind: 'firstSky' }, at)) return;
      const reveal = revealedThought(profile, sky, THOUGHTS);
      if (reveal) show(reveal.constellationId, reveal.thought, at);
    };

    /** One star lit, and the next woken with a blank page beside it. */
    const lightStar = async (i: number) => {
      const star = firstLight.stars[i];
      const before = statesOf(pendingRef.current);
      setFx({ charging: i });
      playSfx('star.charge');
      await wait(900);
      const left = pendingRef.current.filter((id) => id !== scenarioIdOf(star));
      pendingRef.current = left;
      setPending(left);
      onSeeLighting?.(skyLightingTipId(star.id));
      setFx({ burst: { i, n: Date.now() } });
      playSfx('star.earn');
      await wait(750);
      const next = i + 1 < firstLight.stars.length ? i + 1 : null;
      if (next !== null) {
        setFx((f) => ({ ...f, drawing: i }));
        playSfx('map.path');
        await wait(700);
        setFx((f) => ({ ...f, waking: next }));
        playSfx('star.lock', { gain: 0.55 });
        playSfx('ui.page', { delay: 0.3, gain: 0.8 });
        await wait(1100);
      }
      // A seat that opens on this star wakes where it sits.
      const after = statesOf(left);
      const woke = Object.keys(after).find((id) => id !== 'firstLight' && before[id] !== 'open' && after[id] === 'open');
      if (woke) {
        setFx((f) => ({ ...f, stirring: woke }));
        playSfx('star.reveal', { gain: 0.7 });
        await wait(1500);
      }
    };

    /** The trail drawn in, its Stardust paid, and the trail folded into the clasp as the ring closes. */
    const drawIn = async () => {
      for (let k = 0; k < firstLight.lines.length; k++) {
        setFx({ flare: k + 1 });
        playSfx('star.tick', { pitch: 1 + k * 0.18, gain: 0.8 });
        await wait(190);
      }
      playSfx('star.reveal');
      await wait(500);
      setFx({ flare: firstLight.lines.length, crest: 'in' });
      playSfx('star.earn', { pitch: 0.75 });
      await wait(1300);
      if (paysNow) await flyDust(wait);
      await wait(500);
      setFx({ flare: firstLight.lines.length, crest: 'out' });
      await wait(500);
      setFx({ flare: firstLight.lines.length, folding: true });
      playSfx('star.charge');
      await wait(950);
      setFx({ folding: true, closing: true });
      await wait(520);
      finaleRef.current = false;
      onSeeLighting?.(skyLightingTipId(firstLight.id));
      setFolded(true);
      setFx({ flash: true });
      playSfx('seal.strike');
      await wait(650);
      setSettled(true);
      await wait(1250);
      setFx({ calling: 'infinite' });
    };

    const run = async () => {
      await wait(ARRIVE_MS);
      if (pendingRef.current.length === 0 && !finaleRef.current) {
        arrive();
        return;
      }
      setBeating(true);
      blip.current?.react('win');
      onReturnedSeen?.();
      while (pendingRef.current.length > 0) {
        const id = pendingRef.current[0];
        await lightStar(firstLight.stars.findIndex((s) => scenarioIdOf(s) === id));
        await wait(250);
      }
      if (finaleRef.current) {
        await drawIn();
        setBeating(false);
        await wait(400);
        say({ kind: 'drawnIn', constellationId: 'firstLight' });
        return;
      }
      setBeating(false);
      const next = firstLight.stars.find((star) => !isStarLit(profile, firstLight, star));
      if (!(next && say({ kind: 'star', starId: next.id }))) arrive();
    };
    run().catch(() => undefined);

    let idle = 0;
    const next = () =>
      at(IDLE_MS[0] + Math.random() * (IDLE_MS[1] - IDLE_MS[0]), () => {
        // Never cut a thought short.
        if (!beatRef.current && !beatingRef.current && !blip.current?.busy() && idle < IDLE_THOUGHTS_A_VISIT) {
          idle++;
          say({ kind: 'idle' });
        }
        next();
      });
    next();
    return () => {
      alive = false;
      timers.forEach(window.clearTimeout);
      motes.current.forEach((m) => m.remove());
      motes.current = [];
      setFx({});
      // Folded but not yet settled: nothing is left to play, so it settles where it stands.
      if (foldedRef.current) setSettled(true);
    };
    // A visit is one mount while active; the profile changing under it (a first recorded) must not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => () => motes.current.forEach((m) => m.remove()), []);

  /** The sky's states with these scenarios still waiting to be played back. */
  const statesOf = (waiting: readonly string[]) => {
    const p = profileBeforeLightings(profile, waiting);
    return Object.fromEntries(Object.keys(sky.constellations).map((id) => [id, constellationState(p, sky, id)])) as Record<string, ConstellationState>;
  };

  /** The reward's Stardust flown from the crest to the Observatory's badge, which counts it in as each mote lands. */
  const flyDust = (wait: (ms: number) => Promise<void>) => {
    const from = crestDust.current?.getBoundingClientRect();
    const badge = document.querySelector<HTMLElement>('.hub-nav-badge');
    if (!from || !badge) {
      onHoldStardust?.(0);
      return wait(0);
    }
    const to = badge.getBoundingClientRect();
    const a = canvasPoint(from.left + from.width / 2, from.top + from.height / 2);
    const b = canvasPoint(to.left + to.width / 2, to.top + to.height / 2);
    const host = overlayHost();
    onHoldStardust?.(reward);
    let landed = 0;
    return new Promise<void>((resolve) => {
      for (let n = 0; n < DUST_MOTES; n++) {
        const mote = document.createElement('span');
        mote.className = 'sky-dust-mote';
        mote.style.left = `${a.x}px`;
        mote.style.top = `${a.y}px`;
        host.appendChild(mote);
        motes.current.push(mote);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const bow = (n % 2 ? 1 : -1) * (40 + ((n * 23) % 70));
        const flight = mote.animate(
          [
            { transform: 'translate(-50%, -50%) scale(0.3)', opacity: 0 },
            { transform: `translate(calc(-50% + ${bow * 0.6}px), calc(-50% - ${30 + ((n * 13) % 40)}px)) scale(1.4)`, opacity: 1, offset: 0.22 },
            { transform: `translate(calc(-50% + ${dx * 0.5 + bow}px), calc(-50% + ${dy * 0.35}px)) scale(1.1)`, opacity: 1, offset: 0.55 },
            { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.45)`, opacity: 0.9 },
          ],
          { duration: 1050 + ((n * 37) % 300), delay: n * 70, easing: 'cubic-bezier(0.45, 0, 0.7, 0.35)', fill: 'both' }
        );
        flight.onfinish = () => {
          mote.remove();
          landed++;
          onHoldStardust?.(Math.round(reward * (1 - landed / DUST_MOTES)));
          badge.classList.remove('is-gaining');
          void badge.offsetWidth;
          badge.classList.add('is-gaining');
          if (landed % 2 === 1 || landed === DUST_MOTES) playSfx('star.rise', { pitch: 0.85 + (landed / DUST_MOTES) * 0.7, gain: 0.55 });
          if (landed === DUST_MOTES) {
            motes.current = [];
            resolve();
          }
        };
      }
    });
  };

  // A tapped seat zooms in; the card opens once the Pact has flown past it, and Blip says its piece.
  // Held so a back-out mid-flight cancels them: a card opening after its zoom was undone would sit over the title.
  const zoomTimers = useRef<number[]>([]);
  const zoomTo = (id: string) => {
    if (beating || zoomed) return;
    setZoomed(id);
    setFx((f) => ({ ...f, calling: undefined }));
    zoomTimers.current.push(
      window.setTimeout(() => setOpen(id), ZOOM_MS * 0.55),
      window.setTimeout(() => {
        if (!beatRef.current && !blip.current?.busy()) sayThought(zoomThought(profile, sky, THOUGHTS, id, Math.random()));
      }, ZOOM_MS + 300)
    );
  };
  const zoomOut = () => {
    zoomTimers.current.forEach(window.clearTimeout);
    zoomTimers.current = [];
    setOpen(null);
    zoomTimers.current.push(window.setTimeout(() => setZoomed(null), 120));
  };
  useEffect(() => () => zoomTimers.current.forEach(window.clearTimeout), []);
  useEffect(() => {
    onZoomChange?.(zoomed !== null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomed]);
  useEffect(() => {
    if (infiniteRequest > 0) zoomTo('infinite');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [infiniteRequest]);

  const shift = settled ? SETTLE : 0;
  const worldStyle: CSSProperties | undefined = zoomed
    ? (() => {
        const seat = zoomed === 'firstLight' && !folded ? { x: TRAIL[1].x, y: TRAIL[1].y } : SEATS[zoomed];
        const k = zoomed === 'infinite' ? ZOOM * 0.75 : ZOOM;
        return { transform: `translate(${W / 2 - k * seat.x}px, ${H * 0.42 - k * (seat.y + shift)}px) scale(${k})` };
      })()
    : undefined;

  // The press under the Pact: the next lesson while First Light is unfinished, then the Infinite.
  const nextLesson = firstLight.stars.findIndex((_, i) => !trailLit[i]);
  const infinite = sky.constellations.infinite;
  const press =
    !folded && nextLesson >= 0
      ? { label: lessonLabel(nextLesson), go:() => onPlayLesson?.(firstLight.stars[nextLesson].id) }
      : folded && !pressHidden && (states.infinite === 'open' || states.infinite === 'lit')
        ? { label: PLAY_LABELS.infinite, go: () => (openCycle > 1 ? zoomTo('infinite') : onPlay('infinite', 1)) }
        : null;

  return (
    <div className={`sky-chart${zoomed ? ' is-zoomed' : ''}${beating ? ' is-beating' : ''}${fx.crest === 'in' ? ' has-crest' : ''}`}>
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

      <div className="pact-stage" onClick={zoomed ? zoomOut : undefined}>
        <svg className="pact" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <defs>
            <filter id="pact-glow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="2.4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <radialGradient id="pact-star-halo">
              <stop offset="0%" stopColor="#ffe7a8" stopOpacity="0.85" />
              <stop offset="45%" stopColor="#ffc95e" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#ffc95e" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="pact-seat-well">
              <stop offset="0%" stopColor="#131a33" stopOpacity="0.96" />
              <stop offset="80%" stopColor="#0b1022" stopOpacity="0.94" />
              <stop offset="100%" stopColor="#0b1022" stopOpacity="0.6" />
            </radialGradient>
            <radialGradient id="pact-core-glow">
              <stop offset="0%" stopColor="#3a4c8f" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#3a4c8f" stopOpacity="0" />
            </radialGradient>
          </defs>

          <g className="pact-world" style={worldStyle}>
            <g className="pact-settle" style={{ transform: `translateY(${shift}px)` }}>
              <Sigil folded={folded} closing={!!fx.closing} flash={!!fx.flash} states={states} />

              {RING_SEATS.map((id) => (
                <Seat key={id} id={id} state={states[id]} calling={fx.calling === id} stirring={fx.stirring === id} profile={shown} onTap={() => zoomTo(id)} />
              ))}

              <Infinite state={states.infinite} profile={shown} calling={fx.calling === 'infinite'} stirring={fx.stirring === 'infinite'} onTap={() => zoomTo('infinite')} />

              {folded ? (
                <Clasp onTap={() => zoomTo('firstLight')} />
              ) : (
                <Trail
                  lit={trailLit}
                  fx={fx}
                  disabled={disabled || beating}
                  calling={fx.calling === 'firstLight'}
                  onPlayLesson={(id) => onPlayLesson?.(id)}
                />
              )}
            </g>
          </g>
        </svg>

        {fx.crest && (
          <div className={`sky-crest is-${fx.crest}`}>
            <span className="sky-crest-rays" aria-hidden="true" />
            <div className="sky-crest-name">{firstLight.name}</div>
            <span className="sky-crest-rule" aria-hidden="true" />
            {paysNow && (
              <div ref={crestDust} className="sky-crest-dust">
                ✦ {reward}
              </div>
            )}
          </div>
        )}
      </div>

      {open && (
        <div className="sky-detail">
          <div className="sky-detail-card">
            {open === 'infinite' ? (
              <InfiniteView openCycle={openCycle} cleared={profile.cyclesCleared} disabled={disabled} onEnter={(cycle) => onPlay('infinite', cycle)} />
            ) : (
              <ConstellationCard
              profile={shown}
              constellation={sky.constellations[open]}
              state={cardState(states[open])}
              disabled={disabled}
              pressHidden={pressHidden && open === 'infinite'}
              onPlay={onPlay}
              onPlayLesson={onPlayLesson}
              />
            )}
          </div>
          <button type="button" className="sky-detail-back" data-sfx="ui.back" onClick={zoomOut}>
            <span className="sky-detail-back-arrow" aria-hidden="true">
              ‹
            </span>
            Back
          </button>
        </div>
      )}

      <div className={`sky-press${press && !beating && !zoomed ? '' : ' is-held'}${fx.calling === 'infinite' ? ' is-fresh' : ''}`}>
        {press && (
          <PlateButton onClick={press.go} disabled={disabled || beating || !!zoomed} data-sfx="ui.commit">
            {press.label}
          </PlateButton>
        )}
      </div>

      {beat && active && (
        <BlipBeat
          lines={beat.thought.scene ? beat.thought.lines : [...beat.thought.lines, ...(beat.next?.lines ?? [])]}
          scene={beat.thought.scene}
          sceneLines={beat.next?.lines}
          onDone={endBeat}
          from={blipPoint()}
        />
      )}
    </div>
  );
}

/** The Pact itself: a double ring with First Light's gap at its foot until the trail folds, the ticks, and the circle round the Infinite. */
function Sigil({ folded, closing, flash, states }: { folded: boolean; closing: boolean; flash: boolean; states: Record<string, ConstellationState> }) {
  const arc = (r: number) => {
    const a = onRing(90 + GAP_DEG, r);
    const b = onRing(90 - GAP_DEG, r);
    return `M${a.x} ${a.y} A${r} ${r} 0 1 1 ${b.x} ${b.y}`;
  };
  /** From one side of the gap to its middle, drawn as the ring closes. */
  const half = (r: number, side: 1 | -1) => {
    const a = onRing(90 + side * GAP_DEG, r);
    const m = onRing(90, r);
    return `M${a.x} ${a.y} A${r} ${r} 0 0 ${side === 1 ? 0 : 1} ${m.x} ${m.y}`;
  };
  const ticks = Array.from({ length: 24 }, (_, i) => i * 15).filter((deg) => folded || Math.abs(deg - 90) > GAP_DEG);
  return (
    <g className="pact-sigil">
      <circle className="pact-core-glow" cx={RING.x} cy={RING.y} r={RING.r * 0.9} />
      {folded ? (
        <>
          <circle className="pact-ring" cx={RING.x} cy={RING.y} r={RING.r} />
          <circle className="pact-ring is-thin" cx={RING.x} cy={RING.y} r={RING.r - 7} />
        </>
      ) : (
        <>
          <path className="pact-ring" d={arc(RING.r)} />
          <path className="pact-ring is-thin" d={arc(RING.r - 7)} />
          {closing &&
            ([1, -1] as const).map((side) => (
              <g key={side}>
                <path className="pact-ring is-closing" d={half(RING.r, side)} pathLength={1} />
                <path className="pact-ring is-thin is-closing" d={half(RING.r - 7, side)} pathLength={1} />
              </g>
            ))}
        </>
      )}
      {flash && <circle className="pact-ring-flash" cx={RING.x} cy={RING.y} r={RING.r} />}
      {ticks.map((deg) => {
        const a = onRing(deg, RING.r + 4);
        const b = onRing(deg, RING.r + (deg % 90 === 0 ? 13 : 9));
        return <line key={deg} className="pact-tick" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
      })}
      <circle className="pact-runes" cx={RING.x} cy={RING.y} r={RING.r - 22} />
      {/* Spokes from the Infinite's circle out to each seat; the foot's only once the clasp is there. */}
      {([0, 180, 270, ...(folded ? [90] : [])] as const).map((deg) => {
        const a = onRing(deg, INNER_R + 6);
        const b = onRing(deg, RING.r - (deg === 90 ? CLASP_R : MEDALLION_R) - 2);
        return <line key={deg} className="pact-spoke" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
      })}
      <circle className={`pact-inner is-${states.infinite}`} cx={RING.x} cy={RING.y} r={INNER_R} pathLength={1} />
    </g>
  );
}

/** A constellation's stars and lines where it sits on the Pact. */
function SeatShape({ id, profile, state, starR }: { id: string; profile: Profile | null; state: ConstellationState; starR: number }) {
  const c = sky.constellations[id];
  const lit = c.stars.map((star) => !profile || isStarLit(profile, c, star));
  return (
    <g className={`pact-shape is-${state}${c.uncharted && !lit.every(Boolean) ? ' is-uncharted' : ''}`}>
      {c.rings &&
        c.stars.map((star, i) => {
          const p = seatPoint(id, star);
          const o = SEATS[id];
          return <circle key={`ring-${star.id}`} className={`pact-line pact-orbit${lit[i] ? ' is-lit' : ''}`} cx={o.x} cy={o.y} r={Math.hypot(p.x - o.x, p.y - o.y)} />;
        })}
      {c.lines.map(([a, b]) => {
        const p = seatPoint(id, c.stars[a]);
        const q = seatPoint(id, c.stars[b]);
        return <line key={`${a}-${b}`} className={`pact-line${lit[a] && lit[b] ? ' is-lit' : ''}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} />;
      })}
      {c.stars.map((star, i) => {
        const p = seatPoint(id, star);
        return (
          <circle
            key={star.id}
            className={`pact-star${lit[i] ? ' is-lit' : ''}`}
            cx={p.x}
            cy={p.y}
            r={lit[i] ? starR * 1.35 : starR}
            style={{ '--twinkle': `${(i * 0.37) % 2.4}s`, '--pop': `${i * 0.12}s` } as CSSProperties}
          />
        );
      })}
    </g>
  );
}

interface SeatProps {
  id: string;
  state: ConstellationState;
  profile: Profile;
  calling: boolean;
  stirring: boolean;
  onTap: () => void;
}

/** One of the ring's three seats: an empty socket until its constellation is glimpsed, then its shape, named. */
function Seat({ id, state, profile, calling, stirring, onTap }: SeatProps) {
  const seat = SEATS[id];
  const hidden = state === 'hidden';
  const below = seat.y + MEDALLION_R + 15;
  return (
    <g className={`pact-seat is-${state}${calling ? ' is-calling' : ''}${stirring ? ' is-stirring' : ''}`}>
      <circle className="pact-medallion" cx={seat.x} cy={seat.y} r={MEDALLION_R} />
      <circle className="pact-medallion-rim" cx={seat.x} cy={seat.y} r={MEDALLION_R - 4} />
      {calling && <circle className="pact-call" cx={seat.x} cy={seat.y} r={MEDALLION_R} />}
      {!hidden && <SeatShape id={id} profile={profile} state={state} starR={1.5} />}
      {!hidden && (
        <text className="pact-name" x={seat.x} y={below} textAnchor="middle">
          {sky.constellations[id].name}
        </text>
      )}
      {!hidden && <circle className="pact-hit" cx={seat.x} cy={seat.y + 6} r={MEDALLION_R + 12} onClick={onTap} />}
    </g>
  );
}

function Infinite({ state, profile, calling, stirring, onTap }: Omit<SeatProps, 'id'>) {
  const hidden = state === 'hidden';
  return (
    <g className={`pact-seat is-centre is-${state}${calling ? ' is-calling' : ''}${stirring ? ' is-stirring' : ''}`}>
      {calling && <circle className="pact-call" cx={RING.x} cy={RING.y} r={INNER_R} />}
      {!hidden && <SeatShape id="infinite" profile={profile} state={state} starR={2.6} />}
      {!hidden && (
        <text className="pact-name is-centre" x={RING.x} y={RING.y + INNER_R + 17} textAnchor="middle">
          {sky.constellations.infinite.name}
        </text>
      )}
      {!hidden && <circle className="pact-hit" cx={RING.x} cy={RING.y} r={INNER_R + 6} onClick={onTap} />}
    </g>
  );
}

/** First Light once it is sealed: the trail folded into a small clasp at the ring's foot. */
function Clasp({ onTap }: { onTap: () => void }) {
  return (
    <g className="pact-seat is-clasp is-lit">
      <circle className="pact-medallion is-clasp" cx={SEATS.firstLight.x} cy={SEATS.firstLight.y} r={CLASP_R} />
      <SeatShape id="firstLight" profile={null} state="lit" starR={1.1} />
      <text className="pact-name is-clasp" x={SEATS.firstLight.x} y={SEATS.firstLight.y + CLASP_R + 13} textAnchor="middle">
        {sky.constellations.firstLight.name}
      </text>
      <circle className="pact-hit" cx={SEATS.firstLight.x} cy={SEATS.firstLight.y + 4} r={CLASP_R + 12} onClick={onTap} />
    </g>
  );
}

interface TrailProps {
  lit: boolean[];
  fx: Fx;
  disabled: boolean;
  calling: boolean;
  onPlayLesson: (scenarioId: string) => void;
}

/** First Light before it is sealed: four stars climbing to the gap, a lit one's page inked, the next one's blank, the rest unknown. */
function Trail({ lit, fx, disabled, calling, onPlayLesson }: TrailProps) {
  const c = sky.constellations.firstLight;
  const nextIndex = lit.findIndex((l) => !l);
  const gate = onRing(90);
  /** The clasp's star each trail star folds into, as an offset from where it stands. */
  const foldTo = (i: number) => {
    const p = seatPoint('firstLight', c.stars[i]);
    return { x: p.x - TRAIL[i].x, y: p.y - TRAIL[i].y };
  };
  return (
    <g className={`pact-trail${fx.folding ? ' is-folding' : ''}${calling ? ' is-calling' : ''}`}>
      {/* The thread from the last star up into the gap: where the trail is going. */}
      <line className={`pact-thread${lit.every(Boolean) ? ' is-lit' : ''}`} x1={TRAIL[3].x} y1={TRAIL[3].y - 6} x2={gate.x} y2={gate.y + 4} />
      {c.lines.map(([a, b], k) => {
        const p = TRAIL[a];
        const q = TRAIL[b];
        const isLit = lit[a] && lit[b];
        const drawing = fx.drawing === a;
        const flared = (fx.flare ?? 0) > k;
        return (
          <g key={`${a}-${b}`}>
            <line className="pact-trail-line" x1={p.x} y1={p.y} x2={q.x} y2={q.y} />
            {(isLit || drawing || (lit[a] && fx.waking === b)) && (
              <line
                className={`pact-trail-line is-lit${drawing ? ' is-drawing' : ''}${flared ? ' is-flared' : ''}`}
                x1={p.x}
                y1={p.y}
                x2={q.x}
                y2={q.y}
                pathLength={1}
              />
            )}
          </g>
        );
      })}
      {c.stars.map((star, i) => {
        const p = TRAIL[i];
        const isLit = lit[i];
        const isNext = i === nextIndex;
        const waking = fx.waking === i;
        const known = isLit || isNext;
        const playable = !disabled && known;
        const off = foldTo(i);
        return (
          <g
            key={star.id}
            className={`pact-trail-star${isLit ? ' is-lit' : ''}${isNext ? ' is-next' : ''}${known ? '' : ' is-unknown'}${fx.charging === i ? ' is-charging' : ''}${waking ? ' is-waking' : ''}`}
            style={{ '--fold-x': `${off.x}px`, '--fold-y': `${off.y}px`, '--fold-delay': `${(3 - i) * 0.06}s` } as CSSProperties}
          >
            <g className="pact-trail-body" transform={`translate(${p.x} ${p.y})`}>
              <circle className="pact-trail-halo" r={isLit ? 16 : 12} />
              {isNext && <circle className="pact-trail-pulse" r={9} />}
              {!known && <circle className="pact-trail-socket" r={6} />}
              <circle className="pact-trail-core" r={isLit ? 3.6 : known ? 3 : 2} />
              {isLit && <path className="pact-trail-glint" d={glint(9)} />}
              {fx.burst?.i === i && <Burst key={fx.burst.n} />}
            </g>
            {known && <PageMark x={p.x + (p.side === 'start' ? 16 : -16)} y={p.y - 2} inked={isLit} fresh={waking} />}
            {playable && <circle className="pact-hit" cx={p.x} cy={p.y} r={22} onClick={() => onPlayLesson(scenarioIdOf(star))} />}
          </g>
        );
      })}
    </g>
  );
}

/** A lesson's page beside its star: inked once the lesson is won, blank while it waits. */
function PageMark({ x, y, inked, fresh = false }: { x: number; y: number; inked: boolean; fresh?: boolean }) {
  return (
    <g className={`pact-page${inked ? ' is-inked' : ''}${fresh ? ' is-fresh' : ''}`} transform={`translate(${x} ${y}) scale(1.35)`}>
      <g className="pact-page-body">
        <path className="pact-page-sheet" d="M-5 -7h7l3 3v11h-10z" />
        <path className="pact-page-fold" d="M2 -7v3h3" />
        {inked && <path className="pact-page-ink" d="M-3 -1.5h6M-3 1.2h5M-3 3.9h6" />}
      </g>
    </g>
  );
}

/** A star bursting alight: two rings out, a crown of rays, and sparks thrown clear. */
function Burst() {
  return (
    <g className="pact-burst">
      <circle className="pact-burst-ring" r={4} />
      <circle className="pact-burst-ring is-late" r={4} />
      {Array.from({ length: 8 }, (_, k) => (
        <g key={`r${k}`} transform={`rotate(${k * 45})`}>
          <line className="pact-burst-ray" x1={0} y1={-7} x2={0} y2={-15} />
        </g>
      ))}
      {Array.from({ length: 12 }, (_, k) => {
        const a = (k / 12) * Math.PI * 2 + 0.3;
        const d = 20 + ((k * 7) % 16);
        return (
          <circle
            key={`s${k}`}
            className="pact-burst-spark"
            r={k % 3 === 0 ? 1.4 : 0.9}
            style={{ '--dx': `${Math.cos(a) * d}px`, '--dy': `${Math.sin(a) * d}px` } as CSSProperties}
          />
        );
      })}
    </g>
  );
}

interface CardProps {
  profile: Profile;
  constellation: ConstellationDefinition;
  state: Exclude<ConstellationState, 'hidden'>;
  disabled: boolean;
  pressHidden: boolean;
  onPlay: (play: SkyPlay) => void;
  onPlayLesson?: (scenarioId: string) => void;
}

/** One constellation zoomed in: its name, its shape with its stars named, and its press. */
function ConstellationCard({ profile, constellation: c, state, disabled, pressHidden, onPlay, onPlayLesson }: CardProps) {
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
    <section className={`sky-band is-${state}${c.uncharted ? ' is-uncharted' : ''}${c.id === 'infinite' ? ' is-main' : ''}`}>
      <h2 className="sky-band-name">{c.name}</h2>
      <svg className="sky-band-shape" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        {c.rings &&
          c.stars.map((star, i) => {
            const p = cardPoint(star);
            return <circle key={`ring-${star.id}`} className={`sky-band-line sky-band-orbit${lit[i] ? ' is-lit' : ''}`} cx={CENTRE.x} cy={CENTRE.y} r={Math.hypot(p.x - CENTRE.x, p.y - CENTRE.y)} />;
          })}
        {c.lines.map(([a, b]) => {
          const p = cardPoint(c.stars[a]);
          const q = cardPoint(c.stars[b]);
          return <line key={`${a}-${b}`} className={`sky-band-line${lit[a] && lit[b] ? ' is-lit' : ''}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} />;
        })}
        {c.stars.map((star, i) => {
          const p = cardPoint(star);
          return (
            <circle
              key={star.id}
              className={`sky-band-star${lit[i] ? ' is-lit' : ''}`}
              cx={p.x}
              cy={p.y}
              r={lit[i] ? 4.6 : 3}
              filter={lit[i] ? 'url(#pact-glow)' : undefined}
              style={{ '--twinkle': `${(i * 0.37) % 2.4}s` } as CSSProperties}
            />
          );
        })}
        {!glimpsed &&
          c.stars.map((star, i) => {
            // Out from the shape's centre, so a ring's names stand round it rather than on each other.
            const p = cardPoint(star);
            const dx = p.x - CENTRE.x;
            const dy = p.y - CENTRE.y;
            const d = Math.hypot(dx, dy) || 1;
            // A lesson is known by its page, not a name: tap it to play the lesson again.
            if (lessonOf(i)) {
              return (
                <g key={`${star.id}-label`} className={`sky-band-page${playableLesson(i) ? ' is-playable' : ''}`} onClick={playableLesson(i) ? () => onPlayLesson?.(c.stars[i].id) : undefined}>
                  <circle className="sky-band-hit" cx={p.x} cy={p.y} r={18} />
                  <PageMark x={p.x + (dx / d) * 16} y={p.y + (dy / d) * 16} inked={lit[i]} />
                </g>
              );
            }
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
            {lessonLabel(nextLesson)}
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
