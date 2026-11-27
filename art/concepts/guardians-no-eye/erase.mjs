// node erase.mjs preview|apply dir outSheet — strips the Titan's eye and crack from the Guardian frames.
import { decode, encode, hsv } from './png.mjs';
const [mode, dir, sheet] = process.argv.slice(2);

const RAMPS = {
  gold: ['#6b4310', '#b8781c', '#e8b23a', '#ffe48a', '#fff8d8'],
  amber: ['#5a3008', '#a65e12', '#e09a28', '#ffd060', '#fff2c0'],
  cyan: ['#145a58', '#2b968e', '#5fcfc0', '#a8f0e4', '#effffb'],
  silver: ['#3c3848', '#6a637a', '#9d97ad', '#cfcade', '#f4f2fa'],
};
const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));

// [hueLo, hueHi, sat, default outside boxes], then boxes per frame: [x0, y0, x1, y1, mode].
const CFG = {
  dragon: [300, 350, 0.3, 'fill', { '': [[15, 11, 20, 14, 'gold']], attack: [[19, 8, 24, 12, 'gold']], damaged: [] }],
  elderBough: [305, 350, 0.3, 'fill', { '': [], attack: [], damaged: [] }],
  kraken: [280, 345, 0.3, 'fill', { '': [[22, 16, 31, 26, 'amber']], attack: [[33, 19, 44, 31, 'amber']], damaged: [[22, 19, 34, 27, 'amber']] }],
  manticore: [300, 350, 0.25, 'fill', { '': [[7, 21, 12, 28, 'amber']], attack: [[8, 26, 18, 35, 'amber']], damaged: [[13, 18, 15, 20, 'amber']] }, true],
  roc: [270, 320, 0.35, 'fill', { '': [[21, 14, 27, 21, 'amber']], attack: [[11, 28, 19, 35, 'amber']], damaged: [[34, 13, 43, 21, 'amber']] }],
  seraph: [298, 350, 0.3, 'fill', { '': [[25, 10, 31, 18, 'gold']], attack: [[28, 13, 34, 20, 'gold']], damaged: [[27, 12, 32, 19, 'gold']] }],
  skeletonKing: [298, 350, 0.3, 'keep', { '': [[26, 7, 36, 16, 'cyan']], attack: [[26, 13, 34, 20, 'cyan']], damaged: [] }],
  sphinx: [298, 370, 0.25, 'keep', {
    '': [[6, 13, 16, 26, 'fill'], [28, 34, 40, 55, 'fill']],
    attack: [[17, 16, 25, 22, 'fill'], [34, 36, 44, 52, 'fill']],
    damaged: [[16, 5, 23, 13, 'fill'], [25, 26, 38, 45, 'fill']],
  }, true, 0.06],
  wendigo: [300, 350, 0.2, 'fill', { '': [], attack: [], damaged: [] }],
  yugzulach: [285, 345, 0.3, 'fill', { '': [[21, 12, 31, 25, 'silver']], attack: [[24, 15, 31, 26, 'silver'], [0, 22, 20, 43, 'silver']], damaged: [[34, 14, 41, 22, 'silver']] }],
};

