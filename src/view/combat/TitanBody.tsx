// The Titan's Eyes fight (docs/titan-eyes.md): the arena IS the Titan. There is no ground and
// no sky — the whole field is a stretch of its hide, plates the size of countries seamed by
// cracks the ember shows through, curving away on every side because the thing under the
// heroes' feet is round at a scale the frame cannot hold. The brow is the one edge in the
// picture: a dark ridge across the top that the Eyes open under. Drawn in Ancient's tones
// (typeColors.ts), stretched to the arena, under every figure and over the floor's perspective.
//
// The heartbeat is the only motion: the veins pulse on a slow loop (styles.css .titan-body-veins).
// Everything else holds still, which is the point — it was never in a hurry.

import { memo } from 'react';

/** Concentric arcs about a centre far below the frame: a cylinder seen from standing on it. */
const SEAM_CENTRE = { x: 200, y: 1180 };
const SEAM_RADII = [860, 940, 1030, 1110, 1200];
/** Radial seams, splitting the plates the way a hide splits over a joint. */
const RADIAL_SEAMS = [-0.34, -0.18, -0.02, 0.15, 0.31];

function arc(r: number): string {
  // The chord of a circle of radius r centred below the frame, from x=-20 to x=420.
  const dy = (x: number) => SEAM_CENTRE.y - Math.sqrt(Math.max(0, r * r - (x - SEAM_CENTRE.x) ** 2));
  const xs = [-20, 60, 140, 200, 260, 340, 420];
  return xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x},${dy(x).toFixed(1)}`).join(' ');
}

function radial(t: number): string {
  // A line from the centre outward, clipped to the frame: the angle is a fraction of the top arc.
  const x0 = SEAM_CENTRE.x + Math.sin(t) * SEAM_RADII[0];
  const y0 = SEAM_CENTRE.y - Math.cos(t) * SEAM_RADII[0];
  const x1 = SEAM_CENTRE.x + Math.sin(t) * (SEAM_RADII[SEAM_RADII.length - 1] + 120);
  const y1 = SEAM_CENTRE.y - Math.cos(t) * (SEAM_RADII[SEAM_RADII.length - 1] + 120);
  return `M${x0.toFixed(1)},${y0.toFixed(1)} L${x1.toFixed(1)},${y1.toFixed(1)}`;
}

/** The ember under the hide: cracks that branch off the seams and glow. */
const VEINS = [
  'M30,330 c14,-10 22,-26 20,-44 c-2,-12 6,-20 18,-22 M50,286 c10,4 16,12 18,24',
  'M352,300 c-12,-12 -16,-28 -10,-44 c4,-10 0,-20 -12,-26 M342,256 c-12,2 -20,10 -24,22',
  'M196,378 c4,-16 -2,-30 -12,-40 c-6,-6 -4,-16 4,-22 M184,338 c12,-2 22,4 28,14',
  'M96,222 c-10,-10 -14,-22 -8,-36 M88,186 c-10,2 -18,-2 -24,-10',
  'M304,214 c8,-12 10,-26 2,-38 M306,176 c10,-2 16,-10 18,-20',
  'M14,140 c10,-8 14,-20 10,-34 M24,106 c8,-4 12,-12 12,-22',
  'M386,150 c-10,-8 -12,-22 -6,-36 M380,114 c-8,-4 -12,-12 -12,-22',
  'M150,120 c8,-10 20,-14 34,-10 M184,110 c6,6 8,14 6,22',
];

export const TitanBody = memo(function TitanBody() {
  return (
    <svg className="titan-body" viewBox="0 0 400 400" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="titan-hide" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#12150d" />
          <stop offset="0.5" stopColor="#2a3020" />
          <stop offset="1" stopColor="#0d100a" />
        </linearGradient>
        {/* The mass curving away on every side: dark at the edges, lit where it faces us. */}
        <radialGradient id="titan-round" cx="50%" cy="50%" r="58%">
          <stop offset="0" stopColor="#07050a" stopOpacity="0" />
          <stop offset="0.7" stopColor="#07050a" stopOpacity="0.25" />
          <stop offset="1" stopColor="#07050a" stopOpacity="0.8" />
        </radialGradient>
        <filter id="titan-vein-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <radialGradient id="titan-ember" cx="50%" cy="52%" r="60%">
          <stop offset="0" stopColor="#e0393f" stopOpacity="0.22" />
          <stop offset="0.55" stopColor="#e0393f" stopOpacity="0.06" />
          <stop offset="1" stopColor="#e0393f" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="titan-brow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#07050a" stopOpacity="0.95" />
          <stop offset="1" stopColor="#07050a" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="400" height="400" fill="url(#titan-hide)" />
      <rect x="0" y="0" width="400" height="400" fill="url(#titan-ember)" />
      <rect x="0" y="0" width="400" height="400" fill="url(#titan-round)" />

      {/* The plates: their lit upper edge, then the seam itself; a finer set between, where a plate has split. */}
      <g className="titan-body-seams" fill="none" strokeLinecap="round">
        {SEAM_RADII.slice(0, -1).map((r, i) => (
          <path key={`f${r}`} d={arc((r + SEAM_RADII[i + 1]) / 2)} stroke="#07050a" strokeWidth="1.4" opacity="0.35" strokeDasharray="90 40 160 70" />
        ))}
        {SEAM_RADII.map((r) => (
          <path key={`l${r}`} d={arc(r)} stroke="#8a9c5e" strokeWidth="1.2" opacity="0.22" transform="translate(0 -3)" />
        ))}
        {SEAM_RADII.map((r) => (
          <path key={`s${r}`} d={arc(r)} stroke="#07050a" strokeWidth="4" opacity="0.7" />
        ))}
        {RADIAL_SEAMS.map((t) => (
          <path key={`r${t}`} d={radial(t)} stroke="#07050a" strokeWidth="3" opacity="0.5" />
        ))}
      </g>

      {/* The ember veins, pulsing: a blurred glow under a thin bright line. */}
      <g className="titan-body-veins" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {VEINS.map((d, i) => (
          <path key={`b${i}`} d={d} stroke="#e0393f" strokeWidth="5" opacity="0.45" filter="url(#titan-vein-glow)" />
        ))}
        {VEINS.map((d, i) => (
          <path key={i} d={d} stroke="#e0393f" strokeWidth="1.6" opacity="0.7" />
        ))}
        {VEINS.map((d, i) => (
          <path key={`g${i}`} d={d} stroke="#f6dc96" strokeWidth="0.6" opacity="0.5" />
        ))}
      </g>

      {/* The brow: the ridge the Eyes open under, furrowed — lowest at the centre. */}
      <path d="M-10,-10 L410,-10 L410,52 C 330,50 250,66 200,84 C 150,66 70,50 -10,52 Z" fill="url(#titan-brow)" />
      <path d="M-10,52 C 70,50 150,66 200,84 C 250,66 330,50 410,52" fill="none" stroke="#8a9c5e" strokeWidth="1.4" opacity="0.3" />
    </svg>
  );
});
