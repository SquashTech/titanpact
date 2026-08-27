import type { ReactNode } from 'react';
import type { EquipmentDefinition, EquipmentSlot } from '../../run/equipment';
import { STAT_PATHS } from './statIcons';

/**
 * What an item *is*, as a shape — the sixth family in the vector vocabulary
 * (stats, move kinds, section headers, map nodes, types, and now gear), on the
 * same 24x24 grid, `currentColor` only, nothing finer than ~2 units.
 *
 * The thing this family adds that none of the others needed: **there are 55
 * items and there will be more, so the glyph cannot be authored per item.**
 * The old pixel-art path hand-mapped seven ids to iconset cells and fell back
 * to one generic sword / shield / sparkle for everything else, which meant the
 * 42 generated per-type pieces (src/data/equipment.ts) and every signature
 * item shared three pictures between them. A roster screen showed the same
 * sword three times for a greatsword, a bow and a scythe.
 *
 * So an item resolves to one of ~30 FORMS instead, and the resolution is
 * derived, not authored — see `equipmentForm` below. Boots look like boots
 * because the item is called Swift Boots, and the Thornbriar Bow is a bow for
 * the same reason. New content gets a correct glyph the moment it is named,
 * with no art pass and no map to update.
 *
 * Two forms are borrowed rather than drawn, on the same literal-pairing rule
 * the map nodes follow (docs/icon-pack.md): a plain `sword` IS the Attack stat
 * glyph and a `shield` IS the Defense one, because a weapon's stat is Attack
 * and an Aegis's is Defense. A player who has read one stat block has already
 * been taught them.
 */

/** A slim upright blade — the base for the weapons that are "a sword, but". Drawn point-up with the caller owning any rotation, same convention as sectionIcons.tsx's SWORD_SLIM. */
const GREATSWORD = (
  <>
    <path d="M12 1.4 15 7.2v9.2H9V7.2Z" />
    <path d="M4.4 16.4h15.2v2.6H4.4Z" />
    <rect x="10.6" y="19" width="2.8" height="3.6" rx="1.2" />
  </>
);

/** Straight haft, common to the pole weapons below so they read as one sub-family and differ only at the head. */
const HAFT = <path d="M6.6 20.6 17.8 5.2l2.4 1.8L9 22.4Z" />;

