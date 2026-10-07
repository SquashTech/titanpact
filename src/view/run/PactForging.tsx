import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { TypeId } from '../../engine/content';
import { rosterHeroes } from '../../data/content';
import { playSfx } from '../../audio/sfx';
import { getTypeColorRgb } from '../combat/typeColors';
import { HeroPortrait } from '../shared/HeroPortrait';
import { TypeWheel } from '../shared/TypeWheel';
import { BlessingMark } from '../shared/BlessingMark';
import { StarField } from '../shared/StarField';
import { overlayHost } from '../shared/overlayHost';
import { prefersReducedMotion } from '../shared/reducedMotion';

// The run's opening (docs/blessings-and-statuses.md §1.5): the two drafted heroes forge the pact
// under the draft's own night sky, the seal they make rises to become a star, and the Pactwarden's
// blessing falls from it onto both. One sequence where the draft ended — no scene change.

const LINE = 'I bless you for this journey. You may need it.';
/** Per character (ms) — RoadEncounter's pace. */
const TYPE_MS = 24;
/** When each automatic beat begins, in ms from the press that sealed the pact. */
const BEATS = { oath: 1000, forge: 2100, ascend: 3000, speak: 3900 } as const;
/** The light falling and settling, before a tap moves on (ms). Matches `pact-forge-cone`. */
const BLESS_MS = 1400;

type Phase = 'gather' | 'oath' | 'forge' | 'ascend' | 'speak' | 'bless' | 'blessed';

/** The stage's own units (px): the heroes' feet, the seal they forge, and where it settles as a star. */
const STAGE = { w: 340, h: 460 } as const;
const HERO_X = [78, 262] as const;
const HERO_FOOT = 388;
const SEAL = { x: 170, y: 150 } as const;
const STAR = { x: 170, y: 40 } as const;

