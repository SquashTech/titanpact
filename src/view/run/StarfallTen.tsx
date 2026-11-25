import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { heroes } from '../../data/heroes';
import { playSfx } from '../../audio/sfx';
import { STARFALL_PRICE, STARFALL_TEN } from '../../run/starShop';
import { getTypeColor, getTypeColorRgb } from '../combat/typeColors';
import { ElementGlyph } from '../shared/elementIcons';
import { HeroPortrait } from '../shared/HeroPortrait';
import { HubGlyph } from '../shared/nodeIcons';
import { overlayHost } from '../shared/overlayHost';
import { prefersReducedMotion } from '../shared/reducedMotion';
import { HeroSketch } from './Starfall';
import './starfall.css';
import './starfallTen.css';

// Ten Starfalls as one scene (docs/the-sky.md §5): the Pages drain, ten blank pages are sketched in
// turn, and the colour floods each. No wheel: ten spins would be the single draw watched ten
// times, which is what this exists to spare.

/** Beat boundaries in ms from the tap. */
const BEATS = { drain: 200, firstSketch: 900, sketchGap: 240, sketchMs: 520, floodMs: 950 } as const;
const settledAt = BEATS.firstSketch + (STARFALL_TEN - 1) * BEATS.sketchGap + BEATS.sketchMs + BEATS.floodMs;

interface Props {
  heroIds: readonly string[];
  balanceBefore: number;
  onClose: () => void;
}

export function StarfallTenScreen({ heroIds, balanceBefore, onClose }: Props) {
  const [drained, setDrained] = useState(false);
  const [sketched, setSketched] = useState(0);
  const [flooded, setFlooded] = useState(0);
  const [settled, setSettled] = useState(false);
  const timers = useRef<number[]>([]);

  function skip() {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    setDrained(true);
    setSketched(heroIds.length);
    setFlooded(heroIds.length);
    setSettled(true);
  }

  useEffect(() => {
    if (prefersReducedMotion()) {
      skip();
      return;
    }
    const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
    at(BEATS.drain, () => {
      setDrained(true);
      playSfx('star.charge');
    });
    heroIds.forEach((_, i) => {
      const start = BEATS.firstSketch + i * BEATS.sketchGap;
      at(start, () => {
        setSketched(i + 1);
        playSfx('star.fall', { pitch: 1 + i * 0.04, gain: 0.6 });
      });
      at(start + BEATS.sketchMs, () => {
        setFlooded(i + 1);
        playSfx('star.land', { pitch: 0.9 + i * 0.06, gain: 0.55 });
      });
    });
    at(settledAt, () => {
      setSettled(true);
      playSfx('star.reveal');
    });
    return () => timers.current.forEach(window.clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const spent = drained ? STARFALL_PRICE * heroIds.length : 0;

  // Portalled into overlayHost(), never body (overlayHost.ts).
  return createPortal(
    <div
      className={`quill quill-ten${settled ? ' is-settled' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        if (!settled) skip();
      }}
    >
      <span className="quill-sun" aria-hidden="true" />
      <div className="quill-balance" aria-label={`${balanceBefore - spent} Pages`}>
        <HubGlyph name="stardust" />
        <span key={spent} className="quill-balance-count">
          {balanceBefore - spent}
        </span>
      </div>

      <div className="quill-ten-ribbon">{settled ? 'Ten new heroes!' : ' '}</div>

      <div className="quill-ten-grid">
        {heroIds.map((heroId, i) => {
          const hero = heroes[heroId];
          if (!hero) return null;
          const type = hero.types[0];
          return (
            <div
              key={heroId}
              className={`quill-ten-cell${i < sketched ? ' is-sketched' : ''}${i < flooded ? ' is-flooded' : ''}`}
              style={{ '--type-rgb': getTypeColorRgb(type), '--type-color': getTypeColor(type), '--i': i } as CSSProperties}
            >
              <div className="quill-ten-page">
                <span className="quill-ten-wash" aria-hidden="true" />
                <HeroSketch heroId={heroId} className="quill-sketch quill-ten-sketch" />
                <HeroPortrait heroId={heroId} className="quill-ten-colour" />
                <span className="quill-ten-stamp" aria-hidden="true">
                  <ElementGlyph type={type} />
                </span>
              </div>
              <span className="quill-ten-name">{hero.name}</span>
            </div>
          );
        })}
      </div>

      <div className="quill-ten-foot">
        {settled ? (
          <button type="button" className="quill-cheer quill-ten-cheer" data-sfx="ui.commit" onClick={onClose}>
            Awesome!
          </button>
        ) : (
          <span className="quill-ten-skip">Tap to skip</span>
        )}
      </div>
    </div>,
    overlayHost()
  );
}
