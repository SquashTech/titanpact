import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { canvasPoint, overlayHost } from '../shared/overlayHost';

// A pointing glove, drawn pixel by pixel (picked off art/concepts/pointer-hand/): 'o' outline, 'w' glove,
// 's' its shade, 'c' the gold cuff, 'd' the cuff's shade. The fingertip is the top of columns 6–7.
const HAND = [
  '......oo........',
  '.....owwo.......',
  '.....owso.......',
  '.....owso.......',
  '.....owsooo.....',
  '.....owsowsoo...',
  '..oo.owsowsowo..',
  '.owwoowsowsowso.',
  '.owwsowwwwwwwso.',
  '..owsswwwwwwwso.',
  '...owwwwwwwwwso.',
  '...owwwwwwwwsso.',
  '....owwwwwwsso..',
  '....owwwwwwsso..',
  '....occcccccdo..',
  '....occcccccdo..',
  '....oooooooooo..',
];
const COLORS: Readonly<Record<string, string>> = { o: '#1b1206', w: '#fffaf0', s: '#d8c9a8', c: '#e0a63c', d: '#9c6a1e' };
const PIXEL = 3;
const TIP_X = 6.5 * PIXEL;

const CELLS = HAND.flatMap((row, y) => [...row].flatMap((c, x) => (c === '.' ? [] : [{ x, y, c }])));

/** Where on the element the fingertip rests, as fractions of its box. */
const AIM_X = 0.62;
const AIM_Y = 0.42;

/**
 * The Story's tap guide (docs/stories.md §5): a hand that bobs at the one thing to tap next, a ring
 * spreading from its fingertip on each press, found by `selector` and re-found as the console
 * changes under it. Above everything, catching nothing.
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
    <>
      <span className="guide-hand-ring" style={{ left: at.x, top: at.y }} aria-hidden="true" />
      <div className="guide-hand" style={{ left: at.x - TIP_X, top: at.y }} aria-hidden="true">
        <svg width={HAND[0].length * PIXEL} height={HAND.length * PIXEL} viewBox={`0 0 ${HAND[0].length} ${HAND.length}`} shapeRendering="crispEdges">
          {CELLS.map(({ x, y, c }) => (
            <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={COLORS[c]} />
          ))}
        </svg>
      </div>
    </>,
    overlayHost()
  );
}
