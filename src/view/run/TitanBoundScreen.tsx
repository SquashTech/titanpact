import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { rosterHeroes } from '../../data/content';
import { FINALE_LOCATION_ID, locations } from '../../data/locations';
import { SEAL_ACTS, type RunState } from '../../run/state';
import { HeroPortrait } from '../shared/HeroPortrait';
import { SealArt } from '../shared/SealArt';
import { prefersReducedMotion } from '../shared/reducedMotion';
import { NODE_TINT_GOLD } from '../shared/NodeStage';
import { locationBackdrop } from '../shared/locationBackdrops';
import { PAINTED_EYES } from './TitanRiseScreen';
import { PlateButton } from '../shared/PlateButton';

interface Props {
  run: RunState;
  onContinue: () => void;
}

/** The Eyes, put out and wide with it: the whole frame shaking under something that will not stop (ms). */
const THROES_MS = 1900;
/** The lids close and the head goes down out of the frame; the jolt at the bottom is it landing (ms). */
const FALL_MS = 1500;
/** Black, and the seal turning in out of it (ms). */
const SEAL_MS = 1400;
/** One Guardian after another struck back into its ring, its sigil re-lit (ms between). */
const WARDEN_MS = 560;
/** The roster's names written round the rim (ms). */
const NAMES_MS = 1500;
/** The rings lock and the whole thing sets (ms). */
const LOCK_MS = 1100;

const FALL_AT = THROES_MS;
const SEAL_AT = FALL_AT + FALL_MS;
const WARDENS_AT = SEAL_AT + SEAL_MS;
const NAMES_AT = WARDENS_AT + WARDEN_MS * SEAL_ACTS + 200;
const LOCK_AT = NAMES_AT + NAMES_MS;
const BOUND_AT = LOCK_AT + LOCK_MS;

type BoundPhase = 'throes' | 'fall' | 'seal' | 'wardens' | 'names' | 'lock' | 'bound';

/** The inscription's circle, in the overlay's own 360 box. */
const RIM_R = 166;
const RIM_PATH = `M180,${180 - RIM_R} a${RIM_R},${RIM_R} 0 1,1 0,${RIM_R * 2} a${RIM_R},${RIM_R} 0 1,1 0,${-RIM_R * 2}`;
const RIM_LENGTH = Math.round(2 * Math.PI * RIM_R * 0.97);

/** On the diagonals, first at the upper right — where the Pact Seal put each ring. */
function ringAngle(index: number): number {
  return -45 + index * (360 / SEAL_ACTS);
}

/**
 * The Eyes have closed (docs/titan-eyes.md §2): the last beat of the fight, played at the scale
 * of the sky. The head that rose as the Herald fell (TitanRiseScreen) goes back down the way it
 * came, and the seal turns in over the black. Every ring the run locked comes back in act order —
 * its Guardian struck into its socket in its Location's light, its sigil re-lit — and the roster's
 * names are written round the rim before the whole thing locks: the run's record, all of it at
 * once. A tap goes straight to the end. Binding is mutual (docs/lore.md §1): the Titan is on the
 * ground because it was made to look away, and this is the leash going back on.
 */
