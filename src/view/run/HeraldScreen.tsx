import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { ENDBRINGER_ID } from '../../data/enemies';
import { allCombatants } from '../../data/content';
import { TitanBody } from '../combat/TitanBody';
import { HeroPortrait } from '../shared/HeroPortrait';
import { prefersReducedMotion } from '../shared/reducedMotion';
import { EntranceFlood } from '../shared/EntranceFlood';
import { PlateButton } from '../shared/PlateButton';

/** One of the Herald's company: a Late spawn and the land it was turned in. */
export interface HeraldCompanion {
  heroId: string;
  placeName: string | null;
}

interface Props {
  company: readonly HeraldCompanion[];
  onContinue: () => void;
}

/** A shape in the haze at the far end of the hide, and the ground under it going (ms). */
const FAR_MS = 1100;
/** It comes: the figure growing out of the distance, the banner streaming (ms). */
const WALK_MS = 3200;
/** It sounds the horn, and the eye on the banner opens wide (ms). */
const HORN_MS = 1000;
/** Each of its company rising out of the haze behind it (ms between). */
const RISE_MS = 560;
/** After the last has risen, before the caption (ms). */
const HOLD_MS = 500;

type HeraldPhase = 'far' | 'walk' | 'horn' | 'company' | 'here';

/**
 * The Threshold's first fight, announced (docs/lore.md §7): the Herald is the Titan's hand and its
 * voice, and it walks ahead of the thing it announces. Drawn on the Titan's own hide — the arena
 * the fight is about to be on — it comes out of the distance, sounds its horn, and what the run's
 * four lands turned rises behind it one at a time, each over the name of the place it came from.
 */
export function HeraldScreen({ company, onContinue }: Props) {
  const [phase, setPhase] = useState<HeraldPhase>('far');
  const [risen, setRisen] = useState(0);
  const timers = useRef<number[]>([]);
  const herald = allCombatants[ENDBRINGER_ID];

  useEffect(() => {
    if (prefersReducedMotion()) {
      setPhase('here');
      setRisen(company.length);
      return;
    }
    const hornAt = FAR_MS + WALK_MS;
    const companyAt = hornAt + HORN_MS;
    const hereAt = companyAt + RISE_MS * company.length + HOLD_MS;
    playSfx('titan.stir');
    timers.current = [
      window.setTimeout(() => {
        setPhase('walk');
        playSfx('entrance.dread');
      }, FAR_MS),
      window.setTimeout(() => {
        setPhase('horn');
        playSfx('titan.gaze');
      }, hornAt),
      window.setTimeout(() => setPhase('company'), companyAt),
      ...company.map((_, i) =>
        window.setTimeout(() => {
          setRisen(i + 1);
          playSfx('map.threat', { pitch: 0.55 + i * 0.05 });
        }, companyAt + RISE_MS * i)
      ),
      window.setTimeout(() => setPhase('here'), hereAt),
    ];
    return () => timers.current.forEach(window.clearTimeout);
  }, [company.length]);

  const skip = () => {
    if (phase === 'here') return;
    timers.current.forEach(window.clearTimeout);
    setPhase('here');
    setRisen(company.length);
  };

  return (
    <div className={`herald-screen is-${phase}`} onClick={skip}>
      <EntranceFlood />
      <div className="herald-shake">
        <TitanBody />
        <span className="herald-haze" aria-hidden="true" />
        <span className="herald-ember" aria-hidden="true" />

        <div className="herald-company" aria-hidden="true">
          {company.map((member, i) => (
            <div
              key={`${member.heroId}-${i}`}
              className={`herald-companion${i < risen ? ' is-risen' : ''}`}
              style={{ '--across': `${companionAcross(i, company.length)}%` } as CSSProperties}
            >
              <HeroPortrait heroId={member.heroId} className="herald-companion-figure" seed={`herald-${i}`} />
              {member.placeName && <span className="herald-companion-place">{member.placeName}</span>}
            </div>
          ))}
        </div>

        <div className="herald-figure-slot" aria-hidden="true">
          <span className="herald-shadow" />
          <HeroPortrait heroId={ENDBRINGER_ID} className="herald-figure" pose={phase === 'horn' ? 'attack' : 'idle'} />
        </div>
      </div>

      <div className="herald-caption">
        <div className="herald-eyebrow">The Titan's Herald</div>
        <h2 className="herald-title">{herald?.name ?? 'Endbringer'}</h2>
        <p className="herald-line">
          The Titan's hand and its voice. The eye on its banner is not its own. What the lands you crossed
          turned walks behind it.
        </p>
        <PlateButton
          className="herald-continue"
          onClick={(event) => {
            event.stopPropagation();
            onContinue();
          }}
        >
          Stand
        </PlateButton>
      </div>
    </div>
  );
}

/** Spread along the horizon over its head, in seal order. */
function companionAcross(index: number, count: number): number {
  return count > 1 ? 14 + (index * 72) / (count - 1) : 50;
}
