// Renders the PWA app icons from code so the mark stays in sync with the game: the Titan's
// eye (2026-09-16, per user direction — it was the T monogram), the lens the title screen,
// TitanWakeScreen and every generated figure carry, lit pale gold at the centre and burning
// out through the run's mythic red (figurePrimitives.ts EYE_GRADIENT), with a slit pupil and a
// red halo on the --bg dark. Pure Node: shapes are evaluated in normalized 0..1 space,
// supersampled, and encoded as 8-bit RGBA PNG by hand.
//
//   node scripts/generate-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

const BG = [0x0f, 0x11, 0x17]; // --bg
const GLOW = [0xe0, 0x39, 0x3f]; // --tier-mythic, the halo
const PUPIL = [0x07, 0x05, 0x0a];
// EYE_GRADIENT (figurePrimitives.ts), centre to rim.
const EYE_STOPS = [
  [0.0, [0xf6, 0xdc, 0x96]],
  [0.42, [0xe9, 0xa2, 0x4e]],
  [0.78, [0xe0, 0x39, 0x3f]],
  [1.0, [0x6e, 0x1a, 0x20]],
];
// The lens: half-width and half-height at the centre, in the 0..1 frame.
const LENS_W = 0.4;
const LENS_H = 0.19;
const PUPIL_W = 0.042;

const SS = 3; // supersample factor per axis

function eyeAt(t) {
  const u = Math.min(1, Math.max(0, t));
  for (let i = 1; i < EYE_STOPS.length; i++) {
    const [p0, c0] = EYE_STOPS[i - 1];
    const [p1, c1] = EYE_STOPS[i];
    if (u <= p1) {
      const k = p1 === p0 ? 0 : (u - p0) / (p1 - p0);
      return [0, 1, 2].map((ch) => c0[ch] + (c1[ch] - c0[ch]) * k);
    }
  }
  return EYE_STOPS[EYE_STOPS.length - 1][1];
}

function mix(a, b, k) {
  return [0, 1, 2].map((ch) => a[ch] + (b[ch] - a[ch]) * k);
}

/**
 * The lens, pointed at both corners: inside where |dy| is under a parabola that peaks at
 * LENS_H in the middle and reaches 0 at ±LENS_W — the same shape titanArt.tsx's LENS draws with
 * two quadratic curves. Returns the lens-relative radius (0 centre .. 1 rim) or -1 outside;
 * `scale` shrinks it toward the centre for the maskable variant.
 */
function lensRadius(x, y, scale) {
  const dx = (x - 0.5) / scale;
  const dy = (y - 0.5) / scale;
  const u = dx / LENS_W;
  if (Math.abs(u) > 1) return -1;
  const h = LENS_H * (1 - u * u);
  if (Math.abs(dy) > h) return -1;
  return Math.hypot(u, dy / LENS_H);
}

function inPupil(x, y, scale) {
  const dx = (x - 0.5) / scale;
  const dy = (y - 0.5) / scale;
  return (dx / PUPIL_W) ** 2 + (dy / (LENS_H * 0.96)) ** 2 <= 1;
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

          // The halo: the red bloom the eye's wide state carries, widest along the lens.
          const d = Math.hypot((nx - 0.5) / 1.35, ny - 0.5) / (0.5 * glowScale * markScale);
          const bloom = Math.max(0, 1 - d) ** 2 * 0.42;
          let c = mix(BG, GLOW, bloom);

          const lr = lensRadius(nx, ny, markScale);
          if (lr >= 0) c = inPupil(nx, ny, markScale) ? PUPIL : eyeAt(lr);
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

// --- minimal PNG encoder ---

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

// --- outputs ---

const TARGETS = [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  // Android crops maskable icons to a circle in the middle 80%: shrink the eye, widen the bloom.
  ['icon-maskable-512.png', 512, { markScale: 0.7, glowScale: 1.5 }],
  ['apple-touch-icon-180.png', 180, { markScale: 0.92 }],
];

mkdirSync(OUT_DIR, { recursive: true });
for (const [name, size, opts] of TARGETS) {
  writeFileSync(join(OUT_DIR, name), encodePng(size, render(size, opts)));
  console.log(`wrote icons/${name} (${size}x${size})`);
}
