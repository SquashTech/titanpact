import { useState } from 'react';
import { createPortal } from 'react-dom';
import { playSfx } from '../../audio/sfx';
import { parseTipText, type Tip, type TipIconToken } from '../../run/tips';
import { MoveKindGlyph } from '../shared/statIcons';
import { overlayHost } from '../shared/overlayHost';

/**
 * Which badge class an inline token wears — the move grid's own (`MoveKindBadge`), so the mark in
 * the sentence is literally the mark on the button the player is being sent to.
 */
const TOKEN_BADGE_CLASS: Record<TipIconToken, string> = {
  physical: 'category-physical',
  magical: 'category-magical',
  heal: 'kind-heal',
  buff: 'kind-buff',
  debuff: 'kind-debuff',
};

/** One page, with `[physical]`-style tokens swapped for the glyph they name. */
function TipText({ text }: { text: string }) {
  return (
    <>
      {parseTipText(text).map((segment, i) =>
        'icon' in segment ? (
          <span key={i} className={`category-badge move-kind-badge tip-inline-icon ${TOKEN_BADGE_CLASS[segment.icon]}`}>
            <MoveKindGlyph kind={segment.icon} className="move-kind-glyph" />
          </span>
        ) : (
          <span key={i}>{segment.text}</span>
        )
      )}
    </>
  );
}

interface Props {
  tip: Tip;
  /** Fired once, when the last page is dismissed. */
  onDone: () => void;
}

/**
 * A first-time tip (docs/tutorial.md): plain game text over whatever screen it explains. The
 * scrim dims without blurring, since the thing being named is on screen behind it, but swallows
 * input — a line explaining a button lands before the button is pressable.
 *
 * Portalled through overlayHost, never document.body: the shell is the transform-scaled design
 * canvas (the standing rule in overlayHost.ts).
 */
export function TipOverlay({ tip, onDone }: Props) {
  const [step, setStep] = useState(0);

  // Clamped rather than trusted: taps land faster than React commits. `onDone` is idempotent at
  // every caller, so the extra taps at the end are harmless once the page itself is pinned.
  const index = Math.min(step, tip.pages.length - 1);
  const last = index >= tip.pages.length - 1;

  function advance() {
    if (last) {
      playSfx('ui.confirm');
      onDone();
      return;
    }
    playSfx('ui.tap');
    setStep((i) => i + 1);
  }

  return createPortal(
    <div className="tip-overlay" onClick={advance} role="dialog" aria-live="polite">
      <div className="tip-box">
        <div className="tip-title">{tip.title}</div>

        {/* Keyed on the page so each one re-runs its arrival. */}
        <p className="tip-page" key={index}>
          <TipText text={tip.pages[index]} />
        </p>

        <div className="tip-foot">
          {tip.pages.length > 1 ? (
            <div className="tip-pips" aria-label={`Page ${index + 1} of ${tip.pages.length}`}>
              {tip.pages.map((_, i) => (
                <span key={i} className={`tip-pip${i === index ? ' is-current' : ''}${i < index ? ' is-done' : ''}`} />
              ))}
            </div>
          ) : (
            <span />
          )}
          <span className="tip-advance">{last ? 'Got it' : 'Next'}</span>
        </div>
      </div>
    </div>,
    overlayHost()
  );
}
