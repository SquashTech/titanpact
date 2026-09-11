// The title screen's two silhouette layers (docs/lore.md §1): the bound Titan's eyes behind
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
 * The Titan: two eyes and the brow over them, and nothing else. The body, the pauldrons,
 * the rim light and the chains all came off (2026-09-11) — drawn, the figure competed with
 * the wordmark for the frame and read as a portrait, which is the wrong scale. What is left
 * is what TitanWakeScreen opens on: a skull continuing past every edge, sensed only by where
 * the backlight is not, and two lights set wider apart than a face has room for.
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

      <g className="titan-figure">
        {/* The one piece of form kept: a brow heavy enough to throw the eyes into shadow. It
            runs off the top and both sides and has exactly one edge, the lower one, so it is
            not a shape but the place the ember stops. Furrowed — lowest at the centre — because
            a brow that lifts at the middle is surprised, and this one is not. */}
        <path
          className="titan-mass"
          d="M-10 -10 L376 -10 L376 84 C 320 84 240 96 183 116 C 126 96 46 84 -10 84 Z"
        />

        {/* The same eye TitanWakeScreen opens on: a lens that tapers to points at both
            corners, lit from inside by pale gold burning out through the run's mythic red,
            with a vertical slit contracted to a hairline and a halo that bleeds past the lids.
            ┄
            Slanted DOWN toward the middle: the same pair with the tilt reversed reads as
            startled, and this way round they read as looking at you. */}
        <g className="titan-eyes">
          <circle className="titan-eye-halo" cx="108" cy="136" r="104" />
          <circle className="titan-eye-halo" cx="258" cy="136" r="104" />
          <g className="titan-eye-lens">
            <path d="M44 136 Q108 112 172 136 Q108 160 44 136 Z" transform="rotate(7 108 136)" />
            <path d="M322 136 Q258 112 194 136 Q258 160 322 136 Z" transform="rotate(-7 258 136)" />
          </g>
          <g className="titan-eye-pupil">
            <ellipse cx="108" cy="136" rx="7.5" ry="20" transform="rotate(7 108 136)" />
            <ellipse cx="258" cy="136" rx="7.5" ry="20" transform="rotate(-7 258 136)" />
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
