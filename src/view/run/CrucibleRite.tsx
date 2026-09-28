import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { playSfx } from '../../audio/sfx';
import { HeroPortrait } from '../shared/HeroPortrait';
import { useAmbientLocation } from '../shared/LocationContext';
import { NodeMotes } from '../shared/NodeStage';
import { prefersReducedMotion } from '../shared/reducedMotion';
import crucibleFrames from '../../../art/cache/crucible.png';

// The Crucible's stage: the vessel lowered out of the dark on its chains, a flare as it comes to
// rest, the fallen Guardian's shape burning behind it, and the line catching fire one letter at a
// time. The Guardian is the act's own (the ambient Location is still the one just cleared). Once the
// line is lit the roster steps up in front of the fire; a tap before then lights the rest at once.

/** The vessel's descent (ms). Matches `crucible-rite-lower`. */
const LOWER_MS = 1400;
/** Per letter (ms). */
const IGNITE_MS = 32;

interface Props {
  line: string;
  /** Stands in front of the fire once the line is lit. */
  stage: ReactNode;
  /** Under the scene once the line is lit: the commit. */
  footer: ReactNode;
}

export function CrucibleRite({ line, stage, footer }: Props) {
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

  function skip() {
    if (done) return;
    setLanded(true);
    setLit(line.length);
  }

  return (
    <>
      <div className={`crucible-rite${landed ? ' is-landed' : ''}${instant ? ' is-still' : ''}`} onClick={skip}>
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

        <div className="crucible-rite-words" aria-label={line}>
          <span className="crucible-rite-eyebrow">The Crucible</span>
          <span className="crucible-rite-line" aria-hidden="true">
            {[...line].map((ch, i) => (
              <span key={i} className={i < lit ? 'is-lit' : undefined}>
                {ch}
              </span>
            ))}
          </span>
        </div>

        {done && <div className="crucible-rite-stage">{stage}</div>}
      </div>
      {done && <div className="crucible-rite-footer">{footer}</div>}
    </>
  );
}
