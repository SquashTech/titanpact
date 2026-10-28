import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from '../shared/reducedMotion';
import './galaxySky.css';

// The title's sky (2026-10-26, per user direction, replacing the treeline): a slow spiral galaxy
// whose bright core sits behind the Infinite, so the heart of the sky and the heart of the game are
// one. Drawn in code, presentation only; it reads where the Infinite stands off the page.

const ARMS = 3;
const ARM_PARTICLES = 1700;
const FIELD_STARS = 160;
/** Radians a second: one turn in about three and a half minutes. */
const SPIN = 0.03;
/** How flat the disk lies. */
const TILT = 0.55;

interface Particle {
  a: number;
  d: number;
  s: number;
  hue: number;
}

function seeded(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Where the Infinite's centre is on the canvas, or null until it is found. Held while a seat is zoomed: the core stays put under the flight. */
function coreOf(canvas: HTMLCanvasElement): { x: number; y: number } | null {
  if (document.querySelector('.sky-chart.is-zoomed')) return null;
  const box = canvas.getBoundingClientRect();
  const inner = document.querySelector('.pact-inner')?.getBoundingClientRect();
  const sx = canvas.offsetWidth / (box.width || 1);
  if (!inner || inner.width === 0) return null;
  return { x: (inner.left + inner.width / 2 - box.left) * sx, y: (inner.top + inner.height / 2 - box.top) * sx };
}

/** How fast the core glides after the Infinite when it moves (a scroll up the climb, a fold): per second. */
const CORE_EASE = 6;

export function GalaxySky({ active }: { active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const r = seeded(23);
    const arms: Particle[] = Array.from({ length: ARM_PARTICLES }, () => {
      const arm = Math.floor(r() * ARMS);
      const d = Math.pow(r(), 0.75) * 340;
      return { a: (arm * Math.PI * 2) / ARMS + d * 0.018 + (r() - 0.5) * 0.5, d, s: r() * 1.6 + 0.5, hue: r() };
    });
    const field = Array.from({ length: FIELD_STARS }, () => ({ x: r(), y: r(), s: r() * 1.3 + 0.3, p: r() * 6.28, sp: 0.4 + r() * 1.2 }));
    const found = coreOf(canvas);
    let core = found ?? { x: canvas.offsetWidth / 2, y: canvas.offsetHeight * 0.42 };
    let placed = !!found;
    let last = performance.now();
    let frame = 0;
    const still = prefersReducedMotion();
    const start = performance.now();

    const draw = (now: number) => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      const dpr = 2;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      const target = coreOf(canvas);
      const k = Math.min(1, ((now - last) / 1000) * CORE_EASE);
      last = now;
      if (target && !placed) {
        core = target;
        placed = true;
      } else if (target) {
        core = { x: core.x + (target.x - core.x) * k, y: core.y + (target.y - core.y) * k };
      }
      const t = still ? 0 : (now - start) / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#04050a';
      ctx.fillRect(0, 0, w, h);

      for (const star of field) {
        const a = (0.45 + 0.55 * Math.sin(t * star.sp + star.p)) * 0.7;
        ctx.fillStyle = `rgba(230, 236, 255, ${a})`;
        ctx.fillRect(star.x * w, star.y * h, star.s, star.s);
      }

      const glow = ctx.createRadialGradient(core.x, core.y, 0, core.x, core.y, 220);
      glow.addColorStop(0, 'rgba(255, 225, 170, 0.42)');
      glow.addColorStop(0.4, 'rgba(150, 110, 220, 0.18)');
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      const turn = t * SPIN;
      for (const p of arms) {
        const a = p.a + turn;
        const x = core.x + Math.cos(a) * p.d;
        const y = core.y + Math.sin(a) * p.d * TILT;
        ctx.fillStyle =
          p.d < 70
            ? `rgba(255, 220, 160, ${0.85 - p.d / 160})`
            : p.hue > 0.5
              ? `rgba(180, 160, 255, ${0.8 - p.d / 500})`
              : `rgba(150, 215, 235, ${0.75 - p.d / 500})`;
        ctx.fillRect(x, y, p.s, p.s);
      }

      if (!still) frame = requestAnimationFrame(loop);
    };
    // Held still while another hub page is up: nothing would see it turn.
    const loop = (now: number) => {
      if (activeRef.current) draw(now);
      else frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  return <canvas ref={ref} className="title-galaxy" aria-hidden="true" />;
}
