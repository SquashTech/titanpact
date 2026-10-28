import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { canvasPoint, overlayHost } from '../shared/overlayHost';
import { Blip, type BlipHandle } from './Blip';

// Blip as a guide (docs/the-sky.md §2e): it leaves its seat and flies to the one thing to tap next,
// hovering over it, and chirps on arriving. Catches nothing but a poke.

/** How far over its target Blip hovers, in canvas px. */
const HOVER = 36;

type Point = { x: number; y: number };

export interface GuideTarget {
  selector: string;
  /** `seat`: Blip's own seat on the sky (`BLIP_SEAT` inside it); otherwise it hovers over the element. */
  at?: 'over' | 'seat';
}

interface Props {
  target: GuideTarget;
  /** Where Blip sits on the sky, in its seat's px. */
  seat: Point;
  /** Out of sight while something else holds the screen; it keeps its place. */
  hidden?: boolean;
  /** Blip has reached the target. */
  onArrive?: () => void;
}

export function BlipGuide({ target, seat, hidden = false, onArrive }: Props) {
  const blip = useRef<BlipHandle>(null);
  const [start] = useState<Point>(() => seatPoint(seat) ?? { x: 190, y: 160 });
  const aimed = useRef<Point | null>(null);
  const arrived = useRef(false);
  const arriveRef = useRef(onArrive);
  arriveRef.current = onArrive;

  useEffect(() => {
    aimed.current = null;
    arrived.current = false;
    const find = () => {
      const point = target.at === 'seat' ? seatPoint(seat, target.selector) : overPoint(target.selector);
      if (!point) return;
      const last = aimed.current;
      if (last && Math.abs(last.x - point.x) < 2 && Math.abs(last.y - point.y) < 2) return;
      aimed.current = point;
      blip.current?.goTo(point.x, point.y, () => {
        if (arrived.current) return;
        arrived.current = true;
        blip.current?.react('chirp');
        arriveRef.current?.();
      });
    };
    find();
    // Pages slide in a beat after a tab changes: follow the target rather than guess when it lands.
    const timer = window.setInterval(find, 200);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.selector, target.at]);

  return createPortal(
    <div className={`blip-guide${hidden ? ' is-hidden' : ''}`}>
      <Blip ref={blip} home={start} active={!hidden} />
    </div>,
    overlayHost()
  );
}

function seatPoint(seat: Point, selector = '.sky-seat'): Point | null {
  const rect = document.querySelector(selector)?.getBoundingClientRect();
  if (!rect || rect.width === 0) return null;
  const corner = canvasPoint(rect.left, rect.top);
  return { x: corner.x + seat.x, y: corner.y + seat.y };
}

function overPoint(selector: string): Point | null {
  const rect = document.querySelector(selector)?.getBoundingClientRect();
  if (!rect || rect.width === 0) return null;
  const top = canvasPoint(rect.left + rect.width / 2, rect.top);
  return { x: top.x, y: top.y - HOVER };
}
