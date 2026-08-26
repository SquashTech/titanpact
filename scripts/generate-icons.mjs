/**
 * Renders the PWA app icons from code rather than checking in hand-made PNGs,
 * so the mark stays in sync with the title screen's palette (styles.css
 * --accent and the .title-logo gradient) and can be re-rasterized at any size.
 *
 *   node scripts/generate-icons.mjs
 *
 * Pure Node — no image library. Shapes are evaluated in normalized 0..1 space
 * and supersampled for antialiasing, then encoded as 8-bit RGBA PNG by hand.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

const BG = [0x0f, 0x11, 0x17]; // --bg
const GLOW = [0xe0, 0xa6, 0x3c]; // --accent
// The .title-logo linear-gradient, top to bottom.
const GOLD_STOPS = [
  [0.0, [0xff, 0xe7, 0xb0]],
  [0.38, [0xf0, 0xbc, 0x5f]],
  [0.62, [0xe0, 0xa6, 0x3c]],
  [1.0, [0xa4, 0x70, 0x1f]],
];

const SS = 3; // supersample factor per axis

function goldAt(t) {
  const u = Math.min(1, Math.max(0, t));
  for (let i = 1; i < GOLD_STOPS.length; i++) {
    const [p0, c0] = GOLD_STOPS[i - 1];
    const [p1, c1] = GOLD_STOPS[i];
    if (u <= p1) {
      const k = p1 === p0 ? 0 : (u - p0) / (p1 - p0);
      return [0, 1, 2].map((ch) => c0[ch] + (c1[ch] - c0[ch]) * k);
    }
  }
  return GOLD_STOPS[GOLD_STOPS.length - 1][1];
}

function mix(a, b, k) {
  return [0, 1, 2].map((ch) => a[ch] + (b[ch] - a[ch]) * k);
}

/** Rounded-rectangle coverage test in normalized space. */
function inRoundedRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

/**
 * The T monogram. `scale` shrinks it toward the center so the maskable
 * variant keeps its content inside Android's safe circle.
 */
function inMark(x, y, scale) {
  const px = 0.5 + (x - 0.5) / scale;
  const py = 0.5 + (y - 0.5) / scale;
  const r = 0.022;
  const bar = inRoundedRect(px, py, 0.165, 0.205, 0.835, 0.355, r);
  const stem = inRoundedRect(px, py, 0.418, 0.205, 0.582, 0.815, r);
  return bar || stem;
}

function render(size, { markScale = 1, glowScale = 1 } = {}) {
  const px = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const nx = (x + (sx + 0.5) / SS) / size;
          const ny = (y + (sy + 0.5) / SS) / size;

          // Warm ember bloom behind the mark, brightest just above center —
          // the icon-scale echo of .title-core-glow.
          const d = Math.hypot(nx - 0.5, ny - 0.44) / (0.58 * glowScale);
          const bloom = Math.max(0, 1 - d) ** 2.2 * 0.3;
          let c = mix(BG, GLOW, bloom);

          if (inMark(nx, ny, markScale)) {
            // Gradient runs across the mark's own height, not the canvas, so
            // it reads the same at every scale.
            const top = 0.5 + (0.205 - 0.5) * markScale;
            const bottom = 0.5 + (0.815 - 0.5) * markScale;
            c = goldAt((ny - top) / (bottom - top));
          }
          r += c[0];
          g += c[1];
          b += c[2];
        }
      }
      const n = SS * SS;
      const i = (y * size + x) * 4;
      px[i] = Math.round(r / n);
      px[i + 1] = Math.round(g / n);
      px[i + 2] = Math.round(b / n);
      px[i + 3] = 255;
    }
  }
  return px;
}

// --- minimal PNG encoder -------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  // 10..12 stay 0: deflate / adaptive filtering / no interlace.

  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter type: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- outputs -------------------------------------------------------------

const TARGETS = [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  // Android crops maskable icons to its own shape; content must survive a
  // circle inscribed in the middle 80%, so the mark shrinks and the bloom
  // widens to keep the cropped field from going flat.
  ['icon-maskable-512.png', 512, { markScale: 0.62, glowScale: 1.5 }],
  ['apple-touch-icon-180.png', 180, { markScale: 0.86 }],
];

mkdirSync(OUT_DIR, { recursive: true });
for (const [name, size, opts] of TARGETS) {
  writeFileSync(join(OUT_DIR, name), encodePng(size, render(size, opts)));
  console.log(`wrote icons/${name} (${size}x${size})`);
}
