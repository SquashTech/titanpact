import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../shared/reducedMotion';
import { launchArtUrls, preloadImages } from '../shared/preload';
import { TitleLogo } from './TitleLogo';
import deskArt from '../../../art/title/book/desk.png';
import libraryArt from '../../../art/title/book/library.png';
import storyArt from '../../../art/title/book/story.png';
import './launchScreen.css';

interface Props {
  /** Mount the title under this screen; it fades out over the top of it. */
  onReveal: () => void;
  /** The fade has finished; unmount. */
  onDone: () => void;
}

/** The shortest the closed book holds (ms). */
const HOLD_MS = 1600;
/** The cover swings open over the title, already mounted underneath (ms; matches `.launch-book-screen.is-reveal`). */
const FADE_MS = 700;
/** Reduced motion: just a beat on the closed book. */
const STILL_MS = 700;
/** The longest a slow connection may hold the launch for the first run's paintings (ms). */
const ART_WAIT_MS = 4000;

/**
 * The cold launch (docs/worlds.md §2.7): the title's book lies closed on the desk with the wordmark
 * on its cover, and opens into the title. It waits for the webfonts too, so the title never lands
 * in a fallback face, and for the first act's paintings (shared/preload.ts).
 *
 * No browser sounds a note before the page is touched, so the title opens silent and its score
 * starts on the player's first touch (audio/synth.ts). A tap here skips straight to the title.
 */
export function LaunchScreen({ onReveal, onDone }: Props) {
  const [revealing, setRevealing] = useState(false);
  // Through refs: the parent rebuilds its callbacks on its own renders.
  const reveal = useRef(onReveal);
  reveal.current = onReveal;
  const done = useRef(onDone);
  done.current = onDone;
  const revealed = useRef(false);

  const startReveal = () => {
    if (revealed.current) return;
    revealed.current = true;
    setRevealing(true);
    reveal.current();
    window.setTimeout(() => done.current(), FADE_MS);
  };
  const skip = useRef(startReveal);
  skip.current = startReveal;

  useEffect(() => {
    const timers: number[] = [];
    let cancelled = false;
    const fontsReady = document.fonts?.ready ?? Promise.resolve();
    const minimum = new Promise<void>((resolve) => timers.push(window.setTimeout(resolve, prefersReducedMotion() ? STILL_MS : HOLD_MS)));
    const art = preloadImages([deskArt, libraryArt, storyArt, ...launchArtUrls()], ART_WAIT_MS);
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
    <div className={`launch-book-screen${revealing ? ' is-reveal' : ''}`} onClick={() => skip.current()} aria-busy={!revealing}>
      <div className="launch-book-frame">
        <div className="launch-book">
          <div className="launch-book-cover">
            <TitleLogo />
            <span className="launch-book-rule" aria-hidden="true" />
          </div>
        </div>
        <span className="launch-book-loading" role="status">
          Loading
        </span>
      </div>
    </div>
  );
}
