import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { playSfx } from '../../audio/sfx';
import './blip.css';

// Blip (docs/the-sky.md §1): the little face, a soft glow with two eyes that look where it is going.
// It springs toward its home, bobs while it waits and squishes when poked; it never speaks. Drawn on a canvas each frame; nothing here is a control except the poke, which opens nothing.

const TAU = Math.PI * 2;
const RADIUS = 12.5;
/** The spring Blip flies on, and the one its squish rings on. */
const PULL = 25;
const DAMP = 8;
const SQUISH_PULL = 220;
const SQUISH_DAMP = 9;
/** Pokes closer together than this count as a run of them. */
const POKE_RUN_MS = 1200;
const DIZZY_AT = 5;
/** Room the canvas keeps past the stage on every side, so the glow and a jump are never clipped square. */
const BLEED = 140;

type Mood = 'idle' | 'happy' | 'sad' | 'dizzy' | 'surprised';

export interface BlipHandle {
  /** Fly to a point in the stage's own pixels, and run `onArrive` once there. */
  goTo(x: number, y: number, onArrive?: () => void): void;
  react(kind: 'win' | 'lose' | 'chirp'): void;
}

interface Props {
  /** Where Blip rests, in the stage's pixels. */
  home: { x: number; y: number };
  /** Off, Blip stops drawing: the page is hidden or something stands over it. */
  active: boolean;
}

interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  homeX: number;
  homeY: number;
  travelling: boolean;
  onArrive: (() => void) | null;
  look: [number, number];
  mood: Mood;
  moodUntil: number;
  bright: number;
  brightTo: number;
  brightUntil: number;
  loopUntil: number;
  sinkUntil: number;
  squish: number;
  squishV: number;
  spin: number;
  seed: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
}