export const EQUIP_FORM_PATHS = {
  // --- Weapons -------------------------------------------------------------
  /** The Attack stat glyph, unchanged — see the file note on borrowed forms. */
  sword: STAT_PATHS.attack,
  /** Broader blade, straight crossguard, stood upright rather than laid across the diagonal: a greatsword is defined against the sword next to it, and "bigger" only reads if the two are drawn the same way up. */
  greatsword: GREATSWORD,
  /** Short blade, oversized pommel. The proportion IS the glyph — a dagger drawn to a sword's proportions at 16px is a sword. */
  dagger: (
    <>
      <path d="M12 4.2 14.6 9v5.8H9.4V9Z" />
      <path d="M6.8 14.8h10.4v2.4H6.8Z" />
      <rect x="10.4" y="17.2" width="3.2" height="4.4" rx="1.4" />
    </>
  ),
  /** A needle blade through a cup guard — the one weapon here defined by its hilt rather than its edge, so the cup has to be wide enough to be the thing you notice. Its first draft was a narrow swept bar and the finished glyph read as a downward arrow. */
  rapier: (
    <>
      <rect x="10.9" y="1.4" width="2.2" height="11.8" rx="1.1" />
      <path d="M5.8 13.2h12.4c0 3.5-2.6 5.8-6.2 5.8s-6.2-2.3-6.2-5.8Z" />
      <rect x="10.4" y="19" width="3.2" height="3.6" rx="1.4" />
    </>
  ),
  /** Axe / cleaver: a crescent bit hung off a haft. */
  cleaver: (
    <>
      {HAFT}
      <path d="M5.4 2.4c6 0 10.8 3.8 10.8 8.6 0 1.6-.5 3-1.4 4.2-1.2-4.8-4.6-8-9.4-9Z" />
    </>
  ),
  /** Maul / hammer: a blunt head set square across the haft. Set ACROSS it — the first draft rotated the head the wrong way and it lay along the haft instead, swallowing it, so the whole glyph read as one more blade. */
  hammer: (
    <>
      {HAFT}
      <g transform="rotate(36 18.2 6.4)">
        <rect x="11.7" y="3.1" width="13" height="6.6" rx="1.5" />
      </g>
    </>
  ),
  /** Staff / stave: a shaft topped by a knot of wood. The knot is off-centre so the staff is not a sceptre. */
  staff: (
    <>
      {HAFT}
      <path d="M13.6 1.4c3.8 0 6.4 2.2 6.4 5 0 2.4-1.8 4-4.2 4-2 0-3.4-1.2-3.4-2.8 0-1.2.8-2 1.9-2 .8 0 1.4.5 1.4 1.2 0 .5-.3.9-.8.9.7.5 1.7.2 1.7-1 0-1.6-1.4-2.7-3.4-2.7Z" />
    </>
  ),
  /** Wand: a short shaft with the four-point spark at the tip — the Intelligence glyph again, and again literally (a wand's stat is Intelligence). */
  wand: (
    <>
      <path d="M3.4 20.4 13.2 10.6l2.6 2.6L6 23Z" transform="translate(0 -1.2)" />
      <g transform="translate(15.6 7.4) scale(0.62) translate(-12 -12)">{STAT_PATHS.intelligence}</g>
    </>
  ),
  /** Sceptre / rod: shaft with a set orb. Reads against `staff` the way a crown reads against a helm — same object, formalised. */
  sceptre: (
    <>
      {HAFT}
      <circle cx="16.8" cy="5.4" r="4.4" />
    </>
  ),
  /** Bow: a limb bowing out to the left with its string dead straight down the right. The straight-against-curve contrast IS the glyph — the first draft ran the string diagonally under the limb, the two nearly coincided, and what came out was a crescent moon. */
  bow: (
    <>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        d="M16.6 2.6C9.8 5.4 6.4 8.6 6.4 12s3.4 6.6 10.2 9.4"
      />
      <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M16.6 2.6v18.8" />
    </>
  ),
  /** Three talons, splayed from a common root. */
  claws: (
    <>
      <path d="M4.6 3.2c2.2 4.4 3 9.4 2.2 15-2.6-4.6-3.4-9.6-2.2-15Z" transform="rotate(-16 6 12)" />
      <path d="M11.4 2.6c2.4 4.6 3.2 9.8 2.4 15.8-2.8-4.8-3.6-10.2-2.4-15.8Z" />
      <path d="M18.2 3.2c2.2 4.4 3 9.4 2.2 15-2.6-4.6-3.4-9.6-2.2-15Z" transform="rotate(16 19 12)" />
      <path d="M4.8 18.6c4.6 2.6 9.6 2.6 14.4 0v3.6H4.8Z" />
    </>
  ),
  /** A single curved tooth, root uppermost. */
  fang: (
    <path d="M8.2 1.8h7.6c1 6.6-.2 13.6-3.8 20.4-3.6-6.8-4.8-13.8-3.8-20.4Z" />
  ),
  /** Scythe: a long curved blade set across the top of a snath. */
  scythe: (
    <>
      <path d="M8.4 21.8 16.4 8.2l2.6 1.5-8 13.6Z" />
      <path d="M2.4 3.4c8.2-.6 14.6 2.4 18.4 8.6-4.6-3.4-9.6-4.6-15-3.4l1.6 3.2C4.6 10.2 2.8 7.2 2.4 3.4Z" />
    </>
  ),
  /** A closed book: cover, a spine ruled off down the left, two bands stamped on the face. Deliberately not the map's open tome (nodeIcons.tsx), which means "a Class is taught here" — a Sage's Tome is a thing you swing. The bands matter: a plain rounded rectangle with a notch in it, which is what this was, is not a book, it is a rectangle. */
  tome: (
    <path
      fillRule="evenodd"
      d="M3.4 3.8a2.2 2.2 0 0 1 2.2-2.2h13a2.2 2.2 0 0 1 2.2 2.2v16.4a2.2 2.2 0 0 1-2.2 2.2h-13a2.2 2.2 0 0 1-2.2-2.2ZM7.8 1.6v20.8h1.9V1.6Zm4.5 5v2.2h6.2V6.6Zm0 4.6v2.2h6.2v-2.2Z"
    />
  ),
  /** Focus / orb / core: a sphere with a glint on it. It sat on a plinth in the first draft and read as a head and shoulders — which is the Mind element's glyph, on a screen that shows both. A sphere alone, with the light on it saying "glass", has nothing to be mistaken for once `lens` became a loupe. */
  orb: (
    <path
      fillRule="evenodd"
      d="M12 2.4a9.6 9.6 0 1 1 0 19.2 9.6 9.6 0 0 1 0-19.2ZM8.4 6.2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z"
    />
  ),

  // --- Armor ---------------------------------------------------------------
  /**
   * Breastplate: two round pauldrons with a cuirass hung between them.
   *
   * The pauldrons are the whole design, and it took two failed drafts to see
   * why. Any single closed silhouette that is widest at the top and tapers to
   * a point at the bottom is a **shield** — which is `shield` below, the
   * Defense glyph, sitting on the same reward screen. Plate has to be widest
   * at the SHOULDERS specifically, with the outline broken either side of the
   * neck, and two discs flanking a flat-topped torso is the cheapest way to
   * say that at 13px.
   */
  plate: (
    <>
      <circle cx="4.4" cy="8.6" r="3.6" />
      <circle cx="19.6" cy="8.6" r="3.6" />
      <path d="M7 5.2h3.4L12 7.2l1.6-2H17v10c0 3.4-1.7 5.9-5 7.4-3.3-1.5-5-4-5-7.4Z" />
    </>
  ),
  /**
   * Scale / mail: a sleeved hauberk. Deliberately a different GARMENT from
   * plate rather than the same torso with a different hem — a scalloped hem
   * under a domed top is a ghost, which is the Haunt status badge, and that is
   * exactly what the first draft of this drew.
   */
  mail: (
    <path
      fillRule="evenodd"
      d="M9.2 3h5.6l6.6 3.4-2.4 5.4-2.4-1.2v10.4H7.4V10.6L5 11.8 2.6 6.4ZM12 4.2l-1.4 1.6L12 7.4l1.4-1.6Z"
    />
  ),
  /** Robe / vestment: narrow shoulders flaring to a wide floor-length hem, cinched at the waist. */
  robe: (
    <>
      <path d="M9 2.6h6l4.6 3-2.2 4-1.6-1v3.2H8.2V8.6l-1.6 1-2.2-4Z" />
      <path d="M8.2 13.4h7.6l3 8.8H5.2Z" />
    </>
  ),
  /** Cloak / mantle / veil / shroud: a collar over a cape that hangs open down the front. The open front is what earns it — closed, with the collar merged into the body, this drew as a purse. */
  cloak: (
    <>
      <path d="M8.4 2.2h7.2l-.4 2.8a3.9 3.9 0 0 1-6.4 0Z" />
      <path d="M8.8 6 12 9.2 15.2 6c3.4 1.7 5.4 6.2 6 13.4-3 1.6-6.1 2.4-9.2 2.4s-6.2-.8-9.2-2.4C3.4 12.2 5.4 7.7 8.8 6Z" />
    </>
  ),
  /** Hide / pelt: an animal skin pegged out flat, which is the one armor shape here with no human symmetry to it. */
  hide: (
    <path d="M6.6 1.8c1.4 1.8 2.4 3.4 3 4.8h4.8c.6-1.4 1.6-3 3-4.8 2.2 2 3.4 4.2 3.6 6.6.2 1.8-.4 3.2-1.8 4.2.6 3.2.2 6-1.2 8.4-1.6-1.6-3.4-2.4-5.4-2.4h-1.2c-2 0-3.8.8-5.4 2.4-1.4-2.4-1.8-5.2-1.2-8.4-1.4-1-2-2.4-1.8-4.2.2-2.4 1.4-4.6 3.6-6.6Z" />
  ),
  /** The Defense stat glyph, unchanged — an Aegis or a Bulwark IS the shield, and its stat IS Defense. */
  shield: STAT_PATHS.defense,

  // --- Accessories ---------------------------------------------------------
  /** A banded ring under a set stone. Shared with the map's Accessory Cache (nodeIcons.tsx), which grants exactly this. The band is a 3.4-unit annulus, which is what a ring needs to still be a ring at pill size. */
  ring: (
    <>
      <path d="M12 1.4 15.6 5.6 12 9.8 8.4 5.6Z" />
      <path fillRule="evenodd" d="M12 8.6a6.7 6.7 0 1 1 0 13.4 6.7 6.7 0 0 1 0-13.4Zm0 3.4a3.3 3.3 0 1 0 0 6.6 3.3 3.3 0 0 0 0-6.6Z" />
    </>
  ),
  /** Necklace: a chain hanging in a shallow curve with a drop below it. The chain is a 2.4-wide stroke rather than drawn links — links are ~1 unit and are the first thing to go at badge size — and the drop has to be big against it, or the pair reads as a wishbone. */
  necklace: (
    <>
      <path fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" d="M4 2.6c0 5.6 3.6 9.4 8 9.4s8-3.8 8-9.4" />
      <path d="M12 12.8c2.8 3.4 4.2 5.7 4.2 7.3a4.2 4.2 0 0 1-8.4 0c0-1.6 1.4-3.9 4.2-7.3Z" />
    </>
  ),
  /** Pendant / charm / locket / amulet: the drop alone, hung from its loop. A necklace without its chain — the modifier names the family, the base shape names the member, same grammar as Mana Pool / MP Regen. */
  pendant: (
    <>
      <circle cx="12" cy="4.4" r="3" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <path d="M12 8 18.4 15 12 22.4 5.6 15Z" />
    </>
  ),
  /** Beads: a strand closed into a loop. Eight discs of 3 units each — the one accessory whose whole identity is repetition, so the count matters more than the shape. */
  beads: (
    <>
      <circle cx="12" cy="3.6" r="2.2" />
      <circle cx="17.9" cy="6.1" r="2.2" />
      <circle cx="20.4" cy="12" r="2.2" />
      <circle cx="17.9" cy="17.9" r="2.2" />
      <circle cx="12" cy="20.4" r="2.2" />
      <circle cx="6.1" cy="17.9" r="2.2" />
      <circle cx="3.6" cy="12" r="2.2" />
      <circle cx="6.1" cy="6.1" r="2.2" />
    </>
  ),
  /** Boots: a side profile with a raised heel. The only gear glyph with a ground line under it, because a boot that is not standing on something reads as a sock. */
  boots: (
    <>
      <path d="M6.4 2.6h5.4v7.8c0 2 .8 3.4 2.6 4.6l4 2.6c1.2.8 1.8 1.8 1.8 3.2H6.4Z" />
      <rect x="4.2" y="21.4" width="17" height="2.2" rx="1.1" />
    </>
  ),
  /** Crown / circlet / diadem / halo: three points over a band. */
  crown: (
    <>
      <path d="M2.6 4.6 7.6 9.4 12 3.2l4.4 6.2 5-4.8-1.4 9.4H4Z" />
      <rect x="4" y="16.2" width="16" height="3.8" rx="1.4" />
    </>
  ),
  /**
   * Lens: a loupe — a glass in a heavy rim, with a handle.
   *
   * Two drafts died first and both are worth remembering. A disc with a
   * diagonal bar across it is the universal "forbidden" sign. A disc with a
   * corner glint is `orb`. The handle is what makes this a lens rather than
   * either: it is the only accessory here you hold up and look through.
   */
  lens: (
    <>
      <circle cx="10.4" cy="9.8" r="7" fill="none" stroke="currentColor" strokeWidth="3.2" />
      <path d="M15.4 15.6 20.8 21l-2.6 2.6-5.4-5.4Z" />
    </>
  ),
  /** Sigil / insignia / emblem / seal: a medal — ribbons behind a struck disc. Deliberately a medal rather than a shield (already `shield`, the Defense glyph) and deliberately not a disc struck with a rune, which is what it was: the rune that read best was an angular bolt, and Conduct's badge is a bolt on the very same screen. */
  sigil: (
    <>
      <path d="M6 1.6h4.4L8 9.6 3.8 6.8Z" />
      <path d="M13.6 1.6H18l2.2 5.2-4.2 2.8Z" />
      <path fillRule="evenodd" d="M12 8.2a7.5 7.5 0 1 1 0 15 7.5 7.5 0 0 1 0-15Zm0 3.8a3.7 3.7 0 1 0 0 7.4 3.7 3.7 0 0 0 0-7.4Z" />
    </>
  ),
  /** Idol: a carved figure, head and tapered body on a plinth. */
  idol: (
    <>
      <circle cx="12" cy="5.4" r="3.6" />
      <path d="M8 9.8h8l2.2 9.4H5.8Z" />
      <rect x="3.8" y="20" width="16.4" height="3" rx="1" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type EquipmentFormName = keyof typeof EQUIP_FORM_PATHS;

/**
 * The generic shape for each slot — what an empty slot draws, and the last
 * resort for an item whose name matches nothing below.
 */
const SLOT_FALLBACK_FORM: Record<EquipmentSlot, EquipmentFormName> = {
  weapon: 'sword',
  armor: 'plate',
  accessory: 'ring',
};

/**
 * Noun -> form. Unordered on purpose: the resolver reads an item's name
 * **last word first** (see `equipmentForm`), so there is no priority list to
 * keep in the right order and no chance of one entry shadowing another.
 *
 * That direction is not a detail, it is the whole reliability of this table.
 * An earlier version scanned these keywords against the full name in a fixed
 * order and got three items wrong in the first 55: "Cinderfang Blade" drew as
 * a fang, "Alpha Fang Necklace" drew as a fang, and "Focusing Lens" drew as an
 * orb — every one of them a word buried mid-name beating the actual noun at
 * the end. English puts the head noun of a name last, and src/data/equipment.ts
 * follows that without trying to ("Thornbriar Bow", "Quarrybreaker Maul",
 * "Ring of Vitality"), so reading backwards gets the head noun first and the
 * modifiers only if nothing else matched.
 *
 * Keys are singular; the resolver strips a trailing "s" and also matches a
 * word that merely *ends* with a key, which is what catches "Forgehammer" and
 * "Cinderfang" when they really are the last word.
 */
const NOUN_FORMS: Readonly<Record<string, EquipmentFormName>> = {
  // Weapons
  greatsword: 'greatsword',
  broadsword: 'greatsword',
  longsword: 'greatsword',
  claymore: 'greatsword',
  rapier: 'rapier',
  dagger: 'dagger',
  dirk: 'dagger',
  knife: 'dagger',
  shiv: 'dagger',
  cleaver: 'cleaver',
  axe: 'cleaver',
  hatchet: 'cleaver',
  hammer: 'hammer',
  maul: 'hammer',
  mace: 'hammer',
  sceptre: 'sceptre',
  scepter: 'sceptre',
  rod: 'sceptre',
  stave: 'staff',
  staff: 'staff',
  wand: 'wand',
  bow: 'bow',
  scythe: 'scythe',
  glaive: 'scythe',
  claw: 'claws',
  talon: 'claws',
  fang: 'fang',
  tooth: 'fang',
  tome: 'tome',
  grimoire: 'tome',
  codex: 'tome',
  focus: 'orb',
  orb: 'orb',
  core: 'orb',
  sword: 'sword',
  blade: 'sword',
  edge: 'sword',
  sabre: 'sword',
  saber: 'sword',
  // Armor
  aegis: 'shield',
  bulwark: 'shield',
  shield: 'shield',
  ward: 'shield',
  robe: 'robe',
  vestment: 'robe',
  garb: 'robe',
  gown: 'robe',
  cloak: 'cloak',
  mantle: 'cloak',
  veil: 'cloak',
  shroud: 'cloak',
  cape: 'cloak',
  hide: 'hide',
  pelt: 'hide',
  skin: 'hide',
  fur: 'hide',
  leather: 'hide',
  mail: 'mail',
  scale: 'mail',
  hauberk: 'mail',
  plate: 'plate',
  breastplate: 'plate',
  cuirass: 'plate',
  armor: 'plate',
  chassis: 'plate',
  // Accessories
  necklace: 'necklace',
  collar: 'necklace',
  torc: 'necklace',
  pendant: 'pendant',
  amulet: 'pendant',
  talisman: 'pendant',
  locket: 'pendant',
  charm: 'pendant',
  bead: 'beads',
  rosary: 'beads',
  boot: 'boots',
  greave: 'boots',
  sandal: 'boots',
  tread: 'boots',
  crown: 'crown',
  circlet: 'crown',
  diadem: 'crown',
  halo: 'crown',
  tiara: 'crown',
  lens: 'lens',
  monocle: 'lens',
  prism: 'lens',
  sigil: 'sigil',
  insignia: 'sigil',
  emblem: 'sigil',
  seal: 'sigil',
  crest: 'sigil',
  medal: 'sigil',
  idol: 'idol',
  totem: 'idol',
  effigy: 'idol',
  fetish: 'idol',
  ring: 'ring',
  loop: 'ring',
  band: 'ring',
};

/** The shortest key that is safe to match as a word ENDING rather than as the whole word. Below this, "sword" would be found inside "answer"-shaped words and "rod" inside "shroud". */
const MIN_SUFFIX_MATCH = 4;

/** One name word, matched whole, then de-pluralised, then as a compound ending ("Forge|hammer"). Returns undefined if the word names nothing. */
function wordForm(word: string): EquipmentFormName | undefined {
  if (NOUN_FORMS[word]) return NOUN_FORMS[word];
  const singular = word.endsWith('s') ? word.slice(0, -1) : word;
  if (NOUN_FORMS[singular]) return NOUN_FORMS[singular];
  for (const noun of Object.keys(NOUN_FORMS)) {
    if (noun.length >= MIN_SUFFIX_MATCH && singular.length > noun.length && singular.endsWith(noun)) {
      return NOUN_FORMS[noun];
    }
  }
  return undefined;
}

/**
 * Per-id overrides, for the items whose name does not contain the noun.
 * Deliberately short: an entry here is a small admission that the item is
 * badly named for its own glyph, so the first thing to try when adding one is
 * renaming the item instead.
 */
const ID_FORMS: Partial<Record<string, EquipmentFormName>> = {
  /** "Worldbreaker" names the effect, not the object. A mythic 30-Attack weapon is a greatsword. */
  worldbreaker: 'greatsword',
  /** "Arcane Focus" would hit the `focus` row anyway; pinned so a rename can't silently move it. */
  arcaneFocus: 'orb',
};

/** The form an item draws as — id override, then its name read last word first, then the slot's generic shape. */
export function equipmentForm(item: EquipmentDefinition): EquipmentFormName {
  const override = ID_FORMS[item.id];
  if (override) return override;
  // Possessives and the like are stripped so "Duelist's" and "Sage's" reduce
  // to words the table can be asked about; they never match, but the word
  // after them does, and a stray apostrophe must not stop the walk early.
  const words = item.name.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean);
  for (let i = words.length - 1; i >= 0; i--) {
    const form = wordForm(words[i]);
    if (form) return form;
  }
  return SLOT_FALLBACK_FORM[item.slot];
}

/**
 * The one place a piece of gear is drawn — every equip slot, cache card, guild
 * shelf and reward spotlight renders this, so the sword/boots/necklace
 * decision is made once and cannot drift between screens.
 *
 * `aria-hidden` for the same reason every other family is: the item's own name
 * sits beside it, and the slot box already carries an `aria-label` naming both
 * the slot and the item.
 */
export function EquipmentFormGlyph({
  item,
  slot,
  className,
}: {
  item: EquipmentDefinition | null;
  slot: EquipmentSlot;
  className?: string;
}) {
  const form = item ? equipmentForm(item) : SLOT_FALLBACK_FORM[slot];
  return (
    <svg
      className={`equip-glyph${className ? ` ${className}` : ''}`}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {EQUIP_FORM_PATHS[form]}
    </svg>
  );
}
