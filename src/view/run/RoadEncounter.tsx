import { useEffect, useState } from 'react';
import { playSfx } from '../../audio/sfx';
import { locationBackdrop } from '../shared/locationBackdrops';
import { useAmbientLocation } from '../shared/LocationContext';
import { NodeSky } from '../shared/NodeStage';
import { prefersReducedMotion } from '../shared/reducedMotion';

// Meeting someone on the road: the act's own painting, the figure walking up out of it, and one
// line said before the node's real screen. A tap finishes the line; a second tap moves on.

/** Per character (ms). Quick enough that a reader never waits on it. */
const TYPE_MS = 24;
/** The walk in, before the line starts (ms). Matches `road-encounter-walk`. */
const WALK_MS = 900;

interface Props {
  /** The speaker's 48px portrait, drawn at 3x. */
  art: string;
  name: string;
  line: string;
  onDone: () => void;
}

export function RoadEncounter({ art, name, line, onDone }: Props) {
  const location = useAmbientLocation();
  const scene = location ? locationBackdrop(location.id, 'arrival') : undefined;
  const instant = prefersReducedMotion();
  const [shown, setShown] = useState(instant ? line.length : 0);
  const [speaking, setSpeaking] = useState(instant);
  const done = shown >= line.length;

  useEffect(() => {
    if (speaking) return;
    const start = window.setTimeout(() => setSpeaking(true), WALK_MS);
    return () => window.clearTimeout(start);
  }, [speaking]);

  useEffect(() => {
    if (!speaking || done) return;
    const tick = window.setTimeout(() => setShown((n) => n + 1), TYPE_MS);
    return () => window.clearTimeout(tick);
  }, [speaking, done, shown]);

  function advance() {
    if (!done) {
      setSpeaking(true);
      setShown(line.length);
      return;
    }
    playSfx('ui.confirm');
    onDone();
  }

  return (
    <button type="button" className="road-encounter" onClick={advance} data-sfx="none" aria-label={`${name}: ${line}`}>
      {scene ? <img src={scene} className="road-encounter-scene" alt="" draggable={false} /> : <NodeSky />}
      <span className="road-encounter-shade" aria-hidden="true" />
      <img src={art} className={`road-encounter-figure${instant ? ' is-still' : ''}`} alt="" draggable={false} />
      <span className={`road-encounter-speech${speaking ? ' is-open' : ''}`} aria-hidden="true">
        <span className="road-encounter-name">{name}</span>
        <span className="road-encounter-line">
          {line.slice(0, shown)}
          <span className="road-encounter-rest">{line.slice(shown)}</span>
        </span>
        {done && <span className="road-encounter-more" />}
      </span>
    </button>
  );
}
