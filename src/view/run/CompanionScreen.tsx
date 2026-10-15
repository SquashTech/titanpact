import { useEffect, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { rosterHeroes } from '../../data/content';
import { moves } from '../../data/moves';
import { companionCallMoveId } from '../../run/companion';
import type { RunState } from '../../run/state';
import { getTypeColor, getTypeColorRgb } from '../combat/typeColors';
import { HeroPortrait } from '../shared/HeroPortrait';
import { NodeHeader } from '../shared/NodeStage';
import { RoadBackdrop } from './RoadEncounter';
import { TypeBadge } from '../shared/TypeBadge';
import { prefersReducedMotion } from '../shared/reducedMotion';

import type { CompanionBeat } from '../../run/companion';
import { PlateButton } from '../shared/PlateButton';
export type { CompanionBeat };

interface Props {
  run: RunState;
  beat: CompanionBeat;
  onContinue: () => void;
}

/** One hop of the dance, in ms; the pose flips on the beat and the chirp lands on it. */
const HOP_MS = 520;
const HOPS = 5;

function copyFor(beat: CompanionBeat, callName: string | null): { eyebrow: string; title: string; readout: string; button: string } {
  const named = (id: string) => rosterHeroes[id]?.name ?? id;
  switch (beat.kind) {
    case 'join':
      return {
        eyebrow: 'Something small stirs',
        title: `The friendly ${named(beat.heroId)} wants to accompany you!`,
        readout: callName ? `Once a fight, it joins in on its own: ${callName}.` : 'Once a fight, it joins in on its own.',
        button: `Welcome, ${named(beat.heroId)}`,
      };
    case 'grown':
      return {
        eyebrow: 'The leak grows',
        title: `${named(beat.fromHeroId)} has grown into ${named(beat.toHeroId)}!`,
        readout: callName ? `Same creature, next body. Now it casts ${callName}.` : 'Same creature, next body.',
        button: 'Onward',
      };
  }
}

export function CompanionScreen({ run, beat, onContinue }: Props) {
  const heroId = beat.kind === 'grown' ? beat.toHeroId : beat.heroId;
  const hero = rosterHeroes[heroId];
  const [hop, setHop] = useState(0);
  // The run already stands in the act the beat belongs to, so its Call move is the one to name.
  const callMoveId = companionCallMoveId(run);
  const copy = copyFor(beat, callMoveId ? (moves[callMoveId]?.name ?? null) : null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
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
  const settled = prefersReducedMotion() || hop >= HOPS - 1;

  return (
    <div
      className={`node-screen companion-screen is-${beat.kind}${!settled ? ' is-dancing' : ''}`}
      style={{ '--node-rgb': getTypeColorRgb(type), '--type-color': getTypeColor(type) } as CSSProperties}
    >
      {/* The road it is met on; the creature stands on the ground, the words up in the sky. */}
      <span className="node-sky companion-road" aria-hidden="true">
        <RoadBackdrop />
      </span>

      <NodeHeader eyebrow={copy.eyebrow} title={copy.title} readout={copy.readout} readoutLive />

      <div className="node-spacer" />

      <div className="companion-stage" aria-hidden="true">
        <span className="companion-platform" />
        {/* Keyed on the hop so the hop animation restarts on each beat; the pose flips with it. */}
        <span key={hop} className="companion-figure">
          <HeroPortrait heroId={heroId} className="companion-portrait" pose={!settled && hop % 2 === 1 ? 'attack' : 'idle'} />
        </span>
      </div>

      <div className="companion-plate">
        <span className="companion-name">{hero.name}</span>
        <span className="companion-types">
          {hero.types.map((t) => (
            <TypeBadge key={t} type={t} />
          ))}
        </span>
      </div>

      <PlateButton onClick={onContinue}>{copy.button}</PlateButton>
    </div>
  );
}
