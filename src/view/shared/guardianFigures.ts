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

import { CHAMPION_IDS, ENDBRINGER_ID, LEFT_EYE_ID, RIGHT_EYE_ID, enemies, unsealedIdFor } from '../../data/enemies';
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

  // Yugzulach (Shadow): a priest of the seal — a bell of robe under a flared cowl that spreads like
  // a hood, a crown of horns that curve in toward each other, and four arms raised in office. The
  // eye is in the cowl. Deliberately not the Nocturne's shape (a stilt-limbed dark with straight
  // spikes): this one is wide where that one is tall, and curved where it is sharp.
  yugzulach: (p, po, ey) => {
    const up = po === 'attack' ? -10 : po === 'hurt' ? 8 : 0;
    const flare = po === 'attack' ? 1.12 : po === 'hurt' ? 0.9 : 1;
    const veil = (path: string) => D(path, INK) + D(path, p.c, 'opacity=".5"');
    const arm = (path: string) => L(path, INK, 5.5) + L(path, p.c, 1.8, 'opacity=".4"');
    const horn = (m: number) => G(`scale(${m} 1) translate(${m < 0 ? -100 : 0} 0)`, D('M52,6 C72,2 86,-12 80,-38 C90,-14 80,6 62,14 Z', INK) + D('M56,8 C70,2 80,-10 78,-30 C82,-12 74,4 62,12 Z', p.c, 'opacity=".4"'));
    return G(`translate(50 88) scale(${flare} 1) translate(-50 -88)`, veil('M18,88 L26,54 C26,34 40,18 50,2 C60,18 74,34 74,54 L82,88 L74,82 L66,88 L58,82 L50,88 L42,82 L34,88 L26,82 Z'))
      + horn(1) + horn(-1) + P('47,6 50,-14 53,6', INK)
      + G(`translate(50 46) scale(${flare} 1) translate(-50 -46)`, D('M10,48 C22,26 78,26 90,48 L80,56 C68,40 32,40 20,56 Z', p.c) + D('M14,48 C24,32 76,32 86,48', p.l, 'opacity=".35"'))
      + D('M40,22 C40,6 60,6 60,22 L58,40 L42,40 Z', '#07050a')
      + arm(`M32,46 C18,${34 + up} 8,${18 + up} 10,${2 + up}`) + arm(`M68,46 C82,${34 + up} 92,${18 + up} 90,${2 + up}`) + arm('M36,58 C22,66 14,76 12,86') + arm('M64,58 C78,66 86,76 88,86')
      + [[10, 2 + up, -1], [90, 2 + up, 1], [12, 86, -1], [88, 86, 1]].map(([x, y, m]) => L(`M${x},${y} l${4 * m},-5 M${x},${y} l${5 * m},0 M${x},${y} l${3 * m},5`, INK, 2.2)).join('')
      + (po === 'attack' ? sparks(96, 10 + up, p.ll, 3) : '')
      + ey(50, 28, 5.4, po === 'hurt' ? 'narrow' : po === 'attack' ? 'wide' : 'stare');
  },

  // The Kraken (Water): a mantle rising past the frame over a ring of arms; the leading arm
  // whips forward. The eye is in the mantle.
  kraken: (p, po, ey) => {
    const arm = (path: string) => L(path, p.c, 7) + L(path, p.l, 2.2, 'opacity=".45"');
    const lead = po === 'attack' ? 'M72,68 C96,54 118,44 122,62' : po === 'hurt' ? 'M72,68 C86,70 96,80 98,90' : 'M72,68 C92,66 110,72 114,86';
    const curl = po === 'hurt' ? 0.8 : 1;
    const ann = (x: number, y: number) => C(x, y, 1.6, p.ll, 'opacity=".8"');
    // The two trailing arms fan: the one rooted further left reaches out flat, the next drops under it, so they never cross.
    return arm(`M34,68 C${22 * curl},66 ${8 * curl},66 ${-2 * curl},72`) + arm(`M42,70 C${32 * curl},80 ${18 * curl},90 ${6 * curl},94`) + arm(`M58,70 C64,84 78,92 ${92 * curl},88`) + arm(lead) + arm('M50,72 C50,82 46,90 40,90')
      + ann(8, 70) + ann(18, 66) + ann(14, 88) + ann(80, 90) + ann(90, 80) + ann(102, 76)
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

  // The Seraph (Light): a hovering bell of robe under a blank face of light — no hollow, no
  // features, nothing to read — with a burning wheel behind the head and three pairs of wings:
  // the upper pair past the top of the frame, the middle pair past both sides, the lower pair
  // folded under. The eye is in the chest, at the centre of a sunburst: the Titan looks out of
  // its heart, not its face. Both hands are raised in benediction. An attack throws the wings
  // and the wheel's rays open; a hit drops the wings and the wheel dims. It never touches the
  // ground — the hem hangs over a pool of its own light.
  seraph: (p, po, ey) => {
    const wy = po === 'attack' ? -14 : po === 'hurt' ? 12 : 0;
    const hands = po === 'attack' ? -12 : po === 'hurt' ? 10 : 0;
    // A stroke at part opacity over the dark goes khaki, so the wheel dims by TONE: cream lit, the body's yellow when struck.
    const lit = po === 'hurt' ? p.c : p.ll;
    const rayLen = po === 'attack' ? 12 : po === 'hurt' ? 3 : 6;
    const wing = (path: string, vein: string, fill: string) => (m: number) =>
      G(`scale(${m} 1) translate(${m < 0 ? -100 : 0} 0)`, D(path, fill) + L(vein, p.ll, 1.2, 'opacity=".5"'));
    const upper = wing(`M50,38 C58,20 74,${-8 + wy} 96,${-34 + wy} C84,${-6 + wy} 76,16 68,42 Z`, `M52,36 C60,18 72,${-2 + wy} 90,${-26 + wy}`, p.c);
    const middle = wing(`M50,46 C66,${40 + wy / 2} 96,${34 + wy} 120,${38 + wy} C102,${50 + wy / 2} 78,58 60,58 Z`, `M54,46 C70,${42 + wy / 2} 94,${38 + wy} 112,${39 + wy}`, p.c);
    const lower = wing(`M50,54 C60,64 72,78 78,${92 + wy / 2} C66,84 56,74 48,64 Z`, `M52,56 C60,66 68,76 74,${86 + wy / 2}`, p.d);
    const rays = [0, 45, 90, 135, 180, 225, 270, 315].map((a) => G(`rotate(${a} 50 22)`, L(`M50,-8 L50,${-10 - rayLen}`, lit, 1.8))).join('');
    const spokes = [0, 45, 90, 135, 180, 225, 270, 315].map((a) => G(`rotate(${a + 22.5} 50 22)`, L('M50,5 L50,-1', lit, 1.4))).join('');
    const burst = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((a) => G(`rotate(${a} 50 54)`, P('48,43 50,38 52,43', p.ll, 'opacity=".85"'))).join('');
    const hand = (m: number) => G(`scale(${m} 1) translate(${m < 0 ? -100 : 0} 0)`, L(`M40,50 C30,46 22,${36 + hands} 24,${24 + hands}`, p.c, 4) + C(24, 24 + hands, 3.6, p.ll) + (po === 'attack' ? sparks(26, 14 + hands, p.ll, 3) : ''));
    return E(50, 89, 22, 3, p.l, 'opacity=".4"') + E(50, 89, 10, 1.6, p.ll, 'opacity=".5"')
      // The wheel behind the head: two rings and the rays through them.
      + C(50, 22, 28, 'none', `stroke="${p.l}" stroke-width="1.4"`) + C(50, 22, 23, 'none', `stroke="${lit}" stroke-width="3.5"`) + C(50, 22, 17, 'none', `stroke="${p.l}" stroke-width="1.6"`) + spokes + rays
      + upper(1) + upper(-1) + lower(1) + lower(-1)
      // The robe: a bell that hangs, its hem ragged like the Herald's but in light.
      + D('M34,84 L38,48 C38,38 62,38 62,48 L66,84 L60,78 L54,84 L48,78 L42,84 L38,78 Z', p.c) + D('M44,82 L46,54 C46,48 54,48 54,54 L56,82 Z', p.d, 'opacity=".45"')
      + middle(1) + middle(-1)
      + E(50, 42, 17, 8, p.c) + E(50, 40, 12, 4, p.l, 'opacity=".35"')
      + hand(1) + hand(-1)
      // A face with nothing on it.
      + D('M40,30 C40,10 60,10 60,30 L58,38 L42,38 Z', p.d) + E(50, 26, 7.5, 10.5, p.ll)
      // The sunburst on the chest, and the eye in it.
      + burst + C(50, 54, 9, p.ll) + C(50, 54, 7, p.l, 'opacity=".6"')
      + ey(50, 54, 5);
  },

  // The Sphinx (Mind): a lion recumbent — haunches at the left edge, two forelegs stretched out
  // past the right — under a striped nemes whose crown rises off the top of the frame and whose
  // lappets fall to the shoulders either side of the face. The face is a smooth mask with the one
  // eye set in it. The near foreleg lifts and comes down on an attack; a hit rocks the head back.
  sphinx: (p, po, ey) => {
    const paw = po === 'attack' ? -16 : po === 'hurt' ? 3 : 0;
    const rock = po === 'hurt' ? -9 : po === 'attack' ? 3 : 0;
    const lappet = (x: number, m: number) => [22, 30, 38, 46].map((y) => L(`M${x},${y} l${7 * m},0`, p.c, 2.6, 'opacity=".6"')).join('');
    return E(54, 89, 44, 3, p.dd, 'opacity=".45"')
      // Tail over the haunch, the haunch, the hind paw.
      + L('M10,66 C-4,62 -8,40 8,34', p.d, 4) + C(8, 34, 4.2, p.d)
      + E(20, 68, 18, 18, p.d) + P('2,88 6,78 26,78 28,88', p.d) + L('M8,88 l-2,3 M14,88 l0,3 M20,88 l2,3', p.ll, 1.2)
      // The body, long and low, the chest rising under the head.
      + D('M10,86 C6,58 26,46 56,46 C76,46 84,50 84,58 L86,86 Z', p.c) + D('M18,84 C18,64 34,54 56,54', p.l, 'opacity=".28"')
      + D('M62,86 L64,52 L100,52 L100,70 C100,80 92,86 84,86 Z', p.c) + D('M82,60 C90,60 96,64 96,72', p.l, 'opacity=".25"')
      // Two forelegs stretched along the ground: the far one flat, the near one on its shoulder pivot.
      + P('64,88 66,76 100,76 106,88', p.d) + L('M96,88 l2,3 M102,88 l2,3', p.ll, 1.2)
      + G(`rotate(${paw} 72 74)`, P('70,88 72,72 106,72 114,88', p.c) + L('M102,88 l2,3 M108,88 l2,3 M96,88 l0,3', p.ll, 1.3) + (po === 'attack' ? sparks(110, 84, p.ll, 3) : ''))
      // The nemes: crown block off the top of the frame, lappets to the shoulders, a brow band.
      + G(`rotate(${rock} 82 52)`,
        D('M62,54 L66,12 C66,-6 98,-6 98,12 L102,54 L92,54 L90,20 L74,20 L72,54 Z', p.d)
        + lappet(63, 1) + lappet(101, -1)
        + D('M70,20 L72,4 C74,-4 90,-4 92,4 L94,20 Z', p.dd, 'opacity=".55"')
        + R(68, 12, 28, 4, p.c, 1) + L('M70,12 h24', p.ll, 1, 'opacity=".6"')
        // The mask: a face with nothing on it but the eye.
        + D('M72,20 L92,20 L92,40 C92,50 72,50 72,40 Z', p.l) + E(82, 26, 7, 4, p.ll, 'opacity=".45"')
        + ey(82, 32, 5.2, po === 'hurt' ? 'narrow' : po === 'attack' ? 'wide' : 'stare'));
  },

  // The Roc (Storm): a bird whose wings pass both edges of the frame, lightning threaded through
  // the pinions, talons on the ground and a hooked beak turned right. The wings throw up and a
  // bolt leaves the beak on an attack; a hit drops them.
  roc: (p, po, ey) => {
    const lift = po === 'attack' ? -20 : po === 'hurt' ? 16 : 0;
    const wing = (m: number) => G(`scale(${m} 1) translate(${m < 0 ? -100 : 0} 0)`,
      D(`M50,46 C62,${22 + lift} 92,${-8 + lift} 134,${-4 + lift} C114,${10 + lift} 102,26 98,42 C86,56 66,60 50,58 Z`, p.c)
      + L(`M58,52 C74,${36 + lift} 100,${16 + lift} 126,${0 + lift}`, p.d, 1.4, 'opacity=".7"') + L(`M62,56 C80,${44 + lift} 100,${30 + lift} 112,${22 + lift}`, p.d, 1.2, 'opacity=".5"')
      + L(`M74,${38 + lift} l6,-4 l-3,8 l7,-5 M100,${18 + lift} l5,-3 l-2,7 l6,-4`, p.ll, 1.6, 'opacity=".9"'));
    const bolt = po === 'attack' ? L('M86,42 l8,10 l-6,3 l10,12 l-5,2 l8,10', p.ll, 2.2) + sparks(96, 70, p.ll, 3) : '';
    return E(50, 89, 24, 3, p.dd, 'opacity=".5"')
      + P('40,70 50,98 60,70', p.d) + P('44,70 50,90 56,70', p.c, 'opacity=".5"')
      + wing(1) + wing(-1)
      + E(50, 58, 17, 22, p.c) + E(48, 62, 8, 13, p.l, 'opacity=".3"')
      + L('M42,78 L34,88 M46,80 L44,88 M54,80 L56,88 M58,78 L66,88', p.dd, 3) + L('M34,88 l-4,2 M44,88 l-2,3 M56,88 l2,3 M66,88 l4,2', p.dd, 2.2)
      + C(60, 36, 12, p.c) + D('M70,32 C86,30 92,40 84,46 L70,44 Z', p.ll) + L('M72,40 L84,42', p.dd, 1)
      + P('52,26 55,6 60,26', p.d) + P('58,26 62,4 66,26', p.d) + P('64,28 70,10 72,28', p.d)
      + bolt
      + ey(63, 34, 4.4);
  },

  // The Wendigo (Frost): gaunt and far too tall — antlers branching off the top of the frame, a
  // stag's skull, a ribcage, arms that hang past the knees and end in claws. It rears and the
  // claws come up on an attack; a hit folds it forward.
  wendigo: (p, po, ey) => {
    const reach = po === 'attack' ? -48 : po === 'hurt' ? 10 : 0;
    const fold = po === 'hurt' ? 8 : 0;
    const antler = (m: number) => G(`scale(${m} 1) translate(${m < 0 ? -100 : 0} 0)`,
      L('M46,2 C38,-8 30,-22 36,-40 M40,-12 L30,-22 M37,-26 L26,-30 M36,-34 L40,-46', p.d, 3) + L('M46,2 C38,-8 30,-22 36,-40', p.l, 1, 'opacity=".4"'));
    const arm = (m: number) => G(`scale(${m} 1) translate(${m < 0 ? -100 : 0} 0)`,
      L(`M40,${34 + fold} C26,${44 + reach / 2} 12,${58 + reach} 10,${80 + reach}`, p.c, 4.5)
      + L(`M10,${80 + reach} l-5,8 M10,${80 + reach} l0,9 M10,${80 + reach} l5,8`, p.ll, 1.8));
    return E(50, 89, 16, 2.5, p.dd, 'opacity=".5"')
      // Legs, backward-kneed, on hooves.
      + L('M44,60 L36,72 L44,88', p.d, 5) + L('M56,60 L64,72 L56,88', p.d, 5) + P('40,88 48,88 45,93', p.dd) + P('52,88 60,88 55,93', p.dd)
      // The torso, a ribcage showing through.
      + G(`translate(0 ${fold})`,
        D('M38,62 C36,42 42,26 50,24 C58,26 64,42 62,62 Z', p.c)
        + L('M42,40 q8,3 16,0 M41,46 q9,4 18,0 M42,52 q8,3 16,0 M50,36 v20', p.dd, 1.4, 'opacity=".7"')
        + E(50, 30, 9, 5, p.l, 'opacity=".3"'))
      + arm(1) + arm(-1)
      // Neck and the stag's skull, the muzzle down.
      + L(`M50,${26 + fold} L50,${12 + fold}`, p.c, 5)
      + G(`translate(0 ${fold})`,
        D('M40,14 C40,-2 60,-2 60,14 L58,22 L42,22 Z', p.ll) + P('44,20 50,34 56,20', p.ll) + L('M47,26 h6 M48,30 h4', p.d, 1)
        + C(56, 10, 3.4, '#07050a')
        + antler(1) + antler(-1) + P('47,4 50,-10 53,4', p.d)
        + ey(44, 10, 3.8, po === 'attack' ? 'wide' : po === 'hurt' ? 'narrow' : 'stare'));
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
 * pair on the field reads as one gaze. WIDE, with the halo the state carries — the rise that
 * brings them opens the lids all the way (docs/titan-eyes.md §10), and what walks on is paying
 * attention. An attack contracts the pupil to a hairline and throws rays; a hit squints.
 */
function titanEye(side: 'left' | 'right', po: GuardianPose, uid: string, gradientId: string): string {
  const state: EyeState | 'closed' = po === 'closed' ? 'closed' : po === 'hurt' ? 'narrow' : 'wide';
  const tilt = side === 'left' ? 7 : -7;
  const rays = po === 'attack'
    ? [-30, -10, 10, 30].map((a) => G(`rotate(${a} 50 46)`, L('M50,4 L50,-14', '#f6dc96', 1.6, 'opacity=".8"'))).join('')
    : '';
  const shadow = E(50, 89, 40, 3, '#07050a', 'opacity=".5"');
  const outer = po !== 'closed' ? C(50, 46, 46, '#e0393f', 'opacity=".08" class="halo"') : '';
  return shadow + outer + rays + lens(50, 46, 44, 20, tilt, state, uid, gradientId);
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
const EYE_SIDE: Record<string, 'left' | 'right'> = { [LEFT_EYE_ID]: 'left', [RIGHT_EYE_ID]: 'right' };

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
    return `${EYE_GRADIENT(gradientId)}${titanEye(EYE_SIDE[heroId], pose, uid, gradientId)}${hit}`;
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
