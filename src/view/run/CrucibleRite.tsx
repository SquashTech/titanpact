import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { playSfx } from '../../audio/sfx';
import { CRUCIBLE_LINES } from '../../data/roadLines';
import type { RunState } from '../../run/state';
import { HeroPortrait } from '../shared/HeroPortrait';
import { useAmbientLocation } from '../shared/LocationContext';
import { NodeMotes } from '../shared/NodeStage';
import { prefersReducedMotion } from '../shared/reducedMotion';
import { useRoadGreeting } from './RoadEncounter';
import crucibleFrames from '../../../art/cache/crucible.png';

// The Crucible's entrance, before the rim: the vessel lowered out of the dark on its chains, a flare
// as it comes to rest, the fallen Guardian's shape burning behind it, and its last words catching
// fire one letter at a time. The Guardian is the act's own (the ambient Location is still the one
// just cleared). A tap lights the rest of the line; a second walks up to the rim.

/** The vessel's descent (ms). Matches `crucible-rite-lower`. */
const LOWER_MS = 1400;
/** Per letter (ms). */
const IGNITE_MS = 32;

export function CrucibleRite({ run, children }: { run: RunState; children: ReactNode }) {
  const [line, dismiss] = useRoadGreeting(run, CRUCIBLE_LINES);
  if (!line) return <>{children}</>;
  return <CrucibleRiteScene line={line} onDone={dismiss} />;
}

function CrucibleRiteScene({ line, onDone }: { line: string; onDone: () => void }) {
  const guardianId = useAmbientLocation()?.guardianFinalEnemyId ?? null;
  const instant = prefersReducedMotion();
  const [landed, setLanded] = useState(instant);
  const [lit, setLit] = useState(instant ? line.length : 0);
  const done = lit >= line.length;

  useEffect(() => {
    if (landed) return;
    const timer = window.setTimeout(() => {
      setLanded(true);
      playSfx('seal.strike', { pitch: 0.7 });
    }, LOWER_MS);
    return () => window.clearTimeout(timer);
  }, [landed]);

  useEffect(() => {
    if (!landed || done) return;
    const timer = window.setTimeout(() => setLit((n) => n + 1), IGNITE_MS);
    return () => window.clearTimeout(timer);
  }, [landed, done, lit]);

  function advance() {
    if (!done) {
      setLanded(true);
      setLit(line.length);
      return;
    }
    playSfx('class.learn');
    onDone();
  }

  return (
    <button
      type="button"
      className={`crucible-rite${landed ? ' is-landed' : ''}${instant ? ' is-still' : ''}`}
      onClick={advance}
      data-sfx="none"
      aria-label={`The Crucible: ${line}`}
    >
      <span className="crucible-rite-glow" aria-hidden="true" />
      <NodeMotes count={18} />
      {guardianId && (
        <span className="crucible-rite-ghost" aria-hidden="true">
          <HeroPortrait heroId={guardianId} className="crucible-rite-ghost-figure" />
        </span>
      )}
      <span className="crucible-rite-vessel" style={{ '--crucible-frames': `url(${crucibleFrames})` } as CSSProperties} aria-hidden="true">
        <span className="crucible-rite-chains" />
        <span className="crucible-rite-frames" />
      </span>
      <span className="crucible-rite-flare" aria-hidden="true" />

      <span className="crucible-rite-words" aria-hidden="true">
        <span className="crucible-rite-eyebrow">The Crucible</span>
        <span className="crucible-rite-line">
          {[...line].map((ch, i) => (
            <span key={i} className={i < lit ? 'is-lit' : undefined}>
              {ch}
            </span>
          ))}
        </span>
        {done && <span className="road-encounter-more" />}
      </span>
    </button>
  );
}
