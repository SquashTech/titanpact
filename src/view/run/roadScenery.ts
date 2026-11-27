// The land beside the road (docs/road-map.md "Zones"): a Location climbs through its own places,
// bottom to top, each drawn from one kit of flat props and kept clear of the road.

export type ZoneKind = 'farm' | 'river' | 'woods' | 'meadow' | 'rocks';

/** Each Location's places from the camp up to the Guardian; a Location with none keeps plain trees. */
export const ROAD_ZONES: Record<string, readonly ZoneKind[]> = {
  wildsEdge: ['farm', 'river', 'woods', 'meadow', 'rocks'],
};

export interface SceneryStop {
  x: number;
  y: number;
}

export interface SceneryInput {
  W: number;
  H: number;
  topY: number;
  rowGap: number;
  rowY: (r: number) => number;
  /** Each row's stops, bottom row first. */
  rows: readonly (readonly SceneryStop[])[];
  camp: SceneryStop;
  /** Points along every road, which no prop may stand on. */
  roadPoints: readonly SceneryStop[];
  rnd: () => number;
}

/** SVG markup: what lies flat under the road, and what stands beside it (drawn over the road, sorted by foot). */
export interface Scenery {
  under: string;
  props: string;
}

const INK = '#2b2340';
const R = (w = 3) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const K = 1.35;

