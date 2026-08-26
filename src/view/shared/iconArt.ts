// Pixel-art glyphs for statuses, move kinds, Field Effects and Elemental
// Force, cut from the Pixel Odyssey iconset — see docs/icon-pack.md for the
// sheet's structure, the per-concept picks and why each was chosen.
//
// Same shape as itemArt.ts: bare `Record<id, url>` maps of Vite-imported PNGs,
// with every consumer falling back to its existing emoji when an id has no
// entry. That fallback is load-bearing, not defensive — the pack has no
// element row for Iron, Mech, Beast or Ancient, so four of the fifteen
// Elemental Force chips genuinely have no icon and must keep rendering.
//
// SIZING (docs/icon-pack.md "The size constraint"): sources are 32x32, so the
// only honest display sizes are 32px and 16px. 16px is a true halving — every
// other source pixel is dropped, not blended — and anything below that is what
// the old `.status-emoji` comment meant by "turned to noise". Every glyph slot
// in styles.css is therefore pinned to exactly 16px. Do not set a size here
// that isn't 16 or 32.

import burnIcon from '../../../art/icons/status/burn.png';
import bleedIcon from '../../../art/icons/status/bleed.png';
import freezeIcon from '../../../art/icons/status/freeze.png';
import dazeIcon from '../../../art/icons/status/daze.png';
import renewIcon from '../../../art/icons/status/renew.png';
import conductIcon from '../../../art/icons/status/conduct.png';
import poisonIcon from '../../../art/icons/status/poison.png';
import hauntIcon from '../../../art/icons/status/haunt.png';
import stealthIcon from '../../../art/icons/status/stealth.png';

import physicalIcon from '../../../art/icons/move-kind/physical.png';
import magicalIcon from '../../../art/icons/move-kind/magical.png';
import healIcon from '../../../art/icons/move-kind/heal.png';
import buffIcon from '../../../art/icons/move-kind/buff.png';

import surgingMagicIcon from '../../../art/icons/field-effect/surging-magic.png';
import scorchedLandIcon from '../../../art/icons/field-effect/scorched-land.png';
import stasisBubbleIcon from '../../../art/icons/field-effect/stasis-bubble.png';
import sanctuaryIcon from '../../../art/icons/field-effect/sanctuary.png';
import verdantEarthIcon from '../../../art/icons/field-effect/verdant-earth.png';

import fireForceIcon from '../../../art/icons/force/fire.png';
import frostForceIcon from '../../../art/icons/force/frost.png';
import stormForceIcon from '../../../art/icons/force/storm.png';
import waterForceIcon from '../../../art/icons/force/water.png';
import stoneForceIcon from '../../../art/icons/force/stone.png';
import natureForceIcon from '../../../art/icons/force/nature.png';
import lightForceIcon from '../../../art/icons/force/light.png';
import shadowForceIcon from '../../../art/icons/force/shadow.png';
import arcaneForceIcon from '../../../art/icons/force/arcane.png';
import mindForceIcon from '../../../art/icons/force/mind.png';
import spiritForceIcon from '../../../art/icons/force/spirit.png';

/** Per-status glyphs, keyed by status id (src/data/statuses.ts). Elemental Force ids are resolved separately — see forceIconArt. */
export const statusIconArt: Partial<Record<string, string>> = {
  Burn: burnIcon,
  Bleed: bleedIcon,
  Freeze: freezeIcon,
  Daze: dazeIcon,
  Renew: renewIcon,
  Conduct: conductIcon,
  Poison: poisonIcon,
  Haunt: hauntIcon,
  Stealth: stealthIcon,
};

/**
 * MoveKindBadge's four glyphs. Keyed by the same two values that badge already
 * switches on: a damage move keys off `move.category` (the stat pipeline it
 * draws from, CLAUDE.md "two-pipeline separation"), a non-damage one off
 * `move.kind`.
 */
export const moveKindIconArt: Partial<Record<string, string>> = {
  physical: physicalIcon,
  magical: magicalIcon,
  heal: healIcon,
  buff: buffIcon,
};

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

/**
 * Elemental Force chips, keyed by the bare TypeId the Force boosts.
 *
 * Each is that element carrying the matrix's "major up arrow" modifier, which
 * is a literal picture of what the status does (+Base Power to moves of that
 * type). That modifier is also what lets Fire Force and Burn both be flames —
 * statusIcons.tsx's FORCE_EMOJI had to dodge the obvious glyph for
 * Fire/Frost/Storm/Shadow precisely because Burn/Freeze/Conduct/Stealth had
 * already claimed it, and that dodge is no longer necessary here.
 *
 * Iron, Mech, Beast and Ancient are absent on purpose: the iconset has no
 * element row for them (docs/icon-pack.md), so those four keep falling back to
 * FORCE_EMOJI rather than being forced onto a wrong-looking icon.
 */
export const forceIconArt: Partial<Record<string, string>> = {
  Fire: fireForceIcon,
  Frost: frostForceIcon,
  Storm: stormForceIcon,
  Water: waterForceIcon,
  Stone: stoneForceIcon,
  Nature: natureForceIcon,
  Light: lightForceIcon,
  Shadow: shadowForceIcon,
  Arcane: arcaneForceIcon,
  Mind: mindForceIcon,
  Spirit: spiritForceIcon,
};
