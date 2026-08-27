// Pixel-art glyphs for Field Effects, cut from the Pixel Odyssey iconset —
// see docs/icon-pack.md for the sheet's structure, the per-concept picks and
// why each was chosen.
//
// SIZING (docs/icon-pack.md "The size constraint"): sources are 32x32, so the
// only honest display sizes are 32px and 16px. 16px is a true halving — every
// other source pixel is dropped, not blended — and anything below that is
// what an earlier pixel-art attempt meant by "turned to noise". Every glyph
// slot in styles.css that draws from this file is therefore pinned to exactly
// 16px. Do not set a size here that isn't 16 or 32.
//
// WHAT LEFT, AND WHY THIS IS THE LAST MAP STANDING. Three families used to
// live here and are vector now (docs/icon-pack.md "Where this pack does NOT
// apply"):
//
// - MoveKindBadge's four glyphs became the stat glyphs themselves
//   (statIcons.tsx MoveKindGlyph), so a physical move wears the Attack sword
//   and a magical one the Intelligence spark — the literal stat each pipeline
//   reads.
// - The nine status glyphs became statusIcons.tsx's STATUS_PATHS: a status
//   chip sets its own color and a PNG could not take it, which is why the old
//   icon needed a drop-shadow to separate from the chip it belonged to.
// - The eleven Elemental Force glyphs became element x arrow, composed in
//   statusIcons.tsx from elementIcons.tsx. Eleven, not fifteen, is the whole
//   story: this pack has no element row for Iron, Mech, Beast or Ancient, so
//   four of the fifteen chips had always fallen back to an emoji.
//
// The extracted PNGs are left in art/icons/ rather than deleted; nothing
// imports them.
//
// Field Effects stay here because the plaque they render on is a fixed 32px
// slot on the horizon — the one surface in the app big enough to show this
// pack at native resolution, and the one whose glyph never needs to be
// recolored.

import surgingMagicIcon from '../../../art/icons/field-effect/surging-magic.png';
import scorchedLandIcon from '../../../art/icons/field-effect/scorched-land.png';
import stasisBubbleIcon from '../../../art/icons/field-effect/stasis-bubble.png';
import sanctuaryIcon from '../../../art/icons/field-effect/sanctuary.png';
import verdantEarthIcon from '../../../art/icons/field-effect/verdant-earth.png';

/**
 * Per-Field-Effect glyphs, keyed by fieldEffectId (src/data/fieldEffects.ts).
 *
 * Each is its flavorType's element carrying the iconset matrix's "cycle
 * arrows" modifier, deliberately NOT the plain element glyph: the plaque sits
 * on the horizon at the same moment status badges sit on the figures, so
 * Scorched Land wearing Burn's flame (or Stasis Bubble wearing Daze's Z) would
 * collide with a status the player is reading three inches away. The cycle
 * arrows also say the right thing — a Field Effect is a standing state that
 * keeps ticking, where the up-arrow column would read "buff" and lie about
 * Stasis Bubble and Scorched Land both.
 */
export const fieldEffectIconArt: Partial<Record<string, string>> = {
  surgingMagic: surgingMagicIcon,
  scorchedLand: scorchedLandIcon,
  stasisBubble: stasisBubbleIcon,
  sanctuary: sanctuaryIcon,
  verdantEarth: verdantEarthIcon,
};
