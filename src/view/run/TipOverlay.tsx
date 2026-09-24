import { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { playSfx } from '../../audio/sfx';
import { parseTipText, type Tip, type TipIconToken } from '../../run/tips';
import { MoveKindGlyph } from '../shared/statIcons';
import { canvasPoint, overlayHost } from '../shared/overlayHost';

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

/**
 * How a tip sits over its screen, by tip id — presentation, so it lives here rather than in the
 * content. `spotlight` is a selector for the thing the tip is about: it stays lit and outlined
 * while the rest of the screen dims harder, so the card points at it rather than only naming it.
 * `placement: 'low'` drops the card toward the bottom, for a screen whose subject is its middle.
 */
interface TipStaging {
  spotlight?: string;
  placement?: 'low';
}

const TIP_STAGING: Readonly<Record<string, TipStaging>> = {
  // The four starters along the bottom are the whole of the draft's first verb.
  draft: { spotlight: '.draft-rail' },
  // The act's arrival is the place itself — keep the card off it.
  run: { placement: 'low' },
};

interface Hole {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The spotlit element's box in canvas px (the overlay lives inside the scaled shell), padded. */
function useSpotlight(selector: string | undefined): Hole | null {
  const [hole, setHole] = useState<Hole | null>(null);
  useLayoutEffect(() => {
    if (!selector) return;
    function measure() {
      const el = document.querySelector(selector!);
      if (!el) return setHole(null);
      const rect = el.getBoundingClientRect();
      const a = canvasPoint(rect.left, rect.top);
      const b = canvasPoint(rect.right, rect.bottom);
      const pad = 6;
      setHole({ left: a.x - pad, top: a.y - pad, width: b.x - a.x + pad * 2, height: b.y - a.y + pad * 2 });
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [selector]);
  return hole;
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
  const staging = TIP_STAGING[tip.id] ?? {};
  const hole = useSpotlight(staging.spotlight);

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
    <div
      className={`tip-overlay${hole ? ' has-spotlight' : ''}${staging.placement === 'low' ? ' is-low' : ''}`}
      onClick={advance}
      role="dialog"
      aria-live="polite"
    >
      {hole && <div className="tip-spotlight" style={{ left: hole.left, top: hole.top, width: hole.width, height: hole.height }} />}
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
