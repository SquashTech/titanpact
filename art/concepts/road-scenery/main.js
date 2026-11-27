import paint from '../../locations/map/wildsEdge.png';
import tower from '../../map-nodes/landmarks/guardianTower.svg';
import camp from '../../map-nodes/landmarks/camp.svg';

const ICONS = Object.fromEntries(
  Object.entries(import.meta.glob('../../map-nodes/flat/*.svg', { eager: true, query: '?url', import: 'default' })).map(([p, u]) => [p.slice(p.lastIndexOf('/') + 1, -4), u])
);

const INK = '#2b2340';
const G = { base: '#8fcf63', dark: '#5ea343', mid: '#73b852', light: '#aee083', pale: '#c6eb9f' };
const R = (w = 3) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;

// ---- the act: rows bottom to top, stop icons
const TOWER_Y = 300;
const ROWS = [
  { y: 1190, icons: ['battle'] },
  { y: 1010, icons: ['equipmentReward', 'passiveReward', 'restReward'] },
  { y: 830, icons: ['scrollReward'] },
  { y: 650, icons: ['elite', 'skirmish'] },
  { y: 470, icons: ['recruitReward'] },
];
const LANES = { 1: [197], 2: [117, 277], 3: [73, 197, 321] };
const CAMP = { x: 197, y: 1330 };
const stopsOf = (r) => r.icons.map((icon, i) => ({ x: LANES[r.icons.length][i], y: r.y, icon }));
const ALL = [[CAMP], ...ROWS.map(stopsOf), [{ x: 197, y: TOWER_Y + 10 }]];

