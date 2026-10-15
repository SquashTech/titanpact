import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { prefersReducedMotion } from '../shared/reducedMotion';
import { NIGHT_STARS, NightSky } from './NightSky';
import titlePainting from '../../../art/title/fogBanks.png';
import fallingTitan from '../../../art/title/fallingTitan.png';

interface Props {
  lines: readonly string[];
  onDone: () => void;
}

/** The sky alone, held: the title with everything on it gone (ms). */
const HOLD_MS = 1300;
/** The fall, from past the top edge to the land, accelerating (ms). */
const FALL_MS = 3000;

const FALL_AT = HOLD_MS;
const IMPACT_AT = FALL_AT + FALL_MS;

/** Where it enters and where it lands, in percent of the sky's box. */
const START = { x: 92, y: -14 };
const IMPACT = { x: 36, y: 80 };
/** How wide a wake it cuts through the stars, px. */
const WAKE_PX = 26;
/** Keyframes the eased path is sampled into: progress is the square of time, so it accelerates. */
const PATH_STEPS = 24;
/** How many earlier lines stay up, receding, behind the newest. */
const CRAWL_DEPTH = 2;

type FallPhase = 'hold' | 'fall' | 'impact';

/**
 * The first run on an account (docs/lore.md "The fall"): the title with everything on it faded away,
 * then the Titan falls head-first across the sky — a black shape, the stars it passes going out and
 * staying out — and comes down on the land. The lore crawls over it a tap at a time, the newest line
 * rising from below and the older ones receding into the sky; the tap after the last goes to the
 * draft. The scene plays on its own under the words, so a tap never skips it.
 */
export function TitanFallScreen({ lines, onDone }: Props) {
  const still = prefersReducedMotion();
  const [phase, setPhase] = useState<FallPhase>(still ? 'impact' : 'hold');
  // -1 is the sky before any words; the first line comes up with the fall.
  const [step, setStep] = useState(still ? 0 : -1);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (rect) setBox({ w: rect.width, h: rect.height });
  }, []);

  // Every star within the wake of the path goes out at the moment the body passes it.
  const outAt = useMemo(() => {
    const out = new Map<number, number>();
    if (!box) return out;
    const sx = (START.x / 100) * box.w, sy = (START.y / 100) * box.h;
    const ex = (IMPACT.x / 100) * box.w, ey = (IMPACT.y / 100) * box.h;
    const dx = ex - sx, dy = ey - sy, len2 = dx * dx + dy * dy;
    NIGHT_STARS.forEach((star, i) => {
      const px = (star.x / 100) * box.w, py = (star.y / 100) * box.h;
      const p = Math.max(0, Math.min(1, ((px - sx) * dx + (py - sy) * dy) / len2));
      const dist = Math.hypot(sx + p * dx - px, sy + p * dy - py);
      // The body grows as it nears, so its wake widens with it.
      if (dist < WAKE_PX * (0.4 + p)) out.set(i, (FALL_AT + Math.sqrt(p) * FALL_MS) / 1000);
    });
    return out;
  }, [box]);

  useEffect(() => {
    if (still || !box) return;
    playSfx('titan.stir', { gain: 0.7 });
    const timers = [
      window.setTimeout(() => {
        setPhase('fall');
        setStep((i) => Math.max(i, 0));
        playSfx('entrance.dread');
      }, FALL_AT),
      window.setTimeout(() => {
        setPhase('impact');
        playSfx('seal.shatter');
        window.setTimeout(() => playSfx('titan.stir'), 250);
      }, IMPACT_AT),
    ];
    const body = bodyRef.current;
    if (body) {
      const frames = Array.from({ length: PATH_STEPS + 1 }, (_, k) => {
        const u = k / PATH_STEPS;
        const p = u * u;
        const x = START.x + (IMPACT.x - START.x) * p;
        const y = START.y + (IMPACT.y - START.y) * p;
        return { left: `${x}%`, top: `${y}%`, transform: `translate(-50%, -50%) rotate(${headfirst(box)}deg) scale(${0.3 + 0.7 * p})`, offset: u };
      });
      body.animate(frames, { duration: FALL_MS, delay: FALL_AT, fill: 'both', easing: 'linear' });
    }
    return () => timers.forEach(window.clearTimeout);
  }, [still, box]);

  function advance() {
    if (step >= lines.length - 1) {
      playSfx('ui.confirm');
      onDone();
      return;
    }
    playSfx('ui.tap');
    setStep((i) => i + 1);
  }

  return (
    <div ref={rootRef} className={`title-screen title-fall is-${phase}`} onClick={advance} role="dialog" aria-live="polite">
      <NightSky outAt={still ? undefined : outAt} />
      <img className="title-painting" src={titlePainting} alt="" draggable={false} />

      <div className="title-fall-shake" aria-hidden="true">
        <span ref={bodyRef} className="title-fall-body">
          <span className="title-fall-trail" />
          <span className="title-fall-figure" style={{ backgroundImage: `url(${fallingTitan})` }} />
        </span>
        <span className="title-fall-flash" style={{ left: `${IMPACT.x}%`, top: `${IMPACT.y}%` }} />
        <span className="title-fall-plume" style={{ left: `${IMPACT.x}%`, top: `${IMPACT.y}%` }} />
        <span className="title-fall-ember" style={{ left: `${IMPACT.x}%`, top: `${IMPACT.y}%` }} />
      </div>

      <div className="title-fall-crawl">
        {lines.map((line, i) => {
          const back = step - i;
          if (back < 0 || back > CRAWL_DEPTH) return null;
          return (
            <p
              key={i}
              className={`lore-line title-fall-line${i === lines.length - 1 ? ' is-last' : ''}${back === 0 ? ' is-current' : ''}`}
              style={{ '--back': back } as CSSProperties}
            >
              {line}
            </p>
          );
        })}
      </div>
    </div>
  );
}

/** The rotation that turns the upright figure head-first down the path, in degrees. */
function headfirst(box: { w: number; h: number }): number {
  const dx = ((IMPACT.x - START.x) / 100) * box.w;
  const dy = ((IMPACT.y - START.y) / 100) * box.h;
  return (Math.atan2(dy, dx) * 180) / Math.PI + 90;
}
