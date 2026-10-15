import type { CSSProperties } from 'react';

// The title's sky (docs/lore.md "The fall"): the same stars on the title, the loading screen and the
// first run's fall, so the fall can put out the very stars the player has been looking at.

export interface NightStar {
  /** Percent of the sky's box. */
  x: number;
  y: number;
  /** Px. */
  r: number;
  /** Peak opacity. */
  o: number;
  /** Twinkle period and phase, s. */
  period: number;
  phase: number;
}

const STAR_COUNT = 280;

/** A fixed field, the same every time: a Lehmer generator on a constant seed. */
export const NIGHT_STARS: readonly NightStar[] = (() => {
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  return Array.from({ length: STAR_COUNT }, (_, i) => {
    const r = i % 9 === 0 ? 2.5 : rnd() < 0.08 ? 2 : rnd() < 0.35 ? 1.4 : 1;
    return { x: rnd() * 100, y: rnd() * 82, r, o: 0.35 + rnd() * 0.65, period: 2 + rnd() * 5, phase: rnd() * 5 };
  });
})();

interface Props {
  /** Star index → seconds after mount at which it goes out for good (the fall's wake). */
  outAt?: ReadonlyMap<number, number>;
}

export function NightSky({ outAt }: Props) {
  return (
    <div className="night-sky" aria-hidden="true">
      <span className="night-sky-band" />
      {NIGHT_STARS.map((star, i) => {
        const out = outAt?.get(i);
        return (
          <span
            key={i}
            className={`night-star${star.r >= 2 ? ' is-bright' : ''}${out !== undefined ? ' is-doomed' : ''}`}
            style={
              {
                left: `${star.x}%`,
                top: `${star.y}%`,
                width: `${star.r}px`,
                height: `${star.r}px`,
                '--o': star.o,
                '--period': `${star.period}s`,
                '--phase': `-${star.phase}s`,
                '--out-at': out !== undefined ? `${out}s` : undefined,
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
