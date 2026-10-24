import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { sky } from '../../data/sky';
import { THOUGHTS } from '../../data/thoughts';
import { trials } from '../../data/trials';
import { cycleOf } from '../../run/cycles';
import type { Profile } from '../../run/profile';
import { constellationState, isConstellationLit, isStarLit, starScenario, type ConstellationDefinition, type ConstellationState, type SkyStar } from '../../run/sky';
import { revealedFirst, revealedThought, thoughtFor, type ThoughtDefinition, type ThoughtMoment } from '../../run/thoughts';
import { PlateButton } from '../shared/PlateButton';
import { Blip, type BlipHandle } from './Blip';
import './skyChart.css';

// The title as the sky (docs/the-sky.md §2, §10 phase 4): every constellation the account can see,
// lit, open, or glimpsed as a shape with its reward. A tap opens one; its sheet lists its stars and
// holds the one press that plays it.

const W = 360;
const H = 440;

/** A constellation's box in the chart's units: the Trials hold fourteen stars and get more room. */
const boxOf = (c: ConstellationDefinition) => (c.stars.length > 6 ? 112 : 96);

/** Where a star sits in the chart. */
function place(c: ConstellationDefinition, star: SkyStar): { x: number; y: number } {
  const size = boxOf(c);
  return { x: c.at.x * W - size / 2 + star.x * size, y: c.at.y * H - size / 2 + star.y * size };
}

/** What the sheet's one press does, read off the kind of star the constellation holds. */
export type SkyPlay = 'journey' | 'cycles' | 'trials' | 'gauntlet';

function playOf(c: ConstellationDefinition): SkyPlay | null {
  switch (c.stars[0]?.light.kind) {
    case 'journeyWon':
      return 'journey';
    case 'cycleCleared':
      return 'cycles';
    case 'trialBeaten':
      return 'trials';
    case 'gauntletCleared':
      return 'gauntlet';
    default:
      return null;
  }
}

const PLAY_LABELS: Record<SkyPlay, string> = {
  journey: 'Enter the Infinite',
  cycles: 'Choose a Cycle',
  trials: 'Open the Trials',
  gauntlet: 'Enter the Gauntlet',
};

function starName(star: SkyStar): string {
  const scenario = starScenario(sky, star);
  if (scenario) return scenario.name;
  switch (star.light.kind) {
    case 'journeyWon':
      return 'The Titan slain';
    case 'cycleCleared': {
      const cycle = cycleOf(star.light.cycle);
      return `Cycle ${cycle.numeral} · ${cycle.name}`;
    }
    case 'trialBeaten':
      return trials[star.light.trialId]?.name ?? star.light.trialId;
    case 'gauntletCleared':
      return 'The Gauntlet cleared';
    default:
      return star.id;
  }
}

/** Where Blip rests by a constellation, in chart units: just over its highest star. */
function perchOf(c: ConstellationDefinition): { x: number; y: number } {
  const top = Math.min(...c.stars.map((star) => place(c, star).y));
  return { x: c.at.x * W, y: top - (c.stars.length === 1 ? 26 : 16) };
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
  /** How the last Infinite run ended, when the player has just come back from it; Blip reacts once. */
  returned?: 'win' | 'loss' | null;
  onReturnedSeen?: () => void;
  /** A first Blip has thought, to keep once an account. */
  onSeeThought?: (thought: ThoughtDefinition) => void;
  onPlay: (play: SkyPlay) => void;
}

