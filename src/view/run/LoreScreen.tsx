import { useState } from 'react';
import { playSfx } from '../../audio/sfx';

interface Props {
  lines: readonly string[];
  onDone: () => void;
}

/**
 * The run's one piece of lore (docs/tutorial.md "The lore card"), ahead of the first draft on an
 * account: a line at a time on black, a tap to advance. Nothing else on the screen — the words are
 * the whole beat, and the draft they end on ("seal the pact") is the next thing the player sees.
 */
export function LoreScreen({ lines, onDone }: Props) {
  const [step, setStep] = useState(0);
  const index = Math.min(step, lines.length - 1);
  const last = index >= lines.length - 1;

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
      {/* Keyed on the line so each one fades in on its own. */}
      <p className={`lore-line${last ? ' is-last' : ''}`} key={index}>
        {lines[index]}
      </p>
      <span className="lore-advance">Tap to continue</span>
    </div>
  );
}
