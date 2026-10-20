import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { canvasPoint, overlayHost } from '../shared/overlayHost';

// A pointing hand, drawn pixel by pixel: 'o' outline, 'w' glove. The fingertip is the top of column 5–6.
const HAND = [
  '.....oo......',
  '....owwo.....',
  '....owwo.....',
  '....owwo.....',
  '....owwooo...',
  '....owwowwoo.',
  '.ooowwowwowwo',
  'owwowwwwwowwo',
  'owwwwwwwwwwwo',
  'owwwwwwwwwwwo',
  '.owwwwwwwwwwo',
  '..owwwwwwwwwo',
  '..owwwwwwwwo.',
  '...owwwwwwwo.',
  '...owwwwwwwo.',
  '...ooooooooo.',
];
const PIXEL = 3;
const TIP_X = 5.5 * PIXEL;

const CELLS = HAND.flatMap((row, y) => [...row].flatMap((c, x) => (c === '.' ? [] : [{ x, y, c }])));

/** Where on the element the fingertip rests, as fractions of its box. */
const AIM_X = 0.62;
const AIM_Y = 0.42;

/**
 * The Story's tap guide (docs/stories.md §5): a hand that bobs at the one thing to tap next, found
 * by `selector` and re-found as the console changes under it. Above everything, catching nothing.
 */
export function GuideHand({ selector }: { selector: string }) {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const find = () => {
      const el = document.querySelector(selector);
      const rect = el?.getBoundingClientRect();
      if (!rect || rect.width === 0) return setAt(null);
      setAt(canvasPoint(rect.left + rect.width * AIM_X, rect.top + rect.height * AIM_Y));
    };
    find();
    // The panels slide in and the cards settle a beat after a tap: follow them rather than guess when.
    const timer = window.setInterval(find, 200);
    return () => window.clearInterval(timer);
  }, [selector]);
  if (!at) return null;
  return createPortal(
    <div className="guide-hand" style={{ left: at.x - TIP_X, top: at.y }} aria-hidden="true">
      <svg width={13 * PIXEL} height={HAND.length * PIXEL} viewBox={`0 0 13 ${HAND.length}`} shapeRendering="crispEdges">
        {CELLS.map(({ x, y, c }) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={c === 'o' ? '#1b1206' : '#fbf3df'} />
        ))}
      </svg>
    </div>,
    overlayHost()
  );
}
