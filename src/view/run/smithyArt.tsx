import type { CSSProperties } from 'react';

// The Smithy's own hardware (ItemServicesSection, SmithyWorkSheet, SmithyBeat): an anvil in side
// view, the hammer that works it, and the Enchanter's circle. Drawn in the node glyphs' flat
// geometry rather than the heroes' pixel art — they are furniture, not figures — and lit from the
// upper left like every piece (`.item-piece`), so a chit sitting on the anvil is lit the same way
// the anvil is.

/** London-pattern anvil on a stump: horn left, heel right, the face a flat highlight. */
export function AnvilFigure({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 120 84" aria-hidden="true">
      <defs>
        <linearGradient id="smithy-anvil-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8f97a6" />
          <stop offset="0.45" stopColor="#4c5363" />
          <stop offset="1" stopColor="#262b36" />
        </linearGradient>
        <linearGradient id="smithy-anvil-face" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#c6ccd8" />
          <stop offset="1" stopColor="#8b93a3" />
        </linearGradient>
        <linearGradient id="smithy-stump" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5a3f2a" />
          <stop offset="1" stopColor="#2a1c12" />
        </linearGradient>
      </defs>
      {/* Stump */}
      <path d="M38 60h44l4 22H34Z" fill="url(#smithy-stump)" />
      <path d="M38 60h44l1 4H37Z" fill="#6b4c33" />
      {/* Base, waist, body */}
      <path d="M30 52h60l6 9H24Z" fill="#33394a" />
      <path d="M40 40h40v12H40Z" fill="#3a4150" />
      {/* The body: horn tapering left, heel squared right */}
      <path d="M6 24c8-4 18-6 30-6h72v18H36c-10 0-20-2-30-6Z" fill="url(#smithy-anvil-body)" />
      {/* Face highlight — the flat the hammer lands on */}
      <path d="M36 18h72v4H36Z" fill="url(#smithy-anvil-face)" />
      {/* Hardy hole */}
      <rect x="96" y="24" width="5" height="5" fill="#1a1d25" />
      {/* Edge shadow under the overhang */}
      <path d="M36 36h72v2H36Z" fill="#1c2029" />
    </svg>
  );
}

/** A cross-peen smith's hammer, head up. Rotated at its handle's foot by the beat's keyframes. */
export function HammerFigure({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 60 110" aria-hidden="true">
      <defs>
        <linearGradient id="smithy-hammer-head" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#aab2c1" />
          <stop offset="0.5" stopColor="#5b6272" />
          <stop offset="1" stopColor="#2d323e" />
        </linearGradient>
        <linearGradient id="smithy-hammer-haft" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7a5636" />
          <stop offset="0.5" stopColor="#a9784c" />
          <stop offset="1" stopColor="#5d4027" />
        </linearGradient>
      </defs>
      <path d="M26 30h8v78h-8Z" fill="url(#smithy-hammer-haft)" />
      <path d="M25 96h10v6H25Z" fill="#3a2718" />
      {/* Head: a flat face on the left, the peen tapering right */}
      <path d="M8 12h32l12 6v10l-12 6H8Z" fill="url(#smithy-hammer-head)" />
      <path d="M8 12h32v3H8Z" fill="#c9d0dc" />
      <path d="M8 31h32v3H8Z" fill="#1d212a" />
    </svg>
  );
}

/** The Enchanter's circle: two rune rings, ticks and a hexagram, each ring turning its own way in CSS. */
export function RuneRing({ className, style }: { className?: string; style?: CSSProperties }) {
  const ticks = Array.from({ length: 24 }, (_, i) => (i * 360) / 24);
  return (
    <svg className={className} style={style} viewBox="0 0 200 200" aria-hidden="true">
      <g className="smithy-rune-outer" fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="100" cy="100" r="92" opacity="0.7" />
        <circle cx="100" cy="100" r="82" opacity="0.35" />
        {ticks.map((deg, i) => (
          <line
            key={i}
            x1="100"
            y1="8"
            x2="100"
            y2={i % 3 === 0 ? 22 : 14}
            transform={`rotate(${deg} 100 100)`}
            opacity={i % 3 === 0 ? 0.95 : 0.5}
          />
        ))}
      </g>
      <g className="smithy-rune-inner" fill="none" stroke="currentColor" strokeWidth="1.4">
        <circle cx="100" cy="100" r="58" opacity="0.6" />
        <polygon points="100,44 148,128 52,128" opacity="0.7" />
        <polygon points="100,156 52,72 148,72" opacity="0.7" />
        <circle cx="100" cy="100" r="34" opacity="0.4" strokeDasharray="6 5" />
      </g>
    </svg>
  );
}
