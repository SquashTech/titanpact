import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { heroes } from '../../data/heroes';
import { playSfx } from '../../audio/sfx';
import { STARFALL_PRICE } from '../../run/starShop';
import { getTypeColor, getTypeColorRgb } from '../combat/typeColors';
import { ElementGlyph } from '../shared/elementIcons';
import { HeroPortrait } from '../shared/HeroPortrait';
import { HubGlyph } from '../shared/nodeIcons';
import { TypeWheel, WHEEL_STEP_DEG, wheelRestDeg } from '../shared/TypeWheel';
import { overlayHost } from '../shared/overlayHost';
import { prefersReducedMotion } from '../shared/reducedMotion';
import './starfall.css';

// The Starfall as writing a hero (docs/worlds.md §3.7, per user direction 2026-11-25): the Pages
// fly into a blank page; the type wheel spins and locks on the hero's type, the first thing the
// player learns, and stamps it on the page; a quill sketches the hero in ink, a drop of the type's
// colour lands, and the colour floods the sketch.

/** The draw's name, in one place: the Observatory, the scene, the Collection's note. */
export const STARFALL_NAME = 'Starfall';

/** Motes of Pages that fly in at the start, each carrying its share of the price. */
const TOKENS = 2;

/** The burst at the reveal: up off the page, then fluttering down. Fixed, so every draw throws the same. */
const CONFETTI = Array.from({ length: 60 }, (_, i) => ({
  x: ((i * 97) % 360) - 180,
  peak: 120 + ((i * 53) % 150),
  drop: 260 + ((i * 71) % 220),
  spin: ((i * 211) % 720) - 360,
  delay: (i % 11) * 0.025,
  tint: i % 3,
  shape: i % 4 === 0 ? 'star' : i % 2 ? 'strip' : 'chip',
}));
/** Dust in the sunlight once the hero stands. */
const MOTES = Array.from({ length: 14 }, (_, i) => ({ x: (i * 37) % 100, delay: (i * 0.53) % 6, dur: 5 + ((i * 13) % 4) }));

/** Beat boundaries in ms from the tap. */
const BEATS = {
  firstToken: 260,
  tokenGap: 320,
  spin: 1050,
  spinMs: 2600,
  charge: 3900,
  stamp: 4150,
  sketch: 4700,
  splash: 5950,
  flood: 6100,
  reveal: 6950,
  settled: 7700,
} as const;
/** Whole turns the wheel makes before it lands. */
const SPIN_TURNS = 4;

type Phase = 'open' | 'spin' | 'lock' | 'stamp' | 'sketch' | 'splash' | 'flood' | 'reveal';
const ORDER: readonly Phase[] = ['open', 'spin', 'lock', 'stamp', 'sketch', 'splash', 'flood', 'reveal'];

/** Ease-out quart: fast off the mark, a long ticking crawl into the lock. */
const ease = (t: number) => 1 - Math.pow(1 - t, 4);

