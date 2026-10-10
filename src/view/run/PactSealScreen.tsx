import { useEffect, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { locations } from '../../data/locations';
import { allCombatants } from '../../data/content';
import { SEAL_ACTS, type BrokenSeal, type RunState } from '../../run/state';
import { HeroPortrait } from '../shared/HeroPortrait';
import { SealArt } from '../shared/SealArt';
import { prefersReducedMotion } from '../shared/reducedMotion';
import { NodeHeader, NODE_TINT_GOLD } from '../shared/NodeStage';
import { TitanColossus, TitanRidge } from './titanArt';
import { PlateButton } from '../shared/PlateButton';

interface Props {
  run: RunState;
  onContinue: () => void;
}

/** The fallen warden rising, then drawn into its ring, while its chain is hauled in (ms). */
const CHARGE_MS = 1400;
/** The lock itself: the clasp closing, the chain drawn taut, the flash (ms). */
const STRIKE_MS = 700;
/** The Titan's answer, a beat after the lock (ms). */
const GAZE_DELAY_MS = 320;

/** `charge` holds the newest ring open and winding up; `strike` locks it; `settled` is the record. */
type SealPhase = 'charge' | 'strike' | 'settled';

/**
 * How far the Titan's lids are open, by rings locked: wide while all four stand open, narrower at
 * every lock, and all but shut once nothing is left open (a scale on the title's lens).
 */
const LID_BY_SEALS = [1, 0.74, 0.5, 0.28, 0.08] as const;

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

/**
 * Where ring `index` sits, in degrees (0 is to the right). On the diagonals, first at the upper
 * right: the chains then run out to the corners and leave the column the header and the record
 * read in clear.
 */
function ringAngle(index: number): number {
  return -45 + index * (360 / SEAL_ACTS);
}
const COUNT_WORDS: Readonly<Record<number, string>> = { 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five' };

/**
 * The arrival beat. The ring the player just earned does NOT simply seat with the others — it
 * stays open while its warden is drawn into it, then locks.
 * `final` makes the last lock the louder one; the CSS is one class either way.
 */
function useSealStrike(final: boolean, still: boolean): SealPhase {
  const [phase, setPhase] = useState<SealPhase>(() => (still || prefersReducedMotion() ? 'settled' : 'charge'));

  useEffect(() => {
    if (still || prefersReducedMotion()) return;
    playSfx('titan.stir', { gain: 0.6 });
    const timers = [
      window.setTimeout(() => {
        setPhase('strike');
        // The sound IS the lock — fired on the frame the clasp closes, not on mount.
        playSfx('seal.strike');
        playSfx('pact.bind', final ? { gain: 1.3 } : { pitch: 1.1 });
      }, CHARGE_MS),
      window.setTimeout(() => playSfx('titan.gaze'), CHARGE_MS + GAZE_DELAY_MS),
      window.setTimeout(() => setPhase('settled'), CHARGE_MS + STRIKE_MS),
    ];
    return () => timers.forEach(window.clearTimeout);
  }, [final, still]);

  return phase;
}

/** Open rings read gold — the pact's own colour — until a warden locks one with its Location's. */
function socketTint(seal: BrokenSeal | undefined): string {
  if (!seal) return NODE_TINT_GOLD;
  return locations[seal.locationId]?.tintRgb ?? NODE_TINT_GOLD;
}

function readout(seals: readonly BrokenSeal[], opening: boolean): string {
  if (opening) return `${COUNT_WORDS[SEAL_ACTS] ?? SEAL_ACTS} Guardians hold its rings open.`;
  const latest = seals[seals.length - 1];
  const name = latest ? (allCombatants[latest.championId]?.name ?? 'The Guardian') : 'The Guardian';
  const open = SEAL_ACTS - seals.length;
  if (open <= 0) return `${name} falls. The seal is shut, and the Titan pushes back.`;
  if (open === 1) return `${name} falls. One ring is still open.`;
  return `${name} falls. ${COUNT_WORDS[open] ?? open} rings are still open.`;
}

// Golden-angle spread, same trick as CacheReveal's sparks: stable, never symmetrical, no seed.
const SPARKS = Array.from({ length: 10 }, (_, i) => {
  const seed = i * 137.51;
  return { angle: seed % 360, distance: 38 + ((seed * 0.29) % 30) };
});

/**
 * The run's frame (docs/lore.md §5): four rings on the title's own seal, one per Guardian, and
 * the Titan's eyes over it all, closing narrower with every ring locked. It opens the run with
 * every ring open, straight after the Blessing, and closes every act: the newest warden rises,
 * is drawn into its ring, and the clasp locks it, its chain hauled taut into the dark toward the
 * thing it binds; the tablets under the seal keep the run's record. It grants nothing, so it goes
 * last in the act-boundary chain. The fourth lock is the payoff: the seal is shut, and the Titan
 * sends its Herald against it.
 */
export function PactSealScreen({ run, onContinue }: Props) {
  // No ring locked yet is the run's first look at the seal, straight after the Blessing.
  const opening = run.brokenSeals.length === 0;
  const seals = [...run.brokenSeals].sort((a, b) => a.actNumber - b.actNumber);
  const complete = seals.length >= SEAL_ACTS;
  // Off the opening, the screen only ever follows a Guardian's fall, so the last ring is this act's.
  const newIndex = seals.length - 1;
  const newSeal = seals[newIndex];
  const phase = useSealStrike(complete, opening);
  const struck = phase !== 'charge';
  const lockedShown = struck ? seals.length : Math.max(0, seals.length - 1);

  return (
    <div
      className={`node-screen pact-seal-screen is-${phase}${complete ? ' is-locked' : ''}${opening ? ' is-opening' : ''}`}
      style={
        {
          '--node-rgb': NODE_TINT_GOLD,
          '--lid': LID_BY_SEALS[Math.min(lockedShown, LID_BY_SEALS.length - 1)],
          '--glare': 0.95 - lockedShown * 0.18,
        } as CSSProperties
      }
    >
      {/* The Titan the seal holds: the title's brow and eyes, lit from behind, over the ridge. */}
      <div className="node-sky pact-seal-scene" aria-hidden="true">
        <span className="title-backlight pact-seal-backlight" />
        <div className="pact-seal-titan">
          <TitanColossus />
        </div>
        <TitanRidge />
      </div>
      <div className="pact-seal-flash" aria-hidden="true" />

      <div className="pact-seal-sky-gap" />

      <NodeHeader
        eyebrow={`${lockedShown} of ${SEAL_ACTS} rings locked`}
        title={complete ? 'The seal is shut' : "The Titan's Seal"}
        readout={readout(seals, opening)}
        readoutKey={String(seals.length)}
      />

      <div className="pact-seal-ring" aria-hidden="true">
        <SealArt lit={0} />
        <span className="pact-seal-core" />

        {Array.from({ length: SEAL_ACTS }, (_, index) => {
          const seal = seals[index];
          const isNew = seal !== undefined && index === newIndex;
          const taut = seal !== undefined && (!isNew || struck);
          return (
            <span
              key={`chain-${index}`}
              className={`pact-seal-arm${taut ? ' is-taut' : ''}${isNew ? ' is-new' : ''}`}
              style={{ '--seal-angle': `${ringAngle(index)}deg` } as CSSProperties}
            >
              <span className="pact-seal-chain is-near" />
              <span className="pact-seal-chain is-far" />
            </span>
          );
        })}

        {Array.from({ length: SEAL_ACTS }, (_, index) => {
          const seal = seals[index];
          const isNew = seal !== undefined && index === newIndex;
          // The new ring holds its open face through the wind-up: it is locked, not seated.
          const shown = seal !== undefined && (!isNew || struck);
          const style = {
            '--seal-angle': `${ringAngle(index)}deg`,
            '--type-rgb': socketTint(shown ? seal : undefined),
            // Each ring seats a beat after the one before it, so a returning player
            // reads the whole record rather than only the one that just landed.
            '--seal-delay': `${index * 0.09}s`,
          } as CSSProperties;
          return (
            <span
              key={index}
              className={`pact-seal-socket${shown ? ' filled' : ''}${isNew ? ' is-new' : ''}`}
              style={style}
            >
              {shown ? (
                <HeroPortrait heroId={seal.championId} className="pact-seal-portrait" />
              ) : (
                <span className="pact-seal-mark">◇</span>
              )}
              {isNew && (
                <>
                  <span className="pact-seal-shock" />
                  <span className="pact-seal-clasp" />
                  {SPARKS.map((s, i) => (
                    <span
                      key={i}
                      className="pact-seal-shard"
                      style={
                        {
                          '--shard-angle': `${s.angle}deg`,
                          '--shard-distance': `${s.distance}px`,
                        } as CSSProperties
                      }
                    />
                  ))}
                </>
              )}
            </span>
          );
        })}

        {/* The fallen warden, risen once more over the seal and drawn into its own ring. */}
        {newSeal && phase === 'charge' && (
          <span
            className="pact-seal-champion"
            style={
              {
                '--seal-angle': `${ringAngle(newIndex)}deg`,
                '--type-rgb': socketTint(newSeal),
              } as CSSProperties
            }
          >
            <HeroPortrait heroId={newSeal.championId} className="pact-seal-champion-figure" />
          </span>
        )}
      </div>

      {/* The run's record: one tablet a ring, its act, its place, and whether it is locked. */}
      <ol className="pact-seal-ledger">
        {Array.from({ length: SEAL_ACTS }, (_, index) => {
          const seal = seals[index];
          const isNew = seal !== undefined && index === newIndex;
          const locked = seal !== undefined && (!isNew || struck);
          const place = seal ? locations[seal.locationId]?.name : undefined;
          return (
            <li
              key={index}
              className={`pact-seal-tablet${locked ? ' is-locked' : ''}${isNew ? ' is-new' : ''}${seal ? '' : ' is-ahead'}`}
              style={{ '--type-rgb': socketTint(seal) } as CSSProperties}
            >
              <span className="pact-seal-tablet-act">{ROMAN[index]}</span>
              <span className="pact-seal-tablet-place">{place ?? 'Unknown'}</span>
              <span className="pact-seal-tablet-state">{locked ? 'Locked' : 'Open'}</span>
            </li>
          );
        })}
      </ol>

      <div className="node-spacer" />

      <PlateButton onClick={onContinue}>{opening ? 'Set out' : complete ? 'Walk to the Threshold' : 'Onward'}</PlateButton>
    </div>
  );
}
