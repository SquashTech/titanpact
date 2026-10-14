import { useEffect, useRef, useState } from 'react';
import { playSfx } from '../../audio/sfx';
import { ENDBRINGER_ID } from '../../data/enemies';
import { FINALE_LOCATION_ID } from '../../data/locations';
import { locationBackdrop } from '../shared/locationBackdrops';
import { HeroPortrait } from '../shared/HeroPortrait';
import { prefersReducedMotion } from '../shared/reducedMotion';

interface Props {
  onDone: () => void;
}

/** The Herald, alone in the dark: its seam goes out, and it comes apart (ms). */
const FALL_MS = 2000;
/** The Threshold coming up out of the black, fogged, the Titan standing in it (ms). */
const STIR_MS = 1100;
/** The push: into the valley, onto the head, the ground going harder the closer it gets (ms). */
const RISE_MS = 3400;
/** Its eyes ignite (ms). */
const SETTLE_MS = 2600;
/** Down to black, so the field cuts back in from nothing (ms). */
const FADE_MS = 600;

const STIR_AT = FALL_MS;
const RISE_AT = STIR_AT + STIR_MS;
const SETTLE_AT = RISE_AT + RISE_MS;
const FADE_AT = SETTLE_AT + SETTLE_MS;
const DONE_AT = FADE_AT + FADE_MS;

type RisePhase = 'fall' | 'stir' | 'rise' | 'settle' | 'fade';

/** The painted Titan's eyes, as fractions of the Threshold's arrival painting (196x344). */
export const PAINTED_EYES = [
  { x: 103 / 196, y: 64.5 / 344 },
  { x: 112 / 196, y: 64.5 / 344 },
] as const;

/**
 * The Herald falls, and the far end of the leash stands up (docs/titan-eyes.md §10, §12 — played
 * over the field by FightScreen on the first Eye's arrival, before its reveal beat). The Herald goes
 * dark on the black; then the Threshold's own painting comes up out of it, the Titan standing in the
 * valley as the player first saw it on arrival, and the frame pushes in onto its head until its eyes
 * fill the screen and ignite. What it looks with is the next thing on the field.
 */
export function TitanRiseScreen({ onDone }: Props) {
  const [phase, setPhase] = useState<RisePhase>('fall');
  // Through a ref, because the parent rebuilds `onDone` on its own renders.
  const done = useRef(onDone);
  done.current = onDone;
  const painting = locationBackdrop(FINALE_LOCATION_ID);

  useEffect(() => {
    if (prefersReducedMotion()) {
      done.current();
      return;
    }
    playSfx('map.threat', { pitch: 0.42 });
    const timers = [
      window.setTimeout(() => {
        setPhase('stir');
        playSfx('titan.stir');
      }, STIR_AT),
      window.setTimeout(() => {
        setPhase('rise');
        playSfx('titan.stir');
      }, RISE_AT),
      window.setTimeout(() => {
        setPhase('settle');
        playSfx('seal.shatter');
        window.setTimeout(() => playSfx('titan.gaze'), 300);
      }, SETTLE_AT),
      window.setTimeout(() => setPhase('fade'), FADE_AT),
      window.setTimeout(() => done.current(), DONE_AT),
    ];
    return () => timers.forEach(window.clearTimeout);
  }, []);

  return (
    // Tap-anywhere skips, as the cold open does; there is nothing on this screen to label.
    <div className={`titan-rise is-${phase}`} onClick={onDone}>
      <div className="titan-rise-herald" aria-hidden="true">
        <HeroPortrait heroId={ENDBRINGER_ID} className="titan-rise-herald-figure" pose="hurt" />
      </div>

      <div className="titan-rise-shake">
        {/* The painting at its own aspect, so the eyes can be placed in its pixels. */}
        <div className="titan-rise-painting" aria-hidden="true">
          {painting && <img src={painting} alt="" draggable={false} />}
          {PAINTED_EYES.map((eye, i) => (
            <span key={i} className="titan-rise-gaze" style={{ left: `${eye.x * 100}%`, top: `${eye.y * 100}%` }} />
          ))}
        </div>
        <span className="titan-rise-fog" aria-hidden="true" />
      </div>

      <div className="titan-rise-caption">
        <div className="titan-rise-eyebrow">The Herald has fallen</div>
        <h2 className="titan-rise-title">The Titan rises</h2>
      </div>

      <div className="titan-wake-blackout" aria-hidden="true" />
    </div>
  );
}
