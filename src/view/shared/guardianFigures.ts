// The Guardians and the Endbringer as generated figures, in the Titanspawn's vocabulary
// (figurePrimitives.ts; docs/titanspawn-overhaul.md §2 "Art" — the Guardian rules are under
// "Guardian art" there). What the spawn are a miniature of, drawn to the same rules and past them:
//
// - The body is the MORTAL type's three tones, at a Late's scale or over it: every Guardian
//   breaks the hero frame on at least one edge, the Endbringer on every edge.
// - Two Titan eyes, wrong-placed as a Late's are (a hump, a palm, a tentacle tip, the canopy, a
//   flank fissure, the ribcage), half-lidded at idle, and a THIRD in the seal.
// - THE SEAL IS WORN. docs/lore.md §2: the Ancient half is not the champion's nature, it is the
//   piece of the lock it carries — so it is drawn as a thing on the body, a ring in the Ancient
//   hue (the one type-coloured thing on the figure that is not the mortal type) with the lock's
//   own eye at its centre, which never blinks with the beast's. Where it is worn is the Guardian's
//   identity: a collar, a brand, a crown. The UNSEALED champion (enemies.ts `unseal`, the finale)
//   is the same drawing with the ring taken off it and a scar where it sat — derived, as the
//   stats are, never a second figure.
// - The Endbringer is mono-Ancient, so its body is the seal's colour; it wears no seal but the
//   five it broke — shackle stubs — and one whole chain running off the frame: the sixth seal,
//   which held (lore §5). Its eyes are the title screen's (titanArt.tsx): lenses, not slits.
//
// Pure — no React, no DOM — so scripts/art/guardian-gallery.ts can write the review page from it.

import { CHAMPION_IDS, ENDBRINGER_ID, enemies, unsealedIdFor } from '../../data/enemies';
import { getTypeColor } from '../combat/typeColors';
import { C, D, E, EYE_GRADIENT, G, L, P, R, makeEye, pal, sparks, ticks, type Eye, type EyeState, type FigurePose, type Pal } from './figurePrimitives';

export type GuardianPose = FigurePose;

/** The seal's ring: one primitive every Guardian wears somewhere, or wears the scar of. */
type Seal = (x: number, y: number, rx: number, ry: number, eyeR: number, tilt?: number) => string;
type Draw = (p: Pal, pose: GuardianPose, eye: Eye, seal: Seal, sealed: boolean) => string;

const ANCIENT = pal(getTypeColor('Ancient'));
/** Near-black; the Shadow spawn's ink, so Yugzulach is the same dark as its brood. */
const INK = '#1a1822';

/**
 * The ring: dark under-stroke so it reads on a body of any hue, the Ancient hue over it, a paler
 * inner ring, eight lock-teeth, and the eye — always `stare`: the lock does not flinch when the
 * beast does. Unsealed, the same call draws the scar: a broken hairline where the ring sat and a
 * dark socket where its eye was.
 */
function makeSeal(p: Pal, eye: Eye, sealed: boolean): Seal {
  return (x, y, rx, ry, eyeR, tilt = 0) => {
    if (!sealed) {
      return G(`rotate(${tilt} ${x} ${y})`, E(x, y, rx, ry, 'none', `stroke="${p.ll}" stroke-width="1.2" stroke-dasharray="4 3" opacity=".4"`) + C(x, y, eyeR * 1.15, p.dd));
    }
    const teeth = Array.from({ length: 8 }, (_, i) => {
      const a = (Math.PI * 2 * i) / 8;
      const cx = x + Math.cos(a) * rx, cy = y + Math.sin(a) * ry;
      return L(`M${cx},${cy} L${x + Math.cos(a) * rx * 1.28},${y + Math.sin(a) * ry * 1.28}`, ANCIENT.d, 1.6);
    }).join('');
    return G(
      `rotate(${tilt} ${x} ${y})`,
      E(x, y, rx, ry, 'none', `stroke="#07050a" stroke-width="5" opacity=".7"`)
        + E(x, y, rx, ry, 'none', `stroke="${ANCIENT.c}" stroke-width="3"`)
        + E(x, y, rx * 0.68, ry * 0.68, 'none', `stroke="${ANCIENT.ll}" stroke-width="1" opacity=".7"`)
        + teeth
        + C(x, y, eyeR * 1.4, '#07050a')
        + eye(x, y, eyeR, 'stare')
    );
  };
}

