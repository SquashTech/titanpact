import type { ReactNode } from 'react';

// One horizon silhouette band per Location (docs/locations.md §4): 400x110, filled shapes only,
// `currentColor` only. Shapes overrun the viewBox edges so the band never shows a seam.

const WILDS_EDGE = (
  <>
    <path d="M-10 78 Q 60 52 130 70 T 270 62 T 410 74 L 410 110 L -10 110 Z" opacity="0.45" />
    <path d="M18 88 L30 46 L42 88 Z" />
    <path d="M44 88 L58 34 L72 88 Z" />
    <path d="M74 88 L84 54 L94 88 Z" />
    <path d="M150 88 L162 42 L174 88 Z" />
    <path d="M176 88 L188 58 L200 88 Z" />
    <path d="M262 88 L276 38 L290 88 Z" />
    <path d="M292 88 L302 60 L312 88 Z" />
    <path d="M336 88 L350 48 L364 88 Z" />
    <path d="M366 88 L378 62 L390 88 Z" />
    <path d="M108 92 L108 60 L113 52 L118 60 L118 92 Z" />
    <path d="M122 92 L122 66 L127 58 L132 66 L132 92 Z" />
    <path d="M212 92 L212 62 L217 54 L222 62 L222 92 Z" />
    <path d="M226 92 L226 70 L231 62 L236 70 L236 92 Z" />
    <path d="M-10 86 Q 100 80 200 86 T 410 84 L410 110 L-10 110 Z" />
  </>
);

// Trunks run past y=0 so the viewport clips them; nothing spans the top edge (it would harden the rim light).
const FORBIDDEN_FOREST = (
  <>
    <path d="M22 92 L30 -8 L42 -8 L38 92 Z" />
    <path d="M78 92 L70 -8 L82 -8 L94 92 Z" />
    <path d="M140 92 L150 -8 L160 -8 L152 92 Z" />
    <path d="M206 92 L198 -8 L212 -8 L220 92 Z" />
    <path d="M272 92 L282 -8 L292 -8 L282 92 Z" />
    <path d="M330 92 L322 -8 L336 -8 L346 92 Z" />
    <path d="M382 92 L390 -8 L400 -8 L396 92 Z" />
    <path d="M52 92 L58 72 L64 92 Z" opacity="0.85" />
    <path d="M172 92 L179 66 L186 92 Z" opacity="0.85" />
    <path d="M248 92 L254 74 L260 92 Z" opacity="0.85" />
    <path d="M356 92 L362 70 L368 92 Z" opacity="0.85" />
    <path d="M-10 84 Q 30 72 62 84 Q 96 70 130 84 Q 168 72 200 84 Q 238 70 272 84 Q 310 72 344 84 Q 380 70 410 84 L410 110 L-10 110 Z" />
  </>
);

const MOLTEN_FOUNDRY = (
  <>
    <path d="M52 90 L56 22 L50 22 L50 12 L76 12 L76 22 L70 22 L74 90 Z" />
    <path d="M146 90 L149 34 L143 34 L143 25 L167 25 L167 34 L161 34 L164 90 Z" />
    <path d="M300 90 L304 18 L297 18 L297 8 L324 8 L324 18 L317 18 L321 90 Z" />
    <path d="M-10 90 L-10 66 L28 66 L28 78 L96 78 L96 58 L126 58 L126 74 L188 74 L188 62 L214 62 L214 82 L268 82 L268 68 L286 68 L286 90 Z" />
    <path d="M334 90 L334 70 L360 70 L360 60 L392 60 L392 76 L410 76 L410 90 Z" />
    <rect x="-10" y="88" width="420" height="22" />
  </>
);