export function TitanBoundScreen({ run, onContinue }: Props) {
  const [phase, setPhase] = useState<BoundPhase>('throes');
  const [lit, setLit] = useState(0);
  const done = useRef(onContinue);
  done.current = onContinue;
  const timers = useRef<number[]>([]);
  const seals = [...run.brokenSeals].sort((a, b) => a.actNumber - b.actNumber);
  const painting = locationBackdrop(FINALE_LOCATION_ID);
  const names = run.roster.map((entry) => rosterHeroes[entry.heroId]?.name ?? entry.heroId).join('  ·  ');

  const skip = () => {
    if (phase === 'bound') return;
    timers.current.forEach(window.clearTimeout);
    setPhase('bound');
    setLit(SEAL_ACTS);
  };

  useEffect(() => {
    if (prefersReducedMotion()) {
      setPhase('bound');
      setLit(SEAL_ACTS);
      return;
    }
    playSfx('titan.gaze');
    playSfx('titan.stir');
    timers.current = [
      window.setTimeout(() => {
        setPhase('fall');
        playSfx('titan.stir');
        // The landing, timed to the drop's end (styles.css titan-bound-drop).
        window.setTimeout(() => playSfx('seal.shatter'), 1100);
      }, FALL_AT),
      window.setTimeout(() => setPhase('seal'), SEAL_AT),
      window.setTimeout(() => setPhase('wardens'), WARDENS_AT),
      ...Array.from({ length: SEAL_ACTS }, (_, i) =>
        window.setTimeout(() => {
          setLit(i + 1);
          playSfx('seal.strike');
          playSfx('pact.bind', { pitch: 0.8 + i * 0.08, gain: 0.7 });
        }, WARDENS_AT + WARDEN_MS * i)
      ),
      window.setTimeout(() => {
        setPhase('names');
        playSfx('quill.scratch');
      }, NAMES_AT),
      window.setTimeout(() => {
        setPhase('lock');
        playSfx('pact.bind', { gain: 1.3 });
      }, LOCK_AT),
      window.setTimeout(() => setPhase('bound'), BOUND_AT),
    ];
    return () => timers.current.forEach(window.clearTimeout);
  }, []);

  const collapsing = phase === 'throes' || phase === 'fall';
  const inscribed = phase === 'names' || phase === 'lock' || phase === 'bound';

  return (
    <div className={`titan-bound is-${phase}`} onClick={skip}>
      {collapsing && (
        <div className="titan-bound-shake">
          <span className="titan-bound-ember" aria-hidden="true" />
          <div className="titan-dust" aria-hidden="true">
            {Array.from({ length: 22 }, (_, i) => {
              const across = (i * 61.8) % 100;
              const down = (i * 38.2) % 100;
              return (
                <span
                  key={i}
                  className="titan-mote"
                  style={{
                    left: `${across}%`,
                    top: `${30 + down * 0.6}%`,
                    animationDelay: `${(down * 0.02) % 1.4}s`,
                    animationDuration: `${1.4 + across * 0.012}s`,
                  }}
                />
              );
            })}
          </div>

          {/* The Titan as TitanRiseScreen left it, eyes blown wide, going out and going down. */}
          <div className="titan-rise-painting titan-bound-painting" aria-hidden="true">
            {painting && <img src={painting} alt="" draggable={false} />}
            {PAINTED_EYES.map((eye, i) => (
              <span key={i} className="titan-rise-gaze" style={{ left: `${eye.x * 100}%`, top: `${eye.y * 100}%` }} />
            ))}
          </div>
          <span className="titan-bound-flash" aria-hidden="true" />
        </div>
      )}

      {!collapsing && (
        <div className="titan-bound-sealing">
          <div className="titan-bound-seal" aria-hidden="true" style={{ '--node-rgb': NODE_TINT_GOLD } as CSSProperties}>
            <SealArt lit={lit} />
            <span className="titan-bound-seal-core" />

            {seals.slice(0, SEAL_ACTS).map((seal, index) => (
              <span
                key={seal.actNumber}
                className={`pact-seal-socket titan-bound-socket${index < lit ? ' filled' : ''}`}
                style={
                  {
                    '--seal-angle': `${ringAngle(index)}deg`,
                    '--type-rgb': locations[seal.locationId]?.tintRgb ?? NODE_TINT_GOLD,
                    '--seal-delay': '0s',
                  } as CSSProperties
                }
              >
                {index < lit && <HeroPortrait heroId={seal.championId} className="pact-seal-portrait" />}
              </span>
            ))}

            <svg className={`titan-bound-names${inscribed ? ' is-written' : ''}`} viewBox="0 0 360 360">
              <defs>
                <path id="titan-bound-rim" d={RIM_PATH} />
              </defs>
              <text>
                <textPath href="#titan-bound-rim" textLength={RIM_LENGTH} lengthAdjust="spacing">
                  {names}
                </textPath>
              </text>
            </svg>
          </div>

          <div className="titan-bound-caption">
            <div className="titan-bound-eyebrow">The seal holds</div>
            <h2 className="titan-bound-title">The Titan is bound</h2>
            <p className="titan-bound-line">Bound to those who put it down. It wakes again in a year.</p>
            <PlateButton
              className="titan-bound-continue"
              onClick={(event) => {
                event.stopPropagation();
                done.current();
              }}
            >
              Continue
            </PlateButton>
          </div>
        </div>
      )}
    </div>
  );
}
