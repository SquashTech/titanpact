import { useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { playSfx } from '../../audio/sfx';
import { parseTipText, type Tip, type TipIconToken } from '../../run/tips';
import { MoveKindGlyph } from '../shared/statIcons';
import { canvasPoint, overlayHost } from '../shared/overlayHost';
import { pageSpotlight, TIP_STAGING } from './tipStaging';

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

interface Hole {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Past this, a selector is lighting a crowd, not a thing — the first few say it as well. */
const MAX_HOLES = 16;
const HOLE_PAD = 5;

/** Every element the page names, as padded boxes in canvas px (the overlay lives inside the scaled shell). */
function measureHoles(selectors: readonly string[]): Hole[] {
  const holes: Hole[] = [];
  for (const selector of selectors) {
    for (const el of Array.from(document.querySelectorAll(selector))) {
      if (holes.length >= MAX_HOLES) return holes;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const a = canvasPoint(rect.left, rect.top);
      const b = canvasPoint(rect.right, rect.bottom);
      holes.push({ left: a.x - HOLE_PAD, top: a.y - HOLE_PAD, width: b.x - a.x + HOLE_PAD * 2, height: b.y - a.y + HOLE_PAD * 2 });
    }
  }
  return holes;
}

/**
 * Re-measured on every page, and again a frame later and on resize: a fight's move rows and
 * nameplates settle a beat after the tip mounts, and a spotlight a few px off reads as a bug.
 */
function useHoles(selectors: readonly string[] | null): Hole[] {
  const [holes, setHoles] = useState<Hole[]>([]);
  const key = selectors ? selectors.join('|') : '';
  useLayoutEffect(() => {
    if (!selectors) {
      setHoles([]);
      return;
    }
    const measure = () => setHoles(measureHoles(selectors));
    measure();
    const frame = requestAnimationFrame(measure);
    const late = window.setTimeout(measure, 250);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(late);
      window.removeEventListener('resize', measure);
    };
    // Keyed on the joined selectors, so a fresh array literal with the same contents is no change.
  }, [key]);
  return holes;
}

type Placement = 'top' | 'center' | 'bottom';

/** Roughly the card's height, for choosing where it covers least; the choice only needs to be about right. */
const BOX_ESTIMATE = 140;
const EDGE = 16;

/** The band that hides least of what the page lit — the middle first, when it is clear or nothing is lit. */
function choosePlacement(holes: readonly Hole[], height: number): Placement {
  if (holes.length === 0 || height <= 0) return 'center';
  const bands: Record<Placement, [number, number]> = {
    center: [height / 2 - BOX_ESTIMATE / 2, height / 2 + BOX_ESTIMATE / 2],
    top: [EDGE, EDGE + BOX_ESTIMATE],
    bottom: [height - EDGE - BOX_ESTIMATE, height - EDGE],
  };
  let best: Placement = 'center';
  let bestCover = Infinity;
  for (const placement of ['center', 'top', 'bottom'] as const) {
    const [y0, y1] = bands[placement];
    const cover = holes.reduce((sum, h) => sum + Math.max(0, Math.min(y1, h.top + h.height) - Math.max(y0, h.top)) * h.width, 0);
    if (cover < bestCover) {
      best = placement;
      bestCover = cover;
    }
  }
  return best;
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
  const overlayRef = useRef<HTMLDivElement>(null);
  const maskId = `tip-mask-${useId().replace(/:/g, '')}`;
  const staging = TIP_STAGING[tip.id];

  // Clamped rather than trusted: taps land faster than React commits. `onDone` is idempotent at
  // every caller, so the extra taps at the end are harmless once the page itself is pinned.
  const index = Math.min(step, tip.pages.length - 1);
  const last = index >= tip.pages.length - 1;

  const holes = useHoles(pageSpotlight(staging, index));
  const lit = holes.length > 0;
  const placement: Placement | 'low' =
    staging?.placement === 'low' ? 'low' : choosePlacement(holes, overlayRef.current?.clientHeight ?? 0);

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
      ref={overlayRef}
      className={`tip-overlay${lit ? ' has-spotlight' : ''} is-${placement}`}
      onClick={advance}
      role="dialog"
      aria-live="polite"
    >
      {/* One scrim with a hole cut for each thing the page names, then a ring on each hole. */}
      {lit && (
        <svg className="tip-scrim" aria-hidden="true">
          <defs>
            <mask id={maskId}>
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {holes.map((h, i) => (
                <rect key={i} x={h.left} y={h.top} width={h.width} height={h.height} rx="9" fill="black" />
              ))}
            </mask>
          </defs>
          <rect x="0" y="0" width="100%" height="100%" className="tip-scrim-fill" mask={`url(#${maskId})`} />
        </svg>
      )}
      {holes.map((h, i) => (
        <div key={`${index}-${i}`} className="tip-spotlight" style={{ left: h.left, top: h.top, width: h.width, height: h.height }} />
      ))}
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
