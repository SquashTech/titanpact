// Draws the map icons the 32x32 pack (art/icons/32x32) has no picture for, in its own grammar:
// 16x16, outlined in #2e222f, on its palette (Resurrect 64), written out doubled to 32x32.
//
//   node scripts/art/map-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

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

function writePng(path, w, h, data) {
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) data.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  writeFileSync(
    path,
    Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]),
  );
}

// The pack's palette, as the pack itself uses it.
const PALETTE = {
  a: '#2e222f', // outline
  D: '#7f708a', // metal, dark
  M: '#9babb2', // metal
  L: '#c7dcd0', // metal, light
  W: '#ffffff',
  k: '#fbff86', // hottest gold
  Y: '#f9c22b',
  O: '#f79617',
  b: '#e6904e', // chest wood, light
  c: '#cd683d',
  d: '#9e4539',
  e: '#7a3045', // chest wood, darkest
  f: '#ffffff',
  g: '#c7dcd0',
  h: '#9babb2',
  i: '#694f62',
  j: '#7f708a',
};

const ICONS = {
  // The Forge: an anvil with an ingot on it, white-hot, sparks coming off.
  'map-nodes/icons/forgeReward': [
    '.....k....k.....',
    '...k....k.......',
    '.....aaaaaa.....',
    '....aWkYYYOa....',
    '....aYYOOOOa....',
    '..aaaaaaaaaaaaa.',
    '.aLLLLLLLLLLLLLa',
    'aMMMMMMMMMMMMMDa',
    '.aaaDMMMMMMMDDa.',
    '....aDMMMMMDDa..',
    '.....aDMMMDDa...',
    '....aaDMMMDDaa..',
    '...aLLLLLLLLDa..',
    '..aMMMMMMMMMDDa.',
    '..aaaaaaaaaaaaa.',
    '................',
  ],
  // The Ley Line: a shard of raw power, the pack's ember crystal (901.png) drawn wider to fill a tile.
  'map-nodes/icons/leyLineReward': [
    '.......aa.......',
    '......aWOa......',
    '.....aWWOda.....',
    '....aWYWOOda....',
    '....aYYWOOda....',
    '...aWYYWOOOda...',
    '...aYYYWOOOda...',
    '...aYYYWOOOda...',
    '...aYYYWOOOda...',
    '....aYYYOOda....',
    '....aOYYOdda....',
    '.....aOYOda.....',
    '.....aOOdda.....',
    '......aOda......',
    '......adda......',
    '.......aa.......',
  ],
  // The Equipment Cache, opened: the pack's chest (equipmentReward.png) with its lid thrown back and
  // the gold showing. Rows 9-15 are the closed chest's own, so the two swap in place.
  'cache/chest-open': [
    '................',
    '..aaaaaaaaaaaa..',
    '..aieeieeieeia..',
    '.aaieeieeieeiaa.',
    'aaaYkYOYYOYkYaaa',
    'aiYOYWYOOYWYOYia',
    'aYOWYOOYkYOYYOYa',
    'aOYOOYOYYOYOOYOa',
    'aggfffgaagfffgha',
    'ahhggghiihggghha',
    'ajideajjjjadeija',
    'ahjcdeecdeecdjha',
    'ahjcdeecdeecdjha',
    'aijjjjjjjjjjjjia',
    'aiiiiiiiiiiiiiia',
    '.aaaaaaaaaaaaaa.',
  ],
};

const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16), 255];

for (const [name, rows] of Object.entries(ICONS)) {
  if (rows.length !== 16) throw new Error(`${name}: ${rows.length} rows`);
  const data = Buffer.alloc(32 * 32 * 4);
  rows.forEach((row, y) => {
    if (row.length !== 16) throw new Error(`${name} row ${y}: ${row.length} wide`);
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      const colour = PALETTE[ch];
      if (!colour) throw new Error(`${name} row ${y}: no colour for "${ch}"`);
      const px = hex(colour);
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const o = ((y * 2 + dy) * 32 + x * 2 + dx) * 4;
        data[o] = px[0];
        data[o + 1] = px[1];
        data[o + 2] = px[2];
        data[o + 3] = px[3];
      }
    });
  });
  writePng(join(ROOT, 'art', `${name}.png`), 32, 32, data);
  console.log(`wrote art/${name}.png`);
}
