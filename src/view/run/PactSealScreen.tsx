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

/** The fallen warden rising, then drawn into its socket, while its chain strains (ms). */
const CHARGE_MS = 1400;
/** The cut itself: slash, the chain snapping, shockwave, shards (ms). */
const STRIKE_MS = 700;
/** The Titan's answer, a beat after the cut (ms). */
const GAZE_DELAY_MS = 320;

/** `charge` holds the newest socket empty and winding up; `strike` cuts it; `settled` is the record. */
type SealPhase = 'charge' | 'strike' | 'settled';

/**
 * How far the Titan's lids are open, by seals broken: shut while all four hold, wider at every
 * break, and past the title's own resting width once nothing holds (a scale on the title's lens).
 */
const LID_BY_SEALS = [0.08, 0.32, 0.6, 0.88, 1.3] as const;

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

/**
 * The arrival beat. The socket the player just earned does NOT simply seat with the others — it
 * stays empty while its warden is drawn into it, then gets struck through.
 * `final` swaps the strike's sound for the ring giving way; the CSS is one class either way.
 */
function useSealStrike(final: boolean): SealPhase {
  const [phase, setPhase] = useState<SealPhase>(() => (prefersReducedMotion() ? 'settled' : 'charge'));

  useEffect(() => {
    if (prefersReducedMotion()) return;
    playSfx('titan.stir', { gain: 0.6 });
    const timers = [
      window.setTimeout(() => {
        setPhase('strike');
        // The sound IS the cut — fired on the frame the slash crosses, not on mount.
        playSfx(final ? 'seal.shatter' : 'seal.strike');
      }, CHARGE_MS),
      window.setTimeout(() => playSfx('titan.gaze'), CHARGE_MS + GAZE_DELAY_MS),
      window.setTimeout(() => setPhase('settled'), CHARGE_MS + STRIKE_MS),
    ];
    return () => timers.forEach(window.clearTimeout);
  }, [final]);

  return phase;
}

/** Empty sockets read gold — the pact's own colour — until a warden fills one with its Location's. */
function socketTint(seal: BrokenSeal | undefined): string {
  if (!seal) return NODE_TINT_GOLD;
  return locations[seal.locationId]?.tintRgb ?? NODE_TINT_GOLD;
}

function readout(seals: readonly BrokenSeal[]): string {
  const latest = seals[seals.length - 1];
  const name = latest ? (allCombatants[latest.championId]?.name ?? 'The warden') : 'The warden';
  const standing = SEAL_ACTS - seals.length;
  if (standing <= 0) return `${name} falls. Nothing is holding the other end.`;
  if (standing === 1) return `${name} falls. One warden still stands.`;
  return `${name} falls. ${standing} wardens still stand.`;
}

// Golden-angle spread, same trick as CacheReveal's sparks: stable, never symmetrical, no seed.
const SHARDS = Array.from({ length: 10 }, (_, i) => {
  const seed = i * 137.51;
  return { angle: seed % 360, distance: 38 + ((seed * 0.29) % 30) };
});

/**
 * The between-acts beat (docs/run-loop.md §4): four sockets on the title's own seal, one per
 * Guardian, each holding a chain that runs off into the dark toward the thing it binds — and the
 * Titan's eyes over it all, opening wider with every seal broken (2026-10-07, per user direction:
 * the screen was barren). The newest warden rises, is drawn into its socket, and the strike cuts
 * its chain; the tablets under the seal keep the run's record. It grants nothing, so it goes last
 * in the act-boundary chain. The fourth socket is the payoff: the seal breaks into the finale.
 */