export function PactForging({ heroIds, onDone }: { heroIds: readonly string[]; onDone: () => void }) {
  const instant = prefersReducedMotion();
  const [phase, setPhase] = useState<Phase>(instant ? 'speak' : 'gather');
  const [shown, setShown] = useState(instant ? LINE.length : 0);
  const typed = shown >= LINE.length;
  // Through a ref: the parent rebuilds `onDone` on its own renders (TitanRiseScreen's note).
  const done = useRef(onDone);
  done.current = onDone;

  const pair = heroIds.slice(0, 2).flatMap((id) => (rosterHeroes[id] ? [rosterHeroes[id]] : []));
  const types = [...new Set(pair.flatMap((h) => h.types))] as TypeId[];
  const names = pair.map((h) => h.name);

  useEffect(() => {
    if (instant) return;
    const at = (ms: number, fn: () => void) => window.setTimeout(fn, ms);
    const timers = [
      at(0, () => playSfx('star.rise', { pitch: 0.75 })),
      at(BEATS.oath, () => {
        setPhase((p) => (p === 'gather' ? 'oath' : p));
        playSfx('star.charge');
      }),
      at(BEATS.forge, () => {
        setPhase((p) => (p === 'oath' ? 'forge' : p));
        playSfx('seal.strike');
        playSfx('pact.bind', { pitch: 0.92, gain: 1.2 });
      }),
      at(BEATS.ascend, () => {
        setPhase((p) => (p === 'forge' ? 'ascend' : p));
        playSfx('star.reveal');
      }),
      at(BEATS.speak, () => setPhase((p) => (p === 'ascend' ? 'speak' : p))),
    ];
    return () => timers.forEach(window.clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== 'speak' || typed) return;
    const t = window.setTimeout(() => setShown((n) => n + 1), TYPE_MS);
    return () => window.clearTimeout(t);
  }, [phase, typed, shown]);

  useEffect(() => {
    if (phase !== 'bless') return;
    playSfx('blessing');
    const t = window.setTimeout(() => setPhase('blessed'), instant ? 0 : BLESS_MS);
    return () => window.clearTimeout(t);
  }, [phase, instant]);

  function advance() {
    if (phase === 'gather' || phase === 'oath' || phase === 'forge' || phase === 'ascend') {
      setPhase('speak');
      return;
    }
    if (phase === 'speak' && !typed) {
      setShown(LINE.length);
      return;
    }
    if (phase === 'speak') {
      setPhase('bless');
      return;
    }
    if (phase === 'bless') {
      setPhase('blessed');
      return;
    }
    playSfx('ui.confirm');
    done.current();
  }

  const blessedLine = `${names.join(' and ')} ${names.length > 1 ? 'are' : 'is'} Blessed. ${names.length > 1 ? 'Each' : 'It'} will shrug off the first blow that would knock it out.`;

  return createPortal(
    <button
      type="button"
      className={`pact-forge is-${phase}${instant ? ' is-still' : ''}`}
      onClick={advance}
      data-sfx="none"
      aria-label={`The pact is forged. The Pactwarden: ${LINE}`}
    >
      <span className="pact-forge-sky">
        <span className="pact-forge-wash" />
        <StarField />
      </span>

      <span className="pact-forge-stage" style={{ width: STAGE.w, height: STAGE.h, marginLeft: -STAGE.w / 2 }} aria-hidden="true">
        <svg className="pact-forge-light" viewBox={`0 0 ${STAGE.w} ${STAGE.h}`} width={STAGE.w} height={STAGE.h}>
          <defs>
            {pair.map((hero, i) => (
              <linearGradient key={hero.id} id={`pact-beam-${i}`} gradientUnits="userSpaceOnUse" x1={HERO_X[i]} y1={HERO_FOOT - 60} x2={SEAL.x} y2={SEAL.y}>
                <stop offset="0" stopColor={`rgb(${getTypeColorRgb(hero.types[0])})`} />
                <stop offset="1" stopColor="#fff6dc" />
              </linearGradient>
            ))}
            <linearGradient id="pact-cone" gradientUnits="userSpaceOnUse" x1={STAR.x} y1={STAR.y} x2={STAR.x} y2={HERO_FOOT}>
              <stop offset="0" stopColor="#fff6dc" stopOpacity="0.9" />
              <stop offset="1" stopColor="#f6dc8c" stopOpacity="0.35" />
            </linearGradient>
            {/* SVG's own blur: a CSS filter on an SVG child is not drawn everywhere. */}
            <filter id="pact-soft" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" />
            </filter>
            <filter id="pact-bloom" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="5" />
            </filter>
          </defs>
          {/* The starlight the blessing falls down: one cone from the pact's star onto each hero. */}
          {pair.map((hero, i) => (
            <polygon
              key={`cone-${hero.id}`}
              className="pact-forge-cone"
              points={`${STAR.x},${STAR.y} ${HERO_X[i] - 40},${HERO_FOOT} ${HERO_X[i] + 40},${HERO_FOOT}`}
              fill="url(#pact-cone)"
              filter="url(#pact-soft)"
            />
          ))}
          {/* What each hero puts into the pact: a beam of its own colour, drawn to the seal. */}
          {pair.map((hero, i) => (
            <g key={`beam-${hero.id}`} className="pact-forge-beam">
              <line pathLength={1} x1={HERO_X[i]} y1={HERO_FOOT - 60} x2={SEAL.x} y2={SEAL.y} stroke={`url(#pact-beam-${i})`} filter="url(#pact-bloom)" className="pact-forge-beam-glow" />
              <line pathLength={1} x1={HERO_X[i]} y1={HERO_FOOT - 60} x2={SEAL.x} y2={SEAL.y} stroke={`url(#pact-beam-${i})`} className="pact-forge-beam-core" />
              <line pathLength={1} x1={HERO_X[i]} y1={HERO_FOOT - 60} x2={SEAL.x} y2={SEAL.y} className="pact-forge-beam-flow" />
            </g>
          ))}
        </svg>

        <span className="pact-forge-seal" style={{ left: SEAL.x, top: SEAL.y }}>
          <TypeWheel className="pact-forge-wheel" size={200} focus={types} topType={pair[0]?.types[0]} />
          <span className="pact-forge-ring is-outer" />
          <span className="pact-forge-ring is-inner" />
          <span className="pact-forge-flash" />
          <span className="pact-forge-shock" />
        </span>

        <span className="pact-forge-star" style={{ left: STAR.x, top: STAR.y }}>
          <span className="pact-forge-star-glow" />
          <BlessingMark className="pact-forge-star-mark" />
        </span>

        <span className="pact-forge-plate">
          <span className="pact-forge-eyebrow">A Titan Stirs</span>
          <span className="pact-forge-title">The Pact is Forged</span>
          <span className="pact-forge-names">{names.join(' · ')}</span>
        </span>

        {pair.map((hero, i) => (
          <span
            key={hero.id}
            className={`pact-forge-hero ${i === 0 ? 'is-left' : 'is-right'}`}
            style={{ left: HERO_X[i] - 48, top: HERO_FOOT - 96, '--hero-rgb': getTypeColorRgb(hero.types[0]) } as CSSProperties}
          >
            <span className="pact-forge-aura" />
            <span className="pact-forge-rim" />
            <HeroPortrait heroId={hero.id} className="pact-forge-figure" />
            <BlessingMark className="pact-forge-mark" />
          </span>
        ))}
      </span>

      <span className={`road-encounter-speech pact-forge-speech${phase === 'speak' ? ' is-open' : ''}`} aria-hidden="true">
        <span className="road-encounter-name">The Pactwarden</span>
        <span className="road-encounter-line">
          {LINE.slice(0, shown)}
          <span className="road-encounter-rest">{LINE.slice(shown)}</span>
        </span>
        {typed && <span className="road-encounter-more" />}
      </span>
      {/* What the light did, said where it happened rather than on the map after. */}
      <span className={`road-encounter-speech pact-forge-speech${phase === 'blessed' ? ' is-open' : ''}`} aria-hidden="true">
        <span className="road-encounter-name">Blessed</span>
        <span className="road-encounter-line">{blessedLine}</span>
        <span className="road-encounter-more" />
      </span>
    </button>,
    overlayHost()
  );
}
