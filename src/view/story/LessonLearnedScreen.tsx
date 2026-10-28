import { useEffect, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import type { ManualPage } from '../../run/manual';
import { LearnedBook, LearnedTiles, learnedBookMs } from '../shared/ManualPages';
import { NODE_TINT_GOLD, NodeMotes } from '../shared/NodeStage';
import { PlateButton } from '../shared/PlateButton';
import { prefersReducedMotion } from '../shared/reducedMotion';

/**
 * The pages a lesson or a win taught, filed into How to Play (docs/the-sky.md §2c) as a beat of
 * their own: the book takes them one by one, then every page sits below it to be read. A tap lands them all.
 */
export function LessonLearnedScreen({ pages, onContinue, onNext }: { pages: readonly ManualPage[]; onContinue: () => void; onNext?: () => void }) {
  const [landed, setLanded] = useState(prefersReducedMotion());

  useEffect(() => {
    playSfx('quill.scratch');
    const land = window.setTimeout(() => setLanded(true), learnedBookMs(pages.length) + 1100);
    return () => window.clearTimeout(land);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`fight-result is-win lesson-learned${landed ? ' is-landed' : ''}`}
      style={{ '--node-rgb': NODE_TINT_GOLD } as CSSProperties}
      onClick={() => setLanded(true)}
    >
      <div className="fight-result-veil" aria-hidden="true" />
      <NodeMotes count={10} />
      <div className="fight-result-body">
        <header className="fight-result-banner">
          <span className="fight-result-flash" aria-hidden="true" />
          <span className="fight-result-rays" aria-hidden="true" />
          <h2 className="fight-result-title" data-text="Learned">
            <span className="fight-result-title-glow" aria-hidden="true">
              Learned
            </span>
            Learned
          </h2>
        </header>
        <section className="lesson-learned-book">
          <LearnedBook pages={pages} landed={landed} />
        </section>
        {pages.length > 1 && (
          <section className={`lesson-learned-pages${landed ? ' is-shown' : ''}`}>
            <LearnedTiles pages={pages} shown={landed} landed={landed} />
          </section>
        )}
      </div>
      <PlateButton
        className={`fight-result-cta${landed ? ' is-lit' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          (onNext ?? onContinue)();
        }}
      >
        {onNext ? 'Next Lesson' : 'Continue'}
      </PlateButton>
      {onNext && (
        <button
          type="button"
          className={`secondary-button lesson-learned-back${landed ? ' is-lit' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onContinue();
          }}
        >
          Back to the Sky
        </button>
      )}
    </div>
  );
}
