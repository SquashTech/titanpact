import { useEffect, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { rosterHeroes } from '../../data/content';
import { moves } from '../../data/moves';
import { companionCallMoveId } from '../../run/companion';
import type { RunState } from '../../run/state';
import { getTypeColorRgb } from '../combat/typeColors';
import { HeroPortrait } from '../shared/HeroPortrait';
import { TypeBadge } from '../shared/TypeBadge';
import { prefersReducedMotion } from '../shared/reducedMotion';
import { RoadScene } from './RoadEncounter';

import type { CompanionBeat } from '../../run/companion';
export type { CompanionBeat };

interface Props {
  run: RunState;
  beat: CompanionBeat;
  onContinue: () => void;
}

/** One hop of the dance, in ms; the pose flips on the beat and the chirp lands on it. */
const HOP_MS = 520;
const HOPS = 5;

function copyFor(beat: CompanionBeat, callName: string | null): { line: string; call: string } {
  const named = (id: string) => rosterHeroes[id]?.name ?? id;
  switch (beat.kind) {
    case 'join':
      return {
        line: `The friendly ${named(beat.heroId)} wants to accompany you!`,
        call: callName ? `Once a fight, it joins in on its own: ${callName}.` : 'Once a fight, it joins in on its own.',
      };
    case 'grown':
      return {
        line: `${named(beat.fromHeroId)} has grown into ${named(beat.toHeroId)}!`,
        call: callName ? `Same creature, next body. Now it casts ${callName}.` : 'Same creature, next body.',
      };
  }
}

/** The companion met on the road: it hops up out of the painting, chirping, and the tap walks on with it. */
export function CompanionScreen({ run, beat, onContinue }: Props) {
  const heroId = beat.kind === 'grown' ? beat.toHeroId : beat.heroId;
  const hero = rosterHeroes[heroId];
  const [hop, setHop] = useState(0);
  // The run already stands in the act the beat belongs to, so its Call move is the one to name.
  const callMoveId = companionCallMoveId(run);
  const copy = copyFor(beat, callMoveId ? (moves[callMoveId]?.name ?? null) : null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    // A few hops on a fixed beat, each chirp a little higher, then it settles: a creature that has finished saying hello.
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
  const settled = prefersReducedMotion() || hop >= HOPS - 1;

  function walkOn() {
    playSfx('ui.confirm');
    onContinue();
  }

  return (
    <RoadScene
      className={`is-companion${!settled ? ' is-dancing' : ''}`}
      label={`${hero.name}: ${copy.line} ${copy.call}`}
      onClick={walkOn}
    >
      <span className="road-encounter-figure road-companion-figure" style={{ '--node-rgb': getTypeColorRgb(hero.types[0]) } as CSSProperties} aria-hidden="true">
        {/* Keyed on the hop so each hop restarts; the pose flips with it. */}
        <span key={hop} className="road-companion-hop">
          <HeroPortrait heroId={heroId} className="road-companion-portrait" pose={!settled && hop % 2 === 1 ? 'attack' : 'idle'} />
        </span>
      </span>
      <span className="road-encounter-speech is-open" aria-hidden="true">
        <span className="road-encounter-name road-companion-name">
          {hero.name}
          {hero.types.map((t) => (
            <TypeBadge key={t} type={t} />
          ))}
        </span>
        <span className="road-encounter-line">{copy.line}</span>
        <span className="road-companion-call">{copy.call}</span>
        {settled && <span className="road-encounter-more" />}
      </span>
    </RoadScene>
  );
}
