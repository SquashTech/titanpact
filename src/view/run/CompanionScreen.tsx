import { useEffect, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { rosterHeroes } from '../../data/content';
import type { RunState } from '../../run/state';
import { getTypeColor, getTypeColorRgb } from '../combat/typeColors';
import { HeroPortrait } from '../shared/HeroPortrait';
import { NodeHeader, NodeSky } from '../shared/NodeStage';
import { TypeBadge } from '../shared/TypeBadge';
import { prefersReducedMotion } from '../shared/reducedMotion';

/**
 * The companion's three beats (docs/titanspawn-overhaul.md §5, run/companion.ts):
 * `join` — the run's first fight is won and one of the Earlies asks to come along; there is no
 * declining (per user direction), so the one button is a welcome. `grown` — a tier-step on the
 * ladder, the same creature in its next body. `lost` — a knockout took it back into the Titan;
 * first in the post-fight chain, the fight's own consequence.
 */
export type CompanionBeat =
  | { kind: 'join'; heroId: string }
  | { kind: 'grown'; fromHeroId: string; toHeroId: string }
  | { kind: 'lost'; heroId: string };

interface Props {
  run: RunState;
  beat: CompanionBeat;
  onContinue: () => void;
}

/** One hop of the dance, in ms; the pose flips on the beat and the chirp lands on it. */
const HOP_MS = 520;
const HOPS = 5;

function copyFor(beat: CompanionBeat): { eyebrow: string; title: string; readout: string; button: string } {
  const named = (id: string) => rosterHeroes[id]?.name ?? id;
  switch (beat.kind) {
    case 'join':
      return {
        eyebrow: 'Something small stirs',
        title: `The friendly ${named(beat.heroId)} wants to accompany you!`,
        readout: 'It has great potential, but death is permanent.',
        button: `Welcome, ${named(beat.heroId)}`,
      };
    case 'grown':
      return {
        eyebrow: 'The leak grows',
        title: `${named(beat.fromHeroId)} has grown into ${named(beat.toHeroId)}!`,
        readout: 'Same creature, next body: every move, item and level it had comes with it.',
        button: 'Onward',
      };
    case 'lost':
      return {
        eyebrow: 'The pact comes due',
        title: `${named(beat.heroId)} was taken back into the Titan.`,
        readout: 'Nothing of it comes back — what it carried goes with it.',
        button: 'Carry on',
      };
  }
}

// `run` is unused today: the plate names the creature, and the roster peek every other node
// screen wears would cover a title that is the point of the screen.
export function CompanionScreen({ beat, onContinue }: Props) {
  const heroId = beat.kind === 'grown' ? beat.toHeroId : beat.heroId;
  const hero = rosterHeroes[heroId];
  const dancing = beat.kind !== 'lost';
  const [hop, setHop] = useState(0);
  const copy = copyFor(beat);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    if (!dancing) {
      playSfx('companion.gone');
      return;
    }
    // The dance: a few hops on a fixed beat, each one a chirp a little higher than the last, then
    // it settles and waits — a creature that has finished saying hello.
    playSfx('companion.chirp');
    const timers = Array.from({ length: HOPS - 1 }, (_, i) =>
      window.setTimeout(() => {
        setHop(i + 1);
        playSfx('companion.chirp', { pitch: 1 + (i + 1) * 0.06 });
      }, (i + 1) * HOP_MS)
    );
    return () => timers.forEach(window.clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!hero) return null;
  const type = hero.types[0];
  const settled = hop >= HOPS - 1;

  return (
    <div
      className={`node-screen companion-screen is-${beat.kind}${dancing && !settled ? ' is-dancing' : ''}`}
      style={{ '--node-rgb': getTypeColorRgb(type), '--type-color': getTypeColor(type) } as CSSProperties}
    >
      <NodeSky />

      <NodeHeader eyebrow={copy.eyebrow} title={copy.title} readout={copy.readout} readoutLive />

      <div className="companion-stage" aria-hidden="true">
        {beat.kind === 'lost' && (
          <span className="companion-eyes">
            <span className="titan-eye is-left companion-eye">
              <span className="titan-eye-halo" />
              <span className="titan-eye-clip">
                <span className="titan-eye-globe" />
                <span className="titan-eye-pupil" />
              </span>
            </span>
            <span className="titan-eye is-right companion-eye">
              <span className="titan-eye-halo" />
              <span className="titan-eye-clip">
                <span className="titan-eye-globe" />
                <span className="titan-eye-pupil" />
              </span>
            </span>
          </span>
        )}
        <span className="companion-platform" />
        {/* Keyed on the hop so the hop animation restarts on each beat; the pose flips with it. */}
        <span key={hop} className="companion-figure">
          <HeroPortrait heroId={heroId} className="companion-portrait" pose={dancing && !settled && hop % 2 === 1 ? 'attack' : 'idle'} />
        </span>
      </div>

      <div className="companion-plate">
        <span className="companion-name">{hero.name}</span>
        <span className="companion-types">
          {hero.types.map((t) => (
            <TypeBadge key={t} type={t} />
          ))}
        </span>
        {beat.kind !== 'lost' && <span className="companion-mortal">Mortal</span>}
      </div>

      <div className="node-spacer" />

      <button className="resolve-button" onClick={onContinue}>
        {copy.button}
      </button>
    </div>
  );
}