// Longships sit entirely above y=78: the Enter button covers the band's lowest quarter.
const STORM_COAST = (
  <>
    <path d="M-10 110 L-10 40 L14 30 L34 54 L52 44 L70 72 L88 66 L104 92 L-10 92 Z" />
    <path d="M410 110 L410 26 L386 18 L364 46 L344 36 L322 68 L302 60 L288 92 L410 92 Z" />
    <rect x="200" y="40" width="3" height="36" />
    <path d="M178 46 Q 201 42 224 46 L220 64 Q 201 68 182 64 Z" opacity="0.62" />
    <path d="M170 68 Q 201 78 232 68 L226 76 Q 201 84 176 76 Z" />
    <rect x="272" y="54" width="2" height="22" />
    <path d="M259 58 Q 273 56 287 58 L285 69 Q 273 71 261 69 Z" opacity="0.4" />
    <path d="M254 72 Q 273 78 292 72 L288 77 Q 273 82 258 77 Z" opacity="0.6" />
    <path d="M-10 88 Q 40 82 90 88 T 190 88 T 290 88 T 410 88 L410 110 L-10 110 Z" />
  </>
);

const NECROPOLIS = (
  <>
    <path d="M186 92 L186 46 L196 46 L196 24 L202 -6 L208 24 L208 46 L218 46 L218 92 Z" />
    <path d="M176 92 L176 60 L186 60 L186 92 Z" />
    <path d="M218 92 L218 60 L228 60 L228 92 Z" />
    <path d="M24 90 L24 68 Q 24 58 34 58 Q 44 58 44 68 L44 90 Z" />
    <path d="M58 90 L60 72 Q 61 62 70 63 Q 79 64 78 74 L76 90 Z" />
    <path d="M112 90 L112 64 Q 112 54 122 54 Q 132 54 132 64 L132 90 Z" />
    <path d="M258 90 L256 70 Q 255 60 264 59 Q 273 58 274 68 L276 90 Z" />
    <path d="M304 90 L304 66 Q 304 56 314 56 Q 324 56 324 66 L324 90 Z" />
    <path d="M356 90 L356 72 Q 356 62 366 62 Q 376 62 376 72 L376 90 Z" />
    <path d="M88 90 L88 56 L84 56 L84 50 L88 50 L88 44 L94 44 L94 50 L98 50 L98 56 L94 56 L94 90 Z" />
    <path d="M238 90 L242 58 L238 57 L239 51 L243 52 L244 46 L250 47 L249 53 L253 54 L252 60 L248 59 L244 90 Z" />
    <path d="M-10 88 Q 90 84 200 88 T 410 86 L410 110 L-10 110 Z" />
  </>
);

const BLIGHTED_SHRINE = (
  <>
    <path d="M22 92 L22 30 L18 30 L18 22 L44 22 L44 30 L40 30 L40 92 Z" />
    <path d="M334 92 L334 26 L330 26 L330 18 L356 18 L356 26 L352 26 L352 92 Z" />
    <path d="M78 92 L78 48 L84 40 L90 50 L96 44 L96 92 Z" />
    <path d="M290 92 L290 56 L296 46 L302 58 L308 50 L308 92 Z" />
    <path d="M126 92 L126 66 L132 60 L138 68 L138 92 Z" />
    <path d="M240 92 L240 84 L282 84 L282 92 Z" opacity="0.8" />
    <path d="M160 92 L160 82 L176 82 L176 70 L188 70 L188 56 L216 56 L216 70 L228 70 L228 82 L244 82 L244 92 Z" />
    <path d="M202 44 L210 34 L202 24 L194 34 Z" opacity="0.75" />
    <rect x="-10" y="90" width="420" height="20" />
  </>
);

export const LOCATION_HORIZONS: Record<string, ReactNode> = {
  wildsEdge: WILDS_EDGE,
  forbiddenForest: FORBIDDEN_FOREST,
  moltenFoundry: MOLTEN_FOUNDRY,
  stormCoast: STORM_COAST,
  necropolis: NECROPOLIS,
  blightedShrine: BLIGHTED_SHRINE,
};

/** Renders nothing for an unknown id: a missing horizon should look like plain sky, not the wrong place. */
export function LocationHorizon({ locationId }: { locationId: string }) {
  const art = LOCATION_HORIZONS[locationId];
  if (!art) return null;
  return (
    // "none" on purpose: "meet" is ~120px tall on a phone, "slice" crops Storm Coast's headlands.
    <svg className="location-horizon" viewBox="0 0 400 110" preserveAspectRatio="none" aria-hidden="true">
      {art}
    </svg>
  );
}
