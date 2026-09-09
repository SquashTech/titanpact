// The title screen's two silhouette layers (docs/lore.md §1): the bound Titan behind
// everything, and the ridge with the pactbearers on it in front. Same idiom as
// locationArt.tsx — filled paths in a fixed viewBox, no raster art — sized to the title
// screen's own box (366x754 on the 394-wide design canvas) and `slice`d, so a taller or
// shorter phone crops the frame rather than squashing the figure.
//
// Everything here is read against the light behind it (`.title-backlight`), not by its own
// fill. That is why the fills are all within a few points of black: this is a hole cut in a
// lit fog bank, and the moment the figure is lighter than what is behind it, it stops being
// a thing in the distance and becomes a decal on the glass.

const VIEW_W = 366;
const VIEW_H = 754;

/** Both layers share it: `inset` alone mis-sizes a replaced element on iOS. */
const FILL = { width: '100%', height: '100%' } as const;

/**
 * A chain drawn as discrete links along a parabola. Links alternate face-on and edge-on
 * — a chain whose links all lie in one plane reads as a rope, and the whole point of this
 * one is that it is heavy enough to hold something that cannot be killed.
 */
function chain(
  from: readonly [number, number],
  to: readonly [number, number],
  sag: number,
  count: number,
  key: string,
) {
  const [x0, y0] = from;
  const [x1, y1] = to;
  return Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t + sag * (1 - (2 * t - 1) ** 2);
    // Tangent of the same curve, so a link always lies along the line rather than across it.
    const angle = (Math.atan2(y1 - y0 - 4 * sag * (2 * t - 1), x1 - x0) * 180) / Math.PI;
    const edgeOn = i % 2 === 1;
    return (
      <ellipse
        key={`${key}${i}`}
        cx={x}
        cy={y}
        rx={6.4}
        ry={edgeOn ? 1.8 : 3.8}
        transform={`rotate(${angle} ${x} ${y})`}
        fill="none"
        strokeWidth={edgeOn ? 1.6 : 2}
      />
    );
  });
}

/**
 * The Titan: bowed, chained, and with no top of head — the skull dissolves upward out of
 * the frame, because a colossus that fits in frame is not one. The face is three bands and
 * two lights: a brow heavy enough to throw the eyes into shadow, a jaw, and a throat. Any
 * more detail and it starts reading as a character portrait, which is the wrong scale.
 */
