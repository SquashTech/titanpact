import { useEffect, useRef, useState } from 'react';
import { SealArt } from '../shared/SealArt';
import { prefersReducedMotion } from '../shared/reducedMotion';
import { TitanColossus, TitanRidge } from './titanArt';

interface Props {
  /** Mount the title under this screen; it fades out over the top of it. */
  onReveal: () => void;
  /** The fade has finished; unmount. */
  onDone: () => void;
}

/** The Titan climbing into the frame behind the spinning seal, eyes shut (ms). */
const RISE_MS = 2600;
/** It stops and the lids open (ms). */
const WAKE_MS = 800;
/** Over the title, which is already mounted underneath (ms; matches `.launch-screen.is-reveal`). */
const FADE_MS = 700;
/** Reduced motion: no climb, just a beat on the finished picture. */
const STILL_MS = 700;

type LaunchPhase = 'rise' | 'wake' | 'reveal';

/**
 * The cold launch (2026-09-25, per user direction, replacing the Tap to begin gate): a loading
 * screen that plays on its own. The pact's seal — the title's own, type wheel and all — spins up
 * in the middle of the dark while the title's Titan rises into the frame behind it, and the
 * lids open as it arrives; then it fades off the title, which has been mounted underneath for the
 * last beat so the picture is already there when this goes. It waits for the webfonts too, so
 * the title never lands in a fallback face.
 *
 * The cost of dropping the gate: no browser sounds a note before the page is touched, so the
 * title opens silent and its score starts on the player's first touch (the window-level unlock
 * listeners, audio/synth.ts). A tap here skips straight to the title and counts as that touch.
 */
export function LaunchScreen({ onReveal, onDone }: Props) {
  const [phase, setPhase] = useState<LaunchPhase>('rise');
  // Through refs, as TitanRiseScreen does: the parent rebuilds its callbacks on its own renders.
  const reveal = useRef(onReveal);
  reveal.current = onReveal;
  const done = useRef(onDone);
  done.current = onDone;
  const revealed = useRef(false);

  const startReveal = () => {
    if (revealed.current) return;
    revealed.current = true;
    setPhase('reveal');
    reveal.current();
    window.setTimeout(() => done.current(), FADE_MS);
  };
  const skip = useRef(startReveal);
  skip.current = startReveal;

  useEffect(() => {
    const still = prefersReducedMotion();
    const timers: number[] = [];
    let cancelled = false;
    const fontsReady = document.fonts?.ready ?? Promise.resolve();
    const minimum = new Promise<void>((resolve) => timers.push(window.setTimeout(resolve, still ? STILL_MS : RISE_MS + WAKE_MS)));
    if (!still) timers.push(window.setTimeout(() => setPhase((p) => (p === 'rise' ? 'wake' : p)), RISE_MS));
    void Promise.all([fontsReady, minimum]).then(() => {
      if (!cancelled) skip.current();
    });
    return () => {
      cancelled = true;
      timers.forEach(window.clearTimeout);
    };
  }, []);

  return (
    // Tap-anywhere skips, as the cinematics do; there is nothing on this screen to label.
    <div className={`launch-screen is-${phase}`} onClick={() => skip.current()} aria-busy={phase !== 'reveal'}>
      {/* The title's Titan — brow and eyes — climbing up to where the title holds it, with the
          light it is cut from climbing with it. */}
      <div className="launch-titan" aria-hidden="true">
        <span className="launch-backlight" />
        <TitanColossus />
      </div>

      <TitanRidge />
      <span className="launch-vignette" aria-hidden="true" />

      <div className="launch-mark" aria-hidden="true">
        <SealArt />
        <span className="launch-core" />
      </div>

      <div className="launch-foot">
        <span className="launch-wordmark">Titanpact</span>
        <span className="launch-loading" role="status">
          Loading
        </span>
      </div>
    </div>
  );
}
