import { useEffect, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { gemAmount, type Gem } from '../../run/gems';
import { GemIcon, GEM_STONES } from '../shared/GemIcon';
import { prefersReducedMotion } from '../shared/reducedMotion';
import { STAT_FULL_LABELS } from '../shared/relicStacks';
import lapidaryArt from '../../../art/npc/lapidary.png';
import { RoadScene } from './RoadEncounter';

/** The walk-in, then the first Gem (ms from mount). Matches `road-encounter-arrive`. */
const FIRST_GIFT_AT = 1100;
/** Between one Gem and the next. */
const GIFT_EVERY = 420;
/** Each Gem's ding a step up from the last: a major triad, then on up the octave. */
const DING_PITCH = [1, 1.26, 1.5, 2, 2.52, 3];

/**
 * The Lapidary met on the road: one line, then the Gems handed over one at a time, each with a
 * ding. A tap while they are still coming lays them all out; a tap after walks on to the who-screen.
 */
export function LapidaryOnTheRoad({ line, gems, onDone }: { line: string; gems: readonly Gem[]; onDone: () => void }) {
  const [given, setGiven] = useState(() => (prefersReducedMotion() ? gems.length : 0));
  const done = given >= gems.length;

  useEffect(() => {
    if (done) return;
    const timer = window.setTimeout(
      () => {
        playSfx('gem.set', { pitch: DING_PITCH[Math.min(given, DING_PITCH.length - 1)] });
        setGiven((n) => n + 1);
      },
      given === 0 ? FIRST_GIFT_AT : GIFT_EVERY
    );
    return () => window.clearTimeout(timer);
  }, [given, done]);

  function advance() {
    if (!done) {
      setGiven(gems.length);
      return;
    }
    playSfx('ui.confirm');
    onDone();
  }

  return (
    <RoadScene className="is-lapidary" label={`The Lapidary: ${line}`} onClick={advance}>
      <img src={lapidaryArt} className={`road-encounter-figure${prefersReducedMotion() ? ' is-still' : ''}`} alt="" draggable={false} />
      <span className="road-encounter-speech is-open" aria-hidden="true">
        <span className="road-encounter-name">The Lapidary</span>
        <span className="road-encounter-line">{line}</span>
        <span className="road-gem-gifts">
          {gems.map((gem, i) => (
            <span
              key={i}
              className={`road-gem-gift${i < given ? ' is-given' : ''}`}
              style={{ '--gem-color': GEM_STONES[gem.stat].tones[1] } as CSSProperties}
            >
              <GemIcon stat={gem.stat} size={40} live={i < given} large={gem.points >= 10} />
              <span className="road-gem-gift-grant">
                +{gemAmount(gem)} {gem.stat === 'manaPool' ? 'Mana' : STAT_FULL_LABELS[gem.stat]}
              </span>
            </span>
          ))}
        </span>
        {done && <span className="road-encounter-more" />}
      </span>
    </RoadScene>
  );
}
