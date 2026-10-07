import { useId, type CSSProperties } from 'react';
import type { GrowthStatKey } from '../../engine/content';

/** Each stat's stone: a name, a cut, and three tones (light, body, deep). */
export const GEM_STONES: Record<GrowthStatKey, { name: string; tones: [string, string, string] }> = {
  hp: { name: 'Emerald', tones: ['#c4ffd3', '#27b45a', '#07401c'] },
  manaPool: { name: 'Sapphire', tones: ['#c6e2ff', '#2f78e0', '#0a2460'] },
  attack: { name: 'Ruby', tones: ['#ffc2bf', '#e1262e', '#55050f'] },
  defense: { name: 'Diamond', tones: ['#ffffff', '#cdd6ea', '#55617d'] },
  intelligence: { name: 'Amethyst', tones: ['#f3c8ff', '#a53ac6', '#360a4b'] },
  wisdom: { name: 'Aquamarine', tones: ['#dcfdff', '#4fcfe2', '#0e5563'] },
  speed: { name: 'Topaz', tones: ['#fff5bf', '#f3bd23', '#714104'] },
};

type Pt = [number, number];

function ring(n: number, rx: number, ry: number, cx = 32, cy = 32, phase = 0): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const a = phase + (i / n) * Math.PI * 2;
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
  });
}

/** The outline of each cut, and the centre its table shrinks toward. */
const CUTS: Record<GrowthStatKey, { outer: Pt[]; center: Pt; table: number; cross?: boolean }> = {
  // Emerald: the step cut, an octagon taller than wide.
  hp: { outer: [[19, 8], [45, 8], [53, 16], [53, 48], [45, 56], [19, 56], [11, 48], [11, 16]], center: [32, 32], table: 0.52 },
  // Sapphire: an oval.
  manaPool: { outer: ring(16, 18, 23, 32, 32, Math.PI / 16), center: [32, 32], table: 0.5 },
  // Ruby: the round brilliant.
  attack: { outer: ring(16, 22, 22, 32, 32, Math.PI / 16), center: [32, 32], table: 0.48 },
  // Diamond: the princess cut, square and crossed.
  defense: { outer: [[10, 10], [54, 10], [54, 54], [10, 54]], center: [32, 32], table: 0.46, cross: true },
  // Amethyst: a hexagon, point up.
  intelligence: { outer: ring(6, 23, 25, 32, 32, -Math.PI / 2), center: [32, 32], table: 0.5 },
  // Aquamarine: the pear.
  wisdom: {
    outer: [[32, 5], [39, 13], [46, 24], [51, 36], [49, 47], [42, 55], [32, 58], [22, 55], [15, 47], [13, 36], [18, 24], [25, 13]],
    center: [32, 38],
    table: 0.46,
  },
  // Topaz: the trillion.
  speed: { outer: [[32, 6], [58, 54], [6, 54]], center: [32, 38], table: 0.42 },
};

const pts = (list: Pt[]) => list.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');

interface Props {
  stat: GrowthStatKey;
  /** Drawn in pixels, square. */
  size?: number;
  /** The gem in hand: it floats, glows and glints. Off, it sits still with a slow glint. */
  live?: boolean;
  /** A large Gem (10 points) wears a second sparkle. */
  large?: boolean;
  className?: string;
}

/**
 * A Gem, drawn: the stat's stone in its own cut, faceted, with a light sweeping across it and a
 * sparkle that comes and goes. Pure SVG, so it scales to any size crisp.
 */
export function GemIcon({ stat, size = 40, live = false, large = false, className }: Props) {
  const uid = useId().replace(/:/g, '');
  const cut = CUTS[stat];
  const [light, body, deep] = GEM_STONES[stat].tones;
  const [cx, cy] = cut.center;
  const inner: Pt[] = cut.outer.map(([x, y]) => [cx + (x - cx) * cut.table, cy + (y - cy) * cut.table]);
  const outline = pts(cut.outer);
  const n = cut.outer.length;
  // Each facet between the outline and the table, lit by how much it faces the upper left.
  const facets = cut.outer.map((p, i) => {
    const q = cut.outer[(i + 1) % n];
    const mid: Pt = [(p[0] + q[0]) / 2 - cx, (p[1] + q[1]) / 2 - cy];
    const len = Math.hypot(mid[0], mid[1]) || 1;
    const facing = -(mid[0] + mid[1]) / (len * Math.SQRT2);
    return { poly: pts([p, q, inner[(i + 1) % n], inner[i]]), facing };
  });
  const classes = ['gem-icon', `is-${stat}`, live ? 'is-live' : '', large ? 'is-large' : '', className].filter(Boolean).join(' ');

  return (
    <span className={classes} style={{ width: size, height: size, '--gem-glow': body } as CSSProperties} aria-hidden="true">
      <svg viewBox="0 0 64 64" width={size} height={size}>
        <defs>
          <linearGradient id={`b${uid}`} x1="0.15" y1="0" x2="0.85" y2="1">
            <stop offset="0" stopColor={light} />
            <stop offset="0.45" stopColor={body} />
            <stop offset="1" stopColor={deep} />
          </linearGradient>
          <radialGradient id={`t${uid}`} cx="0.38" cy="0.32" r="0.8">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.85" />
            <stop offset="0.35" stopColor={light} stopOpacity="0.9" />
            <stop offset="1" stopColor={body} />
          </radialGradient>
          <linearGradient id={`g${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <clipPath id={`c${uid}`}>
            <polygon points={outline} />
          </clipPath>
        </defs>

        <polygon points={outline} fill={`url(#b${uid})`} />
        {facets.map((f, i) => (
          <polygon
            key={i}
            points={f.poly}
            fill={f.facing > 0 ? '#ffffff' : '#000000'}
            fillOpacity={Math.min(0.45, Math.abs(f.facing) * 0.4)}
          />
        ))}
        <polygon points={pts(inner)} fill={`url(#t${uid})`} />
        <g stroke="#ffffff" strokeOpacity="0.45" strokeWidth="0.8" fill="none" strokeLinejoin="round">
          <polygon points={pts(inner)} />
          {cut.outer.map((p, i) => (
            <line key={i} x1={p[0]} y1={p[1]} x2={inner[i][0]} y2={inner[i][1]} />
          ))}
          {cut.cross && (
            <>
              <line x1={inner[0][0]} y1={inner[0][1]} x2={inner[2][0]} y2={inner[2][1]} />
              <line x1={inner[1][0]} y1={inner[1][1]} x2={inner[3][0]} y2={inner[3][1]} />
            </>
          )}
        </g>
        <g clipPath={`url(#c${uid})`}>
          <g transform="rotate(24 32 32)">
            <rect className="gem-glint" x="-40" y="-12" width="18" height="88" fill={`url(#g${uid})`} />
          </g>
        </g>
        <polygon points={outline} fill="none" stroke={deep} strokeWidth="1.6" strokeLinejoin="round" />
        <ellipse cx={cx - 8} cy={cy - 9} rx="5" ry="2.6" fill="#ffffff" fillOpacity="0.75" transform={`rotate(-35 ${cx - 8} ${cy - 9})`} />
        <path className="gem-spark" d="M50 9 L51.6 14.4 L57 16 L51.6 17.6 L50 23 L48.4 17.6 L43 16 L48.4 14.4 Z" fill="#ffffff" />
        {large && <path className="gem-spark is-second" d="M13 44 L14.2 48 L18 49 L14.2 50 L13 54 L11.8 50 L8 49 L11.8 48 Z" fill="#ffffff" />}
      </svg>
    </span>
  );
}
