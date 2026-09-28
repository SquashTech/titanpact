// Draws the shared UI kit's nine-slice tiles (art/ui) pixel by pixel, so the chrome stays on one
// palette and every edge tiles cleanly. Pure Node.
//
//   node scripts/art/ui-tiles.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'art', 'ui');

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

const hex = (s, a = 255) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16), a];
const CLEAR = [0, 0, 0, 0];

function canvas(w, h) {
  const d = Buffer.alloc(w * h * 4);
  return {
    w,
    h,
    set(x, y, c) {
      if (x < 0 || y < 0 || x >= w || y >= h || !c) return;
      const o = (y * w + x) * 4;
      d[o] = c[0];
      d[o + 1] = c[1];
      d[o + 2] = c[2];
      d[o + 3] = c[3];
    },
    rect(x0, y0, x1, y1, c) {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, c);
    },
    ring(i, c) {
      for (let x = i; x < w - i; x++) {
        this.set(x, i, c);
        this.set(x, h - 1 - i, c);
      }
      for (let y = i; y < h - i; y++) {
        this.set(i, y, c);
        this.set(w - 1 - i, y, c);
      }
    },
    save(name) {
      writePng(join(OUT_DIR, `${name}.png`), w, h, d);
    },
  };
}

let seed = 7;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

const INK = hex('#0b0a0e');
const STONE = {
  hi: hex('#7a7f8e'),
  light: hex('#585d6b'),
  mid: hex('#464a57'),
  dark: hex('#383b46'),
  shade: hex('#272932'),
  gold: hex('#b78a3c'),
  goldHi: hex('#e2b862'),
  goldLo: hex('#6f4e1f'),
  fill: hex('#15171e'),
  fill2: hex('#191c24'),
  fillShadow: hex('#0e1015'),
};
const WOOD = {
  hi: hex('#9b6b3e'),
  light: hex('#7d5431'),
  mid: hex('#654226'),
  dark: hex('#4a2f1a'),
  grain: hex('#553821'),
  seam: hex('#24160c'),
  band: hex('#5b5f6a'),
  bandHi: hex('#8d929e'),
  bandLo: hex('#34363e'),
  rivet: hex('#c9cdd6'),
};
const GILT = { ...WOOD, band: hex('#a47a33'), bandHi: hex('#e2b862'), bandLo: hex('#5e421a'), rivet: hex('#fff0bf') };

function stud(c, cx, cy, S) {
  c.rect(cx - 2, cy - 2, cx + 2, cy + 2, INK);
  c.rect(cx - 1, cy - 1, cx + 1, cy + 1, S.gold);
  c.set(cx - 1, cy - 1, S.goldHi);
  c.set(cx, cy - 1, S.goldHi);
  c.set(cx - 1, cy, S.goldHi);
  c.set(cx + 1, cy + 1, S.goldLo);
}

// A window: 32x32, slice 10. Ink, a lit stone bevel, a gold inlay, a lip stepping down into a dark recess.
function frameStone(name, S) {
  seed = 7;
  const N = 32;
  const L = N - 1;
  const c = canvas(N, N);
  c.rect(0, 0, L, L, S.mid);
  for (let y = 1; y < L; y++)
    for (let x = 1; x < L; x++) {
      const r = rnd();
      if (r < 0.14) c.set(x, y, S.dark);
      else if (r < 0.2) c.set(x, y, S.light);
    }
  const edge = (i, top, bottom) => {
    for (let k = i; k <= L - i; k++) {
      c.set(k, i, top);
      c.set(i, k, top);
      c.set(k, L - i, bottom);
      c.set(L - i, k, bottom);
    }
  };
  edge(1, S.hi, S.shade);
  edge(2, S.light, S.dark);
  edge(5, S.goldHi, S.goldLo);
  edge(6, S.gold, S.gold);
  edge(7, S.shade, S.light);
  c.ring(8, INK);
  c.rect(9, 9, L - 9, L - 9, S.fill);
  for (let y = 9; y <= L - 9; y++) for (let x = 9; x <= L - 9; x++) if (rnd() < 0.05) c.set(x, y, S.fill2);
  for (let k = 9; k <= L - 9; k++) {
    c.set(k, 9, S.fillShadow);
    c.set(9, k, S.fillShadow);
  }
  for (const [x, y] of [
    [3, 3],
    [L - 3, 3],
    [3, L - 3],
    [L - 3, L - 3],
  ])
    stud(c, x, y, S);
  c.ring(0, INK);
  c.save(name);
}