function strip(file, [lo, hi, sat, dflt, frames, wrap, minV = 0.18], frame) {
  const im = decode(file), { w, h } = im, src = im.px, px = new Uint8Array(src);
  const at = (x, y) => src.subarray((y * w + x) * 4, (y * w + x) * 4 + 4);
  const boxes = frames[frame];
  const modeAt = (x, y) => { for (const [x0, y0, x1, y1, m] of boxes) if (x >= x0 && x <= x1 && y >= y0 && y <= y1) return m; return dflt; };
  const core = new Uint8Array(w * h), mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [r, g, b, a] = at(x, y); if (a < 128) continue;
    const [hh, s, v] = hsv(r, g, b);
    if ((hh >= lo && hh <= hi || hh + 360 <= hi) && s >= sat && v > minV) core[y * w + x] = 1;
  }
  // Pale glow next to the core, and a dark pupil pinched between two eye pixels.
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (core[i]) { mask[i] = 1; continue; }
    const [r, g, b, a] = at(x, y); if (a < 128) continue;
    const [hh, s, v] = hsv(r, g, b);
    const near = (dx, dy) => { const X = x + dx, Y = y + dy; return X >= 0 && Y >= 0 && X < w && Y < h && core[Y * w + X]; };
    const touching = [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => (dx || dy) && near(dx, dy)));
    if (touching && hh >= 285 && hh <= 355 && s >= 0.15 && v >= 0.3) mask[i] = 1;
    else if (v < 0.3 && ((near(-1, 0) && near(1, 0)) || (near(0, -1) && near(0, 1)))) mask[i] = 2;
  }
  // Grow twice more through the glow's pink fringe and its white-hot centre.
  for (let pass = 0; pass < (wrap ? 4 : 2); pass++) {
    const add = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; if (mask[i]) continue;
      const [r, g, b, a] = at(x, y); if (a < 128) continue;
      const [hh, s, v] = hsv(r, g, b);
      const pink = ((hh >= 290 && hh <= 355 && s >= 0.15) || (wrap && (hh >= 340 || hh <= 12) && s >= 0.2)) && v >= 0.3, white = s < 0.18 && v >= 0.85;
      if (!pink && !white) continue;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if ((dx || dy) && X >= 0 && Y >= 0 && X < w && Y < h && mask[Y * w + X] === 1) n++; }
      if (n >= (white ? 2 : 1)) add.push(i);
    }
    for (const i of add) mask[i] = 1;
  }
  const freq = new Map();
  for (let i = 0; i < w * h; i++) if (src[i * 4 + 3] >= 128) { const k = Array.from(src.subarray(i * 4, i * 4 + 4)).join(','); freq.set(k, (freq.get(k) || 0) + 1); }
  const fill = new Uint8Array(w * h);
  let changed = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (!mask[i]) continue;
    const m = modeAt(x, y);
    if (m === 'keep') continue;
    if (m === 'fill') { fill[i] = 1; changed++; continue; }
    if (mask[i] === 2) continue; // a recoloured eye keeps its pupil
    const [r, g, b] = at(x, y), lum = (0.3 * r + 0.59 * g + 0.11 * b) / 255;
    const k = lum < 0.22 ? 0 : lum < 0.4 ? 1 : lum < 0.62 ? 2 : lum < 0.8 ? 3 : 4;
    px.set([...hex(RAMPS[m][k]), 255], i * 4); changed++;
  }
  // Fill from the outside in: each hole takes the commonest colour among its settled neighbours.
  for (let pass = 0; pass < 64; pass++) {
    const next = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; if (!fill[i]) continue;
      const votes = new Map();
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue; const X = x + dx, Y = y + dy;
        if (X < 0 || Y < 0 || X >= w || Y >= h || fill[Y * w + X]) continue;
        const c = px.subarray((Y * w + X) * 4, (Y * w + X) * 4 + 4), key = c[3] < 128 ? 'clear' : c.join(',');
        votes.set(key, (votes.get(key) || 0) + (dx && dy ? 1 : 2) * (1 + Math.log1p(freq.get(key) || 0)));
      }
      if (!votes.size) continue;
      const best = [...votes].sort((p, q) => q[1] - p[1])[0][0];
      next.push([i, best === 'clear' ? [0, 0, 0, 0] : best.split(',').map(Number)]);
    }
    if (!next.length) break;
    for (const [i, c] of next) { px.set(c, i * 4); fill[i] = 0; }
  }
  return { w, h, before: src, after: px, changed };
}

const results = [];
for (const [name, cfg] of Object.entries(CFG)) for (const frame of ['', 'attack', 'damaged']) {
  const file = `${dir}/${name}${frame}.png`;
  const r = strip(file, cfg, frame);
  results.push({ file, ...r });
  console.log(`${String(r.changed).padStart(4)} px  ${name}${frame}`);
  if (mode === 'apply') encode(file, r.w, r.h, r.after);
}

// Before | after, three frames a row, at 4×.
const S = 4, CW = 64 * S * 2 + 12, CH = 64 * S + 8, COLS = 3, ROWS = Math.ceil(results.length / COLS);
const W = CW * COLS, H = CH * ROWS, out = new Uint8Array(W * H * 4);
for (let i = 0; i < W * H; i++) out.set([238, 232, 218, 255], i * 4);
results.forEach((r, k) => {
  const ox = (k % COLS) * CW, oy = Math.floor(k / COLS) * CH;
  [r.before, r.after].forEach((img, side) => {
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const [cr, cg, cb, a] = img.subarray((y * 64 + x) * 4, (y * 64 + x) * 4 + 4), bg = [238, 232, 218];
      const c = [cr, cg, cb].map((v, j) => Math.round((v * a + bg[j] * (255 - a)) / 255));
      for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) out.set([...c, 255], ((oy + y * S + dy) * W + ox + side * (64 * S + 4) + x * S + dx) * 4);
    }
  });
});
encode(sheet, W, H, out);
