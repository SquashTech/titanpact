import { useEffect, useRef, useState } from 'react';
import { playSfx } from '../../audio/sfx';
import { prefersReducedMotion } from '../shared/reducedMotion';
import { TitanColossus, TitanRidge } from './titanArt';

interface Props {
  onDone: () => void;
}

/** Black, and the ground going. The ember below is the only light (ms). */
const STIR_MS = 900;
/** The head climbing in from under the frame, the rumble climbing with it (ms). */
const RISE_MS = 3400;
/** It stops. One jolt as the weight lands, and the lids open (ms). */
const SETTLE_MS = 2600;
/** Down to black, so the field cuts back in from nothing (ms). */
const FADE_MS = 600;

const RISE_AT = STIR_MS;
const SETTLE_AT = RISE_AT + RISE_MS;
const FADE_AT = SETTLE_AT + SETTLE_MS;
const DONE_AT = FADE_AT + FADE_MS;

type RisePhase = 'stir' | 'rise' | 'settle' | 'fade';

/**
 * The Herald has fallen, mid-fight, and the far end of the leash stands up (docs/titan-eyes.md
 * §10 — played over the field by FightScreen on the first Eye's arrival, before its reveal beat).
 * The title screen's own figure — the brow, the two eyes, and the ridge with the four pactbearers
 * on it for scale — climbs into the frame from below, which is the title's picture becoming true.
 * The eyes stay shut on the way up and OPEN at the top: a Titan does not come through a breach
 * five-sixths open (docs/lore.md §7), it looks through it, and what it looks with is the next
 * thing on the field. Until 2026-09-18 this played at the fifth seal with the lids cracked to a
 * slit; the rise moved to the fall it answers.
 */
export function TitanRiseScreen({ onDone }: Props) {
  const [phase, setPhase] = useState<RisePhase>('stir');
  // Through a ref, as TitanWakeScreen does: the parent rebuilds `onDone` on its own renders.
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    if (prefersReducedMotion()) {
      done.current();
      return;
    }
    playSfx('titan.stir');
    const timers = [
      window.setTimeout(() => {
        setPhase('rise');
        playSfx('titan.stir');
      }, RISE_AT),
      window.setTimeout(() => {
        setPhase('settle');
        // The weight landing, then the lids: the impact is the seal's, the grind is the eye's.
        playSfx('seal.shatter');
        window.setTimeout(() => playSfx('titan.gaze'), 700);
      }, SETTLE_AT),
      window.setTimeout(() => setPhase('fade'), FADE_AT),
      window.setTimeout(() => done.current(), DONE_AT),
    ];
    return () => timers.forEach(window.clearTimeout);
  }, []);

  return (
    // Tap-anywhere skips, as the cold open does; there is nothing on this screen to label.
    <div className={`titan-rise is-${phase}`} onClick={onDone}>
      <div className="titan-rise-shake">
        <span className="titan-rise-ember" aria-hidden="true" />

        <div className="titan-dust" aria-hidden="true">
          {/* The wake's motes, in the wake's spread: grit shaken loose, drifting UP. */}
          {Array.from({ length: 18 }, (_, i) => {
            const across = (i * 61.8) % 100;
            const down = (i * 38.2) % 100;
            return (
              <span
                key={i}
                className="titan-mote"
                style={{
                  left: `${across}%`,
                  top: `${46 + down * 0.5}%`,
                  animationDelay: `${(down * 0.026) % 2.4}s`,
                  animationDuration: `${2.6 + across * 0.02}s`,
                }}
              />
            );
          })}
        </div>

        {/* The head: the title's brow-and-eyes over a skull that runs off the bottom, so the
            figure is a solid silhouette against the ember rather than a brow floating over it. */}
        <div className="titan-rise-head" aria-hidden="true">
          <span className="titan-rise-skull" />
          <TitanColossus />
        </div>

        <TitanRidge />
      </div>

      <div className="titan-rise-caption">
        <div className="titan-rise-eyebrow">The Herald has fallen</div>
        <h2 className="titan-rise-title">The Titan rises</h2>
        <p className="titan-rise-line">Nothing is holding the other end. It has found the breach, and it is looking at you.</p>
      </div>

      <div className="titan-wake-blackout" aria-hidden="true" />
    </div>
  );
}