// A button: 48x24, slice 7. Two boards bound in a metal band with a riveted bracket at each corner.
function plank(name, W) {
  seed = 11;
  const c = canvas(48, 24);
  c.rect(0, 0, 47, 23, W.mid);
  for (let y = 3; y <= 20; y++)
    for (let x = 3; x <= 44; x++) {
      const r = rnd();
      if (r < 0.08) c.set(x, y, W.dark);
      else if (r < 0.13) c.set(x, y, W.light);
    }
  for (const gy of [6, 16]) for (let x = 3; x <= 44; x++) if ((x * 7 + gy) % 11 > 2) c.set(x, gy, W.grain);
  for (let x = 3; x <= 44; x++) {
    c.set(x, 11, W.seam);
    c.set(x, 12, W.light);
    c.set(x, 3, W.hi);
    c.set(x, 20, W.dark);
  }
  for (let y = 3; y <= 20; y++) {
    c.set(3, y, W.light);
    c.set(44, y, W.dark);
  }
  c.ring(1, W.band);
  c.ring(2, W.bandLo);
  for (let x = 1; x < 47; x++) c.set(x, 1, W.bandHi);
  for (let y = 1; y < 23; y++) c.set(1, y, W.bandHi);
  for (const [x0, y0] of [
    [1, 1],
    [42, 1],
    [1, 18],
    [42, 18],
  ]) {
    c.rect(x0, y0, x0 + 4, y0 + 4, W.band);
    c.set(x0 + 2, y0 + 2, W.rivet);
    c.set(x0 + 1, y0 + 1, W.bandHi);
    c.set(x0 + 3, y0 + 3, W.bandLo);
  }
  c.ring(0, INK);
  for (const [x, y] of [
    [0, 0],
    [47, 0],
    [0, 23],
    [47, 23],
  ])
    c.set(x, y, CLEAR);
  c.save(name);
}

// The console's ground: 32x32 flagstones that tile seamlessly, two courses offset like laid stone.
function flagstones(name) {
  seed = 23;
  const c = canvas(32, 32);
  const base = [hex('#1a1c24'), hex('#1d2029'), hex('#181a21')];
  const joint = hex('#0c0d12');
  const lip = hex('#262a35');
  const fleck = hex('#22252f');
  // Courses 16 high; the lower course is offset by half a stone.
  const stones = [
    { x: 0, y: 0, w: 20, h: 16 },
    { x: 20, y: 0, w: 12, h: 16 },
    { x: -6, y: 16, w: 16, h: 16 },
    { x: 10, y: 16, w: 16, h: 16 },
    { x: 26, y: 16, w: 16, h: 16 },
  ];
  stones.forEach((s, i) => {
    const tone = base[i % base.length];
    for (let y = s.y; y < s.y + s.h; y++)
      for (let x = s.x; x < s.x + s.w; x++) {
        const px = ((x % 32) + 32) % 32;
        let col = tone;
        if (x === s.x || y === s.y) col = joint;
        else if (y === s.y + 1 || x === s.x + 1) col = lip;
        else if (rnd() < 0.07) col = fleck;
        c.set(px, y, col);
      }
  });
  c.save(name);
}

// Where the arena's floor meets the console: 16x8, tiles horizontally. A stone lip with a gold inlay.
function ledge(name, S) {
  seed = 31;
  const c = canvas(16, 8);
  c.rect(0, 0, 15, 7, S.mid);
  for (let x = 0; x < 16; x++) {
    c.set(x, 0, INK);
    c.set(x, 1, S.hi);
    c.set(x, 2, rnd() < 0.3 ? S.dark : S.light);
    c.set(x, 3, S.goldHi);
    c.set(x, 4, S.goldLo);
    c.set(x, 5, rnd() < 0.3 ? S.dark : S.mid);
    c.set(x, 6, S.shade);
    c.set(x, 7, INK);
  }
  c.set(15, 5, INK);
  c.set(15, 6, INK);
  c.save(name);
}

// A move's slot, cut into the flagstones: 24x24, slice 6. Lit from above, so its top and left walls
// fall in shadow and its bottom and right catch the light. The lit variant is rimmed in gold.
function slot(name, rim) {
  seed = 41;
  const c = canvas(24, 24);
  const L = 23;
  c.rect(0, 0, L, L, hex('#111319'));
  for (let y = 4; y <= L - 4; y++) for (let x = 4; x <= L - 4; x++) if (rnd() < 0.05) c.set(x, y, hex('#15171e'));
  const edge = (i, top, bottom) => {
    for (let k = i; k <= L - i; k++) {
      c.set(k, i, top);
      c.set(i, k, top);
      c.set(k, L - i, bottom);
      c.set(L - i, k, bottom);
    }
  };
  edge(0, rim ? rim.lo : hex('#2e323e'), rim ? rim.hi : hex('#4a4f5e'));
  edge(1, INK, rim ? rim.mid : hex('#353947'));
  edge(2, hex('#08090d'), hex('#1b1e27'));
  edge(3, hex('#0d0f14'), hex('#161920'));
  c.save(name);
}

frameStone('frame-stone', STONE);
plank('plank', WOOD);
plank('plank-gilt', GILT);
flagstones('flagstones');
ledge('ledge', STONE);
slot('slot', null);
slot('slot-lit', { lo: STONE.goldLo, mid: STONE.gold, hi: STONE.goldHi });
