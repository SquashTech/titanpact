import { useEffect, useState } from 'react';
import { playSfx } from '../../audio/sfx';
import { prefersReducedMotion } from '../shared/reducedMotion';

interface Props {
  lines: readonly string[];
  onDone: () => void;
}

/** Black, and a rumble under it: only the light behind the lids (ms). */
const STIR_MS = 950;
/** The lids part to a slit and hold there (ms). */
const CRACK_MS = 620;

type EyesPhase = 'stir' | 'crack' | 'open';

/**
 * A lore card (docs/tutorial.md "The lore card", docs/cycles.md §7): the account's first ahead of
 * its first draft, and each Cycle's ahead of its first. A line at a time on black, a tap to
 * advance, and above the lines the Titan's eyes opening — the cold open, which played before
 * every run until 2026-10-06 and now plays only here, high on the screen so the words stay clear.
 */
export function LoreScreen({ lines, onDone }: Props) {
  const [step, setStep] = useState(0);
  const [eyes, setEyes] = useState<EyesPhase>(() => (prefersReducedMotion() ? 'open' : 'stir'));
  const index = Math.min(step, lines.length - 1);
  const last = index >= lines.length - 1;

  useEffect(() => {
    if (prefersReducedMotion()) return;
    playSfx('titan.stir');
    const timers = [
      window.setTimeout(() => setEyes('crack'), STIR_MS),
      window.setTimeout(() => {
        setEyes('open');
        playSfx('titan.gaze');
      }, STIR_MS + CRACK_MS),
    ];
    return () => timers.forEach(window.clearTimeout);
  }, []);

  function advance() {
    if (last) {
      playSfx('ui.confirm');
      onDone();
      return;
    }
    playSfx('ui.tap');
    setStep((i) => i + 1);
  }

  return (
    <div className="lore-screen" onClick={advance} role="dialog" aria-live="polite">
      <div className={`titan-wake lore-titan is-${eyes}`} aria-hidden="true">
        <div className="titan-wake-shake">
          <div className="titan-face">
            {(['is-left', 'is-right'] as const).map((side) => (
              <span key={side} className={`titan-eye ${side}`}>
                <span className="titan-eye-halo" />
                <span className="titan-eye-clip">
                  <span className="titan-eye-globe" />
                  <span className="titan-eye-pupil" />
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>
      {/* Keyed on the line so each one fades in on its own. */}
      <p className={`lore-line${last ? ' is-last' : ''}`} key={index}>
        {lines[index]}
      </p>
      <span className="lore-advance">Tap to continue</span>
    </div>
  );
}
