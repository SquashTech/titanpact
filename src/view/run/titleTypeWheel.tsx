import { TYPES, typeChart } from '../../data/typechart';
import { ELEMENT_PATHS } from '../shared/elementIcons';
import { getTypeColor } from '../combat/typeColors';

// The type chart, drawn as the seal's outer dial (docs/types-and-heroes.md). The fifteen
// glyphs sit on the ring in chart order, and every 2× cell is a chord from the attacker to
// the defender in the attacker's colour, fading toward the end it strikes — so the direction
// is in the line, not in an arrowhead the size would not carry. Resistances are not drawn:
// forty-one chords is a seal, eighty is a hairball.
//
// Sized to the outer ring in styles.css (`.title-seal-ring.is-outer`, 300px): RING is that
// ring's radius. The chords end ON the hairline, between its ticks; the glyphs sit just
// OUTSIDE it, like the labels on a dial. Outside, because fifteen is odd — wherever the
// wheel is turned, one side has a glyph within a few degrees of the horizontal, and on the
// ring that glyph is under the wordmark's first or last letter.

const SIZE = 364;
const CENTRE = SIZE / 2;
const RING = 150;
const LABEL = 168;
const NODE_R = 11;
const GLYPH = 12;

/** 6° off the vertical so the wheel is never mirror-symmetric about the wordmark. */
const START_DEG = -84;
const STEP_DEG = 360 / TYPES.length;

function point(index: number, radius: number): readonly [number, number] {
  const a = ((START_DEG + index * STEP_DEG) * Math.PI) / 180;
  return [CENTRE + radius * Math.cos(a), CENTRE + radius * Math.sin(a)];
}

const NODES = TYPES.map((type, i) => ({
  type,
  color: getTypeColor(type),
  at: point(i, RING),
  label: point(i, LABEL),
}));

const CHORDS = TYPES.flatMap((attacker, a) =>
  TYPES.flatMap((defender, d) =>
    typeChart[attacker][defender] > 1 ? [{ id: `${attacker}-${defender}`, from: NODES[a], to: NODES[d] }] : [],
  ),
);

export function TitleTypeWheel() {
  return (
    // The wrapper carries the fade below the wordmark and does not turn; the dial inside it
    // does. A mask on the turning element would turn with it.
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
