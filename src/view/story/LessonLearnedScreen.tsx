import { useEffect, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import type { ManualPage } from '../../run/manual';
import { LearnedTiles, LEARNED_STAGGER_MS } from '../shared/ManualPages';
import { NODE_TINT_GOLD, NodeMotes } from '../shared/NodeStage';
import { PlateButton } from '../shared/PlateButton';
import { prefersReducedMotion } from '../shared/reducedMotion';

/** The title strikes and is read before the first page lands. */
const PAGES_LEAD_MS = 620;

/**
 * A lesson won: the pages it taught, filed into How to Play (docs/the-sky.md §2c). The fight
 * result's own stage, with the pages where the ledger would be; a tap lands them all.
 */
export function LessonLearnedScreen({ pages, onContinue }: { pages: readonly ManualPage[]; onContinue: () => void }) {
  const [shown, setShown] = useState(false);
  const [landed, setLanded] = useState(prefersReducedMotion());

  useEffect(() => {
    playSfx('quill.scratch');
    const show = window.setTimeout(() => setShown(true), PAGES_LEAD_MS);
    const land = window.setTimeout(() => setLanded(true), PAGES_LEAD_MS + pages.length * LEARNED_STAGGER_MS + 200);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(land);
    };
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
        <section className="lesson-learned-pages">
          <LearnedTiles pages={pages} shown={shown || landed} landed={landed} />
        </section>
      </div>
      <PlateButton
        className={`fight-result-cta${landed ? ' is-lit' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          onContinue();
        }}
      >
        Continue
      </PlateButton>
    </div>
  );
}
