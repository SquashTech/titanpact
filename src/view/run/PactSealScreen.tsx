import { useEffect, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { locations } from '../../data/locations';
import { allCombatants } from '../../data/content';
import { SEAL_ACTS, type BrokenSeal, type RunState } from '../../run/state';
import { heroArt } from '../shared/heroArt';
import { prefersReducedMotion } from '../shared/reducedMotion';
import { NodeHeader, NodeSky, NODE_TINT_GOLD } from '../shared/NodeStage';

interface Props {
  run: RunState;
  onContinue: () => void;
}

/** The already-standing sockets seating, back to front (ms). */
const CHARGE_MS = 820;
/** The cut itself: slash sweep, shockwave, shards (ms). */
const STRIKE_MS = 520;

/** `charge` holds the newest socket empty and winding up; `strike` cuts it; `settled` is the record. */
type SealPhase = 'charge' | 'strike' | 'settled';

/**
 * The arrival beat. The socket the player just earned does NOT simply seat with the
 * others — it stays empty while the record behind it fills, then gets struck through.
 * `final` swaps the strike's sound for the ring giving way; the CSS is one class either way.
 */
function useSealStrike(final: boolean): SealPhase {
  const [phase, setPhase] = useState<SealPhase>('charge');

  useEffect(() => {
    if (prefersReducedMotion()) {
      setPhase('settled');
      return;
    }
    const strike = window.setTimeout(() => {
      setPhase('strike');
      // The sound IS the cut — fired on the frame the slash crosses, not on mount.
      playSfx(final ? 'seal.shatter' : 'seal.strike');
    }, CHARGE_MS);
    const settle = window.setTimeout(() => setPhase('settled'), CHARGE_MS + STRIKE_MS);
    return () => {
      window.clearTimeout(strike);
      window.clearTimeout(settle);
    };
  }, [final]);

  return phase;
}

/** Empty sockets read gold — the pact's own colour — until a warden fills one with its faction's. */
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
const SHARDS = Array.from({ length: 8 }, (_, i) => {
  const seed = i * 137.51;
  return { angle: seed % 360, distance: 34 + ((seed * 0.29) % 26) };
});

/**
 * The between-acts beat (docs/run-loop.md §4): five sockets, one per Guardian, in the
 * same fixed-denominator idiom as the draft's pact sockets. It grants nothing, so it
 * goes last in the act-boundary chain — the seal fills, then you arrive somewhere new.
 * The fifth socket is the payoff: it fills and the seal breaks into Act 6.
 */
export function PactSealScreen({ run, onContinue }: Props) {
  const seals = [...run.brokenSeals].sort((a, b) => a.actNumber - b.actNumber);
  const complete = seals.length >= SEAL_ACTS;
  // The screen only ever opens on a Guardian's fall, so the last socket is always this act's.
  const newIndex = seals.length - 1;
  const phase = useSealStrike(complete);

  return (
    <div
      className={`node-screen pact-seal-screen is-${phase}${complete ? ' is-broken' : ''}`}
      style={{ '--node-rgb': NODE_TINT_GOLD } as CSSProperties}
    >
      <NodeSky />
      <div className="pact-seal-flash" aria-hidden="true" />

      <div className="node-spacer" />

      <NodeHeader
        eyebrow={`${seals.length} of ${SEAL_ACTS} seals broken`}
        title={complete ? 'The seal breaks' : 'The Pact Seal'}
        readout={readout(seals)}
        readoutKey={String(seals.length)}
        floating
      />

      <div className="pact-seal-ring" aria-hidden="true">
        <span className="pact-seal-core" />
        {Array.from({ length: SEAL_ACTS }, (_, index) => {
          const seal = seals[index];
          const isNew = seal !== undefined && index === newIndex;
          // The new socket holds its empty face through the wind-up: it is struck, not seated.
          const shown = seal !== undefined && (!isNew || phase !== 'charge');
          const art = shown ? heroArt[seal.championId] : undefined;
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
              {art ? (
                <img className="pact-seal-portrait" src={art} alt="" />
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
      </div>

      <div className="node-spacer" />

      <button className="resolve-button" onClick={onContinue}>
        {complete ? 'Walk to the Threshold' : 'Onward'}
      </button>
    </div>
  );
}