export function TitanColossus() {
  return (
    <svg
      className="title-titan"
      style={FILL}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        {/* The figure dissolves at BOTH ends: into the dark above, so the skull has no top
            edge and reads as continuing past the frame, and into the fog well before the floor,
            so the ridge in front of it is far away rather than leaning against it. */}
        <linearGradient id="titan-dissolve" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0" />
          <stop offset="13%" stopColor="#fff" stopOpacity="1" />
          <stop offset="72%" stopColor="#fff" stopOpacity="1" />
          <stop offset="94%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="titan-fade">
          <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill="url(#titan-dissolve)" />
        </mask>
        {/* Lifted stop for stop from `.titan-eye-globe` (TitanWakeScreen): pale gold at the
            centre out through the mythic red to almost nothing at the rim, so the light reads
            as coming from inside the eye rather than the eye being a painted disc. */}
        <radialGradient id="titan-iris" cx="50%" cy="50%" r="52%">
          <stop offset="0%" stopColor="#fff3d2" />
          <stop offset="20%" stopColor="#f0b060" />
          <stop offset="46%" stopColor="#e0393f" />
          <stop offset="76%" stopColor="#601018" />
          <stop offset="100%" stopColor="#1e060a" />
        </radialGradient>
        <radialGradient id="titan-glare" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#e0393f" stopOpacity="0.34" />
          <stop offset="42%" stopColor="#e0393f" stopOpacity="0.09" />
          <stop offset="100%" stopColor="#e0393f" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g className="titan-figure" mask="url(#titan-fade)">
        {/* Body first, so every plate laid over it shares its outline. The trapezius runs
            almost FLAT out of the neck before it turns down: a shoulder that curves away
            from the throat in one arc reads as a hood, and this shelf is the single line
            doing the most work in the whole figure. */}
        <path
          className="titan-mass"
          d="M-30 754 L-30 470 C -28 400 -18 332 6 300 C 24 278 76 258 122 250 C 140 246 146 238 146 218 L 220 218 C 220 238 226 246 244 250 C 290 258 342 278 360 300 C 384 332 394 400 396 470 L 396 754 Z"
        />
        {/* NO crown and no horns, and the skull dissolves upward out of the frame rather than
            closing over. Three attempts at a top-of-head all failed the same way — a wide brim
            under a dome read as a cowboy hat, thin horns off a dome read as ears, a flat crown
            between two horns read as a chimney — and they failed because the top of the frame
            is the one place with no backlight to silhouette against and a hard vignette on top
            of that. TitanWakeScreen never draws a top of head either: it sets the eyes wide and
            low and lets the skull continue past every edge, which is both the fix and the
            throughline. What is left is a mass, a brow, a jaw, and two lights. */}
        <path className="titan-mass" d="M112 176 L106 104 C 108 30 130 -20 183 -20 C 236 -20 258 30 260 104 L254 176 Z" />
        <path className="titan-mass" d="M106 100 L260 100 L256 130 L110 130 Z" />
        <path className="titan-mass" d="M112 176 L254 176 L246 202 Q183 224 120 202 Z" />
        <path className="titan-mass" d="M142 200 L224 200 L226 224 L140 224 Z" />

        {/* The pauldrons rise ABOVE the shoulder line they sit on. Tucked under it they
            track the body's own edge a few pixels inside it, and two near-parallel rims
            read as one thick line rather than as a plate on top of a shoulder. */}
        <path className="titan-mass" d="M4 338 C 8 288 46 246 108 232 C 128 228 142 238 145 254 L 150 298 C 100 306 48 330 26 370 Z" />
        <path className="titan-mass" d="M362 338 C 358 288 320 246 258 232 C 238 228 224 238 221 254 L 216 298 C 266 306 318 330 340 370 Z" />
        <path className="titan-mass" d="M100 268 C 134 250 232 250 266 268 L 278 418 C 230 450 136 450 88 418 Z" />

        {/* Rim light: open polylines along the edges the sky actually reaches, rather than an
            outline around the whole figure. An outline would light the underside too, and a
            silhouette lit from below is a lamp, not a shape in the dark. Both edges of each
            horn are drawn — one edge alone reads as a hoop rather than as a taper. */}
        <g className="titan-rim" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M106 104 C 108 30 130 -20 183 -20" />
          <path d="M260 104 C 258 30 236 -20 183 -20" />
          <path d="M110 130 L256 130" />
          <path d="M120 202 Q183 224 246 202" />
          <path d="M146 218 C 146 238 140 246 122 250 C 76 258 24 278 6 300 C -18 332 -28 400 -30 470" />
          <path d="M220 218 C 220 238 226 246 244 250 C 290 258 342 278 360 300 C 384 332 394 400 396 470" />
          <path d="M4 338 C 8 288 46 246 108 232 C 128 228 142 238 145 254" />
          <path d="M362 338 C 358 288 320 246 258 232 C 238 228 224 238 221 254" />
          {/* Two lamellar ridges make a plate. One is a scratch, three is a fingerprint. */}
          <path className="is-faint" d="M18 318 C 32 274 68 246 118 236" />
          <path className="is-faint" d="M40 350 C 56 308 92 282 136 270" />
          <path className="is-faint" d="M348 318 C 334 274 298 246 248 236" />
          <path className="is-faint" d="M326 350 C 310 308 274 282 230 270" />
          <path className="is-faint" d="M100 268 C 134 250 232 250 266 268" />
        </g>

        {/* The binding. It is kept off the middle of the frame entirely — the collar above
            the wordmark, the flanks outside the buttons, and one heavy span across the waist
            in the band the layout leaves empty. The right flank still holds; the LEFT has
            parted, and its three loose links hang from the break. */}
        <g className="titan-chains">
          {chain([112, 196], [254, 196], 18, 9, 'c')}
          {chain([-10, 528], [376, 528], 46, 17, 'w')}
          {chain([340, 344], [344, 430], 6, 6, 'r')}
          {chain([26, 344], [22, 424], 5, 6, 'l')}
          <g className="titan-chain-loose">
            <ellipse cx="21" cy="446" rx="6.4" ry="3.8" transform="rotate(96 21 446)" />
            <ellipse cx="19" cy="460" rx="6.4" ry="1.8" transform="rotate(92 19 460)" />
            <ellipse cx="18" cy="474" rx="6.4" ry="3.8" transform="rotate(88 18 474)" />
          </g>
        </g>

        {/* The same eye TitanWakeScreen opens on, at a hundredth the size: a lens that tapers
            to points at both corners, lit from inside by pale gold burning out through the
            run's mythic red, with a vertical slit contracted to a hairline and a halo that
            bleeds past the lids. Set wide on the skull for the reason the cold open sets them
            wide on the screen — eyes further apart than a face has room for read as a head
            continuing past what you can see of it.
            ┄
            Slanted DOWN toward the middle: the same pair with the tilt reversed reads as
            startled, and this way round they read as looking at you. */}
        <g className="titan-eyes">
          <circle className="titan-eye-halo" cx="140" cy="152" r="54" />
          <circle className="titan-eye-halo" cx="226" cy="152" r="54" />
          <g className="titan-eye-lens">
            <path d="M110 152 Q140 138 170 152 Q140 166 110 152 Z" transform="rotate(8 140 152)" />
            <path d="M256 152 Q226 138 196 152 Q226 166 256 152 Z" transform="rotate(-8 226 152)" />
          </g>
          <g className="titan-eye-pupil">
            <ellipse cx="140" cy="152" rx="4.2" ry="9" transform="rotate(8 140 152)" />
            <ellipse cx="226" cy="152" rx="4.2" ry="9" transform="rotate(-8 226 152)" />
          </g>
        </g>
      </g>
    </svg>
  );
}

