import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { playSfx } from '../../audio/sfx';
import { prefersReducedMotion } from '../shared/reducedMotion';
import { NIGHT_STARS, NightSky } from './NightSky';
import landPainting from '../../../art/title/fogBanks.png';
import fallingTitan from '../../../art/title/fallingTitan.png';
import ridgePainting from '../../../art/title/openingRidge.png';
import './openingFall.css';

// The opening beat's scene (docs/the-sky.md §1): the Titan falls across the night, putting out the
// stars it passes, and comes down on the land; then the view pulls back to a ridge where Valor and
// Fang stand watching the glow. It plays on its own; nothing here waits for a tap.

const HOLD_MS = 900;
const FALL_MS = 2800;
const DWELL_MS = 1300;
const PAN_MS = 2800;

const FALL_AT = HOLD_MS;
const IMPACT_AT = FALL_AT + FALL_MS;
const PAN_AT = IMPACT_AT + DWELL_MS;
const SETTLED_AT = PAN_AT + PAN_MS;

/** Where it enters and lands in the fall, and where that glow sits in the ridge painting, percent of the box. */
const START = { x: 88, y: -14 };
const IMPACT = { x: 50, y: 70 };
const GLOW = { x: 48, y: 49 };
/** The ridge painting's zoom on its glow when the pull-back starts. */
const PAN_FROM = 2.6;
const WAKE_PX = 26;
const PATH_STEPS = 24;

type Phase = 'hold' | 'fall' | 'impact' | 'pan' | 'settled';

interface Props {
  onSettled: () => void;
}

export function OpeningFall({ onSettled }: Props) {
  const still = prefersReducedMotion();
  const [phase, setPhase] = useState<Phase>(still ? 'settled' : 'hold');
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLSpanElement>(null);
  const fallRef = useRef<HTMLDivElement>(null);
  const ridgeRef = useRef<HTMLImageElement>(null);

  useLayoutEffect(() => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (rect) setBox({ w: rect.width, h: rect.height });
  }, []);

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
      if (dist < WAKE_PX * (0.4 + p)) out.set(i, (FALL_AT + Math.sqrt(p) * FALL_MS) / 1000);
    });
    return out;
  }, [box]);

  useEffect(() => {
    if (still) {
      onSettled();
      return;
    }
    if (!box) return;
    playSfx('titan.stir', { gain: 0.7 });
    const timers = [
      window.setTimeout(() => {
        setPhase('fall');
        playSfx('entrance.dread');
      }, FALL_AT),
      window.setTimeout(() => {
        setPhase('impact');
        playSfx('seal.shatter');
        window.setTimeout(() => playSfx('titan.stir'), 250);
      }, IMPACT_AT),
      window.setTimeout(() => setPhase('pan'), PAN_AT),
      window.setTimeout(() => {
        setPhase('settled');
        onSettled();
      }, SETTLED_AT),
    ];

    const body = bodyRef.current;
    if (body) {
      const turn = headfirst(box);
      const frames = Array.from({ length: PATH_STEPS + 1 }, (_, k) => {
        const u = k / PATH_STEPS;
        const p = u * u;
        const x = START.x + (IMPACT.x - START.x) * p;
        const y = START.y + (IMPACT.y - START.y) * p;
        return { left: `${x}%`, top: `${y}%`, transform: `translate(-50%, -50%) rotate(${turn}deg) scale(${0.3 + 0.7 * p})`, offset: u };
      });
      body.animate(frames, { duration: FALL_MS, delay: FALL_AT, fill: 'both', easing: 'linear' });
    }

    // One pull-back across both layers: the fall shrinks its impact onto the ridge's glow as the ridge opens out from it.
    const ease = 'cubic-bezier(0.45, 0, 0.2, 1)';
    fallRef.current?.animate(
      [
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { opacity: 0, offset: 0.45 },
        { transform: `translate(${GLOW.x - IMPACT.x}%, ${GLOW.y - IMPACT.y}%) scale(${1 / PAN_FROM})`, opacity: 0 },
      ],
      { duration: PAN_MS, delay: PAN_AT, fill: 'both', easing: ease }
    );
    ridgeRef.current?.animate(
      [
        { transform: `scale(${PAN_FROM})`, opacity: 0 },
        { opacity: 1, offset: 0.4 },
        { transform: 'scale(1)', opacity: 1 },
      ],
      { duration: PAN_MS, delay: PAN_AT, fill: 'both', easing: ease }
    );
    return () => timers.forEach(window.clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [still, box]);

  return (
    <div ref={rootRef} className={`opening-fall is-${phase}`} aria-hidden="true">
      {!still && (
        <div ref={fallRef} className="opening-fall-world" style={{ transformOrigin: `${IMPACT.x}% ${IMPACT.y}%` }}>
          <div className="opening-fall-shake">
            <NightSky outAt={outAt} />
            <span ref={bodyRef} className="opening-fall-body">
              <span className="opening-fall-trail" />
              <span className="opening-fall-figure" style={{ backgroundImage: `url(${fallingTitan})` }} />
            </span>
            <span className="opening-fall-flash" style={{ left: `${IMPACT.x}%`, top: `${IMPACT.y}%` }} />
            <span className="opening-fall-plume" style={{ left: `${IMPACT.x}%`, top: `${IMPACT.y}%` }} />
            <span className="opening-fall-ember" style={{ left: `${IMPACT.x}%`, top: `${IMPACT.y}%` }} />
            <img className="title-painting" src={landPainting} alt="" draggable={false} />
          </div>
        </div>
      )}
      <img
        ref={ridgeRef}
        className="opening-fall-ridge"
        src={ridgePainting}
        alt=""
        draggable={false}
        style={{ transformOrigin: `${GLOW.x}% ${GLOW.y}%`, opacity: still ? 1 : 0 }}
      />
    </div>
  );
}

/** The rotation that turns the upright figure head-first down the path, in degrees. */
function headfirst(box: { w: number; h: number }): number {
  const dx = ((IMPACT.x - START.x) / 100) * box.w;
  const dy = ((IMPACT.y - START.y) / 100) * box.h;
  return (Math.atan2(dy, dx) * 180) / Math.PI + 90;
}
