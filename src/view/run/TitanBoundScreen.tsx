import { useEffect, useRef, useState } from 'react';
import { playSfx } from '../../audio/sfx';
import { SEAL_ACTS } from '../../run/state';
import { SealArt } from '../shared/SealArt';
import { prefersReducedMotion } from '../shared/reducedMotion';
import { TitanColossus } from './titanArt';

interface Props {
  onContinue: () => void;
}

/** The Eyes, put out and wide with it: the whole frame shaking under something that will not stop (ms). */
const THROES_MS = 1900;
/** The lids close and the head goes down out of the frame; the jolt at the bottom is it landing (ms). */
const FALL_MS = 1500;
/** Black, and the seal turning in out of it (ms). */
const SEAL_MS = 1500;
/** One sigil after another re-lit (ms between). */
const SIGIL_MS = 340;
/** After the fifth: the rings lock and the whole thing sets (ms). */
const LOCK_MS = 1100;

const FALL_AT = THROES_MS;
const SEAL_AT = FALL_AT + FALL_MS;
const SIGILS_AT = SEAL_AT + SEAL_MS;
const LOCK_AT = SIGILS_AT + SIGIL_MS * SEAL_ACTS;
const BOUND_AT = LOCK_AT + LOCK_MS;

type BoundPhase = 'throes' | 'fall' | 'seal' | 'lock' | 'bound';

/**
 * The Eyes have closed (docs/titan-eyes.md §2): the last beat of the fight, played at the scale
 * of the sky. The head that rose when the fifth seal broke (TitanRiseScreen) goes back down the
 * way it came, and the title screen's own seal — the one with a sigil dead on it every time the
 * player has looked at it — turns in over the black and re-lights, one warden at a time, and
 * locks. Binding is mutual (docs/lore.md §1): the Titan is on the ground because it was made to
 * look away, and this is the leash going back on. The champion's hall follows.
 */
export function TitanBoundScreen({ onContinue }: Props) {
  const [phase, setPhase] = useState<BoundPhase>('throes');
  const [lit, setLit] = useState(0);
  const done = useRef(onContinue);
  done.current = onContinue;

  useEffect(() => {
    if (prefersReducedMotion()) {
      setPhase('bound');
      setLit(SEAL_ACTS);
      return;
    }
    playSfx('titan.gaze');
    playSfx('titan.stir');
    const timers = [
      window.setTimeout(() => {
        setPhase('fall');
        playSfx('titan.stir');
        // The landing, timed to the drop's end (styles.css titan-bound-drop).
        window.setTimeout(() => playSfx('seal.shatter'), 1100);
      }, FALL_AT),
      window.setTimeout(() => setPhase('seal'), SEAL_AT),
      ...Array.from({ length: SEAL_ACTS }, (_, i) =>
        window.setTimeout(() => {
          setLit(i + 1);
          playSfx('seal.strike');
        }, SIGILS_AT + SIGIL_MS * i)
      ),
      window.setTimeout(() => {
        setPhase('lock');
        playSfx('pact.bind');
      }, LOCK_AT),
      window.setTimeout(() => setPhase('bound'), BOUND_AT),
    ];
    return () => timers.forEach(window.clearTimeout);
  }, []);

  const collapsing = phase === 'throes' || phase === 'fall';

  return (
    <div className={`titan-bound is-${phase}`}>
      {collapsing && (
        <div className="titan-bound-shake">
          <span className="titan-bound-ember" aria-hidden="true" />
          <div className="titan-dust" aria-hidden="true">
            {Array.from({ length: 22 }, (_, i) => {
              const across = (i * 61.8) % 100;
              const down = (i * 38.2) % 100;
              return (
                <span
                  key={i}
                  className="titan-mote"
                  style={{
                    left: `${across}%`,
                    top: `${30 + down * 0.6}%`,
                    animationDelay: `${(down * 0.02) % 1.4}s`,
                    animationDuration: `${1.4 + across * 0.012}s`,
                  }}
                />
              );
            })}
          </div>

          {/* The same head TitanRiseScreen brought up, eyes wide (the title's own open lens),
              going out and going down. */}
          <div className="titan-bound-head" aria-hidden="true">
            <span className="titan-rise-skull" />
            <TitanColossus />
          </div>
          <span className="titan-bound-flash" aria-hidden="true" />
        </div>
      )}

      {!collapsing && (
        <div className="titan-bound-sealing">
          <div className="titan-bound-seal" aria-hidden="true">
            <SealArt lit={lit} />
            <span className="titan-bound-seal-core" />
          </div>

          <div className="titan-bound-caption">
            <div className="titan-bound-eyebrow">The sixth held</div>
            <h2 className="titan-bound-title">The Titan is bound</h2>
            <p className="titan-bound-line">Bound to those who put it down. A thousand years, if the seals are kept.</p>
            <button type="button" className="resolve-button titan-bound-continue" onClick={() => done.current()}>
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
