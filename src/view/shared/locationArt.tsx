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

// A basilica: the dome and its lantern spire between two bell towers, a colonnade running off
// both edges under an entablature, and a pair of obelisks on the near side. Every arch is a
// solid — the band is filled shapes only — so the colonnade reads as columns against the glow.
const HOLY_SANCTUM = (
  <>
    <path d="M-10 92 L-10 62 L118 62 L118 92 Z" opacity="0.55" />
    <path d="M282 92 L282 62 L410 62 L410 92 Z" opacity="0.55" />
    <path d="M-10 58 L118 58 L118 64 L-10 64 Z" />
    <path d="M282 58 L410 58 L410 64 L282 64 Z" />
    <path d="M4 92 L4 64 L12 64 L12 92 Z M28 92 L28 64 L36 64 L36 92 Z M52 92 L52 64 L60 64 L60 92 Z M76 92 L76 64 L84 64 L84 92 Z M100 92 L100 64 L108 64 L108 92 Z" />
    <path d="M292 92 L292 64 L300 64 L300 92 Z M316 92 L316 64 L324 64 L324 92 Z M340 92 L340 64 L348 64 L348 92 Z M364 92 L364 64 L372 64 L372 92 Z M388 92 L388 64 L396 64 L396 92 Z" />
    <path d="M118 92 L118 40 L124 40 L124 30 L128 22 L132 30 L132 40 L138 40 L138 92 Z" />
    <path d="M262 92 L262 40 L268 40 L268 30 L272 22 L276 30 L276 40 L282 40 L282 92 Z" />
    <path d="M138 92 L138 56 L262 56 L262 92 Z" />
    <path d="M148 56 Q200 14 252 56 Z" />
    <path d="M194 22 L194 12 L198 12 L200 -4 L202 12 L206 12 L206 22 Z" />
    <path d="M186 24 L214 24 L214 30 L186 30 Z" />
    <path d="M60 58 L64 34 L68 58 Z" opacity="0.85" />
    <path d="M332 58 L336 34 L340 58 Z" opacity="0.85" />
    <rect x="-10" y="88" width="420" height="22" />
  </>
);

// Towers that lean on nothing: every spire is off plumb by a different angle, two blocks hang in
// the air with no ground under them, and a stair climbs to where a tower is not. The right-hand
// spire runs past the top edge (a point, never the width).
const DREAMING_SPIRES = (
  <>
    <path d="M36 92 L26 30 L46 26 L62 92 Z" />
    <path d="M110 92 L124 38 L138 40 L134 92 Z" />
    <path d="M150 92 L158 8 L172 10 L180 92 Z" />
    <path d="M330 92 L346 -10 L356 -8 L354 92 Z" />
    <path d="M78 46 L112 40 L114 50 L80 56 Z" opacity="0.85" />
    <path d="M252 30 L286 34 L284 44 L250 40 Z" opacity="0.85" />
    <path d="M196 92 L196 70 L212 70 L212 62 L228 62 L228 54 L244 54 L244 46 L260 46 L260 92 Z" />
    <path d="M270 92 L278 58 L296 58 L304 92 Z" />
    <path d="M382 92 L386 52 L398 52 L402 92 Z" />
    <path d="M-10 84 Q 60 78 130 84 T 270 84 T 410 82 L410 110 L-10 110 Z" />
  </>
);

// A range with one peak higher than the frame, a spire on it and a rod above that; a shoulder of
// cloud below the ridge, a watch-tower on the near side.
const THUNDER_AERIE = (
  <>
    <path d="M-10 92 L-10 78 L40 66 L86 72 L128 48 L160 30 L192 8 L200 -6 L208 8 L236 32 L272 54 L310 62 L352 52 L410 74 L410 92 Z" />
    <path d="M196 20 L200 -22 L204 20 Z" />
    <path d="M-10 84 Q 50 74 110 84 T 240 84 T 410 82 L410 110 L-10 110 Z" opacity="0.7" />
    <path d="M300 92 L300 64 L306 64 L306 56 L310 50 L314 56 L314 64 L320 64 L320 92 Z" />
    <path d="M60 92 L64 62 L70 62 L74 92 Z" opacity="0.8" />
  </>
);

// Ice: two shelves with a broken edge between them, a ship frozen into the reach with its mast
// standing, a berg on the far side.
const FROZEN_REACH = (
  <>
    <path d="M-10 92 L-10 62 L30 62 L36 52 L92 52 L100 62 L140 62 L146 72 L-10 72 Z" />
    <path d="M-10 92 L-10 70 L150 70 L150 92 Z" />
    <path d="M272 92 L272 58 L300 58 L306 48 L360 48 L368 58 L410 58 L410 92 Z" />
    <path d="M300 92 L318 16 L342 92 Z" />
    <rect x="212" y="26" width="3" height="56" />
    <path d="M215 30 L242 46 L215 54 Z" opacity="0.7" />
    <path d="M178 80 Q 213 92 248 80 L242 90 L184 90 Z" />
    <path d="M150 92 L156 86 L200 84 L226 86 L272 84 L272 92 Z" opacity="0.85" />
    <rect x="-10" y="88" width="420" height="22" />
  </>
);

export const LOCATION_HORIZONS: Record<string, ReactNode> = {
  wildsEdge: WILDS_EDGE,
  forbiddenForest: FORBIDDEN_FOREST,
  moltenFoundry: MOLTEN_FOUNDRY,
  stormCoast: STORM_COAST,
  necropolis: NECROPOLIS,
  blightedShrine: BLIGHTED_SHRINE,
  holySanctum: HOLY_SANCTUM,
  dreamingSpires: DREAMING_SPIRES,
  thunderAerie: THUNDER_AERIE,
  frozenReach: FROZEN_REACH,
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
