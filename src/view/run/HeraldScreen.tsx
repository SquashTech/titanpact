import { useEffect, useState } from 'react';
import { playSfx } from '../../audio/sfx';
import { ENDBRINGER_ID } from '../../data/enemies';
import { allCombatants } from '../../data/content';
import { TitanBody } from '../combat/TitanBody';
import { HeroPortrait } from '../shared/HeroPortrait';
import { prefersReducedMotion } from '../shared/reducedMotion';

interface Props {
  onContinue: () => void;
}

/** A shape in the haze at the far end of the hide, and the ground under it going (ms). */
const FAR_MS = 1100;
/** It comes: the figure growing out of the distance, the banner streaming (ms). */
const WALK_MS = 3200;

const WALK_AT = FAR_MS;
const HERE_AT = WALK_AT + WALK_MS;

type HeraldPhase = 'far' | 'walk' | 'here';

/**
 * The Threshold's first fight, announced (docs/lore.md §7): the Herald is the Titan's hand
 * and its voice, and it walks ahead of the thing it announces. It is drawn once on the
 * Titan's own hide — the arena the fight is about to be on — at the size the fight cannot
 * afford it, coming out of the distance toward the player. The five unsealed wardens walk
 * ahead of it in the fight itself; this beat is the one thing that comes last.
 */
export function HeraldScreen({ onContinue }: Props) {
  const [phase, setPhase] = useState<HeraldPhase>('far');
  const herald = allCombatants[ENDBRINGER_ID];

  useEffect(() => {
    if (prefersReducedMotion()) {
      setPhase('here');
      return;
    }
    playSfx('titan.stir');
    const timers = [
      window.setTimeout(() => {
        setPhase('walk');
        playSfx('entrance.dread');
      }, WALK_AT),
      window.setTimeout(() => {
        setPhase('here');
        playSfx('titan.gaze');
      }, HERE_AT),
    ];
    return () => timers.forEach(window.clearTimeout);
  }, []);

  return (
    <div className={`herald-screen is-${phase}`} onClick={() => phase !== 'here' && setPhase('here')}>
      <div className="herald-shake">
        <TitanBody />
        <span className="herald-haze" aria-hidden="true" />
        <span className="herald-ember" aria-hidden="true" />

        <div className="herald-figure-slot" aria-hidden="true">
          <span className="herald-shadow" />
          <HeroPortrait heroId={ENDBRINGER_ID} className="herald-figure" />
        </div>
      </div>

      <div className="herald-caption">
        <div className="herald-eyebrow">The Titan's Herald</div>
        <h2 className="herald-title">{herald?.name ?? 'Endbringer'}</h2>
        <p className="herald-line">
          The Titan's hand and its voice. The eye on its banner is not its own. The five wardens walk ahead of
          it, unsealed — it comes last.
        </p>
        <button
          type="button"
          className="resolve-button herald-continue"
          onClick={(event) => {
            event.stopPropagation();
            onContinue();
          }}
        >
          Stand
        </button>
      </div>
    </div>
  );
}
