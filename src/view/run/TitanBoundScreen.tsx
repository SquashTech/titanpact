import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { rosterHeroes } from '../../data/content';
import { locations } from '../../data/locations';
import { SEAL_ACTS, type RunState } from '../../run/state';
import { HeroPortrait } from '../shared/HeroPortrait';
import { SealArt } from '../shared/SealArt';
import { prefersReducedMotion } from '../shared/reducedMotion';
import { NODE_TINT_GOLD } from '../shared/NodeStage';
import { PlateButton } from '../shared/PlateButton';
import inkmasterPageArt from '../../../art/inkmaster/inkmasterPage.png';
import './inkmaster.css';

interface Props {
  run: RunState;
  onContinue: () => void;
}

/** The Hands beaten, the Inkmaster bursts out of his page at last, furious (ms). */
const THROES_MS = 1900;
/** He is pulled back down into the page and the book shuts on him (ms). */
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
 * The Hands are beaten (docs/worlds.md §3.8): the first time the Inkmaster shows his face. He bursts
 * out of his page, is pulled back down into it, and the book shuts. Then the seal turns in over the
 * black: every ring the run locked comes back in act order, its Guardian struck into its socket, and
 * the roster's names are written round the rim before it locks. A tap goes straight to the end.
 */
export function TitanBoundScreen({ run, onContinue }: Props) {
  const [phase, setPhase] = useState<BoundPhase>('throes');
  const [lit, setLit] = useState(0);
  const done = useRef(onContinue);
  done.current = onContinue;
  const timers = useRef<number[]>([]);
  const seals = [...run.brokenSeals].sort((a, b) => a.actNumber - b.actNumber);
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
    playSfx('seal.shatter');
    playSfx('titan.stir');
    timers.current = [
      window.setTimeout(() => {
        setPhase('fall');
        playSfx('titan.stir');
        // The book slamming shut, timed to the sink's end (inkmaster.css ink-shut).
        window.setTimeout(() => playSfx('seal.strike'), 900);
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
    <div className={`titan-bound ink-bound is-${phase}`} onClick={skip}>
      {collapsing && (
        <div className="ink-bound-face" aria-hidden="true">
          <img className="ink-bound-figure" src={inkmasterPageArt} alt="" draggable={false} />
          <span className="ink-bound-shut" />
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
            <h2 className="titan-bound-title">The book is shut</h2>
            <p className="titan-bound-line">The Inkmaster is closed in his own pages. He writes again in a year.</p>
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
