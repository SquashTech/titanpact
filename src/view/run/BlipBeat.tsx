import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { overlayHost } from '../shared/overlayHost';
import { Blip, type BlipHandle } from './Blip';

// A forced thought (docs/the-sky.md §1): the sky dims, Blip comes forward, and each bubble waits for
// a tap anywhere. A poke on Blip is still only a poke.

const ENTER_MS = 650;

interface Props {
  lines: readonly string[];
  onDone: () => void;
  /** Where Blip was sitting, in the canvas's px: it flies forward from there, and back once done. */
  from?: { x: number; y: number };
}

export function BlipBeat({ lines, onDone, from }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const blip = useRef<BlipHandle>(null);
  const [home, setHome] = useState<{ x: number; y: number } | null>(null);
  const [leaving, setLeaving] = useState(false);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const centre = { x: stage.clientWidth / 2, y: stage.clientHeight * 0.34 };
    setHome(from ?? centre);
    if (from) requestAnimationFrame(() => setHome(centre));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    if (!home) return;
    const timer = window.setTimeout(() => {
      blip.current?.react('chirp');
      blip.current?.think(
        lines,
        () => {
          setLeaving(true);
          if (from) setHome(from);
          window.setTimeout(onDone, 450);
        },
        { forced: true }
      );
    }, ENTER_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home !== null]);

  return createPortal(
    <div ref={stageRef} className={`blip-beat${leaving ? ' is-leaving' : ''}`} onClick={() => blip.current?.advance()}>
      {home && <Blip ref={blip} home={home} active bubbleAt="below" />}
    </div>,
    overlayHost()
  );
}