// ---------- the six Guardians ----------
// Each draw returns untransformed markup, facing right, ground y=88, as a spawn's does.
const GUARDIANS: Record<string, Draw> = {
  // The Goblin Lord (Beast): a hunched brute under a crude crown, ears like blades, a spiked
  // club taller than he is. The second eye looks out of the hump on his back. The seal is a
  // collar — the beast that was leashed.
  goblinLord: (p, po, ey, seal) => {
    const swing = po === 'attack' ? 100 : po === 'hurt' ? -10 : 4;
    const jaw = po === 'attack' ? 5 : 0;
    const club = G(
      `rotate(${swing} 108 60)`,
      P('103,62 113,62 120,-18 96,-18', p.dd) + [-12, -2, 8].map((dy) => P(`97,${-2 + dy} 88,${-6 + dy} 99,${-10 + dy}`, p.dd) + P(`119,${-2 + dy} 128,${-6 + dy} 117,${-10 + dy}`, p.dd)).join('') + L('M106,54 L109,-10', p.d, 1.8, 'opacity=".6"') + [0, 1, 2].map((i) => C(108, 38 - i * 16, 2, p.l)).join('')
    );
    return R(20, 84, 24, 6, p.dd, 2) + R(56, 84, 24, 6, p.dd, 2) + P('26,86 28,66 44,66 44,86', p.d) + P('58,86 58,66 74,66 74,86', p.d)
      + D('M20,72 C10,44 30,22 56,22 C84,22 96,44 90,72 Z', p.c) + D('M36,72 C34,52 48,42 66,46 C80,50 84,62 82,72 Z', p.l, 'opacity=".3"') + L('M30,44 q8,-10 20,-12 M64,30 q10,2 16,10', p.d, 1.4, 'opacity=".5"')
      + L('M28,52 C14,58 8,70 10,82', p.c, 8) + C(10, 84, 6, p.d)
      + P('62,30 46,4 70,24', p.c) + P('64,30 54,12 68,26', p.d, 'opacity=".4"') + P('88,30 104,10 96,34', p.c) + P('90,30 100,16 96,32', p.d, 'opacity=".4"')
      + C(80, 38, 15, p.c) + D('M66,34 L96,30 L94,40 L68,44 Z', p.d)
      + D(`M70,46 L94,44 L90,${56 + jaw} L74,${56 + jaw} Z`, p.d) + P(`78,${54 + jaw} 80,42 84,${54 + jaw}`, p.ll) + P(`86,${54 + jaw} 88,42 92,${54 + jaw}`, p.ll)
      + P('70,28 72,12 78,22 84,6 90,20 96,10 98,28', p.ll) + [74, 84, 94].map((x) => C(x, 24, 1.6, p.dd)).join('')
      + L('M86,58 C96,60 104,60 108,60', p.c, 7) + club + C(108, 60, 5.5, p.d)
      + ey(84, 42, 4.8) + ey(44, 38, 3.6)
      + seal(66, 54, 11, 4.6, 3.2, -14);
  },

  // Yugzulach (Shadow): a tall hooded dark with a fan of horns, four arms, no legs — it hangs.
  // One eye in the hood, one in a lower palm. The seal is a brand on the chest.
  yugzulach: (p, po, ey, seal) => {
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
      + ey(51, 24, 5.4, po === 'hurt' ? 'narrow' : po === 'attack' ? 'wide' : 'stare') + ey(88, 82, 3, po === 'hurt' ? 'narrow' : 'open')
      + seal(50, 50, 9, 9, 3.4);
  },

  // The Kraken (Water): a mantle rising past the frame over a ring of arms; the leading arm
  // whips forward. One eye in the mantle, a small one on the tip of that arm. The seal is a
  // collar where the mantle meets the arms.
  kraken: (p, po, ey, seal) => {
    const arm = (path: string) => L(path, p.c, 7) + L(path, p.l, 2.2, 'opacity=".45"');
    const lead = po === 'attack' ? 'M72,68 C96,54 118,44 122,62' : po === 'hurt' ? 'M72,68 C86,70 96,80 98,90' : 'M72,68 C92,66 110,72 114,86';
    const tip = po === 'attack' ? [118, 58] : po === 'hurt' ? [96, 86] : [110, 82];
    const curl = po === 'hurt' ? 0.8 : 1;
    const ann = (x: number, y: number) => C(x, y, 1.6, p.ll, 'opacity=".8"');
    return arm(`M34,68 C${18 * curl},74 ${2 * curl},64 ${6 * curl},82 C8,92 24,92 24,84`) + arm('M42,70 C30,84 20,90 10,88') + arm(`M58,70 C64,84 78,92 ${92 * curl},88`) + arm(lead) + arm('M50,72 C50,82 46,90 40,90')
      + ann(12, 80) + ann(8, 86) + ann(28, 86) + ann(80, 90) + ann(90, 80) + ann(102, 76)
      + D('M30,40 C14,20 22,-4 46,-16 L44,40 Z', p.d) + D('M78,40 C94,20 86,-4 62,-16 L64,40 Z', p.d)
      + D('M28,64 C22,26 36,-16 54,-30 C72,-16 86,26 80,64 Z', p.c) + D('M40,58 C36,30 44,4 54,-14 C60,4 66,30 62,58 Z', p.l, 'opacity=".3"') + [[46, 10], [60, 2], [50, -8], [64, 20], [42, 28]].map(([x, y]) => C(x, y, 2.4, p.ll, 'opacity=".45"')).join('')
      + D('M24,64 C32,76 76,76 84,64 Z', p.d)
      + ey(64, 46, 7) + ey(tip[0], tip[1], 3, po === 'hurt' ? 'narrow' : 'open')
      + seal(54, 66, 25, 6, 3.6);
  },

  // The Elder Bough (Nature): a trunk on root-legs with a hollow for a face, a canopy of leaf
  // clusters off the top of the frame, and a limb that slams. One eye in the hollow, one in
  // the canopy as a bloom. The bark has grown around the seal.
  elderBough: (p, po, ey, seal) => {
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
      + ey(50, 58, 5.4) + ey(92, -20, 4.2)
      + seal(50, 78, 12, 5, 3.2);
  },

  // The Lava Beast (Fire): a crust-plated quadruped, horned, a crest of flame down its spine and
  // molten cracks that flare when it attacks and go dark when it is hit. One eye in the head,
  // one sunk in a flank fissure. The seal is a collar between the plates of the neck.
  lavaBeast: (p, po, ey, seal) => {
    const hh = po === 'attack' ? 1.6 : po === 'hurt' ? 0.45 : 1;
    const crack = po === 'attack' ? p.ll : po === 'hurt' ? p.d : p.c;
    const dip = po === 'attack' ? 6 : 0;
    const crest = [[16, 48], [28, 38], [42, 32], [58, 30], [72, 32]].map(([x, y], i) => P(`${x - 6},${y + 6} ${x},${y - (12 + i * 2) * hh} ${x + 6},${y + 6}`, p.c) + P(`${x - 2.5},${y + 6} ${x},${y - (12 + i * 2) * hh * 0.55} ${x + 2.5},${y + 6}`, p.ll)).join('');
    const head = G(
      `translate(0 ${dip})`,
      D('M82,40 C104,32 126,44 124,64 C122,76 102,80 88,72 Z', p.dd) + P('92,42 96,10 106,44', p.d) + P('108,46 128,22 120,52', p.d) + P('94,40 97,18 102,42', p.c, 'opacity=".3"')
        + D('M98,68 L124,64 L122,74 L100,78 Z', crack) + L('M98,48 l10,8 M112,46 l6,10 M92,60 l6,6', crack, 2.2) + ey(108, 54, 5, po === 'hurt' ? 'narrow' : po === 'attack' ? 'wide' : 'stare')
    );
    return crest + P('10,80 8,88 26,88 26,80', p.dd) + P('34,80 34,88 50,88 50,80', p.dd) + P('60,80 60,88 76,88 76,80', p.dd) + P('84,78 86,88 100,88 98,78', p.dd)
      + [12, 36, 62, 88].map((x) => R(x, 86, 12, 3, crack, 1.5, 'opacity=".8"')).join('')
      + D('M8,74 C4,46 30,30 60,32 C84,32 100,44 98,66 L100,80 L12,80 Z', p.dd) + D('M18,62 L30,44 L52,38 L46,62 Z', p.d, 'opacity=".4"') + D('M62,40 L86,46 L92,66 L64,64 Z', p.d, 'opacity=".3"')
      + L('M24,54 l8,10 l-4,10 M56,44 l8,12 l-6,10 M76,54 l8,12 M44,72 l10,6 M18,72 l6,6', crack, 2.4)
      + head + (po === 'attack' ? P('124,60 144,56 140,70 126,70', p.c) + P('126,64 138,62 136,68', p.ll) : '')
      + C(40, 56, 7, '#07050a', 'opacity=".55"') + ey(40, 56, 5.2)
      + seal(86, 58 + dip / 2, 7, 11, 3.2, 12);
  },

  // The Skeleton King (Spirit): a crowned skull on a spectral robe, a sceptre raised. One socket
  // holds an eye and the other is empty; the second eye is behind the ribs. The crown IS the
  // seal — unsealed, it is a bare skull.
  skeletonKing: (p, po, ey, seal, sealed) => {
    const jaw = po === 'attack' ? 5 : 0;
    const raise = po === 'attack' ? -18 : po === 'hurt' ? 14 : 0;
    const bone = p.ll;
    const sceptre = G(`rotate(${raise} 84 56)`, L('M84,62 L84,-22', p.d, 2.6) + P('77,-18 84,-36 91,-18 84,-8', bone) + C(84, -18, 2.2, p.dd));
    return E(50, 88, 18, 2.5, p.d, 'opacity=".4"')
      + D('M22,88 L28,44 C30,34 70,34 72,44 L78,88 L70,84 L62,90 L54,84 L46,90 L38,84 L30,90 Z', p.d, 'opacity=".7"')
      + D('M32,88 L32,50 C32,32 68,32 68,50 L68,88 L62,80 L56,88 L50,80 L44,88 L38,80 Z', p.c, 'opacity=".82"') + D('M40,86 L40,54 C40,44 60,44 60,54 L60,86 Z', p.d, 'opacity=".55"')
      + L('M36,52 L22,70', bone, 3) + C(21, 72, 3.2, bone) + L('M64,52 L84,44 L84,62', bone, 3) + sceptre + C(84, 60, 3.2, bone)
      + ey(50, 60, 4, po === 'hurt' ? 'narrow' : 'open') + L('M40,50 q10,5 20,0 M39,56 q11,6 22,0 M40,62 q10,5 20,0 M41,68 q9,4 18,0 M50,46 v26', bone, 1.6)
      + D('M36,30 C36,4 64,4 64,30 L62,42 L38,42 Z', bone) + C(44, 26, 4.6, '#07050a') + C(56, 26, 4.6, '#07050a') + P('48,34 50,29 52,34', p.dd)
      + R(39, 42, 22, 6 + jaw, p.l, 1) + L(`M42,42 v${4 + jaw} M46,42 v${4 + jaw} M50,42 v${4 + jaw} M54,42 v${4 + jaw} M58,42 v${4 + jaw}`, p.dd, 1)
      + ey(44, 26, 3.4)
      + seal(50, 12, 13, 4.2, 3) + (sealed ? CROWN : '');
  },
};

