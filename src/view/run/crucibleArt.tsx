// The Crucible's vessel: a hanging iron bowl of molten gold, drawn as holes cut in the light
// behind it (the same trick as titanArt.tsx). Every plate is one near-black fill; the structure is
// the rim highlights, which are the only edges the fire can reach.

/** Where the rim sits in the vessel's own 394×200 box — the chains hang from its two ends. */
export const VESSEL_RIM_Y = 74;
export const VESSEL_HEIGHT = 200;

const BUBBLES = [
  { cx: 150, cy: 76, r: 3.2, delay: 0 },
  { cx: 226, cy: 70, r: 2.4, delay: 1.7 },
  { cx: 188, cy: 80, r: 2.8, delay: 3.1 },
  { cx: 262, cy: 78, r: 2.1, delay: 4.6 },
  { cx: 121, cy: 69, r: 2, delay: 2.4 },
];

export function CrucibleVessel() {
  return (
    <svg className="crucible-vessel" viewBox={`0 0 394 ${VESSEL_HEIGHT}`} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="crucible-melt" cx="50%" cy="45%" r="60%">
          <stop offset="0" stopColor="#fff6c4" />
          <stop offset="0.28" stopColor="#ffcf5a" />
          <stop offset="0.62" stopColor="#f07b22" />
          <stop offset="0.9" stopColor="#8a2410" />
          <stop offset="1" stopColor="#3a0d08" />
        </radialGradient>
        <linearGradient id="crucible-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3b2314" />
          <stop offset="0.35" stopColor="#15100d" />
          <stop offset="1" stopColor="#06070a" />
        </linearGradient>
        <linearGradient id="crucible-edge" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffb85c" stopOpacity="0.9" />
          <stop offset="0.5" stopColor="#c8631f" stopOpacity="0.35" />
          <stop offset="1" stopColor="#c8631f" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="crucible-lip" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7a3a12" />
          <stop offset="0.5" stopColor="#ffd98a" />
          <stop offset="1" stopColor="#7a3a12" />
        </linearGradient>
        <filter id="crucible-soft" x="-20%" y="-60%" width="140%" height="220%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>

      {/* The floor under it, and the stone the vessel stands over. */}
      <ellipse cx="197" cy="188" rx="150" ry="9" fill="#000" opacity="0.55" />
      <path d="M137 172h120l6 22H131Z" fill="#0a0b0f" />
      <path d="M139 172h116" stroke="#4a2c18" strokeWidth="1.4" opacity="0.7" />

      {/* Body: the bowl, dark, with light only along the two side edges. */}
      <path d="M47 74C58 150 118 184 197 184s139-34 150-110Z" fill="url(#crucible-body)" />
      <path d="M47 74C58 150 118 184 197 184s139-34 150-110" fill="none" stroke="url(#crucible-edge)" strokeWidth="2.2" />
      {/* Two iron hoops. */}
      <path d="M58 106a145 20 0 0 0 278 0" fill="none" stroke="#6a3a1c" strokeWidth="3" opacity="0.55" />
      <path d="M78 140a125 18 0 0 0 238 0" fill="none" stroke="#6a3a1c" strokeWidth="2.6" opacity="0.4" />

      {/* The mouth: inner wall, then the melt, then its moving slick and the bubbles. */}
      <ellipse cx="197" cy="74" rx="150" ry="24" fill="#120806" />
      <ellipse className="crucible-melt" cx="197" cy="74" rx="138" ry="19" fill="url(#crucible-melt)" />
      <ellipse className="crucible-slick" cx="197" cy="72" rx="84" ry="7" fill="#fffbe0" opacity="0.5" filter="url(#crucible-soft)" />
      {BUBBLES.map((b, i) => (
        <circle
          key={i}
          className="crucible-bubble"
          cx={b.cx}
          cy={b.cy}
          r={b.r}
          fill="#fff4c0"
          style={{ animationDelay: `${b.delay}s` }}
        />
      ))}

      {/* The front lip, hot at the centre where the melt lights it and iron at the ends. */}
      <path d="M47 74a150 24 0 0 0 300 0" fill="none" stroke="#1a0e08" strokeWidth="7" />
      <path d="M47 74a150 24 0 0 0 300 0" fill="none" stroke="url(#crucible-lip)" strokeWidth="3" />
      <path d="M47 74a150 24 0 0 0 300 0" fill="none" stroke="#fff1c0" strokeWidth="0.9" opacity="0.55" />
    </svg>
  );
}

/** One hanging chain: a tiled pattern, so it can be any height the stage gives it. */
export function CrucibleChain({ side }: { side: 'left' | 'right' }) {
  const id = `crucible-links-${side}`;
  return (
    <svg className={`crucible-chain is-${side}`} aria-hidden="true" focusable="false">
      <defs>
        <pattern id={id} width="16" height="26" patternUnits="userSpaceOnUse">
          <ellipse cx="8" cy="8" rx="5.2" ry="7.6" fill="#07080b" stroke="#c98a45" strokeWidth="1.5" />
          <rect x="6.2" y="14" width="3.6" height="12" rx="1.8" fill="#0d0e12" stroke="#a86a30" strokeWidth="1.2" />
        </pattern>
      </defs>
      <rect width="16" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
