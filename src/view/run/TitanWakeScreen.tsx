import { useEffect, useRef, useState } from 'react';
import { playSfx } from '../../audio/sfx';
import { prefersReducedMotion } from '../shared/reducedMotion';

interface Props {
  onDone: () => void;
}

/** Black, and a rumble under it. Nothing is on screen yet but the light behind the lids (ms). */
const STIR_MS = 950;
/** The lids part to a slit and hold there — the worst part, because it is not finished (ms). */
const CRACK_MS = 620;
/** Open, and looking (ms). */
const HOLD_MS = 1750;
/** Down to black, so the arrival screen cuts in from nothing (ms). */
const FADE_MS = 560;

const CRACK_AT = STIR_MS;
const OPEN_AT = CRACK_AT + CRACK_MS;
const FADE_AT = OPEN_AT + HOLD_MS;
const DONE_AT = FADE_AT + FADE_MS;

type WakePhase = 'stir' | 'crack' | 'open' | 'fade';

/**
 * The run's cold open (docs/lore.md §1). Binding is mutual — the player has just picked up
 * one end of the leash, so this is the beat where the far end notices. Placed on the draft's
 * confirm rather than the title's press for the reason App.tsx already gives there: a draft
 * backed out of is not a run, and this is too big a thing to spend on one.
 */
export function TitanWakeScreen({ onDone }: Props) {
  const [phase, setPhase] = useState<WakePhase>('stir');
  // The parent rebuilds `onDone` on every one of its own renders, and one of those lands while
  // this is mounted (the draft's setPlayerRun). Through a ref rather than a dep, or the timeline
  // restarts under the player and the bed plays twice.
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    if (prefersReducedMotion()) {
      done.current();
      return;
    }
    // The bed starts under the black and runs the whole beat; the gaze lands on the open.
    playSfx('titan.stir');
    const timers = [
      window.setTimeout(() => setPhase('crack'), CRACK_AT),
      window.setTimeout(() => {
        setPhase('open');
        playSfx('titan.gaze');
      }, OPEN_AT),
      window.setTimeout(() => setPhase('fade'), FADE_AT),
      window.setTimeout(() => done.current(), DONE_AT),
    ];
    return () => timers.forEach(window.clearTimeout);
  }, []);

  return (
    // Tap-anywhere skips: this plays at the top of every run, and the fifth time through is
    // not the first. Not a button — a labelled control would be the loudest thing on a screen
    // whose whole point is that there is nothing on it.
    <div className={`titan-wake is-${phase}`} onClick={onDone}>
      <div className="titan-wake-shake">
        <div className="titan-dust" aria-hidden="true">
          {/* Grit shaken loose off something enormous, drifting UP: the light is below. */}
          {Array.from({ length: 14 }, (_, i) => {
            // Golden ratio, not the golden ANGLE: 137.51 is for points on a disc, and
            // scaled into a 0-100 range it walks in near-lockstep and stacks every mote
            // down one side. 61.8 spreads across the width, which is the axis that matters.
            const across = (i * 61.8) % 100;
            const down = (i * 38.2) % 100;
            return (
              <span
                key={i}
                className="titan-mote"
                style={{
                  left: `${across}%`,
                  top: `${38 + down * 0.56}%`,
                  animationDelay: `${(down * 0.026) % 2.4}s`,
                  animationDuration: `${3.4 + across * 0.022}s`,
                }}
              />
            );
          })}
        </div>

        <div className="titan-face" aria-hidden="true">
          <span className="titan-eye is-left">
            <span className="titan-eye-halo" />
            <span className="titan-eye-clip">
              <span className="titan-eye-globe" />
              <span className="titan-eye-pupil" />
            </span>
          </span>
          <span className="titan-eye is-right">
            <span className="titan-eye-halo" />
            <span className="titan-eye-clip">
              <span className="titan-eye-globe" />
              <span className="titan-eye-pupil" />
            </span>
          </span>
        </div>
      </div>

      <div className="titan-wake-blackout" aria-hidden="true" />
    </div>
  );
}
