import { useId, type CSSProperties } from 'react';
import { TYPES, typeChart } from '../../data/typechart';
import type { TypeId } from '../../engine/content';
import { ELEMENT_PATHS } from './elementIcons';
import { getTypeColor } from '../combat/typeColors';

// The type chart, drawn as a dial (docs/types-and-heroes.md). Fourteen glyphs sit round the
// ring in chart order, and every 2× cell is a chord from the attacker to the defender in the
// attacker's colour, fading toward the end it strikes — so the direction is in the line, not
// in an arrowhead the size would not carry. Resistances are not drawn: forty-one chords is a
// seal, eighty is a hairball. Ancient is left off: it strikes nothing for 2× and is only ever
// resisted, so its glyph would hang off the dial with no line to or from it — and fourteen is
// even, which lets the wheel start dead-top and straddle the horizontal on both sides.
//
// Born as the title seal's outer ring and now the one dial every seal in the game turns
// (docs/visual-language.md "The type wheel"): the title at rest, the Evolution as the chart
// collapsing into one colour, the recruit fanfare locking on the hero's own type, the act
// intro with the location's domains lit. The host owns every motion — this draws the dial and
// exposes three things for a host to animate against: a `--wheel-tint` layer (a second web of
// chords in one colour, `.is-tint`, off until the host fades it up), lit/dim classes off
// `focus`, and `--wheel-rest`, the angle a lock lands on to put `topType` at twelve o'clock.
// With `onPickType` the glyphs are buttons and the dial is the Compendium's chart.
//
// Geometry is in a fixed 366 box (RING is the title's outer ring's radius, 150) and scales
// with `size`: the chords end ON the hairline, between its ticks; the glyphs sit just OUTSIDE
// it, like the labels on a dial.

export const WHEEL_SIZE = 366;
const CENTRE = WHEEL_SIZE / 2;
const RING = 150;
const LABEL = 168;
const NODE_R = 13;
const GLYPH = 15;
/** The tap target under a pickable glyph — a thumb's worth, well past the drawn circle. */
const HIT_R = 22;

export const WHEEL_TYPES: readonly TypeId[] = TYPES.filter((t) => t !== 'Ancient');

const START_DEG = -90;
export const WHEEL_STEP_DEG = 360 / WHEEL_TYPES.length;

function point(index: number, radius: number): readonly [number, number] {
  const a = ((START_DEG + index * WHEEL_STEP_DEG) * Math.PI) / 180;
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
    typeChart[attacker][defender] > 1
      ? [{ id: `${attacker}-${defender}`, attacker, defender, from: NODES[a], to: NODES[d] }]
      : [],
  ),
);

/** The dial rotation that puts a type's glyph at the top. Ancient has no seat, so it reads as the rest position. */
export function wheelRestDeg(type: TypeId | undefined): number {
  const i = type ? WHEEL_TYPES.indexOf(type) : -1;
  return i < 0 ? 0 : -i * WHEEL_STEP_DEG;
}

interface Props {
  /** Rendered box in px; the geometry scales with it. Defaults to the title's. */
  size?: number;
  /** Types to light: their glyphs at full and the chords they strike along; the rest drop back. Unset lights everything. */
  focus?: readonly TypeId[];
  /** Also light the chords INTO a focused type — what strikes it, in the strikers' own colours. A reference wants both directions; a seal wants one. */
  focusIncoming?: boolean;
  /** Makes every glyph a button. The dial is inert without it. */
  onPickType?: (type: TypeId) => void;
  /** Thin the web toward the middle (the default): for a dial with something at its centre. A bare chart keeps its chords whole. */
  clearCentre?: boolean;
  /** Draw the hairline the chords end on. The title draws its own, with ticks. */
  ring?: boolean;
  /** The glyph a lock lands at twelve o'clock (`--wheel-rest`). */
  topType?: TypeId;
  className?: string;
  style?: CSSProperties;
}