function roadPaths() {
  const out = [];
  const curve = (x1, y1, x2, y2) => `M${x1} ${y1} C${x1} ${(y1 + y2) / 2} ${x2} ${(y1 + y2) / 2} ${x2} ${y2}`;
  for (let i = 0; i < ALL.length - 1; i++) {
    const a = ALL[i], b = ALL[i + 1];
    const j = { x: a.length === 1 ? a[0].x : b.length === 1 ? b[0].x : 197, y: (a[0].y + b[0].y) / 2 };
    for (const s of a) out.push(curve(s.x, s.y, j.x, j.y));
    for (const s of b) out.push(curve(j.x, j.y, s.x, s.y));
  }
  return out;
}
const road = () => {
  const ps = roadPaths();
  return (
    ps.map((d) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="32" stroke-linecap="round"/>`).join('') +
    ps.map((d) => `<path d="${d}" fill="none" stroke="#f6e6bd" stroke-width="25" stroke-linecap="round"/>`).join('') +
    ps.map((d) => `<path d="${d}" fill="none" stroke="#e2c88c" stroke-width="4" stroke-dasharray="2 14" stroke-linecap="round"/>`).join('')
  );
};

// ---- props
const shadow = (x, y, rx) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${rx * 0.32}" fill="${INK}" opacity="0.18"/>`;
const orb = (x, y, r, t) =>
  shadow(x, y + r * 0.95, r * 0.9) +
  `<rect x="${x - 3}" y="${y + r * 0.3}" width="6" height="${r * 0.7}" rx="2" fill="#8a5a3a" ${R(2)}/>` +
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${t > 0.5 ? G.dark : G.mid}" ${R()}/><circle cx="${x - r * 0.3}" cy="${y - r * 0.35}" r="${r * 0.35}" fill="${G.base}"/>`;
const K = 1.35;
const oak = (x, y, s = 1, tone = 0) => {
  s *= K;
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
const pine = (x, y, s = 1, tone = 0) => {
  s *= K;
  const c = tone ? '#3f8a4a' : '#4c9a52';
  const hi = '#6cb866';
  return (
    shadow(x, y + 2, 14 * s) +
    `<rect x="${x - 3 * s}" y="${y - 8 * s}" width="${6 * s}" height="${10 * s}" rx="1.5" fill="#7a4f2c" ${R(2.2)}/>` +
    [0, 1, 2]
      .map((k) => {
        const w = (17 - k * 4) * s;
        const top = y - (22 + k * 13) * s;
        const bot = y - (6 + k * 13) * s;
        return `<path d="M${x} ${top - 8 * s} L${x + w} ${bot} Q${x} ${bot + 5 * s} ${x - w} ${bot} Z" fill="${c}" ${R()}/><path d="M${x - 2 * s} ${top - 2 * s} L${x - w * 0.55} ${bot - 2 * s}" stroke="${hi}" stroke-width="${2.6 * s}" stroke-linecap="round"/>`;
      })
      .join('')
  );
};
const bush = (x, y, s0 = 1, berries = false, s = s0 * K) =>
  shadow(x, y + 1, 14 * s) +
  `<path d="M${x - 15 * s} ${y} C${x - 20 * s} ${y - 10 * s} ${x - 10 * s} ${y - 17 * s} ${x - 4 * s} ${y - 12 * s} C${x - 2 * s} ${y - 21 * s} ${x + 12 * s} ${y - 19 * s} ${x + 10 * s} ${y - 9 * s} C${x + 18 * s} ${y - 10 * s} ${x + 19 * s} ${y} ${x + 13 * s} ${y} Z" fill="#62b24a" ${R(2.6)}/>` +
  `<path d="M${x - 9 * s} ${y - 9 * s} Q${x - 5 * s} ${y - 13 * s} ${x - 1 * s} ${y - 10 * s}" fill="none" stroke="#8ad166" stroke-width="${2.6 * s}" stroke-linecap="round"/>` +
  (berries ? [[-6, -5], [4, -9], [8, -3]].map(([dx, dy]) => `<circle cx="${x + dx * s}" cy="${y + dy * s}" r="${2 * s}" fill="#e8554a" stroke="${INK}" stroke-width="1.2"/>`).join('') : '');
const rock = (x, y, s0 = 1, s = s0 * K) =>
  shadow(x, y + 1, 12 * s) +
  `<path d="M${x - 12 * s} ${y} L${x - 10 * s} ${y - 9 * s} L${x - 3 * s} ${y - 14 * s} L${x + 7 * s} ${y - 12 * s} L${x + 12 * s} ${y - 4 * s} L${x + 11 * s} ${y} Z" fill="#b9b3c6" ${R(2.6)}/>` +
  `<path d="M${x - 6 * s} ${y - 9 * s} L${x - 1 * s} ${y - 11.5 * s}" stroke="#e2dded" stroke-width="${2.4 * s}" stroke-linecap="round"/>`;
const flowers = (x, y, n = 5, seed = 1) => {
  let out = '';
  const cols = ['#ff8fb1', '#ffe066', '#fffaf0', '#c9a4ff'];
  for (let i = 0; i < n; i++) {
    const a = (seed * 7 + i * 2.4) % 6.28;
    const d = 4 + ((i * 13 + seed) % 11);
    const fx = x + Math.cos(a) * d * 1.6, fy = y + Math.sin(a) * d * 0.7;
    out += `<path d="M${fx} ${fy + 6} V${fy + 1}" stroke="#4f9a3e" stroke-width="1.6"/><circle cx="${fx}" cy="${fy}" r="3.2" fill="${cols[(i + seed) % 4]}" stroke="${INK}" stroke-width="1.4"/><circle cx="${fx}" cy="${fy}" r="1" fill="#ffb020"/>`;
  }
  return out;
};
const tuft = (x, y, s = 1) => `<path d="M${x - 6 * s} ${y} Q${x - 4 * s} ${y - 7 * s} ${x - 1 * s} ${y - 1} Q${x} ${y - 10 * s} ${x + 2 * s} ${y - 1} Q${x + 5 * s} ${y - 6 * s} ${x + 6 * s} ${y}" fill="none" stroke="${G.dark}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`;
const mushroom = (x, y) =>
  `<rect x="${x - 2}" y="${y - 7}" width="4" height="7" rx="1.5" fill="#fffaf0" ${R(1.6)}/><path d="M${x - 7} ${y - 6} Q${x} ${y - 16} ${x + 7} ${y - 6} Z" fill="#e8554a" ${R(1.8)}/><circle cx="${x - 2}" cy="${y - 10}" r="1.2" fill="#fff"/><circle cx="${x + 3}" cy="${y - 8}" r="1" fill="#fff"/>`;
const fence = (x1, x2, y) => {
  let out = `<path d="M${x1} ${y - 12} H${x2} M${x1} ${y - 5} H${x2}" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><path d="M${x1} ${y - 12} H${x2} M${x1} ${y - 5} H${x2}" stroke="#c98a4a" stroke-width="2.6" stroke-linecap="round"/>`;
  for (let x = x1; x <= x2 + 0.1; x += (x2 - x1) / Math.max(1, Math.round((x2 - x1) / 22))) out += `<rect x="${x - 3}" y="${y - 18}" width="6" height="19" rx="1.5" fill="#b8743a" ${R(2.2)}/>`;
  return out;
};
const pond = (x, y, rx, ry) =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx + 4}" ry="${ry + 3}" fill="${G.dark}" opacity="0.35"/>` +
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#5cb8f0" ${R()}/>` +
  `<ellipse cx="${x - rx * 0.25}" cy="${y - ry * 0.3}" rx="${rx * 0.35}" ry="${ry * 0.15}" fill="#a8defc"/>` +
  `<path d="M${x + rx * 0.3} ${y + ry * 0.2} a6 4 0 1 0 0.1 0 Z" fill="#62b24a" ${R(1.6)}/>` +
  `<path d="M${x + rx * 0.35 - 3} ${y + ry * 0.05} q2 -4 5 -1" fill="none" stroke="#ff8fb1" stroke-width="2.6" stroke-linecap="round"/>` +
  `<path d="M${x - rx * 0.55} ${y + ry * 0.35} h8 M${x + rx * 0.05} ${y - ry * 0.55} h6" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="0.8"/>`;
const river = (y) => {
  const d = `M-20 ${y} C60 ${y - 26} 120 ${y + 22} 197 ${y} C270 ${y - 22} 330 ${y + 26} 420 ${y}`;
  return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="40" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#5cb8f0" stroke-width="33" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#a8defc" stroke-width="3" stroke-dasharray="10 26" stroke-linecap="round" transform="translate(0 -6)"/>`;
};
const bridge = (x, y) =>
  `<rect x="${x - 22}" y="${y - 26}" width="44" height="52" rx="3" fill="#c98a4a" ${R(3)}/>` +
  [-14, -5, 4, 13].map((dy) => `<path d="M${x - 22} ${y + dy} H${x + 22}" stroke="${INK}" stroke-width="1.6" opacity="0.4"/>`).join('') +
  `<path d="M${x - 24} ${y - 26} V${y + 26} M${x + 24} ${y - 26} V${y + 26}" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M${x - 24} ${y - 26} V${y + 26} M${x + 24} ${y - 26} V${y + 26}" stroke="#a0603a" stroke-width="3.4" stroke-linecap="round"/>`;
const wheat = (x, y, w, h) => {
  let out = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="#f0cf6a" ${R(3)}/>`;
  for (let yy = y + 9; yy < y + h - 4; yy += 10) out += `<path d="M${x + 8} ${yy} H${x + w - 8}" stroke="#d9ac3f" stroke-width="3" stroke-linecap="round" stroke-dasharray="1 7"/>`;
  return out;
};
const hay = (x, y) => shadow(x, y + 1, 14) + `<path d="M${x - 14} ${y} Q${x - 15} ${y - 22} ${x} ${y - 24} Q${x + 15} ${y - 22} ${x + 14} ${y} Z" fill="#f0cf6a" ${R(2.6)}/><path d="M${x - 9} ${y - 8} Q${x} ${y - 12} ${x + 9} ${y - 8}" fill="none" stroke="#d9ac3f" stroke-width="2.4" stroke-linecap="round"/>`;
const sign = (x, y) =>
  `<rect x="${x - 2.5}" y="${y - 26}" width="5" height="26" rx="1.5" fill="#a0603a" ${R(2)}/><path d="M${x - 16} ${y - 28} H${x + 12} L${x + 18} ${y - 22} L${x + 12} ${y - 16} H${x - 16} Z" fill="#e2b26a" ${R(2.4)}/><path d="M${x - 10} ${y - 22} H${x + 6}" stroke="#a0603a" stroke-width="1.6" stroke-linecap="round"/>`;
const stump = (x, y) => shadow(x, y + 1, 10) + `<path d="M${x - 9} ${y} V${y - 10} H${x + 9} V${y} Z" fill="#a0603a" ${R(2.4)}/><ellipse cx="${x}" cy="${y - 10}" rx="9" ry="3.6" fill="#e2b26a" ${R(2.4)}/><ellipse cx="${x}" cy="${y - 10}" rx="4" ry="1.4" fill="none" stroke="#a0603a" stroke-width="1.2"/>`;
const hill = (x, y, rx, ry, fill) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}"/>`;

// ---- a phone
function ground(features) {
  return (
    `<defs><linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${G.base}" stop-opacity="0"/><stop offset="1" stop-color="${G.base}"/></linearGradient></defs>` +
    `<rect x="0" y="330" width="394" height="70" fill="url(#fade)"/><rect x="0" y="399" width="394" height="1001" fill="${G.base}"/>` +
    features
  );
}
function phone(title, note, under, over) {
  const stops = ROWS.flatMap(stopsOf)
    .map((s) => `<div class="stop" style="left:${s.x}px;top:${s.y}px"><img src="${ICONS[s.icon]}"></div>`)
    .join('');
  return `<div class="phone"><h2>${title}</h2><p>${note}</p><div class="frame"><img class="paint" src="${paint}">
    <svg width="394" height="1400" viewBox="0 0 394 1400">${ground(under)}${road()}${over}</svg>
    <img class="tower" src="${tower}" style="left:197px;top:${TOWER_Y}px">
    <img class="camp" src="${camp}" style="left:${CAMP.x}px;top:${CAMP.y}px">${stops}</div></div>`;
}
const byY = (items) => items.sort((a, b) => a[0] - b[0]).map((i) => i[1]).join('');

// Now: the orbs, as the game draws them.
const NOW_TREES = [[30, 520, 18, 0.2], [362, 560, 20, 0.7], [44, 760, 15, 0.6], [350, 790, 19, 0.3], [28, 900, 21, 0.8], [197, 720, 17, 0.4], [360, 1100, 16, 0.6], [40, 1180, 20, 0.2], [340, 1250, 18, 0.9], [130, 1100, 14, 0.5], [270, 1240, 15, 0.1], [197, 940, 13, 0.7]];
const now = phone(
  'Now',
  'Round trees in the ground colour, a few flecks.',
  [[1, 1], [0, 0]].map(() => '').join('') + hill(70, 620, 170, 70, G.light) + hill(330, 980, 170, 70, G.light),
  byY(NOW_TREES.map(([x, y, r, t]) => [y, orb(x, y, r, t)]))
);

// A · Props: one kit of flat props, clustered into groves and edges.
const PROPS = [
  [500, oak(26, 500, 0.9)], [528, pine(366, 528, 1)], [560, bush(330, 560, 0.9, true)], [470, rock(300, 470, 0.8)],
  [700, oak(197, 700, 0.75, 1)], [688, flowers(160, 676, 5, 2)], [610, mushroom(232, 610)],
  [760, pine(30, 760, 1.1, 1)], [790, pine(58, 790, 0.85)], [740, oak(368, 740, 0.95)], [810, bush(340, 810, 0.8)],
  [870, rock(46, 870, 1)], [880, tuft(80, 880)], [900, oak(352, 900, 0.85, 1)],
  [950, bush(135, 958, 0.7)], [1060, flowers(259, 1050, 5, 4)], [940, mushroom(262, 945)], [1062, rock(140, 1066, 0.7)],
  [1110, oak(30, 1110, 1)], [1130, pine(364, 1130, 1)], [1150, bush(330, 1158, 0.8, true)], [1160, stump(80, 1160)],
  [1260, oak(350, 1270, 0.9, 1)], [1300, bush(60, 1300, 1)], [1240, fence(250, 330, 1240)], [1240, flowers(110, 1236, 6, 6)],
  [496, oak(56, 520, 0.7, 1)], [470, pine(368, 470, 0.8, 1)], [575, pine(350, 590, 0.75)], [820, pine(370, 830, 0.8, 1)], [745, bush(48, 745, 0.7)], [1100, pine(56, 1120, 0.8, 1)], [1090, oak(360, 1080, 0.7)], [1280, oak(28, 1280, 0.8)], [1330, pine(366, 1330, 0.9, 1)], [1350, bush(110, 1360, 0.8)], [900, pine(22, 930, 0.8)], [660, oak(370, 660, 0.7, 1)],
  [420, tuft(120, 430)], [640, tuft(40, 640)], [980, tuft(30, 990)], [1210, tuft(150, 1206)], [1350, tuft(300, 1350)],
];
const props = phone(
  'A · Props',
  'One kit of drawn props (oaks, pines, bushes, rocks, flowers, a fence) in groves at the edges and inside the loops.',
  hill(70, 620, 170, 70, G.light) + hill(330, 980, 170, 70, G.light),
  byY(PROPS)
);

// B · Zones: the same kit, but the act climbs through places — farm, river, wood, meadow, the tower's hill.
const ZONES_UNDER =
  hill(197, 400, 260, 90, G.pale) +
  wheat(18, 1220, 110, 70) + wheat(270, 1250, 108, 60) +
  river(1110) +
  hill(197, 650, 150, 90, G.light) + pond(197, 650, 46, 26) +
  [[30, 830], [364, 830], [30, 970], [364, 980]].map(([x, y]) => hill(x, y, 60, 80, G.mid)).join('');
const ZONES = [
  [1110, bridge(197, 1110)],
  [1300, hay(120, 1310)], [1300, fence(250, 330, 1300)], [1330, sign(260, 1350)], [1200, bush(360, 1196, 0.8, true)],
  [1050, pine(30, 1050, 1, 1)], [1060, pine(364, 1062, 1.1)], [1030, pine(140, 1040, 0.7, 1)], [1020, pine(255, 1034, 0.7)],
  [940, pine(26, 940, 1.15)], [960, pine(56, 968, 0.85, 1)], [930, pine(370, 930, 1.1, 1)], [960, pine(340, 968, 0.8)],
  [860, pine(40, 860, 0.95, 1)], [870, pine(352, 876, 1)], [800, pine(30, 800, 1.1)], [780, pine(366, 786, 0.9, 1)], [900, mushroom(76, 900)], [900, stump(316, 905)],
  [720, flowers(140, 600, 6, 2)], [600, flowers(254, 700, 6, 5)], [560, oak(30, 560, 0.95)], [600, oak(362, 600, 0.9, 1)], [700, bush(40, 700, 0.8)], [700, bush(350, 712, 0.8, true)],
  [430, rock(110, 432, 1.1)], [450, rock(290, 452, 1.3)], [470, rock(40, 474, 0.8)], [440, rock(350, 446, 0.9)], [420, tuft(150, 420)], [430, tuft(250, 430)],
];
const zones = phone(
  'B · Zones',
  'The same kit, but the act climbs through places: farm at the camp, a river and bridge, a pine wood, a meadow with a pond, the tower on its rocky hill.',
  ZONES_UNDER,
  byY(ZONES)
);

document.getElementById('phones').innerHTML = now + props + zones;
