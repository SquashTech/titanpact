// Draws the Contract node's map prop (art/map-nodes/props/contractReward.png): a rolled parchment
// with a wax seal and ribbons in the contract counter's blue, at the props' 48x48. Pure Node.
//
//   node scripts/art/contract-prop.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'art', 'map-nodes', 'props', 'contractReward.png');
const W = 48;
const H = 48;

function crc32(b) {
  let crc = 0xffffffff;
  for (let n = 0; n < b.length; n++) {
    let c = (crc ^ b[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function writePng(path, grid) {
  const raw = Buffer.alloc(H * (W * 4 + 1));
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const hex = grid[y][x];
      if (!hex) continue;
      const at = y * (W * 4 + 1) + 1 + x * 4;
      raw[at] = parseInt(hex.slice(1, 3), 16);
      raw[at + 1] = parseInt(hex.slice(3, 5), 16);
      raw[at + 2] = parseInt(hex.slice(5, 7), 16);
      raw[at + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  writeFileSync(path, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}

const C = {
  outline: '#2a1a0e',
  paperHi: '#f6e6bf',
  paper: '#e8cf98',
  paperShade: '#cfae72',
  paperDeep: '#a9864f',
  ink: '#8a6238',
  inkDark: '#5a3a1e',
  wax: '#b02a2a',
  waxHi: '#e0564c',
  waxDeep: '#6e1414',
  ribbon: '#3d82c8',
  ribbonHi: '#8fc4ff',
  ribbonDeep: '#1d4a7a',
};

const grid = Array.from({ length: H }, () => Array(W).fill(null));
const set = (x, y, c) => {
  if (x >= 0 && x < W && y >= 0 && y < H) grid[y][x] = c;
};
const rect = (x0, y0, x1, y1, c) => {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, c);
};

// The sheet, lit from the upper left.
rect(12, 9, 35, 38, C.paper);
rect(12, 9, 13, 38, C.paperHi);
rect(34, 9, 35, 38, C.paperShade);

// The two rolls: a cylinder in four bands, darker ends with the curl showing.
function roll(y0) {
  const bands = [C.paperHi, C.paper, C.paperShade, C.paperDeep];
  bands.forEach((c, i) => rect(10, y0 + i, 37, y0 + i, c));
  for (const x of [10, 37]) {
    rect(x, y0, x, y0 + 3, C.paperDeep);
    set(x, y0 + 1, C.paperShade);
  }
  set(11, y0 + 2, C.paperDeep);
  set(36, y0 + 2, C.paperDeep);
}
roll(6);
roll(38);

// The terms, then the signature.
const lines = [
  [15, 31],
  [15, 28],
  [15, 32],
  [15, 26],
];
lines.forEach(([x0, x1], i) => {
  const y = 13 + i * 3;
  for (let x = x0; x <= x1; x++) if ((x - x0) % 7 !== 5) set(x, y, C.ink);
});
for (const [x, y] of [[15, 28], [16, 27], [17, 28], [18, 29], [19, 28], [20, 27], [21, 28], [22, 28]]) set(x, y, C.inkDark);

// Ribbons under the seal, swallow-tailed, in the contract blue.
function ribbon(points, edge) {
  for (const [x, y] of points) {
    set(x, y, C.ribbon);
    set(x + 1, y, edge);
  }
}
ribbon([[27, 34], [27, 35], [26, 36], [26, 37], [25, 38], [25, 39], [24, 40], [24, 41], [23, 42]], C.ribbonDeep);
ribbon([[31, 34], [31, 35], [32, 36], [32, 37], [33, 38], [33, 39], [34, 40], [34, 41], [35, 42]], C.ribbonDeep);
set(23, 43, C.ribbonDeep);
set(25, 42, C.ribbonDeep);
set(35, 43, C.ribbonDeep);
set(33, 42, C.ribbonDeep);
set(27, 34, C.ribbonHi);
set(31, 34, C.ribbonHi);

// The wax seal: a disc lit from the upper left with a pressed ring in it.
const cx = 29.5;
const cy = 30.5;
for (let y = 25; y <= 36; y++) {
  for (let x = 23; x <= 36; x++) {
    const d = Math.hypot(x - cx, y - cy);
    if (d > 5.2) continue;
    const lit = (x - cx) + (y - cy);
    let c = C.wax;
    if (d > 4.2 && lit > 1) c = C.waxDeep;
    else if (lit < -3.5) c = C.waxHi;
    if (d > 2.2 && d < 3.2) c = lit < 0 ? C.waxDeep : C.waxHi;
    set(x, y, c);
  }
}
set(29, 30, C.waxHi);
set(30, 31, C.waxDeep);

// A 1px outline around the whole silhouette.
const filled = grid.map((row) => row.map((c) => !!c));
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (filled[y][x]) continue;
    const touches = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => filled[y + dy]?.[x + dx]);
    if (touches) set(x, y, C.outline);
  }
}

writePng(OUT, grid);
console.log(`wrote ${OUT}`);
