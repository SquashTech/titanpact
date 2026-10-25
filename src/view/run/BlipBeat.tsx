import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { overlayHost } from '../shared/overlayHost';
import { Blip, type BlipHandle } from './Blip';
import { OpeningFall } from './OpeningFall';

// A forced thought (docs/the-sky.md §1): the sky dims, Blip comes forward, and each bubble waits for
// a tap anywhere. A poke on Blip is still only a poke. With a scene, Blip flies up out of the way
// while it plays, then comes back to say the rest over its last frame.

const ENTER_MS = 650;
const LEAVE_MS = 450;
const SCENE_LEAVE_MS = 700;

type Point = { x: number; y: number };

interface Props {
  lines: readonly string[];
  onDone: () => void;
  /** Where Blip was sitting, in the canvas's px: it flies forward from there, and back once done. */
  from?: Point;
  scene?: 'fall';
  /** Said over the scene's last frame. */
  sceneLines?: readonly string[];
}

export function BlipBeat({ lines, onDone, from, scene, sceneLines = [] }: Props) {
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
    const centre = stagePoint(0.5, 0.34);
    setHome(from ?? centre);
    if (from) requestAnimationFrame(() => setHome(centre));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = () => {
    setLeaving(true);
    if (from && !sceneUp) setHome(from);
    window.setTimeout(onDone, sceneUp ? SCENE_LEAVE_MS : LEAVE_MS);
  };

  useLayoutEffect(() => {
    if (!home) return;
    const timer = window.setTimeout(() => {
      blip.current?.react('chirp');
      blip.current?.think(
        lines,
        () => {
          if (!scene) return finish();
          setSceneUp(true);
          setHome(stagePoint(0.5, -0.15));
        },
        { forced: true }
      );
    }, ENTER_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home !== null]);

  const sceneSettled = () => {
    if (sceneLines.length === 0) return finish();
    setHome(stagePoint(0.3, 0.17));
    window.setTimeout(() => {
      blip.current?.react('chirp');
      blip.current?.think(sceneLines, finish, { forced: true });
    }, ENTER_MS);
  };

  return createPortal(
    <div
      ref={stageRef}
      className={`blip-beat${sceneUp ? ' has-scene' : ''}${leaving ? ' is-leaving' : ''}`}
      onClick={() => blip.current?.advance()}
    >
      {sceneUp && scene === 'fall' && <OpeningFall onSettled={sceneSettled} />}
      {home && <Blip ref={blip} home={home} active bubbleAt="below" />}
    </div>,
    overlayHost()
  );
}
