import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { SKY_HEIGHT as H, SKY_WIDTH as W, sky } from '../../data/sky';
import { THOUGHTS } from '../../data/thoughts';
import { trials } from '../../data/trials';
import { cycleOf } from '../../run/cycles';
import type { Profile } from '../../run/profile';
import { constellationState, isConstellationLit, isStarLit, starScenario, type ConstellationDefinition, type ConstellationState, type SkyStar } from '../../run/sky';
import { revealedFirst, revealedThought, thoughtFor, zoomThought, type ThoughtDefinition, type ThoughtMoment } from '../../run/thoughts';
import { PlateButton } from '../shared/PlateButton';
import { Blip, type BlipHandle } from './Blip';
import './skyChart.css';

// The title as the sky (docs/the-sky.md §2, the zoom sky picked 2026-10-24): five constellations on
// one screen, the Infinite's press under it. A tap zooms the sky into a constellation, its stars named
// and its own press at the foot. Blip sits in a band under the logo and talks there, so its thoughts
// never cover a constellation; it flies out only to point at one.

/** Blip's band, over the sky; its seat sits in it. */
const BAND = 56;
const SEAT = { x: 26, y: BAND / 2 };
const ZOOM_MS = 650;

type Box = [number, number, number, number];
const OVERVIEW: Box = [0, 0, W, H];

const sizeOf = (c: ConstellationDefinition) => c.size * W;
const centreOf = (c: ConstellationDefinition) => ({ x: c.at.x * W, y: c.at.y * H });

/** Where a star sits in the sky. */
function place(c: ConstellationDefinition, star: SkyStar): { x: number; y: number } {
  const size = sizeOf(c);
  const o = centreOf(c);
  return { x: o.x - size / 2 + star.x * size, y: o.y - size / 2 + star.y * size };
}

/** Just over a constellation's highest star, where Blip points from. */
function perchOf(c: ConstellationDefinition): { x: number; y: number } {
  return { x: centreOf(c).x, y: Math.min(...c.stars.map((star) => place(c, star).y)) - 22 };
}

/** The view a zoom settles on: the constellation with room round it for its names, in the sky's own shape. */
function zoomBox(c: ConstellationDefinition): Box {
  const size = sizeOf(c);
  const w = Math.min(size * 2, size + 110);
  const h = (w * H) / W;
  const o = centreOf(c);
  return [o.x - w / 2, o.y - h / 2 + size * 0.08, w, h];
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
}

