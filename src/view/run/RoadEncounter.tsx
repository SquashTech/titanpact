import { useEffect, useState, type ReactNode } from 'react';
import { playSfx } from '../../audio/sfx';
import type { RunState } from '../../run/state';
import { locationBackdrop } from '../shared/locationBackdrops';
import { useAmbientLocation } from '../shared/LocationContext';
import { NodeSky } from '../shared/NodeStage';
import { prefersReducedMotion } from '../shared/reducedMotion';

// Meeting someone on the road: the act's own painting, the figure walking up out of it, and one
// line said before the node's real screen. A tap finishes the line; a second tap moves on. A PLACE
// (a shrine, a chest, a well) is met the same way, rising into view with its line narrated.

/** Nodes whose greeting has been heard this session: a screen that remounts mid-visit does not greet twice. */
const greeted = new Set<string>();

/**
 * The line to open a node with, or null once it has been said. Keyed by the node stood on, since
 * a screen like the Guild Hall unmounts under a who-screen and comes back within the same visit.
 */
export function useRoadGreeting(run: RunState, lines: readonly string[], enabled = true): [string | null, () => void] {
  const key = `${run.map?.seed}:${run.actNumber}:${run.currentNodeId}`;
  const [line, setLine] = useState<string | null>(() =>
    enabled && !greeted.has(key) ? lines[Math.floor(Math.random() * lines.length)] : null
  );
  const dismiss = () => {
    greeted.add(key);
    setLine(null);
  };
  return [line, dismiss];
}

/** Per character (ms). Quick enough that a reader never waits on it. */
const TYPE_MS = 24;
/** The walk in, before the line starts (ms). Matches `road-encounter-walk`. */
const WALK_MS = 900;

interface Props {
  /** The speaker's 48px portrait, or the place's 48px map piece, drawn at 3x. */
  art: string;
  /** A place rather than a person: no walk, and the line is narration. */
  place?: boolean;
  name: string;
  line: string;
  onDone: () => void;
}

export function RoadEncounter({ art, name, line, place = false, onDone }: Props) {
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
    <button type="button" className={`road-encounter${place ? ' is-place' : ''}`} onClick={advance} data-sfx="none" aria-label={`${name}: ${line}`}>
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

/**
 * A node screen held behind its greeting: the screen itself mounts only once the line is heard, so
 * whatever it starts on arrival (a chest's rattle, a purse's count-up, a sound) starts in view.
 */
export function RoadGate({
  run,
  art,
  name,
  lines,
  place = false,
  enabled = true,
  children,
}: {
  run: RunState;
  art: string;
  name: string;
  lines: readonly string[];
  place?: boolean;
  enabled?: boolean;
  children: ReactNode;
}) {
  const [line, dismiss] = useRoadGreeting(run, lines, enabled);
  if (line) return <RoadEncounter art={art} name={name} line={line} place={place} onDone={dismiss} />;
  return <>{children}</>;
}
