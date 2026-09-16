// The Guardians and the Endbringer as generated figures, in the Titanspawn's vocabulary
// (figurePrimitives.ts; docs/titanspawn-overhaul.md §2 "Art" — the Guardian rules are under
// "Guardian art" there). What the spawn are a miniature of, drawn to the same rules and past them:
//
// - The body is the MORTAL type's three tones, at a Late's scale or over it: every Guardian
//   breaks the hero frame on at least one edge.
// - ONE Titan eye, half-lidded at idle (per user direction, 2026-09-16: a Late's second,
//   wrong-placed eye was tried on every Guardian and taken off).
// - The finale's UNSEALED champion (enemies.ts `unseal`) is the same drawing: the type comes off
//   the stats, not the body. A worn seal — a ring in the Ancient hue with a third eye in it, struck
//   off for the finale — was built and removed the same day (2026-09-16, per user direction).
// - The Endbringer is the Titan's HERALD, mono-Ancient and so drawn in Ancient's tones: a
//   standard-bearer with the Titan's eye on the pennant (the title screen's lens, titanArt.tsx)
//   and the five broken seals threaded on the pole.
//
// Pure — no React, no DOM — so scripts/art/guardian-gallery.ts can write the review page from it.

import { CHAMPION_IDS, ENDBRINGER_ID, LEFT_EYE_ID, LEFT_EYE_WIDE_ID, RIGHT_EYE_ID, RIGHT_EYE_WIDE_ID, WIDE_EYE_IDS, enemies, unsealedIdFor } from '../../data/enemies';
import { getTypeColor } from '../combat/typeColors';
import { C, D, E, EYE_GRADIENT, G, L, P, R, makeEye, pal, sparks, ticks, type Eye, type EyeState, type FigurePose, type Pal } from './figurePrimitives';

/** `closed` is the Eyes' alone: a knocked-out Eye stays on the field with its lid shut (FightScreen). Every other figure reads it as idle. */
export type GuardianPose = FigurePose | 'closed';

type Draw = (p: Pal, pose: GuardianPose, eye: Eye) => string;

const ANCIENT = pal(getTypeColor('Ancient'));
/** Near-black; the Shadow spawn's ink, so Yugzulach is the same dark as its brood. */
const INK = '#1a1822';