export function TypeWheel({
  size = WHEEL_SIZE,
  focus,
  focusIncoming,
  topType,
  onPickType,
  clearCentre = true,
  ring = false,
  className,
  style,
}: Props) {
  // Two dials can share a screen (the act intro under a fanfare), and gradient ids are global.
  const uid = useId().replace(/:/g, '');
  const webMask = clearCentre ? `url(#${uid}-centre-fade)` : undefined;
  const lit = focus ? new Set<TypeId>(focus) : null;
  const litClass = (on: boolean) => (lit ? (on ? ' is-lit' : ' is-dim') : '');
  const chordLit = (attacker: TypeId, defender: TypeId) =>
    !!lit && (lit.has(attacker) || (!!focusIncoming && lit.has(defender)));

  return (
    // The wrapper is the fixed box the dial turns inside — a host's spin and lock land on the
    // dial and its nodes, and the wrapper is what positions it.
    <span
      className={`type-wheel${onPickType ? ' is-pickable' : ''}${className ? ` ${className}` : ''}`}
      aria-hidden={onPickType ? undefined : true}
      style={
        {
          '--wheel-size': `${size}px`,
          '--wheel-rest': `${wheelRestDeg(topType)}deg`,
          ...style,
        } as CSSProperties
      }
    >
      <svg className="type-wheel-dial" viewBox={`0 0 ${WHEEL_SIZE} ${WHEEL_SIZE}`}>
        <defs>
          {CHORDS.map((c) => (
            <linearGradient
              key={c.id}
              id={`${uid}-${c.id}`}
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
          {/* The tint web: the same chords in one colour — `currentColor`, which the dial reads
              off `--wheel-tint` — so a host can fade the chart into a hero's own colour. */}
          {CHORDS.map((c) => (
            <linearGradient
              key={`tint-${c.id}`}
              id={`${uid}-tint-${c.id}`}
              gradientUnits="userSpaceOnUse"
              x1={c.from.at[0]}
              y1={c.from.at[1]}
              x2={c.to.at[0]}
              y2={c.to.at[1]}
            >
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.95" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.14" />
            </linearGradient>
          ))}
          {/* The web thins toward the middle so whatever sits at the centre — the wordmark, the
              hero — sits on the core glow, not on a knot. */}
          <radialGradient id={`${uid}-clear`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.08" />
            <stop offset="40%" stopColor="#fff" stopOpacity="0.2" />
            <stop offset="78%" stopColor="#fff" stopOpacity="1" />
          </radialGradient>
          <mask id={`${uid}-centre-fade`}>
            <rect x="0" y="0" width={WHEEL_SIZE} height={WHEEL_SIZE} fill={`url(#${uid}-clear)`} />
          </mask>
        </defs>

        {ring && <circle className="type-wheel-ring" cx={CENTRE} cy={CENTRE} r={RING} fill="none" />}

        <g className="type-wheel-chords is-native" mask={webMask} fill="none" strokeLinecap="round">
          {CHORDS.map((c) => (
            <line
              key={c.id}
              className={`type-wheel-chord${litClass(chordLit(c.attacker, c.defender))}`}
              x1={c.from.at[0]}
              y1={c.from.at[1]}
              x2={c.to.at[0]}
              y2={c.to.at[1]}
              stroke={`url(#${uid}-${c.id})`}
            />
          ))}
        </g>
        <g className="type-wheel-chords is-tint" mask={webMask} fill="none" strokeLinecap="round">
          {CHORDS.map((c) => (
            <line
              key={c.id}
              className="type-wheel-chord"
              x1={c.from.at[0]}
              y1={c.from.at[1]}
              x2={c.to.at[0]}
              y2={c.to.at[1]}
              stroke={`url(#${uid}-tint-${c.id})`}
            />
          ))}
        </g>

        {NODES.map((n) => (
          <g key={n.type} transform={`translate(${n.label[0]} ${n.label[1]})`}>
            {/* The inner group carries the counter-spin, so the glyph stays upright while the
                dial turns under it. It has to be its own element: a CSS transform on the
                positioning group would replace the translate. The colour is a variable rather
                than `color` itself so a host's keyframe can carry it to the tint and back. */}
            <g
              className={`type-wheel-node${litClass(!!lit && lit.has(n.type))}`}
              style={{ '--node-color': n.color } as CSSProperties}
              role={onPickType ? 'button' : undefined}
              aria-label={onPickType ? n.type : undefined}
              onClick={onPickType ? () => onPickType(n.type) : undefined}
            >
              {onPickType && <circle className="type-wheel-hit" r={HIT_R} />}
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
