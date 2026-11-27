import { useEffect, useRef, useState } from 'react';
import { playSfx } from '../../audio/sfx';
import { ENDBRINGER_ID, LEFT_EYE_ID, RIGHT_EYE_ID } from '../../data/enemies';
import { HeroPortrait } from '../shared/HeroPortrait';
import { prefersReducedMotion } from '../shared/reducedMotion';
import bookArt from '../../../art/inkmaster/book.png';
import './inkmaster.css';

interface Props {
  onDone: () => void;
}

/** The Herald, alone in the dark: hit, and going out (ms). */
const FALL_MS = 2000;
/** The Inkmaster's book coming up out of the black, the blot spreading on its page (ms). */
const STIR_MS = 1100;
/** His two Hands rising out of the ink (ms). */
const RISE_MS = 2200;
/** They hold over the page; the caption (ms). */
const SETTLE_MS = 2400;
/** Down to black, so the field cuts back in from nothing (ms). */
const FADE_MS = 600;

const STIR_AT = FALL_MS;
const RISE_AT = STIR_AT + STIR_MS;
const SETTLE_AT = RISE_AT + RISE_MS;
const FADE_AT = SETTLE_AT + SETTLE_MS;
const DONE_AT = FADE_AT + FADE_MS;

type RisePhase = 'fall' | 'stir' | 'rise' | 'settle' | 'fade';

/**
 * The Herald falls and the Inkmaster takes up his pen (docs/worlds.md §3.8), played over the field
 * by FightScreen on the first Hand's arrival. The Herald goes dark; his book opens out of the black
 * with a blot spreading on the page, and his two Hands rise out of the ink. His face stays hidden
 * until the end (TitanBoundScreen).
 */
export function TitanRiseScreen({ onDone }: Props) {
  const [phase, setPhase] = useState<RisePhase>('fall');
  // Through a ref, because the parent rebuilds `onDone` on its own renders.
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    if (prefersReducedMotion()) {
      done.current();
      return;
    }
    playSfx('map.threat', { pitch: 0.42 });
    const timers = [
      window.setTimeout(() => {
        setPhase('stir');
        playSfx('quill.scratch');
      }, STIR_AT),
      window.setTimeout(() => {
        setPhase('rise');
        playSfx('titan.stir');
      }, RISE_AT),
      window.setTimeout(() => {
        setPhase('settle');
        playSfx('seal.shatter');
      }, SETTLE_AT),
      window.setTimeout(() => setPhase('fade'), FADE_AT),
      window.setTimeout(() => done.current(), DONE_AT),
    ];
    return () => timers.forEach(window.clearTimeout);
  }, []);

  return (
    // Tap-anywhere skips, as the cold open does; there is nothing on this screen to label.
    <div className={`titan-rise ink-rise is-${phase}`} onClick={onDone}>
      <div className="titan-rise-herald" aria-hidden="true">
        <HeroPortrait heroId={ENDBRINGER_ID} className="titan-rise-herald-figure" pose="hurt" />
      </div>

      <div className="ink-rise-stage" aria-hidden="true">
        <img className="ink-book" src={bookArt} alt="" draggable={false} />
        <div className="ink-rise-hand is-left">
          <HeroPortrait heroId={LEFT_EYE_ID} className="ink-rise-hand-figure" />
        </div>
        <div className="ink-rise-hand is-right">
          <HeroPortrait heroId={RIGHT_EYE_ID} className="ink-rise-hand-figure" />
        </div>
      </div>

      <div className="titan-rise-caption">
        <div className="titan-rise-eyebrow">The Herald has fallen</div>
        <h2 className="titan-rise-title">The Inkmaster takes up his pen</h2>
      </div>

      <div className="titan-wake-blackout" aria-hidden="true" />
    </div>
  );
}
