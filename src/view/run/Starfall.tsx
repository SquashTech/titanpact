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

// The Starfall (docs/collection.md §4): a blind draw of a hero the account does not own, played as
// a summoning. The spent Stardust rises into the sky; the type wheel spins up around it and slows,
// ticking, until it locks on the hero's type — the first thing the player learns; the gathered
// light swells in that colour, leaves the sky, and comes back down as a falling star; it strikes
// the ground and the hero rises out of the light as a silhouette before colouring in.

/** The draw's name, in one place: the Constellation, the scene, the Collection's note. */
export const STARFALL_NAME = 'Starfall';

/** A fixed night: the same sky every draw. */
function skyStars(count: number): { x: number; y: number; r: number; delay: number }[] {
  let seed = 7;
  const next = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: count }, () => ({ x: next() * 100, y: next() * 100, r: 0.35 + next() * 1.1, delay: next() * 4 }));
}
const SKY = skyStars(90);
const STREAKS = Array.from({ length: 28 }, (_, i) => ({ angle: (i * 137.51) % 360, delay: (i * 0.071) % 0.6, len: 30 + ((i * 53) % 40) }));
const EMBERS = 22;
/** Motes of Stardust that rise at the start, each carrying its share of the price. */
const TOKENS = 2;

/** The burst at the reveal: up out of the light, then fluttering down. Fixed, so every draw throws the same. */
const CONFETTI = Array.from({ length: 60 }, (_, i) => ({
  x: ((i * 97) % 360) - 180,
  peak: 120 + ((i * 53) % 150),
  drop: 260 + ((i * 71) % 220),
  spin: ((i * 211) % 720) - 360,
  delay: (i % 11) * 0.025,
  tint: i % 3,
  shape: i % 4 === 0 ? 'star' : i % 2 ? 'strip' : 'chip',
}));
/** Glints drifting down the sky once the hero stands. */
const GLINTS = Array.from({ length: 14 }, (_, i) => ({ x: (i * 37) % 100, delay: (i * 0.53) % 6, dur: 5 + ((i * 13) % 4) }));

/** Beat boundaries in ms from the tap. */
const BEATS = {
  firstToken: 260,
  tokenGap: 320,
  spin: 1050,
  spinMs: 2600,
  charge: 3900,
  kindle: 4150,
  launch: 4950,
  fall: 5350,
  land: 5950,
  rise: 6100,
  reveal: 6950,
  settled: 7700,
} as const;
/** Whole turns the wheel makes before it lands. */
const SPIN_TURNS = 4;

type Phase = 'gather' | 'spin' | 'lock' | 'kindle' | 'launch' | 'fall' | 'land' | 'rise' | 'reveal';
const ORDER: readonly Phase[] = ['gather', 'spin', 'lock', 'kindle', 'launch', 'fall', 'land', 'rise', 'reveal'];

/** Ease-out quart: fast off the mark, a long ticking crawl into the lock. */
const ease = (t: number) => 1 - Math.pow(1 - t, 4);

interface ScreenProps {
  heroId: string;
  /** The balance the Stardust was spent from, before the draw. */
  balanceBefore: number;
  /** The hero took an empty seat in its deck row on arrival. */
  joinsDeck: boolean;
  onClose: () => void;
}