export function SkyChart({ profile, disabled = false, active = true, pressHidden = false, returned = null, onReturnedSeen, onSeeThought, onPlay }: Props) {
  const [zoomId, setZoomId] = useState<string | null>(null);
  const shown = Object.values(sky.constellations)
    .map((c) => ({ c, state: constellationState(profile, sky, c.id) }))
    .filter((entry): entry is { c: ConstellationDefinition; state: Exclude<ConstellationState, 'hidden'> } => entry.state !== 'hidden');
  const zoomed = zoomId ? sky.constellations[zoomId] : null;

  // The stage is the svg's own box; a sky point maps to it on the overview's meet fit.
  const stageRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ scale: 1, ox: 0, oy: 0 });
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => {
      const scale = Math.min(stage.clientWidth / W, stage.clientHeight / H) || 1;
      setFit({ scale, ox: (stage.clientWidth - W * scale) / 2, oy: (stage.clientHeight - H * scale) / 2 });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    measure();
    return () => observer.disconnect();
  }, []);
  // Read through a ref: the visit's timers outlive the render that set them, and must see the fit as it is now.
  const fitRef = useRef(fit);
  fitRef.current = fit;
  /** A sky point in Blip's stage, which also covers the band above the sky. */
  const toBlip = (p: { x: number; y: number }) => ({ x: fitRef.current.ox + p.x * fitRef.current.scale, y: BAND + fitRef.current.oy + p.y * fitRef.current.scale });

  // The zoom: the viewBox walks between the overview and a constellation's box, set straight on the svg.
  const svgRef = useRef<SVGSVGElement>(null);
  const view = useRef<Box>(OVERVIEW);
  useEffect(() => {
    const to = zoomed ? zoomBox(zoomed) : OVERVIEW;
    const from = view.current.slice() as Box;
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ZOOM_MS);
      const e = 1 - Math.pow(1 - t, 3);
      view.current = from.map((v, i) => v + (to[i] - v) * e) as Box;
      svgRef.current?.setAttribute('viewBox', view.current.join(' '));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomId]);

  const blip = useRef<BlipHandle>(null);
  const goSeat = (onArrive?: () => void) => blip.current?.goTo(SEAT.x, SEAT.y, onArrive);
  /** Fly out to a constellation, point at it, and come back to the seat to say its first. */
  const show = (constellationId: string, thought: ThoughtDefinition, later: (ms: number, fn: () => void) => void) => {
    const target = toBlip(perchOf(sky.constellations[constellationId]));
    blip.current?.goTo(target.x, target.y, () => {
      blip.current?.react('chirp');
      later(650, () => goSeat(() => blip.current?.think(thought.lines, undefined, true)));
      onSeeThought?.(thought);
    });
  };
  const sayThought = (thought: ThoughtDefinition | null, onDone?: () => void) => {
    if (!thought) return false;
    blip.current?.think(thought.lines, onDone, !!thought.once);
    if (thought.once) onSeeThought?.(thought);
    return true;
  };
  const say = (moment: ThoughtMoment, later?: (ms: number, fn: () => void) => void) => {
    const thought = thoughtFor(profile, THOUGHTS, moment, Math.random());
    const next = thought?.showsNext && later ? revealedFirst(profile, THOUGHTS, thought.showsNext) : null;
    return sayThought(thought, next && later ? () => show(thought!.showsNext!, next, later) : undefined);
  };

  // One thing to say on arriving — an Infinite run's end, the first sky, a constellation seen open
  // for the first time — then a few idle thoughts, spaced out.
  const zoomRef = useRef(zoomId);
  zoomRef.current = zoomId;
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
        // Never cut a thought or a trip short, and leave a zoom to its own thought.
        if (!blip.current?.busy() && !zoomRef.current && idle < IDLE_THOUGHTS_A_VISIT) {
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

  // Zoomed in, Blip says its first about the constellation or one of its stars, if it has one left.
  useEffect(() => {
    if (!active || !zoomId) return;
    const timer = window.setTimeout(() => {
      if (!blip.current?.guarded()) sayThought(zoomThought(profile, sky, THOUGHTS, zoomId, Math.random()));
    }, ZOOM_MS + 100);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomId, active]);

  const infinite = sky.constellations.infinite;
  const infiniteOpen = shown.some(({ c, state }) => c.id === infinite.id && state !== 'glimpsed');
  const pressAt = {
    left: fit.ox + centreOf(infinite).x * fit.scale,
    top: fit.oy + (centreOf(infinite).y + sizeOf(infinite) / 2 + 24) * fit.scale,
  };
  const zoomedPlay = zoomed ? playOf(zoomed) : null;
  const zoomedUncharted = !!zoomed?.uncharted && !isConstellationLit(profile, zoomed);

  return (
    <div className={`sky-chart${zoomed ? ' is-zoomed' : ''}`}>
      <div ref={stageRef} className="sky-chart-stage">
        <svg ref={svgRef} viewBox={OVERVIEW.join(' ')} preserveAspectRatio="xMidYMid meet" aria-label="The sky">
          <defs>
            <filter id="sky-chart-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {shown.map(({ c, state }) => {
            const size = sizeOf(c);
            const o = centreOf(c);
            const lit = c.stars.map((star) => isStarLit(profile, c, star));
            const isZoomed = zoomId === c.id;
            const tappable = state !== 'glimpsed' && !disabled && !zoomId;
            const reward = c.rewards.reduce((sum, r) => sum + r.amount, 0);
            const labelSize = size * 0.05;
            return (
              <g
                key={c.id}
                className={`sky-con is-${state}${c.uncharted ? ' is-uncharted' : ''}${c.id === infinite.id ? ' is-main' : ''}${zoomId && !isZoomed ? ' is-dimmed' : ''}`}
                role={tappable ? 'button' : undefined}
                tabIndex={tappable ? 0 : undefined}
                aria-label={tappable ? c.name : undefined}
                onClick={tappable ? () => setZoomId(c.id) : undefined}
                onKeyDown={
                  tappable
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') setZoomId(c.id);
                      }
                    : undefined
                }
              >
                <circle className="sky-con-hit" cx={o.x} cy={o.y} r={size * 0.62} />
                {c.lines.map(([a, b]) => {
                  const p = place(c, c.stars[a]);
                  const q = place(c, c.stars[b]);
                  return <line key={`${a}-${b}`} className="sky-con-line" x1={p.x} y1={p.y} x2={q.x} y2={q.y} />;
                })}
                {c.stars.map((star, i) => {
                  const p = place(c, star);
                  return (
                    <circle
                      key={star.id}
                      className={`sky-con-star${lit[i] ? ' is-lit' : ''}`}
                      cx={p.x}
                      cy={p.y}
                      r={(lit[i] ? 3.4 : 2.3) * Math.max(1, size / 140)}
                      filter={lit[i] ? 'url(#sky-chart-glow)' : undefined}
                      style={{ '--twinkle': `${(i * 0.37) % 2.4}s` } as CSSProperties}
                    />
                  );
                })}
                {isZoomed &&
                  c.stars.map((star, i) => {
                    // Out from the shape's centre, so a ring's names stand round it rather than on each other.
                    const p = place(c, star);
                    const dx = p.x - o.x;
                    const dy = p.y - o.y;
                    const d = Math.hypot(dx, dy) || 1;
                    const anchor = Math.abs(dx) < size * 0.12 ? 'middle' : dx < 0 ? 'end' : 'start';
                    return (
                      <text
                        key={`${star.id}-label`}
                        className={`sky-con-label${lit[i] ? ' is-lit' : ''}`}
                        x={p.x + (dx / d) * size * 0.07}
                        y={p.y + (dy / d) * size * 0.07 + labelSize * 0.35}
                        textAnchor={anchor}
                        fontSize={labelSize}
                      >
                        {starName(star)}
                      </text>
                    );
                  })}
                {!isZoomed && (
                  <text className="sky-con-name" x={o.x} y={o.y + size / 2 + 14} textAnchor="middle">
                    {c.name}
                  </text>
                )}
                {state === 'glimpsed' && reward > 0 && (
                  <text className="sky-con-reward" x={o.x} y={o.y + size / 2 + 26} textAnchor="middle">
                    ✦ {reward}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {zoomed && (
          <button type="button" className="sky-back" onClick={() => setZoomId(null)}>
            ‹ The Sky
          </button>
        )}
        {!zoomed && infiniteOpen && !pressHidden && (
          <div className="sky-press is-overview" style={{ left: pressAt.left, top: pressAt.top }}>
            <PlateButton compact onClick={() => onPlay('infinite')} disabled={disabled} data-sfx="ui.commit">
              {PLAY_LABELS.infinite}
            </PlateButton>
          </div>
        )}
        {zoomed && (zoomedPlay || zoomedUncharted) && (
          <div className="sky-press is-zoomed">
            <PlateButton compact onClick={() => zoomedPlay && onPlay(zoomedPlay)} disabled={disabled || zoomedUncharted || !zoomedPlay} data-sfx="ui.commit">
              {zoomedUncharted ? 'Not yet charted' : PLAY_LABELS[zoomedPlay!]}
            </PlateButton>
          </div>
        )}
      </div>

      <Blip
        ref={blip}
        home={SEAT}
        active={active}
        bubbleBeside
        onPoke={(inARow) => {
          // A poke mid-first only giggles, so it never cuts one short.
          if (blip.current?.guarded()) return;
          if (inARow >= 5) say({ kind: 'pokedLots' });
          else if (inARow === 1 || inARow === 3) say({ kind: 'poked' });
        }}
      />
    </div>
  );
}
