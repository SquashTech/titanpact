import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { rosterHeroes } from '../../data/content';
import { locations } from '../../data/locations';
import type { RunState } from '../../run/state';
import { HeroPortrait } from '../shared/HeroPortrait';
import { prefersReducedMotion } from '../shared/reducedMotion';
import { PlateButton } from '../shared/PlateButton';
import inkmasterPageArt from '../../../art/inkmaster/inkmasterPage.png';
import './inkmaster.css';

interface Props {
  run: RunState;
  onContinue: () => void;
}

/** The Hands beaten, the Inkmaster bursts out of his page at last, furious (ms). */
const THROES_MS = 1900;
/** He is pulled back down into the page and the book shuts on him (ms). */
const FALL_MS = 1500;
/** The last page turns up: The End, the roster, then the contents (ms). */
const PAGE_MS = 2600;

const FALL_AT = THROES_MS;
const PAGE_AT = FALL_AT + FALL_MS;
const DONE_AT = PAGE_AT + PAGE_MS;

type BoundPhase = 'throes' | 'fall' | 'page' | 'done';

/**
 * The Hands are beaten (docs/worlds.md §3.8): the first time the Inkmaster shows his face. He bursts
 * out of his page, is pulled back down into it, and the book shuts. Then its last page: The End, the
 * run's heroes standing on it, and its chapters as a table of contents, each with the Guardian beaten
 * there. A tap goes straight to the page.
 */
export function TitanBoundScreen({ run, onContinue }: Props) {
  const [phase, setPhase] = useState<BoundPhase>('throes');
  const done = useRef(onContinue);
  done.current = onContinue;
  const timers = useRef<number[]>([]);
  const chapters = [...run.brokenSeals].sort((a, b) => a.actNumber - b.actNumber);

  const skip = () => {
    if (phase === 'page' || phase === 'done') return;
    timers.current.forEach(window.clearTimeout);
    setPhase('done');
  };

  useEffect(() => {
    if (prefersReducedMotion()) {
      setPhase('done');
      return;
    }
    playSfx('seal.shatter');
    playSfx('titan.stir');
    timers.current = [
      window.setTimeout(() => {
        setPhase('fall');
        // The book slamming shut, timed to the sink's end (inkmaster.css ink-shut).
        window.setTimeout(() => playSfx('seal.strike'), 900);
      }, FALL_AT),
      window.setTimeout(() => {
        setPhase('page');
        playSfx('quill.scratch');
      }, PAGE_AT),
      window.setTimeout(() => setPhase('done'), DONE_AT),
    ];
    return () => timers.current.forEach(window.clearTimeout);
  }, []);

  const collapsing = phase === 'throes' || phase === 'fall';

  return (
    <div className={`titan-bound ink-bound is-${phase}`} onClick={skip}>
      {collapsing && (
        <div className="ink-bound-face" aria-hidden="true">
          <img className="ink-bound-figure" src={inkmasterPageArt} alt="" draggable={false} />
          <span className="ink-bound-shut" />
        </div>
      )}

      {!collapsing && (
        <div className="ink-end">
          <div className="ink-end-paper">
            <h2 className="ink-end-title">The End</h2>
            <div className="ink-end-roster">
              {run.roster.map((entry, i) => (
                <div key={entry.rosterId} className="ink-end-hero" style={{ '--i': i } as CSSProperties}>
                  <HeroPortrait heroId={entry.heroId} className="ink-end-hero-art" />
                  <span>{rosterHeroes[entry.heroId]?.name ?? entry.heroId}</span>
                </div>
              ))}
            </div>
            {chapters.length > 0 && (
              <>
                <div className="ink-end-contents-head">Contents</div>
                <ol className="ink-end-contents">
                  {chapters.map((chapter, i) => (
                    <li key={chapter.actNumber} style={{ '--i': i } as CSSProperties}>
                      <span className="ink-end-chapter">Chapter {chapter.actNumber}</span>
                      <span className="ink-end-place">{locations[chapter.locationId]?.name ?? chapter.locationId}</span>
                      <HeroPortrait heroId={chapter.championId} className="ink-end-guardian" />
                    </li>
                  ))}
                </ol>
              </>
            )}
          </div>
          <PlateButton
            className="ink-end-continue"
            onClick={(event) => {
              event.stopPropagation();
              done.current();
            }}
          >
            Continue
          </PlateButton>
        </div>
      )}
    </div>
  );
}