export const Blip = forwardRef<BlipHandle, Props>(function Blip({ home, active }, ref) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hitRef = useRef<HTMLButtonElement>(null);
  const body = useRef<Body>({
    x: home.x,
    y: home.y,
    vx: 0,
    vy: 0,
    homeX: home.x,
    homeY: home.y,
    travelling: false,
    onArrive: null,
    look: [0, 0.3],
    mood: 'idle',
    moodUntil: 0,
    bright: 1,
    brightTo: 1,
    brightUntil: 0,
    loopUntil: 0,
    sinkUntil: 0,
    squish: 0,
    squishV: 0,
    spin: 0,
    seed: Math.random() * 3,
  });
  const sparks = useRef<Spark[]>([]);
  const clock = useRef(0);
  const pokes = useRef({ count: 0, at: 0 });

  function spark(power: number, angle = Math.random() * TAU) {
    const b = body.current;
    const speed = (40 + Math.random() * 90) * power;
    sparks.current.push({ x: b.x, y: b.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0, max: 0.5 + Math.random() * 0.5 });
  }

  useImperativeHandle(ref, () => ({
    goTo(x, y, onArrive) {
      Object.assign(body.current, { homeX: x, homeY: y, travelling: true, onArrive: onArrive ?? null });
      playSfx('blip.chirp');
    },
    react(kind) {
      const b = body.current;
      const t = clock.current;
      if (kind === 'win') {
        playSfx('blip.win');
        Object.assign(b, { brightTo: 1.8, brightUntil: t + 1.3, loopUntil: t + 1, mood: 'happy', moodUntil: t + 2.2 });
        for (let i = 0; i < 16; i++) spark(1.2, (i / 16) * TAU);
      } else if (kind === 'lose') {
        playSfx('blip.lose');
        Object.assign(b, { brightTo: 0.45, brightUntil: t + 2, sinkUntil: t + 2, mood: 'sad', moodUntil: t + 2.6 });
      } else {
        playSfx('blip.chirp');
        Object.assign(b, { brightTo: 1.5, brightUntil: t + 0.25 });
        b.vy -= 120;
      }
    },
  }));

  useEffect(() => {
    const b = body.current;
    if (b.homeX === home.x && b.homeY === home.y) return;
    Object.assign(b, { homeX: home.x, homeY: home.y, travelling: true });
  }, [home.x, home.y]);

  useEffect(() => {
    if (!active) return;
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    const g = canvas?.getContext('2d');
    if (!stage || !canvas || !g) return;

    let width = 0;
    let height = 0;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      width = stage.clientWidth;
      height = stage.clientHeight;
      canvas.width = (width + BLEED * 2) * dpr;
      canvas.height = (height + BLEED * 2) * dpr;
      g.setTransform(dpr, 0, 0, dpr, BLEED * dpr, BLEED * dpr);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(stage);
    resize();

    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      clock.current += dt;
      step(clock.current, dt);
      draw(g, width, height, clock.current);
      place();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  function step(t: number, dt: number) {
    const b = body.current;
    if (t > b.brightUntil) b.brightTo = 1;
    if (t > b.moodUntil) b.mood = 'idle';
    b.bright += (b.brightTo - b.bright) * Math.min(1, dt * 4);

    let ox = b.travelling ? 0 : Math.sin(t * 0.9) * 6;
    let oy = b.travelling ? 0 : Math.sin(t * 2) * 5;
    if (t < b.loopUntil) {
      ox += Math.cos(t * 9) * 26;
      oy += Math.sin(t * 9) * 26;
    }
    if (t < b.sinkUntil) oy += 20;
    b.vx += (PULL * (b.homeX + ox - b.x) - DAMP * b.vx) * dt;
    b.vy += (PULL * (b.homeY + oy - b.y) - DAMP * b.vy) * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    const speed = Math.hypot(b.vx, b.vy);
    if (b.travelling && Math.hypot(b.homeX - b.x, b.homeY - b.y) < 10 && speed < 60) {
      b.travelling = false;
      const arrive = b.onArrive;
      b.onArrive = null;
      arrive?.();
    }
    const want: [number, number] = speed > 30 ? [b.vx / speed, b.vy / speed] : [0, 0.3];
    b.look[0] += (want[0] - b.look[0]) * 0.12;
    b.look[1] += (want[1] - b.look[1]) * 0.12;

    b.squishV += (-SQUISH_PULL * b.squish - SQUISH_DAMP * b.squishV) * dt;
    b.squish += b.squishV * dt;
    b.spin *= Math.max(0, 1 - dt * 3);

    for (const s of sparks.current) {
      s.life += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= 1 - dt * 2;
      s.vy *= 1 - dt * 2;
    }
    sparks.current = sparks.current.filter((s) => s.life < s.max);
  }

  function draw(g: CanvasRenderingContext2D, width: number, height: number, t: number) {
    const b = body.current;
    g.clearRect(-BLEED, -BLEED, width + BLEED * 2, height + BLEED * 2);

    for (const s of sparks.current) glow(g, s.x, s.y, 5 * (1 - s.life / s.max), 0.8 * (1 - s.life / s.max));
    glow(g, b.x, b.y, 34 * b.bright, 0.45 * b.bright);

    const speed = Math.hypot(b.vx, b.vy);
    const heading = Math.atan2(b.vy, b.vx);
    const stretch = Math.min(0.18, speed / 1400);
    g.save();
    g.translate(b.x, b.y);
    g.rotate(heading);
    g.scale(1 + stretch, 1 - stretch);
    g.rotate(-heading + b.spin);
    g.scale(1 + b.squish, 1 - b.squish);

    const fill = g.createRadialGradient(-3, -4, 1, 0, 0, RADIUS + 0.5);
    fill.addColorStop(0, '#fffdf3');
    fill.addColorStop(0.7, '#ffe7a8');
    fill.addColorStop(1, '#ffcf6e');
    g.fillStyle = fill;
    g.beginPath();
    g.arc(0, 0, RADIUS, 0, TAU);
    g.fill();

    const ex = b.look[0] * 3;
    const ey = b.look[1] * 2;
    g.fillStyle = g.strokeStyle = '#2a2140';
    g.lineWidth = 1.6;
    g.lineCap = 'round';
    const blinking = (t + b.seed) % 3.7 < 0.12;
    for (const side of [-1, 1]) {
      const x = side * 4.2 + ex;
      if (b.mood === 'happy') {
        g.beginPath();
        g.arc(x, ey, 2.2, Math.PI * 1.1, Math.PI * 1.9);
        g.stroke();
        g.fillStyle = 'rgba(255,140,140,.45)';
        g.beginPath();
        g.arc(side * 7.5, 3.5, 1.8, 0, TAU);
        g.fill();
        g.fillStyle = '#2a2140';
      } else if (b.mood === 'dizzy') {
        g.lineWidth = 1.1;
        g.beginPath();
        g.arc(x, ey - 0.5, 2.2, t * 8 * side, t * 8 * side + Math.PI * 1.6);
        g.stroke();
        g.lineWidth = 1.6;
      } else if (b.mood === 'surprised') {
        g.beginPath();
        g.arc(x, ey - 1, 2.3, 0, TAU);
        g.fill();
      } else {
        const sad = b.mood === 'sad';
        g.beginPath();
        g.ellipse(x, (sad ? 1.5 : -1) + ey, sad ? 1.3 : 1.7, blinking ? 0.25 : sad ? 2 : 2.8, 0, 0, TAU);
        g.fill();
      }
    }
    g.restore();
  }

  /** The poke target rides on Blip itself. */
  function place() {
    const b = body.current;
    const hit = hitRef.current;
    if (hit) hit.style.transform = `translate(${b.x - 22}px, ${b.y - 22}px)`;
  }

  function poke() {
    const b = body.current;
    const now = performance.now();
    const run = pokes.current;
    run.count = now - run.at < POKE_RUN_MS ? run.count + 1 : 1;
    run.at = now;
    const t = clock.current;
    b.squishV += 9;
    b.vy -= 140;
    playSfx('blip.giggle');
    if (run.count >= DIZZY_AT) {
      Object.assign(b, { mood: 'dizzy', moodUntil: t + 2 });
      b.spin += TAU;
    } else Object.assign(b, { mood: run.count === 1 ? 'surprised' : 'happy', moodUntil: t + (run.count === 1 ? 0.35 : 1.2) });
    for (let i = 0; i < 6; i++) spark(0.7);
  }

  return (
    <div ref={stageRef} className="blip-stage">
      <canvas ref={canvasRef} className="blip-canvas" aria-hidden="true" />
      {/* A toy, not a control: a poke opens nothing, and a tap here never reaches the sky under it. */}
      <button
        ref={hitRef}
        type="button"
        className="blip-hit"
        data-sfx="none"
        aria-label="Blip"
        onClick={(e) => {
          e.stopPropagation();
          poke();
        }}
      />
    </div>
  );
});

function glow(g: CanvasRenderingContext2D, x: number, y: number, r: number, alpha: number) {
  const radius = Math.max(1, r);
  const grad = g.createRadialGradient(x, y, 0, x, y, radius);
  grad.addColorStop(0, `rgba(255,220,150,${alpha})`);
  grad.addColorStop(1, 'rgba(255,220,150,0)');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(x, y, radius, 0, TAU);
  g.fill();
}