export function PactSealScreen({ run, onContinue }: Props) {
  const seals = [...run.brokenSeals].sort((a, b) => a.actNumber - b.actNumber);
  const complete = seals.length >= SEAL_ACTS;
  // The screen only ever opens on a Guardian's fall, so the last socket is always this act's.
  const newIndex = seals.length - 1;
  const newSeal = seals[newIndex];
  const phase = useSealStrike(complete);
  const struck = phase !== 'charge';
  const brokenShown = struck ? seals.length : Math.max(0, seals.length - 1);

  return (
    <div
      className={`node-screen pact-seal-screen is-${phase}${complete ? ' is-broken' : ''}`}
      style={
        {
          '--node-rgb': NODE_TINT_GOLD,
          '--lid': LID_BY_SEALS[Math.min(brokenShown, LID_BY_SEALS.length - 1)],
          '--glare': 0.35 + brokenShown * 0.16,
        } as CSSProperties
      }
    >
      {/* The Titan the seals hold: the title's brow and eyes, lit from behind, over the ridge. */}
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
        eyebrow={`${brokenShown} of ${SEAL_ACTS} seals broken`}
        title={complete ? 'The seal breaks' : 'The Pact Seal'}
        readout={readout(seals)}
        readoutKey={String(seals.length)}
      />

      <div className="pact-seal-ring" aria-hidden="true">
        <SealArt lit={0} />
        <span className="pact-seal-core" />

        {Array.from({ length: SEAL_ACTS }, (_, index) => {
          const seal = seals[index];
          const isNew = seal !== undefined && index === newIndex;
          const snapped = seal !== undefined && (!isNew || struck);
          return (
            <span
              key={`chain-${index}`}
              className={`pact-seal-arm${snapped ? ' is-snapped' : ''}${isNew ? ' is-new' : ''}`}
              style={{ '--seal-angle': `${-90 + index * (360 / SEAL_ACTS)}deg` } as CSSProperties}
            >
              <span className="pact-seal-chain is-near" />
              <span className="pact-seal-chain is-far" />
            </span>
          );
        })}

        {Array.from({ length: SEAL_ACTS }, (_, index) => {
          const seal = seals[index];
          const isNew = seal !== undefined && index === newIndex;
          // The new socket holds its empty face through the wind-up: it is struck, not seated.
          const shown = seal !== undefined && (!isNew || struck);
          const style = {
            '--seal-angle': `${-90 + index * (360 / SEAL_ACTS)}deg`,
            '--type-rgb': socketTint(shown ? seal : undefined),
            // Each socket seats a beat after the one before it, so a returning player
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
                  <span className="pact-seal-slash" />
                  {SHARDS.map((s, i) => (
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

        {/* The fallen warden, risen once more over the seal and drawn into its own socket. */}
        {newSeal && phase === 'charge' && (
          <span
            className="pact-seal-champion"
            style={
              {
                '--seal-angle': `${-90 + newIndex * (360 / SEAL_ACTS)}deg`,
                '--type-rgb': socketTint(newSeal),
              } as CSSProperties
            }
          >
            <HeroPortrait heroId={newSeal.championId} className="pact-seal-champion-figure" />
          </span>
        )}
      </div>

      {/* The run's record: one tablet a seal, its act, its place, and whether it holds. */}
      <ol className="pact-seal-ledger">
        {Array.from({ length: SEAL_ACTS }, (_, index) => {
          const seal = seals[index];
          const isNew = seal !== undefined && index === newIndex;
          const broken = seal !== undefined && (!isNew || struck);
          const place = seal ? locations[seal.locationId]?.name : undefined;
          return (
            <li
              key={index}
              className={`pact-seal-tablet${broken ? ' is-broken' : ''}${isNew ? ' is-new' : ''}${seal ? '' : ' is-ahead'}`}
              style={{ '--type-rgb': socketTint(seal) } as CSSProperties}
            >
              <span className="pact-seal-tablet-act">{ROMAN[index]}</span>
              <span className="pact-seal-tablet-place">{place ?? 'Unknown'}</span>
              <span className="pact-seal-tablet-state">{broken ? 'Broken' : 'Holds'}</span>
            </li>
          );
        })}
      </ol>

      <div className="node-spacer" />

      <PlateButton onClick={onContinue}>{complete ? 'Walk to the Threshold' : 'Onward'}</PlateButton>
    </div>
  );
}
