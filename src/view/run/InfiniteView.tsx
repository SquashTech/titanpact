import { useEffect, useRef, useState } from 'react';
import { CYCLES } from '../../run/cycles';
import { playSfx } from '../../audio/sfx';
import { PlateButton } from '../shared/PlateButton';
import { prefersReducedMotion } from '../shared/reducedMotion';
import './infiniteView.css';

// The Infinite, tapped (2026-10-26, per user direction, replacing the star map and the Cycle
// picker): a black hole, its disk burning in the chosen Cycle's colour, and the Cycles chosen at the
// top. Enter starts that Cycle. Drawn in code, presentation only.

/** Each Cycle's fire: hue and saturation, near its star colour (docs/cycles.md §5); V turns through them all. */
const CYCLE_FIRE: Record<number, { h: number; s: number }> = {
  1: { h: 42, s: 35 },
  2: { h: 24, s: 85 },
  3: { h: 205, s: 50 },
  4: { h: 44, s: 92 },
  5: { h: 0, s: 80 },
};

const DISK = 700;
const FIELD = 110;
const HOLE_R = 44;
const DISK_TILT = 0.32;

function seeded(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

interface Props {
  /** The highest Cycle open to play. */
  openCycle: number;
  cleared: number;
  /** A run is parked or the screen is launching: Enter waits. */
  disabled: boolean;
  onEnter: (cycle: number) => void;
}

export function InfiniteView({ openCycle, cleared, disabled, onEnter }: Props) {
  const [cycle, setCycle] = useState(openCycle);
  const ref = useRef<HTMLCanvasElement>(null);
  const cycleRef = useRef(cycle);
  cycleRef.current = cycle;
  const def = CYCLES[cycle - 1];
  const locked = cycle > openCycle;

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const r = seeded(31);
    const disk = Array.from({ length: DISK }, () => ({ a: r() * 6.28, d: 52 + Math.pow(r(), 1.6) * 90, s: r() * 1.6 + 0.4, sp: 0.4 + r() * 0.6 }));
    const field = Array.from({ length: FIELD }, () => ({ x: r(), y: r(), s: r() * 1.3 + 0.3, p: r() * 6.28, sp: 0.5 + r() * 1.5 }));
    const still = prefersReducedMotion();
    const start = performance.now();
    let frame = 0;

    const draw = (now: number) => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      const dpr = 2;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      const t = still ? 0 : (now - start) / 1000;
      const n = cycleRef.current;
      const cold = n > openCycle;
      const fire = CYCLE_FIRE[n];
      const hue = n === 5 ? (t * 40) % 360 : fire.h;
      const col = (l: number, a: number) => (cold ? `hsla(220, 8%, ${l}%, ${a})` : `hsla(${hue}, ${fire.s}%, ${l}%, ${a})`);
      const cx = w / 2;
      const cy = h / 2;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      for (const star of field) {
        ctx.fillStyle = `rgba(230, 236, 255, ${(0.45 + 0.55 * Math.sin(t * star.sp + star.p)) * 0.6})`;
        ctx.fillRect(star.x * w, star.y * h, star.s, star.s);
      }
      const halo = ctx.createRadialGradient(cx, cy, 30, cx, cy, 170);
      halo.addColorStop(0, col(60, 0.35));
      halo.addColorStop(1, col(40, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, w, h);

      const back: [number, number, (typeof disk)[number]][] = [];
      const front: [number, number, (typeof disk)[number]][] = [];
      for (const p of disk) {
        const a = p.a + t * p.sp * (70 / p.d);
        const y = Math.sin(a) * p.d * DISK_TILT;
        (y < 0 ? back : front).push([cx + Math.cos(a) * p.d, cy + y, p]);
      }
      const plot = ([x, y, p]: [number, number, (typeof disk)[number]]) => {
        ctx.fillStyle = col(75 - (p.d - 52) * 0.25, 0.85 - (p.d - 52) / 130);
        ctx.fillRect(x, y, p.s, p.s);
      };
      ctx.globalCompositeOperation = 'lighter';
      back.forEach(plot);
      // The far side of the disk, bent up over the top by the hole's pull.
      for (let k = 0; k < 18; k++) {
        const rr = HOLE_R + 6 + k * 2.2;
        const flick = 0.5 + 0.5 * Math.sin(t * 1.3 + k);
        ctx.strokeStyle = col(70 - k, (0.32 - k * 0.016) * (0.8 + 0.2 * flick));
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rr, rr * 0.92, 0, Math.PI * 1.04, Math.PI * 1.96);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(cx, cy, HOLE_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = col(85, 0.9);
      ctx.lineWidth = 2;
      ctx.shadowColor = col(70, 1);
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(cx, cy, HOLE_R + 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = 'lighter';
      front.forEach(plot);
      ctx.globalCompositeOperation = 'source-over';
      if (!still) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [openCycle]);

  const step = (by: number) => {
    const next = Math.max(1, Math.min(CYCLES.length, cycle + by));
    if (next === cycle) return;
    playSfx('ui.tab');
    setCycle(next);
  };

  return (
    <div className={`infinite-view${locked ? ' is-locked' : ''}`}>
      <div className="infinite-cycles">
        <div className="infinite-cycles-row">
          <button type="button" className="infinite-step" aria-label="Previous Cycle" disabled={cycle === 1} data-sfx="none" onClick={() => step(-1)}>
            ‹
          </button>
          <div key={cycle} className="infinite-cycle">
            <div className="infinite-numeral">{def.numeral}</div>
            <div className="infinite-name">{def.name}</div>
          </div>
          <button type="button" className="infinite-step" aria-label="Next Cycle" disabled={cycle === CYCLES.length} data-sfx="none" onClick={() => step(1)}>
            ›
          </button>
        </div>
        <div className="infinite-pips" aria-hidden="true">
          {CYCLES.map((c) => (
            <span key={c.cycle} className={`infinite-pip${c.cycle <= cleared ? ' is-cleared' : ''}${c.cycle === cycle ? ' is-chosen' : ''}`} />
          ))}
        </div>
      </div>
      <canvas ref={ref} className="infinite-hole" aria-hidden="true" />
      <div className="infinite-press">
        <PlateButton onClick={() => onEnter(cycle)} disabled={disabled || locked} data-sfx="ui.commit">
          {locked ? (cycle === cleared + 1 ? 'Needs a full deck' : `Clear ${CYCLES[cycle - 2].numeral} first`) : `Enter Cycle ${def.numeral}`}
        </PlateButton>
      </div>
    </div>
  );
}