/** Where a pactbearer stands on the ridge, and how tall it is in the frame — see below. */
const BEARERS: readonly (readonly [number, number, number])[] = [
  [88, 700, 1],
  [106, 703, 0.86],
  [206, 681, 1.06],
  [296, 695, 0.92],
];

function bearer([x, y, s]: readonly [number, number, number], i: number) {
  const h = 11 * s;
  return (
    <g key={i}>
      <path
        d={`M${x - 2.6 * s} ${y} L${x - 2.6 * s} ${y - h} Q${x} ${y - h - 3.4 * s} ${x + 2.6 * s} ${y - h} L${x + 2.6 * s} ${y} Z`}
      />
      <circle cx={x} cy={y - h - 5.4 * s} r={2.2 * s} />
    </g>
  );
}

/**
 * The foreground ridge, and four figures on it. This layer exists for exactly one reason:
 * nothing else on the screen gives the Titan a scale. A silhouette the size of the frame is
 * only big if something known-small stands in front of it, and these are ~15px against a
 * figure that runs off the top edge — about forty to one.
 */
export function TitanRidge() {
  return (
    <svg
      className="title-ridge"
      style={FILL}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {/* A second, further crest with three broken towers on it — the garrison the wardens
          decayed into (docs/lore.md §2), and the reason the band between the buttons and the
          near ridge is distance rather than emptiness. Lighter fill, no rim: further away. */}
      <g className="title-ridge-far">
        <path d="M-20 754 L-20 646 L36 630 L74 642 L118 622 L152 638 L206 616 L252 634 L302 618 L344 636 L386 624 L386 754 Z" />
        <path d="M96 632 L94 578 L102 570 L110 578 L112 596 L118 592 L120 634 Z" />
        <path d="M232 622 L230 560 L240 550 L248 560 L250 606 L244 602 L246 626 Z" />
        <path d="M318 626 L316 592 L324 584 L330 592 L332 628 Z" />
      </g>

      <g className="title-ridge-figures">{BEARERS.map(bearer)}</g>
      <path
        className="title-ridge-band"
        d="M-20 754 L-20 706 L30 692 L76 706 L124 684 L168 700 L212 678 L256 698 L306 682 L350 702 L386 690 L386 754 Z"
      />
      {/* One hairline along the crest, which is the only part of the ridge the sky can see. */}
      <path
        className="title-ridge-crest"
        fill="none"
        d="M-20 706 L30 692 L76 706 L124 684 L168 700 L212 678 L256 698 L306 682 L350 702 L386 690"
      />
    </svg>
  );
}
