import { useRef, useState, type RefObject, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { playSfx } from '../../audio/sfx';

/** Past this the drag is a page turn, not a scroll that wandered. */
const AXIS_LOCK_PX = 10;
const TURN_FRACTION = 0.2;
const TURN_MIN_PX = 48;

/**
 * Swipe between a tabbed sheet's pages. The page follows the finger, rubber-bands at either end,
 * and turns past a fifth of its width; a vertical drag is left to the scroller. `select` is the
 * strip's tap, so a tapped page enters from the same side a swiped one would.
 */
export function useTabSwipe<Id extends string>(ids: readonly Id[], active: Id, onSelect: (id: Id) => void, sharedRef?: RefObject<HTMLDivElement | null>) {
  const ownRef = useRef<HTMLDivElement>(null);
  const pageRef = sharedRef ?? ownRef;
  const drag = useRef<{ id: number; x: number; y: number; axis: 'x' | 'y' | null } | null>(null);
  const swiped = useRef(false);
  const [enterFrom, setEnterFrom] = useState<'left' | 'right' | null>(null);
  const index = ids.indexOf(active);

  const setDx = (dx: number) => pageRef.current?.style.setProperty('--swipe-dx', `${dx}px`);
  const setDragging = (on: boolean) => pageRef.current?.classList.toggle('is-swiping', on);

  function select(next: Id) {
    const to = ids.indexOf(next);
    if (to < 0 || next === active) return;
    setEnterFrom(to > index ? 'right' : 'left');
    onSelect(next);
  }

  function onPointerDown(e: ReactPointerEvent<HTMLElement>) {
    if (!e.isPrimary || ids.length < 2) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, axis: null };
  }

  function onPointerMove(e: ReactPointerEvent<HTMLElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.axis) {
      if (Math.hypot(dx, dy) < AXIS_LOCK_PX) return;
      d.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (d.axis === 'x') {
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragging(true);
      }
    }
    if (d.axis !== 'x') return;
    const atEdge = (index === 0 && dx > 0) || (index === ids.length - 1 && dx < 0);
    setDx(atEdge ? dx / 4 : dx);
  }

  function onPointerUp(e: ReactPointerEvent<HTMLElement>) {
    const d = drag.current;
    drag.current = null;
    if (!d || d.axis !== 'x') return;
    setDragging(false);
    setDx(0);
    swiped.current = true;
    window.setTimeout(() => (swiped.current = false), 0);
    const dx = e.clientX - d.x;
    const threshold = Math.max(TURN_MIN_PX, e.currentTarget.clientWidth * TURN_FRACTION);
    const step = dx <= -threshold ? 1 : dx >= threshold ? -1 : 0;
    const next = ids[index + step];
    if (step !== 0 && next) {
      playSfx('ui.page');
      select(next);
    }
  }

  function onPointerCancel() {
    drag.current = null;
    setDragging(false);
    setDx(0);
  }

  // The release after a swipe would otherwise land as a tap on whatever card sits under the finger.
  function onClickCapture(e: ReactMouseEvent) {
    if (!swiped.current) return;
    e.stopPropagation();
    e.preventDefault();
  }

  return {
    pageRef,
    select,
    pageClass: enterFrom ? ` is-enter-${enterFrom}` : '',
    swipeHandlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onClickCapture },
  };
}
