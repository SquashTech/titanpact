import type { CSSProperties } from 'react';
import { locations } from '../../data/locations';
import { allCombatants } from '../../data/content';
import { SEAL_ACTS, type BrokenSeal, type RunState } from '../../run/state';
import { heroArt } from '../shared/heroArt';
import { NodeHeader, NodeSky, NODE_TINT_GOLD } from '../shared/NodeStage';

interface Props {
  run: RunState;
  onContinue: () => void;
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

/**
 * The between-acts beat (docs/run-loop.md §4): five sockets, one per Guardian, in the
 * same fixed-denominator idiom as the draft's pact sockets. It grants nothing, so it
 * goes last in the act-boundary chain — the seal fills, then you arrive somewhere new.
 * The fifth socket is the payoff: it fills and the seal breaks into Act 6.
 */
export function PactSealScreen({ run, onContinue }: Props) {
  const seals = [...run.brokenSeals].sort((a, b) => a.actNumber - b.actNumber);
  const complete = seals.length >= SEAL_ACTS;

  return (
    <div
      className={`node-screen pact-seal-screen${complete ? ' is-broken' : ''}`}
      style={{ '--node-rgb': NODE_TINT_GOLD } as CSSProperties}
    >
      <NodeSky />

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
          const art = seal ? heroArt[seal.championId] : undefined;
          const style = {
            '--seal-angle': `${-90 + index * (360 / SEAL_ACTS)}deg`,
            '--type-rgb': socketTint(seal),
            // Each socket seats a beat after the one before it, so a returning player
            // reads the whole record rather than only the one that just landed.
            '--seal-delay': `${index * 0.09}s`,
          } as CSSProperties;
          return (
            <span key={index} className={`pact-seal-socket${seal ? ' filled' : ''}`} style={style}>
              {art ? (
                <img className="pact-seal-portrait" src={art} alt="" />
              ) : (
                <span className="pact-seal-mark">◇</span>
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
