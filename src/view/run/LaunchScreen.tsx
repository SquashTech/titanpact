import { useEffect, useRef, useState } from 'react';
import { SealArt } from '../shared/SealArt';
import { prefersReducedMotion } from '../shared/reducedMotion';
import { TitanRidge } from './titanArt';
import titlePainting from '../../../art/title/fogBanks.png';
import { NightSky } from './NightSky';
import { launchArtUrls, preloadImages } from '../shared/preload';
import { canvasPoint } from '../shared/overlayHost';

interface Props {
  /** Mount the title under this screen; it fades out over the top of it. */
  onReveal: () => void;
  /** The fade has finished; unmount. */
  onDone: () => void;
}

/** The seal spinning up in the fog (ms). */
const RISE_MS = 2600;
/** It settles (ms). */
const WAKE_MS = 800;
/** Over the title, which is already mounted underneath (ms; matches `.launch-screen.is-reveal`). */
const FADE_MS = 700;
/** Reduced motion: no climb, just a beat on the finished picture. */
const STILL_MS = 700;
/** The longest a slow connection may hold the launch for the first run's paintings (ms). */
const ART_WAIT_MS = 4000;

type LaunchPhase = 'rise' | 'wake' | 'reveal';

/** The seal's gold ring (`.title-seal-ring.is-inner`, px), laid on the Pact's rune ring. */
const SEAL_GOLD_RING = 168;
/** Frames to wait for the title underneath to lay its Pact out. */
const FIND_FRAMES = 12;

/** Glides the seal onto the title's Pact as the fade runs, so the one circle becomes the other. */
function landOnPact(seat: HTMLElement | null) {
  let frames = 0;
  const find = () => {
    const runes = document.querySelector('.title-screen .pact-runes');
    const r = runes?.getBoundingClientRect();
    if (!seat || !r || r.width === 0) {
      if (seat && ++frames < FIND_FRAMES) requestAnimationFrame(find);
      return;
    }
    const from = seat.getBoundingClientRect();
    const scale = canvasPoint(0, 0).scale;
    const dx = (r.left + r.width / 2 - from.left) / scale;
    const dy = (r.top + r.height / 2 - from.top) / scale;
    seat.style.transform = `translate(${dx}px, ${dy}px) scale(${r.width / scale / SEAL_GOLD_RING})`;
  };
  requestAnimationFrame(find);
}

/**
 * The cold launch (2026-09-25, per user direction, replacing the Tap to begin gate): a loading
 * screen that plays on its own. The pact's seal — the title's own, type wheel and all — spins up
 * under the title's night sky, then it fades off the title, which has been mounted underneath for the
 * last beat so the picture is already there when this goes. It waits for the webfonts too, so
 * the title never lands in a fallback face, and for the first act's paintings (shared/preload.ts).
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

  const seatRef = useRef<HTMLDivElement>(null);

  const startReveal = () => {
    if (revealed.current) return;
    revealed.current = true;
    setPhase('reveal');
    reveal.current();
    landOnPact(seatRef.current);
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
    // Wild's Edge is the first thing a new run shows; its paintings load under the climb.
    const art = preloadImages(launchArtUrls(), ART_WAIT_MS);
    void Promise.all([fontsReady, minimum, art]).then(() => {
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
      <NightSky />
      <img className="title-painting" src={titlePainting} alt="" draggable={false} />

      <TitanRidge />
      <span className="launch-vignette" aria-hidden="true" />

      <div ref={seatRef} className="launch-seat" aria-hidden="true">
        <div className="launch-mark">
          <SealArt />
          <span className="launch-core" />
        </div>
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