/** The crown's spikes stand on the seal's ring, so they go with it. */
const CROWN = [40, 46, 54, 60].map((x, i) => P(`${x - 3},10 ${x},${i % 2 ? -8 : -2} ${x + 3},10`, ANCIENT.c) + P(`${x - 1},10 ${x},${i % 2 ? -4 : 0} ${x + 1},10`, ANCIENT.ll, 'opacity=".6"')).join('');

// ---------- the Endbringer ----------

/**
 * The Titan's own eye, the title screen's (titanArt.tsx `LENS`): pointed at both corners, lit
 * from inside, a slit contracted to a hairline. The lid state scales the lens height.
 */
function lens(x: number, y: number, hw: number, hh: number, tilt: number, state: EyeState, uid: string, gradientId: string): string {
  const k = state === 'narrow' ? 0.3 : state === 'wide' ? 1.0 : state === 'stare' ? 0.55 : 0.75;
  const h = hh * k;
  const id = `${uid}l${x}`;
  const path = `M${-hw} 0 Q0 ${-h} ${hw} 0 Q0 ${h} ${-hw} 0 Z`;
  const halo = C(0, 0, hw * 1.25, '#e0393f', `opacity="${state === 'wide' ? 0.3 : 0.16}" class="halo"`);
  return G(
    `translate(${x} ${y}) rotate(${tilt})`,
    `<defs><clipPath id="${id}"><path d="${path}"/></clipPath></defs>${halo}<g clip-path="url(#${id})">${E(0, 0, hw, hh * 1.1, `url(#${gradientId})`)}${E(0, 0, hw * 0.16, hh, '#07050a')}</g>${L(path, '#07050a', 1.2, 'opacity=".6"')}`
  );
}

/**
 * The Endbringer: an armature of Ancient plate that runs off the top of the frame — the brow
 * TitanColossus keeps, over a torso between two pillar arms whose fists rest on the ground.
 * Five shackle stubs and one whole chain (see the header). It barely moves: an attack lifts a
 * fist and opens the eyes, a hit narrows them.
 */
function endbringer(p: Pal, po: GuardianPose, uid: string, gradientId: string): string {
  const state: EyeState = po === 'hurt' ? 'narrow' : po === 'attack' ? 'wide' : 'stare';
  const lift = po === 'attack' ? -20 : 0;
  const seam = (d: string) => L(d, '#07050a', 1.6, 'opacity=".45"');
  const fist = (x: number) => D(`M${x},88 L${x + 2},68 C${x + 4},58 ${x + 26},58 ${x + 28},68 L${x + 30},88 Z`, p.d) + seam(`M${x + 8},70 v14 M${x + 15},68 v16 M${x + 22},70 v14`);
  // A link is an ellipse along the chain's run, every other one seen edge-on.
  const chain = (x: number, y: number, dx: number, dy: number, n: number) => {
    const a = (Math.atan2(dy, dx) * 180) / Math.PI;
    return Array.from({ length: n }, (_, i) => {
      const cx = x + dx * i, cy = y + dy * i;
      const t = `rotate(${a + (i % 2 ? 90 : 0)} ${cx} ${cy})`;
      return E(cx, cy, 3, 1.7, 'none', `stroke="#07050a" stroke-width="2.8" transform="${t}"`) + E(cx, cy, 3, 1.7, 'none', `stroke="${p.c}" stroke-width="1.3" transform="${t}"`);
    }).join('');
  };
  // A broken seal: two-thirds of a ring, open at the top where it was struck.
  const shackle = (x: number, y: number) => {
    const arc = `M${x - 4.5},${y - 2} A5,3.6 0 1 0 ${x + 4.5},${y - 2}`;
    return L(arc, '#07050a', 3.4) + L(arc, p.l, 1.6);
  };
  return E(50, 89, 64, 3, p.dd, 'opacity=".5"')
    // Arms: pillars, cut off the torso by a dark gap so they read as limbs and not as width.
    + P('-6,74 2,36 28,40 22,74', p.d) + seam('M0,50 L24,54 M-2,64 L22,68') + P('78,74 72,40 98,36 106,74', p.d) + seam('M76,54 L100,50 M78,68 L102,64')
    + fist(-10) + G(`translate(0 ${lift})`, fist(80) + shackle(96, 66))
    + P('20,88 24,46 32,46 28,88', '#07050a', 'opacity=".55"') + P('72,88 68,46 76,46 80,88', '#07050a', 'opacity=".55"')
    // The torso: plate over plate, narrowing to the waist.
    + D('M24,88 L20,46 C20,38 80,38 80,46 L76,88 Z', p.c) + seam('M24,58 h52 M26,70 h48 M28,82 h44') + D('M38,52 L62,52 L60,80 L40,80 Z', p.d, 'opacity=".4"')
    // Pauldrons over the shoulders, and the collar the head sits in.
    + D('M-6,46 C-6,26 28,22 34,38 L32,50 L-2,52 Z', p.c) + seam('M0,42 L30,38') + D('M106,46 C106,26 72,22 66,38 L68,50 L102,52 Z', p.c) + seam('M100,42 L70,38')
    + R(28, 30, 44, 16, '#07050a', 2, 'opacity=".7"')
    // The eyes under the brow: the skull is drawn OVER them, so the lids are its edge.
    + lens(32, 30, 14, 7, 7, state, uid, gradientId) + lens(68, 30, 14, 7, -7, state, uid, gradientId)
    + D('M12,28 C12,-44 88,-44 88,28 C72,18 28,18 12,28 Z', p.dd) + D('M20,20 C20,-32 80,-32 80,20 C66,12 34,12 20,20 Z', p.d, 'opacity=".4"')
    + D('M12,28 C28,18 72,18 88,28 L88,31 C72,22 28,22 12,31 Z', '#07050a', 'opacity=".6"')
    // The five broken seals, and the one that held: its chain runs off the left edge.
    + shackle(12, 40) + shackle(88, 40) + shackle(50, 46) + shackle(6, 64)
    + E(-6, 70, 5.5, 4, 'none', `stroke="#07050a" stroke-width="3.8"`) + E(-6, 70, 5.5, 4, 'none', `stroke="${p.l}" stroke-width="2"`) + chain(-14, 70, -6, -1, 5)
    + (po === 'attack' ? sparks(110, 46, p.ll, 4) : '');
}

// ---------- assembly ----------

interface Figure {
  draw: Draw;
  /** The mortal type; the body's hue. */
  hue: string;
  sealed: boolean;
}

function figureFor(heroId: string): Figure | undefined {
  const championId = CHAMPION_IDS.find((id) => id === heroId || unsealedIdFor(id) === heroId);
  if (!championId) return undefined;
  // The mortal half's colour is read off the definition, so a retyped champion recolours itself.
  return { draw: GUARDIANS[championId], hue: getTypeColor(enemies[championId].types[0]), sealed: heroId === championId };
}

/** True for any id this module draws: a champion, its unsealed twin, or the Endbringer. */
export function isGuardianFigure(heroId: string): boolean {
  return heroId === ENDBRINGER_ID || figureFor(heroId) !== undefined;
}

/** The figure's inner markup: body under the pose transform, impact ticks on a hurt. Facing right, ground y=88. Empty for an id this module does not draw. */
export function guardianMarkup(heroId: string, pose: GuardianPose, uid: string): string {
  const gradientId = `${uid}eg`;
  const t = pose === 'attack' ? 'translate(4 0) rotate(4 50 88)' : pose === 'hurt' ? 'translate(-5 0) rotate(-4 50 88) translate(50 88) scale(1.05 .94) translate(-50 -88)' : '';
  const hit = pose === 'hurt' ? ticks(84, 44) : '';
  if (heroId === ENDBRINGER_ID) {
    return `${EYE_GRADIENT(gradientId)}${G(t, endbringer(ANCIENT, pose, uid, gradientId))}${hit}`;
  }
  const figure = figureFor(heroId);
  if (!figure) return '';
  const p = pal(figure.hue);
  const eye = makeEye(uid, gradientId);
  const ey: Eye = (x, y, r, st) => eye(x, y, r, st ?? (pose === 'hurt' ? 'narrow' : pose === 'attack' ? 'wide' : 'stare'));
  const seal = makeSeal(p, eye, figure.sealed);
  return `${EYE_GRADIENT(gradientId)}${G(t, figure.draw(p, pose, ey, seal, figure.sealed))}${hit}`;
}

/**
 * The viewBox every Guardian is drawn against — the spawn's, so a Guardian stands on the same
 * ground at the same scale and is bigger because it is DRAWN bigger, not boxed bigger. What
 * leaves the box is meant to.
 */
export const GUARDIAN_VIEW_BOX = '-4 -20 108 108';
