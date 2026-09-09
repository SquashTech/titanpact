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
 * The Titan: crowned, bowed, and chained, with the horns running off the top edge because
 * a colossus that fits in frame is not one. The face is three bands and two slits — a brow
 * heavy enough to throw the eyes into shadow, a jaw, and a throat. Any more detail and it
 * starts reading as a character portrait, which is the wrong scale entirely.
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
        {/* The figure dissolves into the fog well before the floor, so the ridge in front of
            it reads as far away rather than as leaning against it. */}
        <linearGradient id="titan-dissolve" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="1" />
          <stop offset="72%" stopColor="#fff" stopOpacity="1" />
          <stop offset="94%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="titan-fade">
          <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill="url(#titan-dissolve)" />
        </mask>
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
        <path className="titan-mass" d="M140 128 C 104 112 76 62 58 -26 L 72 -30 C 96 40 130 82 172 96 Z" />
        <path className="titan-mass" d="M226 128 C 262 112 290 62 308 -26 L 294 -30 C 270 40 236 82 194 96 Z" />
        <path className="titan-mass" d="M158 46 L163 18 L172 44 Z" />
        <path className="titan-mass" d="M177 38 L183 6 L189 38 Z" />
        <path className="titan-mass" d="M194 44 L203 18 L208 46 Z" />
        <path className="titan-mass" d="M132 162 L126 96 Q129 58 158 44 L183 34 L208 44 Q237 58 240 96 L234 162 Z" />
        <path className="titan-mass" d="M126 100 L240 100 L234 128 L132 128 Z" />
        <path className="titan-mass" d="M133 162 L233 162 L226 190 Q183 208 140 190 Z" />
        <path className="titan-mass" d="M150 190 L216 190 L220 224 L146 224 Z" />

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
          <path d="M72 -30 C 96 40 130 82 172 96" />
          <path d="M58 -26 C 76 62 104 112 140 128" />
          <path d="M294 -30 C 270 40 236 82 194 96" />
          <path d="M308 -26 C 290 62 262 112 226 128" />
          <path d="M126 96 Q129 58 158 44 L183 34 L208 44 Q237 58 240 96" />
          <path d="M132 128 L234 128" />
          <path d="M140 190 Q183 208 226 190" />
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

        {/* Slanted DOWN toward the middle. The same two slits with the tilt reversed read as
            startled; this way round they read as looking at you, which is the point. */}
        <g className="titan-eyes">
          <path d="M143 132 L167 141 L166 146 L142 138 Z" />
          <path d="M223 132 L199 141 L200 146 L224 138 Z" />
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
