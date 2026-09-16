// The generated-figure vocabulary the Titanspawn (titanspawnArt.tsx) and the Guardians
// (guardianFigures.ts) draw with: three tones of one hue, flat primitives built as markup
// strings, and the Titan's eye — the one thing on every body that is not type-coloured. Lifted
// verbatim from the approved gallery (docs/art/titanspawn-bestiary.html). Pure: no React, no DOM,
// so a script can render a figure to a file.

export type FigurePose = 'idle' | 'attack' | 'hurt';

export interface Pal {
  c: string;
  d: string;
  dd: string;
  l: string;
  ll: string;
}

export type EyeState = 'open' | 'narrow' | 'wide' | 'stare';
export type Eye = (x: number, y: number, r: number, state?: EyeState) => string;

// ---------- palette ----------
function hex(c: string): number[] {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function mix(a: string, t: number, b: string): string {
  const A = hex(a), B = hex(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
export function pal(c: string): Pal {
  return { c, d: mix(c, 0.36, '#000000'), dd: mix(c, 0.6, '#07050a'), l: mix(c, 0.32, '#ffffff'), ll: mix(c, 0.62, '#ffffff') };
}

// ---------- primitives ----------
export const P = (pts: string, f: string, extra = '') => `<polygon points="${pts}" fill="${f}" ${extra}/>`;
export const C = (x: number, y: number, r: number, f: string, extra = '') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${f}" ${extra}/>`;
export const E = (x: number, y: number, rx: number, ry: number, f: string, extra = '') => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${f}" ${extra}/>`;
export const R = (x: number, y: number, w: number, h: number, f: string, rx = 0, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${f}" ${extra}/>`;
export const D = (d: string, f: string, extra = '') => `<path d="${d}" fill="${f}" ${extra}/>`;
export const L = (d: string, s: string, w = 1.5, extra = '') => `<path d="${d}" fill="none" stroke="${s}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
export const G = (t: string, inner: string) => `<g transform="${t}">${inner}</g>`;

/** The eye's fill: gold burning to the mythic red (TitanWakeScreen's). Defined once per figure. */
export const EYE_GRADIENT = (id: string) =>
  `<defs><radialGradient id="${id}" cx="50%" cy="50%" r="55%"><stop offset="0" stop-color="#f6dc96"/><stop offset=".42" stop-color="#e9a24e"/><stop offset=".78" stop-color="#e0393f"/><stop offset="1" stop-color="#6e1a20"/></radialGradient></defs>`;

/** The Titan's eye: vertical slit pupil, horizontal lids. `uid` keeps clip paths unique across every figure on a screen. */
export function makeEye(uid: string, gradientId: string): Eye {
  let n = 0;
  return (x, y, r, state = 'open') => {
    const id = `${uid}c${n++}`;
    const k = state === 'narrow' ? 0.3 : state === 'wide' ? 1.0 : state === 'stare' ? 0.52 : 0.72;
    const rr = state === 'wide' ? r * 1.08 : r;
    const halo = state === 'wide' ? C(x, y, rr * 1.9, '#e0393f', 'opacity=".28" class="halo"') : state === 'stare' ? C(x, y, rr * 1.7, '#e0393f', 'opacity=".14"') : '';
    return `<defs><clipPath id="${id}"><ellipse cx="${x}" cy="${y}" rx="${rr}" ry="${rr * k}"/></clipPath></defs>${halo}
  <g clip-path="url(#${id})">${C(x, y, rr, `url(#${gradientId})`)}${E(x, y, rr * 0.2, rr * 0.95, '#07050a')}</g>
  ${E(x, y, rr, rr * k, 'none', `stroke="#07050a" stroke-width="${Math.max(0.6, r * 0.09)}" opacity=".55"`)}`;
  };
}

/** Impact ticks on the struck side. */
export const ticks = (x: number, y: number) =>
  [[-25, -18], [10, -30], [28, -8]].map(([a, b]) => L(`M${x + a * 0.55},${y + b * 0.55} L${x + a},${y + b}`, '#fff', 1.6, 'opacity=".85"')).join('');

/** Spark scatter for attacks. */
export const sparks = (x: number, y: number, f: string, n = 4, s = 1) =>
  Array.from({ length: n }, (_, i) => C(x + [10, 18, 24, 14, 28][i % 5] * s, y + [-12, -4, -18, 6, 2][i % 5] * s, 1.4, f)).join('');
