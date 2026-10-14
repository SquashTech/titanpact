import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { ENDBRINGER_ID } from '../../data/enemies';
import { allCombatants } from '../../data/content';
import { FINALE_LOCATION_ID } from '../../data/locations';
import { locationBackdrop } from '../shared/locationBackdrops';
import { HeroPortrait } from '../shared/HeroPortrait';
import { prefersReducedMotion } from '../shared/reducedMotion';
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

/** Nothing but fog over the valley, and the Titan's eyes somewhere behind it (ms). */
const FOG_MS = 1400;
/** The fog thins from the top down and something is standing in it, near (ms). */
const THIN_MS = 3800;
/** Each of its company darkening into shape in the fog behind it (ms between). */
const RISE_MS = 520;
/** After the last, before the name (ms). */
const HOLD_MS = 600;

type HeraldPhase = 'fog' | 'thin' | 'company' | 'here';

/**
 * The Threshold's first fight, announced (docs/titan-eyes.md §12): the Threshold's own painting,
 * a wall of fog over it, and the fog thinning from the top down to leave the Herald already
 * standing there, close — dark until its seam lights. What the run's lands turned darkens into
 * shape in the fog behind it. Stillness, not a walk: it was always there.
 */
export function HeraldScreen({ company, onContinue }: Props) {
  const [phase, setPhase] = useState<HeraldPhase>('fog');
  const [risen, setRisen] = useState(0);
  const timers = useRef<number[]>([]);
  const herald = allCombatants[ENDBRINGER_ID];
  const backdrop = locationBackdrop(FINALE_LOCATION_ID);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setPhase('here');
      setRisen(company.length);
      return;
    }
    const companyAt = FOG_MS + THIN_MS;
    const hereAt = companyAt + RISE_MS * company.length + HOLD_MS;
    playSfx('titan.stir', { gain: 0.7 });
    timers.current = [
      window.setTimeout(() => {
        setPhase('thin');
        playSfx('entrance.dread');
      }, FOG_MS),
      // The seam lights as the fog clears its head (styles.css herald-seam).
      window.setTimeout(() => playSfx('titan.gaze'), FOG_MS + THIN_MS - 700),
      window.setTimeout(() => setPhase('company'), companyAt),
      ...company.map((_, i) =>
        window.setTimeout(() => {
          setRisen(i + 1);
          playSfx('map.threat', { pitch: 0.5 + i * 0.04, gain: 0.6 });
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
      {backdrop && <img className="herald-sky" src={backdrop} alt="" draggable={false} />}
      <span className="herald-fog is-band" aria-hidden="true" />

      <div className="herald-company" aria-hidden="true">
        {company.map((member, i) => (
          <div
            key={`${member.heroId}-${i}`}
            className={`herald-companion${i < risen ? ' is-risen' : ''}`}
            style={{ '--across': `${companionAcross(i, company.length)}%` } as CSSProperties}
          >
            <HeroPortrait heroId={member.heroId} className="herald-companion-figure" seed={`herald-${i}`} />
          </div>
        ))}
      </div>

      <div className="herald-figure-slot" aria-hidden="true">
        <HeroPortrait heroId={ENDBRINGER_ID} className="herald-figure" />
      </div>

      <span className="herald-fog is-ground" aria-hidden="true" />
      <span className="herald-fog is-wall" aria-hidden="true" />

      <div className="herald-caption">
        <div className="herald-eyebrow">The Titan's Herald</div>
        <h2 className="herald-title">{herald?.name ?? 'Endbringer'}</h2>
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

/** Either side of it in the fog, never in front: the middle is the Herald's. */
function companionAcross(index: number, count: number): number {
  const spots = [14, 86, 30, 70, 6, 94];
  return count > 0 ? spots[index % spots.length] : 50;
}