/** A goose quill, nib at the bottom left. */
export function Quill({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <path d="M8.5 33.5C10 20 21 6.5 37 2.5 35.5 15 25 28 8.5 33.5Z" fill="#fff" stroke="#2b2340" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M9 33 31 9.5" stroke="#2b2340" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M17 20.5 13.5 19M21 16 18 13.5M25.5 13 23.5 9.5M21.5 25 24.5 26.5" stroke="#c9b48a" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M3.5 38.5 8 33l2.6 2.4Z" fill="#2b2340" stroke="#2b2340" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

/** The hero as a pencil sketch: an ink outline around a paper silhouette. */
export function HeroSketch({ heroId, className }: { heroId: string; className: string }) {
  return (
    <span className={className}>
      <HeroPortrait heroId={heroId} className="quill-sketch-ink" />
      <HeroPortrait heroId={heroId} className="quill-sketch-paper" />
    </span>
  );
}

interface ScreenProps {
  heroId: string;
  /** The balance the Pages were spent from, before the draw. */
  balanceBefore: number;
  onClose: () => void;
}

export function StarfallScreen({ heroId, balanceBefore, onClose }: ScreenProps) {
  const hero = heroes[heroId];
  const type = hero?.types[0];
  const [phase, setPhase] = useState<Phase>('open');
  const [launched, setLaunched] = useState(0);
  const [settled, setSettled] = useState(false);
  const wheelRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const frame = useRef(0);

  const finalSpin = wheelRestDeg(type) - SPIN_TURNS * 360;

  function setSpin(deg: number) {
    wheelRef.current?.style.setProperty('--spin', `${deg}deg`);
  }

  function skipToReveal() {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    cancelAnimationFrame(frame.current);
    setSpin(finalSpin);
    setLaunched(TOKENS);
    setPhase('reveal');
    setSettled(true);
  }

  useEffect(() => {
    if (prefersReducedMotion()) {
      skipToReveal();
      return;
    }
    const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
    for (let i = 0; i < TOKENS; i++) {
      at(BEATS.firstToken + i * BEATS.tokenGap, () => {
        setLaunched(i + 1);
        playSfx('star.rise', { pitch: 1 + i * 0.12 });
      });
    }
    at(BEATS.spin, () => {
      setPhase('spin');
      const start = performance.now();
      let lastStep = 0;
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / BEATS.spinMs);
        const deg = finalSpin * ease(t);
        setSpin(deg);
        const step = Math.floor(Math.abs(deg) / WHEEL_STEP_DEG);
        if (step !== lastStep) {
          lastStep = step;
          // Rising as it slows: the last few ticks are the tension, so they climb.
          playSfx('star.tick', { pitch: 0.8 + t * 0.7, gain: 0.5 + t * 0.6 });
        }
        if (t < 1) frame.current = requestAnimationFrame(tick);
        else {
          // Frames stop while the page is hidden and the timers do not, so the spin can end after the reveal.
          setPhase((current) => (ORDER.indexOf(current) < ORDER.indexOf('lock') ? 'lock' : current));
          playSfx('star.lock');
        }
      };
      frame.current = requestAnimationFrame(tick);
    });
    at(BEATS.charge, () => playSfx('star.charge'));
    at(BEATS.stamp, () => setPhase('stamp'));
    at(BEATS.sketch, () => {
      setPhase('sketch');
      playSfx('star.fall');
    });
    at(BEATS.splash, () => {
      setPhase('splash');
      playSfx('star.land');
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate([30, 40, 60]);
    });
    at(BEATS.flood, () => setPhase('flood'));
    at(BEATS.reveal, () => {
      setPhase('reveal');
      playSfx('star.reveal');
    });
    at(BEATS.settled, () => setSettled(true));
    return () => {
      timers.current.forEach(window.clearTimeout);
      cancelAnimationFrame(frame.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!hero || !type) return null;
  const past = (p: Phase) => ORDER.indexOf(phase) >= ORDER.indexOf(p);
  const locked = past('lock');
  const balance = balanceBefore - launched * (STARFALL_PRICE / TOKENS);
  const pastClasses = ORDER.filter((p) => past(p))
    .map((p) => ` was-${p}`)
    .join('');

  // Portalled into overlayHost(), never body (overlayHost.ts).
  return createPortal(
    <div
      className={`quill is-${phase}${pastClasses}${settled ? ' is-settled' : ''}`}
      style={{ '--type-rgb': getTypeColorRgb(type), '--type-color': getTypeColor(type) } as CSSProperties}
      // A portal still bubbles through React to whatever hosts it; nothing behind should hear this tap.
      onClick={(e) => {
        e.stopPropagation();
        if (!settled) skipToReveal();
      }}
    >
      <span className="quill-sun" aria-hidden="true" />

      <div className="quill-balance" aria-label={`${balance} Pages`}>
        <HubGlyph name="stardust" />
        <span key={launched} className="quill-balance-count">
          {balance}
        </span>
      </div>

      {Array.from({ length: TOKENS }, (_, i) => (
        <span key={i} className={`quill-token${i < launched ? ' is-launched' : ''}`} style={{ '--i': i } as CSSProperties} aria-hidden="true">
          <HubGlyph name="stardust" />
        </span>
      ))}

      <div className="quill-stage">
        <span className="quill-rays" aria-hidden="true" />
        <div className="quill-page">
          <span className="quill-page-lines" aria-hidden="true" />
          <span className="quill-wash" aria-hidden="true" />
          <HeroSketch heroId={hero.id} className="quill-sketch" />
          <HeroPortrait heroId={hero.id} className="quill-colour" />
          <svg className="quill-splat" viewBox="0 0 100 100" aria-hidden="true">
            <path d="M50 14c6 0 7 12 13 13s14-9 18-4-5 13-2 18 15 4 15 11-13 6-15 11 8 14 2 18-14-6-19-3-5 15-12 15-7-13-13-14-15 8-19 3 5-13 2-18-14-5-14-11 13-7 15-12-8-13-2-17 14 6 19 3 6-17 12-17Z" />
          </svg>
          <span className="quill-stamp" aria-hidden="true">
            <ElementGlyph type={type} />
          </span>
        </div>

        <div className="quill-dial" aria-hidden="true">
          <div ref={wheelRef} className="quill-wheel" style={{ '--spin': '0deg', '--wheel-tint': getTypeColor(type) } as CSSProperties}>
            <TypeWheel size={260} ring focus={locked ? [type] : undefined} topType={type} />
          </div>
          <span className="quill-pointer" />
        </div>

        <span className="quill-pen-track" aria-hidden="true">
          <Quill className="quill-pen" />
        </span>

        <span className="quill-confetti" aria-hidden="true">
          {CONFETTI.map((c, i) => (
            <span
              key={i}
              className={`is-${c.shape} is-tint-${c.tint}`}
              style={{ '--x': `${c.x}px`, '--peak': `${-c.peak}px`, '--drop': `${c.drop}px`, '--spin': `${c.spin}deg`, '--d': `${c.delay}s` } as CSSProperties}
            />
          ))}
        </span>
      </div>

      <span className="quill-motes" aria-hidden="true">
        {MOTES.map((g, i) => (
          <span key={i} style={{ left: `${g.x}%`, '--d': `${g.delay}s`, '--dur': `${g.dur}s` } as CSSProperties} />
        ))}
      </span>

      {locked && !past('flood') && (
        <div className="quill-omen" aria-hidden="true">
          {`${/^[AEIOU]/.test(type) ? 'An' : 'A'} ${type} hero answers`}
        </div>
      )}

      <div className="quill-plate">
        <div className="quill-ribbon">New hero!</div>
        <h2 className="quill-name" aria-label={hero.name}>
          {Array.from(hero.name).map((ch, i) => (
            <span key={i} style={{ '--l': i } as CSSProperties} aria-hidden="true">
              {ch === ' ' ? ' ' : ch}
            </span>
          ))}
        </h2>
        <div className="quill-types">
          {hero.types.map((t) => (
            <span key={t} className="quill-type" style={{ '--chip-rgb': getTypeColorRgb(t) } as CSSProperties}>
              <ElementGlyph type={t} />
              {t}
            </span>
          ))}
        </div>
        <div className="quill-oath">joins your Collection!</div>
        <button type="button" className="quill-cheer" data-sfx="ui.commit" disabled={!settled} onClick={onClose}>
          Awesome!
        </button>
      </div>

      {!settled && <span className="quill-skip">Tap to skip</span>}
    </div>,
    overlayHost()
  );
}
