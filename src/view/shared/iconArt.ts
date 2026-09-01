// Pixel-art Field Effect plaque glyphs from the Pixel Odyssey iconset (docs/icon-pack.md).
// Sources are 32x32: display only at 32px or 16px (a true halving) — anything else turns to noise.
// Each is the flavorType's element with the "cycle arrows" modifier, not the plain element, so the
// plaque never wears a status glyph (Burn's flame, Daze's Z) the player is reading nearby.

import surgingMagicIcon from '../../../art/icons/field-effect/surging-magic.png';
import scorchedLandIcon from '../../../art/icons/field-effect/scorched-land.png';
import stasisBubbleIcon from '../../../art/icons/field-effect/stasis-bubble.png';
import sanctuaryIcon from '../../../art/icons/field-effect/sanctuary.png';
import verdantEarthIcon from '../../../art/icons/field-effect/verdant-earth.png';

/** Keyed by fieldEffectId (src/data/fieldEffects.ts). */
export const fieldEffectIconArt: Partial<Record<string, string>> = {
  surgingMagic: surgingMagicIcon,
  scorchedLand: scorchedLandIcon,
  stasisBubble: stasisBubbleIcon,
  sanctuary: sanctuaryIcon,
  verdantEarth: verdantEarthIcon,
};