export function StarfallScreen({ heroId, balanceBefore, joinsDeck, onClose }: ScreenProps) {
  const hero = heroes[heroId];
  const type = hero?.types[0];
  const [phase, setPhase] = useState<Phase>('gather');
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
    at(BEATS.kindle, () => setPhase('kindle'));
    at(BEATS.launch, () => setPhase('launch'));
    at(BEATS.fall, () => {
      setPhase('fall');
      playSfx('star.fall');
    });
    at(BEATS.land, () => {
      setPhase('land');
      playSfx('star.land');
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate([30, 40, 60]);
    });
    at(BEATS.rise, () => setPhase('rise'));
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

  // Portalled into overlayHost(), never body (overlayHost.ts).
  return createPortal(
    <div
      className={`summon is-${phase}${locked ? ' is-locked' : ''}${past('land') ? ' is-landed' : ''}${settled ? ' is-settled' : ''}`}
      style={{ '--type-rgb': getTypeColorRgb(type), '--type-color': getTypeColor(type) } as CSSProperties}
      // A portal still bubbles through React to whatever hosts it; nothing behind should hear this tap.
      onClick={(e) => {
        e.stopPropagation();
        if (!settled) skipToReveal();
      }}
    >
      <div className="summon-stage">
        <div className="summon-sky" aria-hidden="true">
          <span className="summon-nebula" />
          {SKY.map((star, i) => (
            <span key={i} className="summon-sky-star" style={{ left: `${star.x}%`, top: `${star.y}%`, '--r': star.r, animationDelay: `${star.delay}s` } as CSSProperties} />
          ))}
          <span className="summon-flood" />
        </div>

        {/* The sky rushing past while the wheel spins. */}
        <div className="summon-warp" aria-hidden="true">
          {STREAKS.map((s, i) => (
            <span key={i} style={{ '--a': `${s.angle}deg`, '--d': `${s.delay}s`, '--len': `${s.len}%` } as CSSProperties} />
          ))}
        </div>

        <div className="summon-balance" aria-label={`${balanceBefore - launched * (STARFALL_PRICE / TOKENS)} Stardust`}>
          <HubGlyph name="stardust" />
          <span key={launched} className="summon-balance-count">
            {balanceBefore - launched * (STARFALL_PRICE / TOKENS)}
          </span>
        </div>

        {Array.from({ length: TOKENS }, (_, i) => (
          <span key={i} className={`summon-token${i < launched ? ' is-launched' : ''}`} style={{ '--i': i } as CSSProperties} aria-hidden="true">
            <HubGlyph name="stardust" />
          </span>
        ))}

        <div className="summon-altar" aria-hidden="true">
          <div ref={wheelRef} className="summon-wheel" style={{ '--spin': '0deg', '--wheel-tint': getTypeColor(type) } as CSSProperties}>
            <TypeWheel size={300} ring focus={locked ? [type] : undefined} topType={type} />
          </div>
          <span className="summon-pointer" />
          <span className="summon-lock-ring" />
          <span className="summon-lock-ring is-second" />
          <span className="summon-orb">
            <span className="summon-orb-glow" />
            <span className="summon-orb-core" />
            {locked && (
              <span className="summon-orb-sigil">
                <ElementGlyph type={type} />
              </span>
            )}
          </span>
        </div>

        <span className="summon-meteor" aria-hidden="true">
          <span className="summon-meteor-tail" />
          <span className="summon-meteor-head" />
        </span>

        <div className="summon-ground" aria-hidden="true">
          <span className="summon-crater" />
        </div>
        <span className="summon-flash" aria-hidden="true" />
        <span className="summon-shock" aria-hidden="true" />
        <span className="summon-shock is-second" aria-hidden="true" />
        <span className="summon-pillar" aria-hidden="true" />
        <span className="summon-embers" aria-hidden="true">
          {Array.from({ length: EMBERS }, (_, i) => (
            <span key={i} style={{ '--e': i, '--x': `${((i * 61) % 100) - 50}px`, '--h': `${90 + ((i * 37) % 120)}px` } as CSSProperties} />
          ))}
        </span>
        <span className="summon-rays" aria-hidden="true" />

        <div className="summon-hero">
          <HeroPortrait heroId={hero.id} className="summon-hero-figure" />
        </div>

        <span className="summon-confetti" aria-hidden="true">
          {CONFETTI.map((c, i) => (
            <span
              key={i}
              className={`is-${c.shape} is-tint-${c.tint}`}
              style={{ '--x': `${c.x}px`, '--peak': `${-c.peak}px`, '--drop': `${c.drop}px`, '--spin': `${c.spin}deg`, '--d': `${c.delay}s` } as CSSProperties}
            />
          ))}
        </span>
        <span className="summon-glints" aria-hidden="true">
          {GLINTS.map((g, i) => (
            <span key={i} style={{ left: `${g.x}%`, '--d': `${g.delay}s`, '--dur': `${g.dur}s` } as CSSProperties} />
          ))}
        </span>
      </div>

      {locked && !past('reveal') && (
        <div className="summon-omen" aria-hidden="true">
          <span className="summon-omen-line">{`A ${type} hero answers`}</span>
        </div>
      )}

      <div className="summon-plate">
        <div className="summon-ribbon">
          <span>New hero!</span>
        </div>
        <h2 className="summon-name" aria-label={hero.name}>
          {Array.from(hero.name).map((ch, i) => (
            <span key={i} style={{ '--l': i } as CSSProperties} aria-hidden="true">
              {ch === ' ' ? ' ' : ch}
            </span>
          ))}
        </h2>
        <div className="summon-types">
          {hero.types.map((t) => (
            <span key={t} className="summon-type" style={{ '--chip-rgb': getTypeColorRgb(t) } as CSSProperties}>
              <ElementGlyph type={t} />
              {t}
            </span>
          ))}
        </div>
        <div className="summon-oath">{joinsDeck ? 'joins your deck!' : 'joins your Collection!'}</div>
        <button type="button" className="summon-cheer" data-sfx="ui.commit" disabled={!settled} onClick={onClose}>
          Awesome!
        </button>
      </div>

      {!settled && <span className="summon-skip">Tap to skip</span>}
    </div>,
    overlayHost()
  );
}