const shadow = (x: number, y: number, rx: number) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${rx * 0.32}" fill="${INK}" opacity="0.18"/>`;
const oak = (x: number, y: number, s0 = 1, tone = 0) => {
  const s = s0 * K;
  const c = tone ? '#4f9a3e' : '#5fae45';
  const hi = tone ? '#72bd55' : '#86cc5e';
  return (
    shadow(x, y + 2, 22 * s) +
    `<path d="M${x - 4 * s} ${y + 2} Q${x - 3 * s} ${y - 14 * s} ${x - 6 * s} ${y - 22 * s} L${x + 6 * s} ${y - 22 * s} Q${x + 3 * s} ${y - 14 * s} ${x + 4 * s} ${y + 2} Z" fill="#8a5a3a" ${R(2.4)}/>` +
    `<path d="M${x - 20 * s} ${y - 24 * s} C${x - 30 * s} ${y - 26 * s} ${x - 28 * s} ${y - 44 * s} ${x - 16 * s} ${y - 44 * s} C${x - 16 * s} ${y - 58 * s} ${x + 4 * s} ${y - 62 * s} ${x + 10 * s} ${y - 50 * s} C${x + 24 * s} ${y - 54 * s} ${x + 32 * s} ${y - 38 * s} ${x + 22 * s} ${y - 28 * s} C${x + 26 * s} ${y - 16 * s} ${x + 8 * s} ${y - 12 * s} ${x + 2 * s} ${y - 18 * s} C${x - 6 * s} ${y - 12 * s} ${x - 20 * s} ${y - 14 * s} ${x - 20 * s} ${y - 24 * s} Z" fill="${c}" ${R()}/>` +
    `<path d="M${x - 14 * s} ${y - 38 * s} C${x - 14 * s} ${y - 48 * s} ${x - 2 * s} ${y - 52 * s} ${x + 4 * s} ${y - 46 * s}" fill="none" stroke="${hi}" stroke-width="${5 * s}" stroke-linecap="round"/>` +
    `<circle cx="${x + 12 * s}" cy="${y - 30 * s}" r="${2.2 * s}" fill="${hi}"/><circle cx="${x - 8 * s}" cy="${y - 24 * s}" r="${1.8 * s}" fill="${hi}"/>`
  );
};
const pine = (x: number, y: number, s0 = 1, tone = 0) => {
  const s = s0 * K;
  const c = tone ? '#3f8a4a' : '#4c9a52';
  let out = shadow(x, y + 2, 14 * s) + `<rect x="${x - 3 * s}" y="${y - 8 * s}" width="${6 * s}" height="${10 * s}" rx="1.5" fill="#7a4f2c" ${R(2.2)}/>`;
  for (let k = 0; k < 3; k++) {
    const w = (17 - k * 4) * s;
    const top = y - (22 + k * 13) * s;
    const bot = y - (6 + k * 13) * s;
    out += `<path d="M${x} ${top - 8 * s} L${x + w} ${bot} Q${x} ${bot + 5 * s} ${x - w} ${bot} Z" fill="${c}" ${R()}/><path d="M${x - 2 * s} ${top - 2 * s} L${x - w * 0.55} ${bot - 2 * s}" stroke="#6cb866" stroke-width="${2.6 * s}" stroke-linecap="round"/>`;
  }
  return out;
};
const bush = (x: number, y: number, s0 = 1, berries = false) => {
  const s = s0 * K;
  return (
    shadow(x, y + 1, 14 * s) +
    `<path d="M${x - 15 * s} ${y} C${x - 20 * s} ${y - 10 * s} ${x - 10 * s} ${y - 17 * s} ${x - 4 * s} ${y - 12 * s} C${x - 2 * s} ${y - 21 * s} ${x + 12 * s} ${y - 19 * s} ${x + 10 * s} ${y - 9 * s} C${x + 18 * s} ${y - 10 * s} ${x + 19 * s} ${y} ${x + 13 * s} ${y} Z" fill="#62b24a" ${R(2.6)}/>` +
    `<path d="M${x - 9 * s} ${y - 9 * s} Q${x - 5 * s} ${y - 13 * s} ${x - 1 * s} ${y - 10 * s}" fill="none" stroke="#8ad166" stroke-width="${2.6 * s}" stroke-linecap="round"/>` +
    (berries ? [[-6, -5], [4, -9], [8, -3]].map(([dx, dy]) => `<circle cx="${x + dx * s}" cy="${y + dy * s}" r="${2 * s}" fill="#e8554a" stroke="${INK}" stroke-width="1.2"/>`).join('') : '')
  );
};
const rock = (x: number, y: number, s0 = 1) => {
  const s = s0 * K;
  return (
    shadow(x, y + 1, 12 * s) +
    `<path d="M${x - 12 * s} ${y} L${x - 10 * s} ${y - 9 * s} L${x - 3 * s} ${y - 14 * s} L${x + 7 * s} ${y - 12 * s} L${x + 12 * s} ${y - 4 * s} L${x + 11 * s} ${y} Z" fill="#b9b3c6" ${R(2.6)}/>` +
    `<path d="M${x - 6 * s} ${y - 9 * s} L${x - 1 * s} ${y - 11.5 * s}" stroke="#e2dded" stroke-width="${2.4 * s}" stroke-linecap="round"/>`
  );
};
const flowers = (x: number, y: number, n: number, seed: number) => {
  const cols = ['#ff8fb1', '#ffe066', '#fffaf0', '#c9a4ff'];
  let out = '';
  for (let i = 0; i < n; i++) {
    const a = (seed * 7 + i * 2.4) % 6.28;
    const d = 4 + ((i * 13 + seed) % 11);
    const fx = x + Math.cos(a) * d * 1.6;
    const fy = y + Math.sin(a) * d * 0.7;
    out += `<path d="M${fx} ${fy + 6} V${fy + 1}" stroke="#4f9a3e" stroke-width="1.6"/><circle cx="${fx}" cy="${fy}" r="3.4" fill="${cols[(i + seed) % 4]}" stroke="${INK}" stroke-width="1.4"/><circle cx="${fx}" cy="${fy}" r="1" fill="#ffb020"/>`;
  }
  return out;
};
const tuft = (x: number, y: number) =>
  `<path d="M${x - 6} ${y} Q${x - 4} ${y - 7} ${x - 1} ${y - 1} Q${x} ${y - 10} ${x + 2} ${y - 1} Q${x + 5} ${y - 6} ${x + 6} ${y}" fill="none" style="stroke:var(--road-ground-dark)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`;
const mushroom = (x: number, y: number) =>
  `<rect x="${x - 2.4}" y="${y - 8}" width="4.8" height="8" rx="1.5" fill="#fffaf0" ${R(1.6)}/><path d="M${x - 8} ${y - 7} Q${x} ${y - 19} ${x + 8} ${y - 7} Z" fill="#e8554a" ${R(1.8)}/><circle cx="${x - 2.4}" cy="${y - 12}" r="1.4" fill="#fff"/><circle cx="${x + 3.4}" cy="${y - 9.6}" r="1.1" fill="#fff"/>`;
