import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { overlayHost } from '../shared/overlayHost';
import { Blip, type BlipHandle } from './Blip';
import { OpeningFall } from './OpeningFall';

// A scene over the sky (docs/the-sky.md §1): the sky dims, Blip flies up out of the way while it
// plays, holds on its last frame a moment, then flies back to its seat.

const ENTER_MS = 450;
const HOLD_MS = 1400;
const LEAVE_MS = 700;

type Point = { x: number; y: number };

interface Props {
  scene?: 'fall';
  onDone: () => void;
  /** Where Blip was sitting, in the canvas's px: it flies up from there, and back once done. */
  from?: Point;
}

export function BlipBeat({ scene, onDone, from }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const blip = useRef<BlipHandle>(null);
  const [home, setHome] = useState<Point | null>(null);
  const [sceneUp, setSceneUp] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const stagePoint = (x: number, y: number): Point => {
    const stage = stageRef.current;
    return stage ? { x: stage.clientWidth * x, y: stage.clientHeight * y } : { x: 0, y: 0 };
  };

  useLayoutEffect(() => {
    setHome(from ?? stagePoint(0.5, 0.34));
    const timer = window.setTimeout(() => {
      blip.current?.react('chirp');
      if (!scene) return sceneSettled();
      setSceneUp(true);
      setHome(stagePoint(0.5, -0.15));
    }, ENTER_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sceneSettled = () => {
    window.setTimeout(() => {
      setLeaving(true);
      if (from) setHome(from);
      window.setTimeout(onDone, LEAVE_MS);
    }, HOLD_MS);
  };

  return createPortal(
    <div ref={stageRef} className={`blip-beat${sceneUp ? ' has-scene' : ''}${leaving ? ' is-leaving' : ''}`}>
      {sceneUp && scene === 'fall' && <OpeningFall onSettled={sceneSettled} />}
      {home && <Blip ref={blip} home={home} active />}
    </div>,
    overlayHost()
  );
}
