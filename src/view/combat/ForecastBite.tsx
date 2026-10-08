/**
 * A damage forecast drawn into an HP track, eaten leftwards from what is left: solid for what even
 * the worst roll takes, striped for the part the roll decides. Fractions are of the target's max HP.
 */
export function ForecastBite({ hpFraction, minFraction, maxFraction }: { hpFraction: number; minFraction: number; maxFraction: number }) {
  const sureLeft = Math.max(0, hpFraction - minFraction);
  const rangeLeft = Math.max(0, hpFraction - maxFraction);
  return (
    <>
      {sureLeft > rangeLeft && <div className="forecast-bite-range" style={{ left: `${rangeLeft * 100}%`, width: `${(sureLeft - rangeLeft) * 100}%` }} />}
      {hpFraction > sureLeft && <div className="forecast-bite-sure" style={{ left: `${sureLeft * 100}%`, width: `${(hpFraction - sureLeft) * 100}%` }} />}
    </>
  );
}