const stump = (x: number, y: number) =>
  shadow(x, y + 1, 11) + `<path d="M${x - 10} ${y} V${y - 11} H${x + 10} V${y} Z" fill="#a0603a" ${R(2.4)}/><ellipse cx="${x}" cy="${y - 11}" rx="10" ry="4" fill="#e2b26a" ${R(2.4)}/><ellipse cx="${x}" cy="${y - 11}" rx="4.4" ry="1.6" fill="none" stroke="#a0603a" stroke-width="1.2"/>`;
const hay = (x: number, y: number) =>
  shadow(x, y + 1, 16) + `<path d="M${x - 16} ${y} Q${x - 17} ${y - 26} ${x} ${y - 28} Q${x + 17} ${y - 26} ${x + 16} ${y} Z" fill="#f0cf6a" ${R(2.6)}/><path d="M${x - 10} ${y - 9} Q${x} ${y - 14} ${x + 10} ${y - 9}" fill="none" stroke="#d9ac3f" stroke-width="2.4" stroke-linecap="round"/>`;
const fence = (x1: number, x2: number, y: number) => {
  let out = `<path d="M${x1} ${y - 13} H${x2} M${x1} ${y - 5} H${x2}" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><path d="M${x1} ${y - 13} H${x2} M${x1} ${y - 5} H${x2}" stroke="#c98a4a" stroke-width="2.6" stroke-linecap="round"/>`;
  const n = Math.max(1, Math.round((x2 - x1) / 22));
  for (let i = 0; i <= n; i++) out += `<rect x="${x1 + ((x2 - x1) * i) / n - 3}" y="${y - 19}" width="6" height="20" rx="1.5" fill="#b8743a" ${R(2.2)}/>`;
  return out;
};
const sign = (x: number, y: number) =>
  `<rect x="${x - 2.5}" y="${y - 28}" width="5" height="28" rx="1.5" fill="#a0603a" ${R(2)}/><path d="M${x - 17} ${y - 30} H${x + 12} L${x + 18} ${y - 24} L${x + 12} ${y - 18} H${x - 17} Z" fill="#e2b26a" ${R(2.4)}/><path d="M${x - 11} ${y - 24} H${x + 6}" stroke="#a0603a" stroke-width="1.6" stroke-linecap="round"/>`;
