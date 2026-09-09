import { useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { TypeId } from '../../engine/content';
import { playSfx } from '../../audio/sfx';
import { heroes } from '../../data/heroes';
import { getTypeColorRgb } from '../combat/typeColors';
import { HeroPortrait } from '../shared/HeroPortrait';
import { TypeBadge } from '../shared/TypeBadge';
import { overlayHost } from '../shared/overlayHost';
import { prefersReducedMotion } from '../shared/reducedMotion';

interface Props {
  heroId: string;
  /** How the hero was got — the only thing that differs between the two beats is the word and the sound. */
  source: 'contract' | 'guild';
  /** The typing the hero actually arrives with — a contract veteran may already be grafted. */
  types?: readonly TypeId[];
  onDone: () => void;
}

/** Beat boundaries, in ms from the moment the hero lands on the roster. */
const BEATS = { swear: 620, done: 2600 } as const;

const SOURCE_KICKER: Record<Props['source'], string> = {
  contract: 'Contract Sealed',
  guild: 'Hired at the Guild Hall',
};

/**
 * A hero joining the pact, as a moment (2026-09-08, per user direction). Both ways in used to
 * resolve silently — the contract stamped a mark in the corner, and a Guild Hall hire simply
 * closed its sheet — which is a strange amount of nothing for the run's second-scarcest resource.
 *
 * One beat: the seal closes on the hero (rings drawing in, the figure rising out of the dark),
 * then the oath lands and the name and typing print under it. Tap skips; a player recruiting four
 * heroes in one Guild Hall visit should not have to watch it four times.
 */
export function RecruitFanfare({ heroId, source, types, onDone }: Props) {
  const [sworn, setSworn] = useState(false);
  const hero = heroes[heroId];

  useEffect(() => {
    if (prefersReducedMotion()) {
      onDone();
      return;
    }
    playSfx(source === 'contract' ? 'contract.sign' : 'gold.purse');
    const timers = [
      window.setTimeout(() => {
        setSworn(true);
        playSfx('pact.bind');
      }, BEATS.swear),
      window.setTimeout(onDone, BEATS.done),
    ];
    return () => timers.forEach(window.clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!hero) return null;

  // Portalled into overlayHost(), never body (overlayHost.ts). A host screen is a flex column
  // whose children the stage rules pin to `position: relative`, which flattened this into the
  // bottom of the page instead of covering it.
  return createPortal(
    <div
      className={`recruit-fanfare${sworn ? ' is-sworn' : ''}`}
      style={{ '--pact-rgb': getTypeColorRgb(hero.types[0]) } as CSSProperties}
      onClick={onDone}
    >
      <span className="recruit-fanfare-veil" aria-hidden="true" />
      <span className="recruit-fanfare-rays" aria-hidden="true" />

      <div className="recruit-fanfare-stage">
        <span className="recruit-fanfare-ring is-outer" aria-hidden="true" />
        <span className="recruit-fanfare-ring is-inner" aria-hidden="true" />
        <HeroPortrait heroId={hero.id} className="recruit-fanfare-figure" />
        <span className="recruit-fanfare-flash" aria-hidden="true" />
      </div>

      <div className="recruit-fanfare-plate">
        <div className="recruit-fanfare-kicker">{SOURCE_KICKER[source]}</div>
        <h2 className="recruit-fanfare-name">{hero.name}</h2>
        <div className="recruit-fanfare-oath">joins your pact</div>
        <div className="recruit-fanfare-types">
          {(types ?? hero.types).map((t) => (
            <TypeBadge key={t} type={t} />
          ))}
        </div>
      </div>
    </div>,
    overlayHost()
  );
}
