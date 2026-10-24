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
import './starfallTen.css';

// Ten Starfalls as one scene (docs/the-sky.md §5): the Stardust drains, ten lights fall into a grid
// in their heroes' colours, and each hero rises out of its light. No wheel: ten spins would be the
// single draw watched ten times, which is what this exists to spare.

/** Beat boundaries in ms from the tap. */
const BEATS = { drain: 200, firstFall: 900, fallGap: 240, fallMs: 520, riseMs: 950 } as const;
const settledAt = BEATS.firstFall + (STARFALL_TEN - 1) * BEATS.fallGap + BEATS.fallMs + BEATS.riseMs;

interface Props {
  heroIds: readonly string[];
  balanceBefore: number;
  onClose: () => void;
}

export function StarfallTenScreen({ heroIds, balanceBefore, onClose }: Props) {
  const [drained, setDrained] = useState(false);
  const [landed, setLanded] = useState(0);
  const [settled, setSettled] = useState(false);
  const timers = useRef<number[]>([]);

  function skip() {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    setDrained(true);
    setLanded(heroIds.length);
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
      const start = BEATS.firstFall + i * BEATS.fallGap;
      at(start, () => playSfx('star.fall', { pitch: 1 + i * 0.04, gain: 0.6 }));
      at(start + BEATS.fallMs, () => {
        setLanded(i + 1);
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
      className={`summon-ten${settled ? ' is-settled' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        if (!settled) skip();
      }}
    >
      <span className="summon-ten-nebula" aria-hidden="true" />
      <div className="summon-ten-balance" aria-label={`${balanceBefore - spent} Stardust`}>
        <HubGlyph name="stardust" />
        <span key={spent} className="summon-ten-count">
          {balanceBefore - spent}
        </span>
      </div>

      <div className="summon-ten-ribbon">{settled ? 'Ten new heroes!' : ' '}</div>

      <div className="summon-ten-grid">
        {heroIds.map((heroId, i) => {
          const hero = heroes[heroId];
          if (!hero) return null;
          const type = hero.types[0];
          return (
            <div
              key={heroId}
              className={`summon-ten-cell${i < landed ? ' is-landed' : ''}`}
              style={{ '--type-rgb': getTypeColorRgb(type), '--type-color': getTypeColor(type), '--i': i } as CSSProperties}
            >
              <span className="summon-ten-light" aria-hidden="true" />
              <span className="summon-ten-flash" aria-hidden="true" />
              <HeroPortrait heroId={heroId} className="summon-ten-figure" />
              <span className="summon-ten-name">
                <ElementGlyph type={type} />
                {hero.name}
              </span>
            </div>
          );
        })}
      </div>

      <div className="summon-ten-foot">
        {settled ? (
          <button type="button" className="summon-cheer summon-ten-cheer" data-sfx="ui.commit" onClick={onClose}>
            Awesome!
          </button>
        ) : (
          <span className="summon-ten-skip">Tap to skip</span>
        )}
      </div>
    </div>,
    overlayHost()
  );
}