const wheat = (x: number, y: number, w: number, h: number) => {
  let out = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="#f0cf6a" ${R(3)}/>`;
  for (let yy = y + 10; yy < y + h - 5; yy += 11) out += `<path d="M${x + 9} ${yy} H${x + w - 9}" stroke="#d9ac3f" stroke-width="3" stroke-linecap="round" stroke-dasharray="1 7"/>`;
  return out;
};
const pond = (x: number, y: number, rx: number, ry: number) =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#5cb8f0" ${R()}/>` +
  `<ellipse cx="${x - rx * 0.25}" cy="${y - ry * 0.3}" rx="${rx * 0.35}" ry="${ry * 0.15}" fill="#a8defc"/>` +
  `<ellipse cx="${x + rx * 0.35}" cy="${y + ry * 0.25}" rx="6" ry="4" fill="#62b24a" ${R(1.6)}/>` +
  `<path d="M${x + rx * 0.35 - 2} ${y + ry * 0.1} q2 -4 5 -1" fill="none" stroke="#ff8fb1" stroke-width="2.6" stroke-linecap="round"/>`;
const river = (y: number, W: number) => {
  const d = `M-20 ${y} C${W * 0.15} ${y - 24} ${W * 0.3} ${y + 22} ${W / 2} ${y} C${W * 0.7} ${y - 22} ${W * 0.85} ${y + 24} ${W + 20} ${y}`;
  return (
    `<path d="${d}" fill="none" stroke="${INK}" stroke-width="42" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#5cb8f0" stroke-width="35" stroke-linecap="round"/>` +
    `<path d="${d}" fill="none" stroke="#a8defc" stroke-width="3" stroke-dasharray="10 26" stroke-linecap="round" transform="translate(0 -6)"/>`
  );
};
const riverY = (y: number, x: number, W: number) => {
  // The river's centre line at x (the same two cubic halves as `river`), close enough for the bridge.
  const t = x < W / 2 ? (x + 20) / (W / 2 + 20) : (x - W / 2) / (W / 2 + 20);
  const [c1, c2] = x < W / 2 ? [-24, 22] : [-22, 24];
  return y + 3 * (1 - t) * (1 - t) * t * c1 + 3 * (1 - t) * t * t * c2;
};
const bridge = (x: number, y: number) =>
  `<rect x="${x - 22}" y="${y - 28}" width="44" height="56" rx="3" fill="#c98a4a" ${R(3)}/>` +
  [-16, -6, 4, 14].map((dy) => `<path d="M${x - 22} ${y + dy} H${x + 22}" stroke="${INK}" stroke-width="1.6" opacity="0.4"/>`).join('') +
  `<path d="M${x - 25} ${y - 28} V${y + 28} M${x + 25} ${y - 28} V${y + 28}" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M${x - 25} ${y - 28} V${y + 28} M${x + 25} ${y - 28} V${y + 28}" stroke="#a0603a" stroke-width="3.4" stroke-linecap="round"/>`;
const blob = (x: number, y: number, rx: number, ry: number, tone: 'light' | 'mid' | 'pale') =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" style="fill:var(--road-ground-${tone === 'pale' ? 'light' : tone})" opacity="${tone === 'pale' ? 0.7 : 0.45}"/>`;

interface Placed {
  x: number;
  y: number;
  r: number;
}

export function buildScenery(zones: readonly ZoneKind[], input: SceneryInput): Scenery {
  const { W, H, topY, rowGap, rowY, rows, camp, roadPoints, rnd } = input;
  const R0 = rows.length;
  const taken: Placed[] = [...rows.flat().flatMap((s) => [{ x: s.x, y: s.y, r: 46 }, { x: s.x, y: s.y + 44, r: 30 }]), { x: camp.x, y: camp.y - 20, r: 56 }];
  const under: string[] = [];
  const props: [number, string][] = [];
  const clear = (x: number, y: number, r: number) =>
    x > r * 0.4 && x < W - r * 0.4 && [0, 1.2, 2.4].every((h) => roadPoints.every((p) => Math.hypot(p.x - x, p.y - (y - r * h)) > r + 18) && taken.every((t) => Math.hypot(t.x - x, t.y - (y - r * h)) > r + t.r));
  /** Scatter up to n props in [y0, y1], each tried a few times until it lands clear. */
  const scatter = (n: number, y0: number, y1: number, r: number, draw: (x: number, y: number) => string, edgeBias = 0) => {
    for (let i = 0, placed = 0; i < n * 14 && placed < n; i++) {
      let x = rnd() * W;
      if (edgeBias && rnd() < edgeBias) x = rnd() < 0.5 ? rnd() * 60 : W - rnd() * 60;
      const y = y0 + rnd() * (y1 - y0);
      if (!clear(x, y, r)) continue;
      taken.push({ x, y, r });
      props.push([y, draw(x, y)]);
      placed++;
    }
  };

  const n = zones.length;
  zones.forEach((kind, k) => {
    const r0 = Math.floor((k * R0) / n);
    const r1 = Math.floor(((k + 1) * R0) / n) - 1;
    const yBottom = k === 0 ? H : rowY(r0) + rowGap / 2;
    const yTop = k === n - 1 ? topY - 40 : rowY(r1) - rowGap / 2;
    const tone = () => (rnd() < 0.5 ? 1 : 0);
    switch (kind) {
      case 'farm': {
        for (const side of [0, 1]) {
          for (let i = 0; i < 16; i++) {
            const w = 84 + rnd() * 30;
            const h = 60 + rnd() * 22;
            const x = side ? W - w - 10 : 10;
            const y = rowY(r0) - 120 + rnd() * 200;
            const cx = x + w / 2;
            const cy = y + h / 2;
            const fits = roadPoints.every((p) => Math.abs(p.x - cx) > w / 2 + 18 || Math.abs(p.y - cy) > h / 2 + 18) && taken.every((t) => Math.abs(t.x - cx) > w / 2 + t.r || Math.abs(t.y - cy) > h / 2 + t.r);
            if (!fits) continue;
            under.push(wheat(x, y, w, h));
            taken.push({ x: cx, y: cy, r: Math.max(w, h) / 2 });
            break;
          }
        }
        scatter(3, yTop, yBottom, 20, hay);
        scatter(1, yTop, rowY(r0) + 40, 52, (x, y) => fence(x - 38, x + 38, y));
        scatter(1, yTop, rowY(r0) + 40, 34, (x, y) => sign(x, y));
        scatter(5, yTop, yBottom, 24, (x, y) => bush(x, y, 0.8, rnd() < 0.5), 0.6);
        scatter(4, yTop, yBottom, 30, (x, y) => oak(x, y, 0.8, tone()), 0.8);
        scatter(3, yTop, yBottom, 16, (x, y) => flowers(x, y, 5, Math.floor(rnd() * 9)));
        break;
      }
      case 'river': {
        // Across the trunk above a single-lane row, where one bridge carries the only road.
        const r = [...Array(r1 - r0 + 1).keys()].map((i) => r0 + i).find((rr) => rows[rr].length === 1 && rr + 1 < R0) ?? r0;
        const x = rows[r][0].x;
        const y = rowY(r) - rowGap * 0.34;
        const cy = riverY(y, x, W);
        under.push(river(y + (y - cy), W));
        props.push([y - 30, bridge(x, y)]);
        taken.push({ x: W / 2, y, r: 0 });
        for (let xx = 0; xx <= W; xx += 30) taken.push({ x: xx, y: riverY(y + (y - cy), xx, W), r: 24 });
        scatter(5, yTop, yBottom, 22, (px, py) => bush(px, py, 0.8, rnd() < 0.3), 0.5);
        scatter(3, yTop, yBottom, 30, (px, py) => oak(px, py, 0.85, tone()), 0.8);
        scatter(3, yTop, yBottom, 16, (px, py) => rock(px, py, 0.7));
        break;
      }
      case 'woods': {
        under.push(blob(30, (yTop + yBottom) / 2, 70, (yBottom - yTop) / 2, 'mid'), blob(W - 30, (yTop + yBottom) / 2, 70, (yBottom - yTop) / 2, 'mid'));
        scatter(Math.round((yBottom - yTop) / 30), yTop, yBottom, 22, (x, y) => pine(x, y, 0.85 + rnd() * 0.3, tone()), 0.7);
        scatter(3, yTop, yBottom, 12, mushroom);
        scatter(2, yTop, yBottom, 14, stump);
        break;
      }
      case 'meadow': {
        const loop = [...Array(r1 - r0 + 1).keys()].map((i) => r0 + i).find((rr) => rows[rr].length === 2);
        if (loop !== undefined) {
          const y = rowY(loop);
          under.push(blob(W / 2, y, 140, 80, 'light'), pond(W / 2, y, 30, 20));
          taken.push({ x: W / 2, y, r: 34 });
        }
        scatter(6, yTop, yBottom, 16, (x, y) => flowers(x, y, 5, Math.floor(rnd() * 9)));
        scatter(4, yTop, yBottom, 30, (x, y) => oak(x, y, 0.85 + rnd() * 0.2, tone()), 0.8);
        scatter(4, yTop, yBottom, 22, (x, y) => bush(x, y, 0.8, rnd() < 0.4), 0.5);
        break;
      }
      case 'rocks': {
        under.push(blob(W / 2, yTop + 40, 260, 110, 'pale'));
        scatter(7, yTop, yBottom, 18, (x, y) => rock(x, y, 0.7 + rnd() * 0.6));
        scatter(6, yTop, yBottom, 8, tuft);
        scatter(2, yTop + 60, yBottom, 24, (x, y) => bush(x, y, 0.7), 0.8);
        break;
      }
    }
    scatter(4, yTop, yBottom, 8, tuft);
  });

  return { under: under.join(''), props: props.sort((a, b) => a[0] - b[0]).map((p) => p[1]).join('') };
}
