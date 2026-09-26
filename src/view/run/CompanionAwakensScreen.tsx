import { useEffect, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { rosterHeroes } from '../../data/content';
import { ANCIENT } from '../../run/companion';
import { getTypeColorRgb } from '../combat/typeColors';
import { HeroPortrait } from '../shared/HeroPortrait';
import { TypeBadge } from '../shared/TypeBadge';
import { prefersReducedMotion } from '../shared/reducedMotion';

interface Props {
  heroId: string;
  onContinue: () => void;
}

/** The companion as it stands, in its own colour, the Herald just gone by (ms). */
const STILL_MS = 1000;
/** The Titan's colour coming up through it from the ground (ms). */
const WAKE_MS = 1600;

type AwakenPhase = 'still' | 'wake' | 'woken';

/**
 * The finale's second beat, only when the companion made it this far: the Herald has named what
 * comes, and the one piece of the Titan the player turned stands up to it. It was made of the
 * Titan; here that wakes — Ancient takes its secondary slot for the fight, and every later
 * companion of its line joins already woken (profile.ts `ascendedSpawnTypes`).
 */
export function CompanionAwakensScreen({ heroId, onContinue }: Props) {
  const [phase, setPhase] = useState<AwakenPhase>('still');
  const hero = rosterHeroes[heroId];
  const type = hero?.types[0];

  useEffect(() => {
    if (prefersReducedMotion()) {
      setPhase('woken');
      return;
    }
    const timers = [
      window.setTimeout(() => {
        setPhase('wake');
        playSfx('titan.stir');
      }, STILL_MS),
      window.setTimeout(() => {
        setPhase('woken');
        playSfx('pact.bind');
      }, STILL_MS + WAKE_MS),
    ];
    return () => timers.forEach(window.clearTimeout);
  }, []);

  const style = {
    '--own-rgb': type ? getTypeColorRgb(type) : '200, 200, 200',
    '--ancient-rgb': getTypeColorRgb(ANCIENT),
  } as CSSProperties;

  return (
    <div className={`awaken-screen is-${phase}`} style={style} onClick={() => phase !== 'woken' && setPhase('woken')}>
      <span className="awaken-glow" aria-hidden="true" />
      <span className="awaken-ring" aria-hidden="true" />
      <div className="awaken-figure-slot" aria-hidden="true">
        <HeroPortrait heroId={heroId} className="awaken-figure" />
      </div>

      <div className="awaken-caption">
        <div className="awaken-eyebrow">Its true potential</div>
        <h2 className="awaken-title">{hero?.name ?? 'Your companion'} awakens</h2>
        <div className="awaken-types">
          {type && <TypeBadge type={type} />}
          <span className="awaken-types-new">
            <TypeBadge type={ANCIENT} />
          </span>
        </div>
        <p className="awaken-line">
          Made of the Titan, it stands against it. What the Titan is wakes in it now — and in every {type ?? ''}{' '}
          Titanspawn that joins you after this.
        </p>
        <button
          type="button"
          className="resolve-button awaken-continue"
          onClick={(event) => {
            event.stopPropagation();
            onContinue();
          }}
        >
          Stand together
        </button>
      </div>
    </div>
  );
}