// ---------- the six Guardians ----------
// Each draw returns untransformed markup, facing right, ground y=88, as a spawn's does.
const GUARDIANS: Record<string, Draw> = {
  // The Manticore (Beast): a lion's body under a mane of spikes, a face too much like a person's,
  // a scorpion tail curled over the back that strikes forward on an attack. One eye in the face;
  // the other side is a hollow.
  manticore: (p, po, ey) => {
    const tail = po === 'attack' ? 'M18,66 C-4,54 4,12 40,6 C70,2 94,12 100,32' : po === 'hurt' ? 'M18,66 C4,72 -8,60 -2,44' : 'M18,66 C0,60 -4,28 20,20 C36,14 48,22 46,36';
    const bulb = po === 'attack' ? [100, 32] : po === 'hurt' ? [-2, 44] : [46, 36];
    const sting = po === 'attack' ? P('104,34 118,44 100,40', p.dd) : po === 'hurt' ? P('-4,48 -6,60 2,48', p.dd) : P('50,38 60,50 46,42', p.dd);
    const jaw = po === 'attack' ? 8 : 0;
    const mane = Array.from({ length: 14 }, (_, i) => {
      const ang = (Math.PI * (i / 13)) * 1.25 + Math.PI * 0.85;
      const cx = 76, cy = 50, r1 = 18, r2 = 30 + (i % 2) * 4;
      return P(`${cx + Math.cos(ang - 0.1) * r1},${cy + Math.sin(ang - 0.1) * r1} ${cx + Math.cos(ang) * r2},${cy + Math.sin(ang) * r2} ${cx + Math.cos(ang + 0.1) * r1},${cy + Math.sin(ang + 0.1) * r1}`, p.d);
    }).join('');
    return L(tail, p.d, 6) + L(tail, p.c, 2, 'opacity=".5"') + C(bulb[0], bulb[1], 7, p.d) + sting
      + P('22,78 18,88 32,88 32,78', p.d) + P('36,78 36,88 46,88 46,78', p.d) + P('54,78 54,88 64,88 62,78', p.d) + P('66,76 68,88 80,88 78,76', p.d)
      + L('M20,88 l-3,3 M26,88 l0,3 M70,88 l0,3 M76,88 l3,3', p.ll, 1.4)
      + D('M20,80 C16,56 34,46 60,48 C76,50 84,60 80,78 Z', p.c) + D('M26,76 C26,60 40,54 58,56', p.l, 'opacity=".3"')
      + mane + C(76, 50, 19, p.d) + C(76, 50, 14, p.c, 'opacity=".5"')
      + E(88, 46, 11, 13, p.l) + D('M80,38 C84,32 94,32 98,38', p.d) + P('86,44 88,52 91,50', p.d, 'opacity=".5"')
      + R(80, 54 + jaw / 2, 17, 5 + jaw, p.dd, 1.5) + L(`M83,${54 + jaw / 2} v3 M87,${54 + jaw / 2} v3 M91,${54 + jaw / 2} v3 M95,${54 + jaw / 2} v3`, p.ll, 1.2) + (po === 'attack' ? L('M83,64 v-3 M87,65 v-3 M91,65 v-3 M95,64 v-3 M85,60 v2 M89,60 v2 M93,60 v2', p.ll, 1.2) : '')
      + C(83, 45, 3.6, '#07050a') + ey(92, 45, 3.8);
  },

  // Yugzulach (Shadow): a tall hooded dark with a fan of horns, four arms, no legs — it hangs.
  // The eye is in the hood.
  yugzulach: (p, po, ey) => {
    const up = po === 'attack' ? -12 : po === 'hurt' ? 6 : 0;
    const spread = po === 'attack' ? 8 : po === 'hurt' ? -6 : 0;
    const veil = (path: string) => D(path, INK) + D(path, p.c, 'opacity=".42"');
    const arm = (path: string) => L(path, INK, 5.5) + L(path, p.c, 1.8, 'opacity=".35"');
    const horns = [[42, 10, 18 - spread, -20], [47, 6, 34 - spread, -34], [53, 6, 66 + spread, -34], [58, 10, 82 + spread, -20], [40, 16, 4 - spread, 2], [60, 16, 96 + spread, 2]]
      .map(([x, y, tx, ty]) => P(`${x - 3},${y} ${tx},${ty} ${x + 6},${y + 5}`, INK) + P(`${x - 1},${y + 1} ${tx},${ty} ${x + 3},${y + 3}`, p.c, 'opacity=".4"')).join('');
    return horns
      + veil('M24,88 L28,58 C28,30 40,10 50,-2 C60,10 72,30 72,58 L76,88 L68,80 L62,88 L56,80 L50,88 L44,80 L38,88 L32,80 Z')
      + D('M42,20 C42,6 58,6 58,20 L57,36 L43,36 Z', '#07050a')
      + arm(`M38,44 C22,${40 + up} 8,${52 + up} 4,${68 + up}`) + arm('M40,54 C24,62 18,74 12,84') + arm(`M62,44 C78,${40 + up} 92,${52 + up} 96,${68 + up}`) + arm('M60,54 C76,62 82,74 88,84')
      + [[4, 68 + up, -1], [12, 84, -1], [96, 68 + up, 1], [88, 84, 1]].map(([x, y, m]) => L(`M${x},${y} l${4 * m},-5 M${x},${y} l${5 * m},0 M${x},${y} l${3 * m},5`, INK, 2.2)).join('')
      + (po === 'attack' ? sparks(100, 60, p.ll, 3) : '')
      + ey(51, 24, 5.4, po === 'hurt' ? 'narrow' : po === 'attack' ? 'wide' : 'stare');
  },

  // The Kraken (Water): a mantle rising past the frame over a ring of arms; the leading arm
  // whips forward. The eye is in the mantle.
  kraken: (p, po, ey) => {
    const arm = (path: string) => L(path, p.c, 7) + L(path, p.l, 2.2, 'opacity=".45"');
    const lead = po === 'attack' ? 'M72,68 C96,54 118,44 122,62' : po === 'hurt' ? 'M72,68 C86,70 96,80 98,90' : 'M72,68 C92,66 110,72 114,86';
    const curl = po === 'hurt' ? 0.8 : 1;
    const ann = (x: number, y: number) => C(x, y, 1.6, p.ll, 'opacity=".8"');
    return arm(`M34,68 C${18 * curl},74 ${2 * curl},64 ${6 * curl},82 C8,92 24,92 24,84`) + arm('M42,70 C30,84 20,90 10,88') + arm(`M58,70 C64,84 78,92 ${92 * curl},88`) + arm(lead) + arm('M50,72 C50,82 46,90 40,90')
      + ann(12, 80) + ann(8, 86) + ann(28, 86) + ann(80, 90) + ann(90, 80) + ann(102, 76)
      + D('M30,40 C14,20 22,-4 46,-16 L44,40 Z', p.d) + D('M78,40 C94,20 86,-4 62,-16 L64,40 Z', p.d)
      + D('M28,64 C22,26 36,-16 54,-30 C72,-16 86,26 80,64 Z', p.c) + D('M40,58 C36,30 44,4 54,-14 C60,4 66,30 62,58 Z', p.l, 'opacity=".3"') + [[46, 10], [60, 2], [50, -8], [64, 20], [42, 28]].map(([x, y]) => C(x, y, 2.4, p.ll, 'opacity=".45"')).join('')
      + D('M24,64 C32,76 76,76 84,64 Z', p.d)
      + ey(64, 46, 7);
  },

  // The Elder Bough (Nature): a trunk on root-legs with a hollow for a face, a canopy of leaf
  // clusters off the top of the frame with a bloom in it, and a limb that slams. The eye is in
  // the hollow.
  elderBough: (p, po, ey) => {
    const swing = po === 'attack' ? 38 : po === 'hurt' ? -18 : 0;
    const shed = po === 'hurt' ? [[24, 60], [78, 52], [90, 70]].map(([x, y]) => D(`M${x},${y} c6,-6 12,-2 10,4 c-6,4 -12,0 -10,-4 z`, p.c, 'opacity=".7"')).join('') : '';
    const cluster = (x: number, y: number, r: number) => C(x, y, r, p.d) + C(x - r * 0.25, y - r * 0.25, r * 0.7, p.c) + C(x - r * 0.4, y - r * 0.4, r * 0.32, p.l, 'opacity=".5"');
    const limb = G(`rotate(${swing} 62 40)`, L('M62,40 L86,34 L104,40', p.d, 6) + L('M86,34 L94,24', p.d, 3) + cluster(98, 20, 8) + C(104, 40, 4, p.d));
    return P('8,88 32,68 40,88', p.dd) + P('42,88 46,72 58,88', p.dd) + P('62,88 66,70 92,88', p.dd) + R(20, 86, 60, 4, p.dd, 1)
      + D('M26,88 L32,40 C32,24 68,24 68,40 L74,88 Z', p.d) + L('M38,82 l3,-30 M62,84 l-3,-34 M46,34 l2,-8 M56,36 l-2,-8', p.dd, 1.8, 'opacity=".6"')
      + L('M50,32 L30,4 L14,-12', p.d, 6) + L('M50,32 L70,2 L92,-18', p.d, 6) + L('M50,32 L50,-6', p.d, 5) + L('M42,36 L12,20', p.d, 4)
      + cluster(14, -14, 16) + cluster(30, 2, 12) + cluster(92, -20, 16) + cluster(70, 0, 12) + cluster(50, -10, 14) + cluster(10, 18, 10)
      + [0, 72, 144, 216, 288].map((a) => G(`rotate(${a} 92 -20)`, E(92, -26, 2.4, 4, p.ll))).join('')
      + limb + shed
      + D('M42,54 C42,42 58,42 58,54 L56,68 L44,68 Z', p.dd)
      + ey(50, 58, 5.4) + C(92, -20, 2.6, p.dd);
  },

  // The Dragon (Fire): a coiled wyrm with its wings thrown up and back past the frame, a neck
  // rising to a horned head, a crest of flame down the spine and molten cracks that flare when it
  // breathes and go dark when it is hit. The eye is in the head.
  dragon: (p, po, ey) => {
    const hh = po === 'attack' ? 1.6 : po === 'hurt' ? 0.45 : 1;
    const crack = po === 'attack' ? p.ll : po === 'hurt' ? p.d : p.c;
    const flare = po === 'attack' ? 1.15 : po === 'hurt' ? 0.8 : 1;
    const jaw = po === 'attack' ? 6 : 0;
    const wing = (path: string, veins: string) => D(path, p.d) + L(veins, p.dd, 1.4, 'opacity=".6"');
    const farWing = G(`translate(50 58) scale(${flare}) translate(-50 -58)`, wing('M50,58 C54,30 62,2 94,-14 C76,2 70,18 70,30 C64,40 56,50 50,58 Z', 'M52,54 C60,36 70,18 88,-8 M56,50 C64,36 68,28 70,30'));
    const nearWing = G(`translate(40 62) scale(${flare}) translate(-40 -62)`, wing('M40,62 C32,32 18,6 -10,-8 C6,8 12,24 10,36 C22,34 32,46 40,62 Z', 'M38,58 C30,38 20,18 -4,-4 M36,56 C26,42 18,36 10,36'));
    const crest = [[30, 62], [44, 58], [58, 56], [70, 46], [78, 34]].map(([x, y], i) => P(`${x - 5},${y + 4} ${x},${y - (9 + i) * hh} ${x + 5},${y + 4}`, p.c) + P(`${x - 2},${y + 4} ${x},${y - (9 + i) * hh * 0.55} ${x + 2},${y + 4}`, p.ll)).join('');
    return L('M28,76 C8,80 -4,66 6,52', p.dd, 6) + L('M28,76 C8,80 -4,66 6,52', crack, 1.4, 'opacity=".7"') + P('2,54 8,40 14,54', p.d)
      + farWing + crest
      + P('54,80 58,88 72,88 66,78', p.dd) + P('26,80 22,88 36,88 36,80', p.dd) + L('M62,88 l3,3 M68,88 l3,3 M26,88 l-3,3 M32,88 l0,3', p.ll, 1.4)
      + E(44, 72, 26, 13, p.dd) + D('M22,76 C30,86 60,86 68,76 C60,80 30,80 22,76 Z', crack, 'opacity=".55"') + L('M30,66 l6,6 l-4,6 M50,64 l6,8 l-6,4', crack, 2)
      + L('M60,66 C74,60 82,44 86,30', p.dd, 12) + L('M66,60 l4,6 M76,46 l5,4', crack, 2)
      + nearWing
      + D('M78,20 C90,10 114,14 120,26 C116,34 102,36 90,34 Z', p.dd) + P('86,18 90,-4 96,20', p.d) + P('96,18 110,0 106,22', p.d)
      + D(`M92,34 L118,30 L114,${38 + jaw} L94,${40 + jaw} Z`, crack) + [96, 102, 108].map((x) => P(`${x - 2},34 ${x},${39 + jaw} ${x + 2},34`, p.ll)).join('')
      + (po === 'attack' ? P('118,32 148,22 140,40 146,52 118,42', p.c) + P('120,36 138,30 136,44', p.ll, 'opacity=".8"') : '')
      + ey(102, 26, 4.4);
  },

  // The Skeleton King (Spirit): a crowned skull on a spectral robe, a sceptre raised. One socket
  // holds the eye and the other is empty.
  skeletonKing: (p, po, ey) => {
    const jaw = po === 'attack' ? 5 : 0;
    const raise = po === 'attack' ? -18 : po === 'hurt' ? 14 : 0;
    const bone = p.ll;
    const sceptre = G(`rotate(${raise} 84 56)`, L('M84,62 L84,-22', p.d, 2.6) + P('77,-18 84,-36 91,-18 84,-8', bone) + C(84, -18, 2.2, p.dd));
    return E(50, 88, 18, 2.5, p.d, 'opacity=".4"')
      + D('M22,88 L28,44 C30,34 70,34 72,44 L78,88 L70,84 L62,90 L54,84 L46,90 L38,84 L30,90 Z', p.d, 'opacity=".7"')
      + D('M32,88 L32,50 C32,32 68,32 68,50 L68,88 L62,80 L56,88 L50,80 L44,88 L38,80 Z', p.c, 'opacity=".82"') + D('M40,86 L40,54 C40,44 60,44 60,54 L60,86 Z', p.d, 'opacity=".55"')
      + L('M36,52 L22,70', bone, 3) + C(21, 72, 3.2, bone) + L('M64,52 L84,44 L84,62', bone, 3) + sceptre + C(84, 60, 3.2, bone)
      + L('M40,50 q10,5 20,0 M39,56 q11,6 22,0 M40,62 q10,5 20,0 M41,68 q9,4 18,0 M50,46 v26', bone, 1.6)
      + D('M36,30 C36,4 64,4 64,30 L62,42 L38,42 Z', bone) + C(44, 26, 4.6, '#07050a') + C(56, 26, 4.6, '#07050a') + P('48,34 50,29 52,34', p.dd)
      + R(39, 42, 22, 6 + jaw, p.l, 1) + L(`M42,42 v${4 + jaw} M46,42 v${4 + jaw} M50,42 v${4 + jaw} M54,42 v${4 + jaw} M58,42 v${4 + jaw}`, p.dd, 1)
      + ey(44, 26, 3.4)
      + crown(p);
  },
};

