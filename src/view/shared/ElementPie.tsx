import type { CSSProperties } from 'react';
import { ELEMENT_PATHS } from './elementIcons';
import { getTypeColor } from '../combat/typeColors';

/**
 * A disc divided by type, one wedge per type in field order, each wearing its element in its own
 * colour: what a recruitable encounter tile IS since 2026-09-13 (per user direction), in place of
 * the helm with a row of marks under it. The helm said "heroes", which every Skirmish is; the
 * wedges say WHICH, which is the read bring-6-pick-4 needs. One type fills the disc; two split it;
 * more fan out from the centre. Drawn in the caller's box (`inset: 0`), so it takes the size the
 * tier gives the tile.
 */
const R = 44;
const RIM = 43;

function point(angle: number, radius: number): [number, number] {
  return [R + Math.cos(angle) * radius, R + Math.sin(angle) * radius];
}

function fmt(n: number): string {
  return n.toFixed(2);
}

/** The glyph's distance from the centre and its size, by how many wedges share the disc. */
function glyphLayout(count: number): { radius: number; size: number } {
  if (count <= 1) return { radius: 0, size: 40 };
  if (count === 2) return { radius: 19, size: 26 };
  if (count === 3) return { radius: 21, size: 22 };
  return { radius: 23, size: 19 };
}

export function ElementPie({ types, className }: { types: readonly string[]; className?: string }) {
  const count = types.length;
  if (count === 0) return null;
  const { radius, size } = glyphLayout(count);
  const step = (Math.PI * 2) / count;
  const start = -Math.PI / 2;
  return (
    <svg className={`element-pie${className ? ` ${className}` : ''}`} viewBox={`0 0 ${R * 2} ${R * 2}`} aria-hidden="true" focusable="false">
      {types.map((type, i) => {
        const color = getTypeColor(type);
        const a0 = start + step * i;
        const a1 = a0 + step;
        const [x0, y0] = point(a0, RIM);
        const [x1, y1] = point(a1, RIM);
        const mid = a0 + step / 2;
        const [gx, gy] = point(mid, radius);
        const scale = size / 24;
        return (
          <g key={type} style={{ color } as CSSProperties}>
            {count === 1 ? (
              <circle className="element-pie-wedge" cx={R} cy={R} r={RIM} fill={color} />
            ) : (
              <path
                className="element-pie-wedge"
                d={`M${R} ${R}L${fmt(x0)} ${fmt(y0)}A${RIM} ${RIM} 0 ${step > Math.PI ? 1 : 0} 1 ${fmt(x1)} ${fmt(y1)}Z`}
                fill={color}
              />
            )}
            <g className="element-pie-glyph" transform={`translate(${fmt(gx - 12 * scale)} ${fmt(gy - 12 * scale)}) scale(${fmt(scale)})`} fill="currentColor">
              {ELEMENT_PATHS[type]}
            </g>
          </g>
        );
      })}
      {/* The seams, over every wedge so a glyph never crosses one. */}
      {count > 1 &&
        types.map((type, i) => {
          const [x, y] = point(start + step * i, RIM);
          return <path key={type} className="element-pie-seam" d={`M${R} ${R}L${fmt(x)} ${fmt(y)}`} />;
        })}
    </svg>
  );
}
