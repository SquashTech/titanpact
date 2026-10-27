import { useEffect, useRef, useState } from 'react';
import { playSfx } from '../../audio/sfx';
import { prefersReducedMotion } from '../shared/reducedMotion';
import panelSky from '../../../art/title/opening/panelSky.png';
import panelFall from '../../../art/title/opening/panelFall.png';
import panelImpact from '../../../art/title/opening/panelImpact.png';
import ridgePainting from '../../../art/title/openingRidge.png';
import './openingFall.css';

// The opening beat's scene (docs/the-sky.md §1), told as a comic page in the ridge painting's own
// pixel style (2026-10-26, per user direction): the sky cracks open, the Titan falls, it strikes the
// land; then the page gives way to the ridge where Valor and Fang stand watching the glow. It plays
// on its own; nothing here waits for a tap.

/** When each panel lands, and when the page gives way to the ridge. */
const SKY_AT = 300;
const FALL_AT = 2000;
const IMPACT_AT = 3800;
const RIDGE_AT = 5800;
const RIDGE_MS = 2600;
const SETTLED_AT = RIDGE_AT + RIDGE_MS;

/** Where the glow sits in the ridge painting, percent of the box, and how close the pull-back starts on it. */
const GLOW = { x: 48, y: 49 };
const PAN_FROM = 2.6;

type Phase = 'dark' | 'sky' | 'fall' | 'impact' | 'ridge' | 'settled';

export function OpeningFall({ onSettled }: { onSettled: () => void }) {
  const still = prefersReducedMotion();
  const [phase, setPhase] = useState<Phase>(still ? 'settled' : 'dark');
  const pageRef = useRef<HTMLDivElement>(null);
  const ridgeRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (still) {
      onSettled();
      return;
    }
    const timers = [
      window.setTimeout(() => {
        setPhase('sky');
        playSfx('titan.stir', { gain: 0.7 });
      }, SKY_AT),
      window.setTimeout(() => {
        setPhase('fall');
        playSfx('entrance.dread');
      }, FALL_AT),
      window.setTimeout(() => {
        setPhase('impact');
        playSfx('seal.shatter');
        window.setTimeout(() => playSfx('titan.stir'), 250);
      }, IMPACT_AT),
      window.setTimeout(() => setPhase('ridge'), RIDGE_AT),
      window.setTimeout(() => {
        setPhase('settled');
        onSettled();
      }, SETTLED_AT),
    ];

    // The page falls away into the glow as the ridge opens out from it.
    const ease = 'cubic-bezier(0.45, 0, 0.2, 1)';
    pageRef.current?.animate(
      [
        { transform: 'scale(1)', opacity: 1 },
        { opacity: 0, offset: 0.4 },
        { transform: 'scale(0.6)', opacity: 0 },
      ],
      { duration: RIDGE_MS, delay: RIDGE_AT, fill: 'both', easing: ease }
    );
    ridgeRef.current?.animate(
      [
        { transform: `scale(${PAN_FROM})`, opacity: 0 },
        { opacity: 1, offset: 0.4 },
        { transform: 'scale(1)', opacity: 1 },
      ],
      { duration: RIDGE_MS, delay: RIDGE_AT, fill: 'both', easing: ease }
    );
    return () => timers.forEach(window.clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [still]);

  const shown = (at: Phase) => {
    const order: Phase[] = ['dark', 'sky', 'fall', 'impact', 'ridge', 'settled'];
    return order.indexOf(phase) >= order.indexOf(at);
  };

  return (
    <div className={`opening-fall is-${phase}`} aria-hidden="true">
      {!still && (
        <div ref={pageRef} className="opening-comic">
          <div className="opening-comic-shake">
            <figure className={`opening-panel is-sky${shown('sky') ? ' is-in' : ''}`}>
              <img src={panelSky} alt="" draggable={false} />
              <span className="opening-panel-crack" />
            </figure>
            <figure className={`opening-panel is-fall${shown('fall') ? ' is-in' : ''}`}>
              <img src={panelFall} alt="" draggable={false} />
            </figure>
            <figure className={`opening-panel is-impact${shown('impact') ? ' is-in' : ''}`}>
              <img src={panelImpact} alt="" draggable={false} />
              <span className="opening-panel-flash" />
            </figure>
          </div>
        </div>
      )}
      <img
        ref={ridgeRef}
        className="opening-fall-ridge"
        src={ridgePainting}
        alt=""
        draggable={false}
        style={{ transformOrigin: `${GLOW.x}% ${GLOW.y}%`, opacity: still ? 1 : 0 }}
      />
    </div>
  );
}