/** The Skeleton King's crown: a band round the skull and four points, in his own bone tones. */
const crown = (p: Pal) => E(50, 12, 13, 4.2, 'none', `stroke="${p.d}" stroke-width="3"`) + [40, 46, 54, 60].map((x, i) => P(`${x - 3},10 ${x},${i % 2 ? -8 : -2} ${x + 3},10`, p.d) + P(`${x - 1},10 ${x},${i % 2 ? -4 : 0} ${x + 1},10`, p.ll, 'opacity=".6"')).join('');

// ---------- the Endbringer ----------

/**
 * The Titan's own eye, the title screen's (titanArt.tsx `LENS`): pointed at both corners, lit
 * from inside, a slit contracted to a hairline. The lid state scales the lens height.
 */
function lens(x: number, y: number, hw: number, hh: number, tilt: number, state: EyeState | 'closed', uid: string, gradientId: string): string {
  const k = state === 'closed' ? 0.07 : state === 'narrow' ? 0.3 : state === 'wide' ? 1.0 : state === 'stare' ? 0.55 : 0.75;
  const h = hh * k;
  const id = `${uid}l${x}`;
  const path = `M${-hw} 0 Q0 ${-h} ${hw} 0 Q0 ${h} ${-hw} 0 Z`;
  // A shut lid throws no light: the seam of the lids, and nothing behind it.
  if (state === 'closed') {
    // The lids meet: a dark seam, and the lid's edge lit faintly above it so the shape still reads on the hide.
    const lid = `M${-hw} 0 Q0 ${-hh * 0.42} ${hw} 0`;
    return G(`translate(${x} ${y}) rotate(${tilt})`, D(`M${-hw} 0 Q0 ${-hh * 0.42} ${hw} 0 Q0 ${hh * 0.42} ${-hw} 0 Z`, '#3a1a1e', 'opacity=".9"') + L(lid, '#8a4a44', 1.6, 'opacity=".8"') + D(path, '#07050a') + L(path, '#e0393f', 0.8, 'opacity=".5"'));
  }
  const halo = C(0, 0, hw * 1.25, '#e0393f', `opacity="${state === 'wide' ? 0.26 : 0.1}" class="halo"`);
  return G(
    `translate(${x} ${y}) rotate(${tilt})`,
    `<defs><clipPath id="${id}"><path d="${path}"/></clipPath></defs>${halo}<g clip-path="url(#${id})">${E(0, 0, hw, hh * 1.1, `url(#${gradientId})`)}${E(0, 0, hw * 0.16, hh, '#07050a')}</g>${L(path, '#07050a', 1.2, 'opacity=".6"')}`
  );
}

/**
 * The Endbringer: the Titan's HERALD, not the Titan. A gaunt hooded bearer with no legs under
 * the hem, a standard taller than the frame in the leading hand and a horn in the trailing one.
 * The pennant carries the Titan's eye — the title screen's lens (titanArt.tsx) — which is how
 * the Titan looks out of its herald; the hood is empty. The five broken seals are
 * threaded on the pole under the pennant: what it came out through. An attack raises the horn and sounds it, and the
 * eye on the banner opens wide; a hit sags the banner.
 */
function endbringer(p: Pal, po: GuardianPose, uid: string, gradientId: string): string {
  const state: EyeState = po === 'hurt' ? 'narrow' : po === 'attack' ? 'wide' : 'stare';
  const sag = po === 'hurt' ? 8 : 0;
  const hornUp = po === 'attack' ? -76 : po === 'hurt' ? 12 : 0;
  const veil = (path: string) => D(path, p.c) + D(path, p.d, 'opacity=".35"');
  // A broken seal: two-thirds of a ring, open where it was struck.
  const shackle = (x: number, y: number) => {
    const arc = `M${x - 4},${y - 2} A4.5,3.4 0 1 0 ${x + 4},${y - 2}`;
    return L(arc, '#07050a', 3.2) + L(arc, p.ll, 1.6);
  };
  const horn = G(`rotate(${hornUp} 36 54)`, L('M36,54 C24,60 12,56 6,44', p.dd, 5) + L('M36,54 C24,60 12,56 6,44', p.l, 1.4, 'opacity=".5"') + P('2,46 10,42 8,50', p.dd) + C(36, 54, 3, p.d));
  const sound = po === 'attack' ? [10, 18, 26].map((r) => L(`M${40 - r},${8 - r * 0.4} a${r},${r} 0 0 0 0,${r * 0.8}`, p.ll, 1.4, 'opacity=".7"')).join('') : '';
  return E(50, 89, 30, 3, p.dd, 'opacity=".5"')
    // The hem, ragged, and the body rising off it: taller and thinner than anything else on the field.
    + veil('M30,88 L34,62 C34,40 40,26 50,14 C60,26 66,40 66,62 L70,88 L64,82 L58,88 L52,82 L46,88 L40,82 Z')
    + D('M42,30 C42,14 58,14 58,30 L56,44 L44,44 Z', '#07050a') + P('44,16 50,-6 56,16', p.d) + P('46,18 50,2 54,18', p.dd)
    // The horn in the trailing hand.
    + L('M40,48 C36,50 34,52 36,54', p.d, 4) + horn + sound
    // The standard: pole, crossbar, the pennant streaming back with the Titan's eye on it.
    + L('M62,50 C70,50 78,52 82,52', p.d, 4) + C(82, 52, 3, p.dd)
    + L('M84,88 L84,-56', p.dd, 3) + L('M84,88 L84,-56', p.l, 1, 'opacity=".4"') + P('80,-56 84,-68 88,-56', p.ll) + L('M60,-18 L84,-18', p.dd, 3)
    + D(`M84,-18 L22,${-10 + sag} L28,${2 + sag} L14,${12 + sag} L24,${20 + sag} L84,26 Z`, p.d) + D(`M84,-14 L30,${-6 + sag} L36,${2 + sag} L24,${11 + sag} L32,${18 + sag} L84,22 Z`, p.c, 'opacity=".5"')
    + lens(52, 4 + sag / 2, 15, 6.5, -4, state, uid, gradientId)
    // The five broken seals, threaded on the pole under the pennant: what it came out through.
    + [30, 35, 40, 45, 50].map((y, i) => shackle(84 + (i % 2 ? 1.5 : -1.5), y)).join('');
}

/**
 * The Titan's Eyes (docs/titan-eyes.md): the title screen's lens (titanArt.tsx) at boss scale,
 * hanging in the dark above the platform with nothing around it — the socket is the sky. The
 * Left Eye tilts down toward the middle as the title's does, the Right Eye the other way, so the
 * pair on the field reads as one gaze. Half-lidded in phase 1 (`stare`); WIDE in phase 2, with
 * the halo the state carries. An attack contracts the pupil to a hairline and throws rays; a hit
 * squints.
 */
function titanEye(side: 'left' | 'right', wide: boolean, po: GuardianPose, uid: string, gradientId: string): string {
  const state: EyeState | 'closed' = po === 'closed' ? 'closed' : po === 'hurt' ? 'narrow' : po === 'attack' || wide ? 'wide' : 'stare';
  const tilt = side === 'left' ? 7 : -7;
  const rays = po === 'attack'
    ? [-30, -10, 10, 30].map((a) => G(`rotate(${a} 50 46)`, L('M50,4 L50,-14', '#f6dc96', 1.6, 'opacity=".8"'))).join('')
    : '';
  const shadow = E(50, 89, wide ? 40 : 34, 3, '#07050a', 'opacity=".5"');
  const outer = wide && po !== 'closed' ? C(50, 46, 46, '#e0393f', 'opacity=".08" class="halo"') : '';
  return shadow + outer + rays + lens(50, 46, wide ? 44 : 40, wide ? 20 : 17, tilt, state, uid, gradientId);
}

// ---------- assembly ----------

interface Figure {
  draw: Draw;
  /** The mortal type; the body's hue. */
  hue: string;
}

function figureFor(heroId: string): Figure | undefined {
  const championId = CHAMPION_IDS.find((id) => id === heroId || unsealedIdFor(id) === heroId);
  if (!championId) return undefined;
  // The mortal half's colour is read off the definition, so a retyped champion recolours itself.
  return { draw: GUARDIANS[championId], hue: getTypeColor(enemies[championId].types[0]) };
}

/** True for any id this module draws: a champion, its unsealed twin (the same figure), or the Endbringer. */
const EYE_SIDE: Record<string, 'left' | 'right'> = { [LEFT_EYE_ID]: 'left', [RIGHT_EYE_ID]: 'right', [LEFT_EYE_WIDE_ID]: 'left', [RIGHT_EYE_WIDE_ID]: 'right' };

export function isGuardianFigure(heroId: string): boolean {
  return heroId === ENDBRINGER_ID || heroId in EYE_SIDE || figureFor(heroId) !== undefined;
}

/** The figure's inner markup: body under the pose transform, impact ticks on a hurt. Facing right, ground y=88. Empty for an id this module does not draw. */
export function guardianMarkup(heroId: string, pose: GuardianPose, uid: string): string {
  const gradientId = `${uid}eg`;
  if (pose === 'closed' && !(heroId in EYE_SIDE)) pose = 'idle';
  const t = pose === 'attack' ? 'translate(4 0) rotate(4 50 88)' : pose === 'hurt' ? 'translate(-5 0) rotate(-4 50 88) translate(50 88) scale(1.05 .94) translate(-50 -88)' : '';
  const hit = pose === 'hurt' ? ticks(84, 44) : '';
  if (heroId === ENDBRINGER_ID) {
    return `${EYE_GRADIENT(gradientId)}${G(t, endbringer(ANCIENT, pose as FigurePose, uid, gradientId))}${hit}`;
  }
  if (heroId in EYE_SIDE) {
    // An eye does not lean or recoil like a body; the pose is in the lid and the pupil alone.
    return `${EYE_GRADIENT(gradientId)}${titanEye(EYE_SIDE[heroId], WIDE_EYE_IDS.includes(heroId), pose, uid, gradientId)}${hit}`;
  }
  const figure = figureFor(heroId);
  if (!figure) return '';
  const p = pal(figure.hue);
  const eye = makeEye(uid, gradientId);
  const ey: Eye = (x, y, r, st) => eye(x, y, r, st ?? (pose === 'hurt' ? 'narrow' : pose === 'attack' ? 'wide' : 'stare'));
  return `${EYE_GRADIENT(gradientId)}${G(t, figure.draw(p, pose as FigurePose, ey))}${hit}`;
}

/**
 * The viewBox every Guardian is drawn against — the spawn's, so a Guardian stands on the same
 * ground at the same scale and is bigger because it is DRAWN bigger, not boxed bigger. What
 * leaves the box is meant to.
 */
export const GUARDIAN_VIEW_BOX = '-4 -20 108 108';
