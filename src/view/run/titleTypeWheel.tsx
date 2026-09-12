import { TYPES, typeChart } from '../../data/typechart';
import { ELEMENT_PATHS } from '../shared/elementIcons';
import { getTypeColor } from '../combat/typeColors';

// The type chart, drawn as the seal's outer dial (docs/types-and-heroes.md). Fourteen
// glyphs sit round the ring in chart order, and every 2× cell is a chord from the attacker
// to the defender in the attacker's colour, fading toward the end it strikes — so the
// direction is in the line, not in an arrowhead the size would not carry. Resistances are
// not drawn: forty-one chords is a seal, eighty is a hairball. Ancient is left off: it
// strikes nothing for 2× and is only ever resisted, so its glyph would hang off the dial
// with no line to or from it — and fourteen is even, which lets the wheel start dead-top
// and straddle the horizontal on both sides.
//
// Sized to the outer ring in styles.css (`.title-seal-ring.is-outer`, 300px): RING is that
// ring's radius. The chords end ON the hairline, between its ticks; the glyphs sit just
// OUTSIDE it, like the labels on a dial, so a glyph turning past the wordmark's ends is
// beside the letters rather than under them.

const SIZE = 366;
const CENTRE = SIZE / 2;
const RING = 150;
const LABEL = 168;
const NODE_R = 13;
const GLYPH = 15;

const WHEEL_TYPES = TYPES.filter((t) => t !== 'Ancient');

const START_DEG = -90;
const STEP_DEG = 360 / WHEEL_TYPES.length;

function point(index: number, radius: number): readonly [number, number] {
  const a = ((START_DEG + index * STEP_DEG) * Math.PI) / 180;
  return [CENTRE + radius * Math.cos(a), CENTRE + radius * Math.sin(a)];
}

const NODES = WHEEL_TYPES.map((type, i) => ({
  type,
  color: getTypeColor(type),
  at: point(i, RING),
  label: point(i, LABEL),
}));

const CHORDS = WHEEL_TYPES.flatMap((attacker, a) =>
  WHEEL_TYPES.flatMap((defender, d) =>
    typeChart[attacker][defender] > 1 ? [{ id: `${attacker}-${defender}`, from: NODES[a], to: NODES[d] }] : [],
  ),
);

export function TitleTypeWheel() {
  return (
    // The wrapper is the fixed box the dial turns inside — the launch's lock spin and the
    // resting spin both land on the dial, and the wrapper is what positions it.
    <span className="title-seal-wheel" aria-hidden="true">
      <svg className="title-seal-dial" width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <defs>
          {CHORDS.map((c) => (
            <linearGradient
              key={c.id}
              id={`wheel-${c.id}`}
              gradientUnits="userSpaceOnUse"
              x1={c.from.at[0]}
              y1={c.from.at[1]}
              x2={c.to.at[0]}
              y2={c.to.at[1]}
            >
              <stop offset="0%" stopColor={c.from.color} stopOpacity="0.95" />
              <stop offset="100%" stopColor={c.from.color} stopOpacity="0.14" />
            </linearGradient>
          ))}
          {/* The web thins toward the middle so the wordmark sits on the core glow, not on a knot. */}
          <radialGradient id="wheel-clear" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.08" />
            <stop offset="40%" stopColor="#fff" stopOpacity="0.2" />
            <stop offset="78%" stopColor="#fff" stopOpacity="1" />
          </radialGradient>
          <mask id="wheel-centre-fade">
            <rect x="0" y="0" width={SIZE} height={SIZE} fill="url(#wheel-clear)" />
          </mask>
        </defs>

        <g className="title-seal-chords" mask="url(#wheel-centre-fade)" fill="none" strokeLinecap="round">
          {CHORDS.map((c) => (
            <line
              key={c.id}
              x1={c.from.at[0]}
              y1={c.from.at[1]}
              x2={c.to.at[0]}
              y2={c.to.at[1]}
              stroke={`url(#wheel-${c.id})`}
            />
          ))}
        </g>

        {NODES.map((n) => (
          <g key={n.type} transform={`translate(${n.label[0]} ${n.label[1]})`}>
            {/* The inner group carries the counter-spin, so the glyph stays upright while the
                dial turns under it. It has to be its own element: a CSS transform on the
                positioning group would replace the translate. */}
            <g className="title-seal-node" style={{ color: n.color }}>
              <circle r={NODE_R} />
              <svg x={-GLYPH / 2} y={-GLYPH / 2} width={GLYPH} height={GLYPH} viewBox="0 0 24 24" fill="currentColor">
                {ELEMENT_PATHS[n.type]}
              </svg>
            </g>
          </g>
        ))}
      </svg>
    </span>
  );
}
