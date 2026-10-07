import type { CSSProperties } from 'react';

interface Star {
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
  bright: boolean;
  warm: boolean;
}

/** A fixed LCG, so every StarField draws the same sky — the draft's and the forging's are one night. */
function buildStars(count: number): Star[] {
  let s = 0x2f6b9d;
  const next = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
  return Array.from({ length: count }, () => {
    const roll = next();
    return {
      x: next() * 100,
      // Thinner toward the horizon, where the glow sits.
      y: Math.pow(next(), 1.35) * 92,
      size: roll > 0.93 ? 3 : roll > 0.68 ? 2 : 1,
      delay: next() * 6,
      duration: 2.4 + next() * 4.2,
      bright: roll > 0.955,
      warm: next() > 0.78,
    };
  });
}

const STARS = buildStars(140);

const SHOOTING = [
  { top: 9, left: 78, delay: 2.5, duration: 11 },
  { top: 24, left: 34, delay: 8, duration: 15 },
];

/** The night sky the draft and the pact's forging stand under: pixel stars twinkling, a band of the galaxy, a shooting star now and then. */
export function StarField({ className }: { className?: string }) {
  return (
    <div className={`star-field${className ? ` ${className}` : ''}`} aria-hidden="true">
      <span className="star-field-band" />
      {STARS.map((star, i) => (
        <span
          key={i}
          className={`star-field-star${star.bright ? ' is-bright' : ''}${star.warm ? ' is-warm' : ''}`}
          style={
            {
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              animationDelay: `${star.delay}s`,
              animationDuration: `${star.duration}s`,
            } as CSSProperties
          }
        />
      ))}
      {SHOOTING.map((s, i) => (
        <span
          key={i}
          className="star-field-shooting"
          style={{ top: `${s.top}%`, left: `${s.left}%`, animationDelay: `${s.delay}s`, animationDuration: `${s.duration}s` }}
        />
      ))}
      <span className="star-field-horizon" />
    </div>
  );
}
