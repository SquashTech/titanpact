// The title's beat after the first Cycle I win (docs/tutorial.md "The modes opening"): the title
// dims, the two doors arrive in their corners, then one window a mode, each over a picture of that
// mode's own screen while its door is lit.

import { useEffect, useRef, useState } from 'react';
import { playSfx } from '../../audio/sfx';
import { MODES_OPEN_CAPTION, MODES_OPEN_PAGES } from '../../data/tips';
import type { TitleMode } from './TitleModes';
import { ModeEmblem } from './TitleModes';
import trialsShot from '../../../art/ui/modes/trials.webp';
import gauntletShot from '../../../art/ui/modes/gauntlet.webp';

const SHOTS: Record<'trials' | 'gauntlet', string> = { trials: trialsShot, gauntlet: gauntletShot };

/** What the title draws under the beat: no doors yet, the doors arriving, or one door lit. */
export type ModesBeatStage = { doors: 'held' } | { doors: 'arriving' } | { doors: 'shown'; lit: TitleMode | null };

/** The dim settles before the doors come; the doors land before the first window rises. */
const DOORS_AT_MS = 800;
const FIRST_PAGE_AT_MS = 2200;
const EXIT_MS = 380;

export function ModesOpenBeat({ onStage, onDone }: { onStage: (stage: ModesBeatStage) => void; onDone: () => void }) {
  // -1 is the arrival, before any window.
  const [page, setPage] = useState(-1);
  const [leaving, setLeaving] = useState(false);
  const stageRef = useRef(onStage);
  stageRef.current = onStage;
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    stageRef.current({ doors: 'held' });
    const doors = window.setTimeout(() => {
      stageRef.current({ doors: 'arriving' });
      playSfx('star.reveal');
    }, DOORS_AT_MS);
    const first = window.setTimeout(() => setPage((p) => Math.max(p, 0)), FIRST_PAGE_AT_MS);
    return () => {
      window.clearTimeout(doors);
      window.clearTimeout(first);
    };
  }, []);

  useEffect(() => {
    if (page < 0) return;
    stageRef.current({ doors: 'shown', lit: leaving ? null : MODES_OPEN_PAGES[page].mode });
  }, [page, leaving]);

  useEffect(() => {
    if (!leaving) return;
    const id = window.setTimeout(() => doneRef.current(), EXIT_MS);
    return () => window.clearTimeout(id);
  }, [leaving]);

  function advance() {
    if (leaving) return;
    if (page < 0) {
      setPage(0);
      return;
    }
    if (page < MODES_OPEN_PAGES.length - 1) {
      playSfx('ui.page');
      setPage(page + 1);
      return;
    }
    playSfx('ui.confirm');
    setLeaving(true);
  }

  const current = page >= 0 ? MODES_OPEN_PAGES[page] : null;
  const last = page === MODES_OPEN_PAGES.length - 1;

  return (
    <div className={`modes-beat${leaving ? ' is-leaving' : ''}`} onClick={advance} role="dialog" aria-live="polite">
      <span className="modes-beat-scrim" aria-hidden="true" />
      {!current && <div className="modes-beat-caption">{MODES_OPEN_CAPTION}</div>}
      {current && (
        <div key={current.mode} className={`modes-beat-window is-${current.mode}`}>
          <div className="modes-beat-head">
            <span className="modes-beat-medal">
              <ModeEmblem mode={current.mode} />
            </span>
            <span className="modes-beat-the">The</span>
            <span className="modes-beat-word">{current.word.toUpperCase()}</span>
          </div>
          <div className="modes-beat-shot">
            <img src={SHOTS[current.mode]} alt="" draggable={false} />
          </div>
          <p className="modes-beat-line">{current.line}</p>
          <div className="modes-beat-foot">
            <span className="modes-beat-pips" aria-label={`Page ${page + 1} of ${MODES_OPEN_PAGES.length}`}>
              {MODES_OPEN_PAGES.map((p, i) => (
                <span key={p.mode} className={`modes-beat-pip${i === page ? ' is-current' : ''}`} />
              ))}
            </span>
            <span className="modes-beat-advance">{last ? 'Got it' : 'Next'}</span>
          </div>
        </div>
      )}
    </div>
  );
}
