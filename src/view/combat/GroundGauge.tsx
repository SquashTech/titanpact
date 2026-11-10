import type { MoveForecast } from './forecast';
import { hpTier } from '../shared/StatBars';

// One ellipse's size on the field, in the gauge's own units; CSS sets the drawn width per side and size.
const RX = 56;
const RY = 12;
const SHIELD_GAP = 5;
const MP_INSET = 9;
const PAD = 9;

/** The front half of an ellipse, left end to right end through the side nearest the viewer. */
function crescent(rx: number, ry: number): string {
  return `M ${-rx} 0 A ${rx} ${ry} 0 0 0 ${rx} 0`;
}

/** A stretch of the crescent, as fractions of its length from the left end. */
function Arc({ rx, ry, from = 0, length, className, width }: { rx: number; ry: number; from?: number; length: number; className: string; width: number }) {
  const len = Math.max(0, Math.min(1 - from, length));
  if (len <= 0) return null;
  return (
    <path
      className={className}
      d={crescent(rx, ry)}
      pathLength={100}
      strokeWidth={width}
      strokeDasharray={`${len * 100} 200`}
      strokeDashoffset={-from * 100}
    />
  );
}

/** A damage forecast eaten leftwards from what is left: solid for what even the worst roll takes, breathing for the rest (ForecastBite). */
function Bite({ forecast }: { forecast: Extract<MoveForecast, { kind: 'damage' }> }) {
  const sureFrom = Math.max(0, forecast.hpFraction - forecast.minFraction);
  const rangeFrom = Math.max(0, forecast.hpFraction - forecast.maxFraction);
  return (
    <>
      <Arc rx={RX} ry={RY} from={rangeFrom} length={sureFrom - rangeFrom} className="gauge-bite-range" width={4.5} />
      <Arc rx={RX} ry={RY} from={sureFrom} length={forecast.hpFraction - sureFrom} className="gauge-bite-sure" width={4.5} />
    </>
  );
}

interface Props {
  hpFraction: number;
  /** Shield held, as a fraction of max HP (capped at the whole of it). */
  shieldFraction: number;
  manaFraction: number;
  manaOverFraction: number;
  /** A boss's ring: the Titan's colours, a gilt rim, no MP. */
  boss: boolean;
  fainted: boolean;
  forecast?: MoveForecast | null;
}

/**
 * HP and MP drawn as a crescent round the ground at a figure's feet (2026-11-09, per user direction,
 * art/concepts/ground-gauge): nothing over a head, however tall the figure. HP is the outer arc and
 * empties right to left like a bar; MP the inner; a Shield a pale arc outside HP; a forecast eats HP.
 */
export function GroundGauge({ hpFraction, shieldFraction, manaFraction, manaOverFraction, boss, fainted, forecast }: Props) {
  const outer = RX + SHIELD_GAP;
  const w = (outer + PAD) * 2;
  const h = (RY + SHIELD_GAP + PAD) * 2;
  const hp = fainted ? 0 : hpFraction;
  const tier = hpTier(hp);
  const mrx = RX - MP_INSET;
  const mry = RY - 5;
  return (
    <svg className="ground-gauge" viewBox={`${-w / 2} ${-h / 2} ${w} ${h}`} aria-hidden="true">
      {boss && (
        <>
          <path className="gauge-rim" d={crescent(RX + 3.5, RY + 3.5)} />
          <path className="gauge-rim" d={crescent(RX - 3.5, RY - 3.5)} />
        </>
      )}
      <path className="gauge-track" d={crescent(RX, RY)} strokeWidth={4} />
      <Arc rx={RX} ry={RY} length={hp} className={`gauge-hp ${tier}`} width={4} />
      {!fainted && forecast?.kind === 'damage' && <Bite forecast={forecast} />}
      {!fainted && forecast?.kind === 'heal' && <Arc rx={RX} ry={RY} from={forecast.hpFraction} length={forecast.restoredFraction} className="gauge-heal" width={4.5} />}
      {!fainted && <Arc rx={outer} ry={RY + 4} length={shieldFraction} className="gauge-shield" width={2} />}
      {!boss && (
        <>
          <path className="gauge-track" d={crescent(mrx, mry)} strokeWidth={2.5} />
          {!fainted && <Arc rx={mrx} ry={mry} length={manaFraction} className="gauge-mp" width={2.5} />}
          {!fainted && <Arc rx={mrx} ry={mry} length={manaOverFraction} className="gauge-mp-over" width={2.5} />}
        </>
      )}
      {boss && (
        <>
          <rect className="gauge-gem" x={-3} y={-3} width={6} height={6} transform={`translate(${-RX - 4} 0) rotate(45)`} />
          <rect className="gauge-gem" x={-3} y={-3} width={6} height={6} transform={`translate(${RX + 4} 0) rotate(45)`} />
        </>
      )}
    </svg>
  );
}