export function SkyChart({ profile, disabled = false, active = true, returned = null, onReturnedSeen, onSeeThought, onPlay }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const shown = Object.values(sky.constellations)
    .map((c) => ({ c, state: constellationState(profile, sky, c.id) }))
    .filter((entry): entry is { c: ConstellationDefinition; state: Exclude<ConstellationState, 'hidden'> } => entry.state !== 'hidden');
  const open = openId ? sky.constellations[openId] : null;

  // The stage is the svg's own box, so a chart point maps to Blip's pixels on the same meet fit.
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
  const toStage = (p: { x: number; y: number }) => ({ x: fitRef.current.ox + p.x * fitRef.current.scale, y: fitRef.current.oy + p.y * fitRef.current.scale });

  // Blip rests by the constellation a press would play next: the first open, unlit one with a press, else the Infinite.
  const restingBy =
    shown.find(({ c, state }) => state === 'open' && !c.uncharted && playOf(c) && !isConstellationLit(profile, c))?.c ?? sky.constellations.journey;
  const home = toStage(perchOf(restingBy));
  const homeRef = useRef(home);
  homeRef.current = home;
  const goHome = () => blip.current?.goTo(homeRef.current.x, homeRef.current.y);

  const blip = useRef<BlipHandle>(null);
  const blipActive = active && !open;
  /** Fly to a constellation, say its first there, and come home after. */
  const show = (constellationId: string, thought: ThoughtDefinition, later: (ms: number, fn: () => void) => void) => {
    const target = toStage(perchOf(sky.constellations[constellationId]));
    blip.current?.goTo(target.x, target.y, () => {
      blip.current?.think(thought.lines, () => later(1200, goHome), true);
      onSeeThought?.(thought);
    });
  };
  const say = (moment: ThoughtMoment, later?: (ms: number, fn: () => void) => void) => {
    const thought = thoughtFor(profile, THOUGHTS, moment, Math.random());
    if (!thought) return false;
    const next = thought.showsNext && later ? revealedFirst(profile, THOUGHTS, thought.showsNext) : null;
    blip.current?.think(thought.lines, next && later ? () => show(thought.showsNext!, next, later) : undefined, !!thought.once);
    if (thought.once) onSeeThought?.(thought);
    return true;
  };

  // One thing to say on arriving — an Infinite run's end, the first sky, a constellation seen open for the
  // first time — then a few idle thoughts, spaced out, and a dart now and then to look around.
  useEffect(() => {
    if (!blipActive) return;
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
        if (blip.current?.busy()) {
          // Never cut a thought or a trip short: try again next beat.
        } else if (Math.random() < 0.5 && idle < IDLE_THOUGHTS_A_VISIT) {
          idle++;
          say({ kind: 'idle' });
        } else {
          const visible = shown.filter(({ state }) => state !== 'glimpsed');
          const pick = visible[Math.floor(Math.random() * visible.length)];
          if (pick) {
            const target = toStage(perchOf(pick.c));
            blip.current?.goTo(target.x, target.y, () => at(2600, goHome));
          }
        }
        next();
      });
    next();
    return () => timers.forEach(window.clearTimeout);
    // A visit is one mount while active; the profile changing under it (a first recorded) must not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blipActive]);

  return (
    <>
      <div className="sky-chart">
        <div ref={stageRef} className="sky-chart-stage">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" aria-label="The sky">
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
            const size = boxOf(c);
            const lit = c.stars.map((star) => isStarLit(profile, c, star));
            const tappable = state !== 'glimpsed' && !disabled;
            const reward = c.rewards.reduce((sum, r) => sum + r.amount, 0);
            // A constellation of one star is a mode in itself; it is drawn larger so it reads as a place to go.
            const solo = c.stars.length === 1;
            return (
              <g
                key={c.id}
                className={`sky-con is-${state}${c.uncharted ? ' is-uncharted' : ''}`}
                role={tappable ? 'button' : undefined}
                tabIndex={tappable ? 0 : undefined}
                aria-label={tappable ? c.name : undefined}
                onClick={tappable ? () => setOpenId(c.id) : undefined}
                onKeyDown={
                  tappable
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') setOpenId(c.id);
                      }
                    : undefined
                }
              >
                <circle className="sky-con-hit" cx={c.at.x * W} cy={c.at.y * H} r={size * 0.62} />
                {c.lines.map(([a, b]) => {
                  const p = place(c, c.stars[a]);
                  const q = place(c, c.stars[b]);
                  return <line key={`${a}-${b}`} className="sky-con-line" x1={p.x} y1={p.y} x2={q.x} y2={q.y} />;
                })}
                {solo && state !== 'glimpsed' && <circle className="sky-con-halo" cx={place(c, c.stars[0]).x} cy={place(c, c.stars[0]).y} r={14} />}
                {c.stars.map((star, i) => {
                  const p = place(c, star);
                  return (
                    <circle
                      key={star.id}
                      className={`sky-con-star${lit[i] ? ' is-lit' : ''}`}
                      cx={p.x}
                      cy={p.y}
                      r={(lit[i] ? 3.6 : 2.4) * (solo ? 1.6 : 1)}
                      filter={lit[i] ? 'url(#sky-chart-glow)' : undefined}
                      style={{ '--twinkle': `${(i * 0.37) % 2.4}s` } as CSSProperties}
                    />
                  );
                })}
                <text className="sky-con-name" x={c.at.x * W} y={c.at.y * H + (solo ? 24 : size / 2 + 12)} textAnchor="middle">
                  {c.name}
                </text>
                {state === 'glimpsed' && reward > 0 && (
                  <text className="sky-con-reward" x={c.at.x * W} y={c.at.y * H + (solo ? 36 : size / 2 + 24)} textAnchor="middle">
                    ✦ {reward}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        <Blip
          ref={blip}
          home={home}
          active={blipActive}
          onPoke={(inARow) => {
            // A poke mid-thought only giggles, so it never cuts a first short.
            if (blip.current?.guarded()) return;
            if (inARow >= 5) say({ kind: 'pokedLots' });
            else if (inARow === 1 || inARow === 3) say({ kind: 'poked' });
          }}
        />
        </div>
      </div>

      {open && (
        <ConstellationSheet
          profile={profile}
          constellation={open}
          onSeeThought={onSeeThought}
          onClose={() => setOpenId(null)}
          onPlay={(play) => {
            setOpenId(null);
            onPlay(play);
          }}
        />
      )}
    </>
  );
}

function ConstellationSheet({
  profile,
  constellation,
  onSeeThought,
  onClose,
  onPlay,
}: {
  profile: Profile;
  constellation: ConstellationDefinition;
  onSeeThought?: (thought: ThoughtDefinition) => void;
  onClose: () => void;
  onPlay: (play: SkyPlay) => void;
}) {
  const play = playOf(constellation);
  const reward = constellation.rewards.reduce((sum, r) => sum + r.amount, 0);
  const lit = constellation.stars.map((star) => isStarLit(profile, constellation, star));
  const allLit = lit.every(Boolean);
  const uncharted = !!constellation.uncharted && !allLit;

  // Blip perches on the sheet, and says its first about this constellation, if it has one left.
  const blip = useRef<BlipHandle>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const thought = thoughtFor(profile, THOUGHTS, uncharted ? { kind: 'uncharted' } : { kind: 'opened', constellationId: constellation.id }, Math.random());
      if (!thought) return;
      blip.current?.think(thought.lines);
      if (thought.once) onSeeThought?.(thought);
    }, 450);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="sky-sheet-scrim" onClick={onClose}>
      <div className="sky-sheet" role="dialog" aria-label={constellation.name} onClick={(e) => e.stopPropagation()}>
        <div className="sky-sheet-perch">
          <Blip ref={blip} home={{ x: 40, y: 92 }} active />
        </div>
        <div className="sky-sheet-head">
          <span className="sky-sheet-name">{constellation.name}</span>
          {reward > 0 && !allLit && <span className="sky-sheet-reward">✦ {reward}</span>}
          <button type="button" className="sky-sheet-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <ul className={`sky-sheet-stars${constellation.stars.length > 6 ? ' is-many' : ''}`}>
          {constellation.stars.map((star, i) => (
            <li key={star.id} className={`sky-sheet-star${lit[i] ? ' is-lit' : ''}`}>
              <span className="sky-sheet-star-mark" aria-hidden="true">
                {lit[i] ? '★' : '☆'}
              </span>
              {starName(star)}
            </li>
          ))}
        </ul>
        {uncharted && <p className="sky-sheet-uncharted">Not yet charted.</p>}
        {play && (
          <PlateButton className="sky-sheet-play" onClick={() => onPlay(play)} data-sfx="ui.commit">
            {PLAY_LABELS[play]}
          </PlateButton>
        )}
      </div>
    </div>
  );
}
