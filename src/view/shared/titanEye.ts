// The Titan's eye as markup: a vertical slit in its magenta, horizontal lids. Pure, so a script
// can render it to a file.

export type EyeState = 'open' | 'narrow' | 'wide' | 'stare';
export type Eye = (x: number, y: number, r: number, state?: EyeState) => string;

/** The Titan's light, as the Threshold paints its eyes. */
export const TITAN_EYE = '#f247dc';

const C = (x: number, y: number, r: number, f: string, extra = '') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${f}" ${extra}/>`;
const E = (x: number, y: number, rx: number, ry: number, f: string, extra = '') => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${f}" ${extra}/>`;

export const EYE_GRADIENT = (id: string) =>
  `<defs><radialGradient id="${id}" cx="50%" cy="50%" r="55%"><stop offset="0" stop-color="#ffd6f6"/><stop offset=".42" stop-color="#f247dc"/><stop offset=".78" stop-color="#b02a9e"/><stop offset="1" stop-color="#4a1048"/></radialGradient></defs>`;

/** `uid` keeps clip paths unique across every eye on a screen. */
export function makeEye(uid: string, gradientId: string): Eye {
  let n = 0;
  return (x, y, r, state = 'open') => {
    const id = `${uid}c${n++}`;
    const k = state === 'narrow' ? 0.3 : state === 'wide' ? 1.0 : state === 'stare' ? 0.52 : 0.72;
    const rr = state === 'wide' ? r * 1.08 : r;
    const halo = state === 'wide' ? C(x, y, rr * 1.9, TITAN_EYE, 'opacity=".28" class="halo"') : state === 'stare' ? C(x, y, rr * 1.7, TITAN_EYE, 'opacity=".14"') : '';
    return `<defs><clipPath id="${id}"><ellipse cx="${x}" cy="${y}" rx="${rr}" ry="${rr * k}"/></clipPath></defs>${halo}
  <g clip-path="url(#${id})">${C(x, y, rr, `url(#${gradientId})`)}${E(x, y, rr * 0.2, rr * 0.95, '#07050a')}</g>
  ${E(x, y, rr, rr * k, 'none', `stroke="#07050a" stroke-width="${Math.max(0.6, r * 0.09)}" opacity=".55"`)}`;
  };
}
