import type { ReactNode } from 'react';
import type { EquipmentDefinition } from '../../run/equipment';
import { STAT_PATHS } from './statIcons';

// What an item IS, as a shape: 24x24, `currentColor` only, nothing finer than ~2 units. There are
// too many items to author a glyph per item, so an item resolves to one of ~30 FORMS by its name
// (`equipmentForm`). `sword` and `shield` are the Attack and Defense stat glyphs, literally.

const GREATSWORD = (
  <>
    <path d="M12 1.4 15 7.2v9.2H9V7.2Z" />
    <path d="M4.4 16.4h15.2v2.6H4.4Z" />
    <rect x="10.6" y="19" width="2.8" height="3.6" rx="1.2" />
  </>
);

// Straight haft shared by the pole weapons so they differ only at the head.
const HAFT = <path d="M6.6 20.6 17.8 5.2l2.4 1.8L9 22.4Z" />;

export const EQUIP_FORM_PATHS = {
  // --- Weapons ---
  sword: STAT_PATHS.attack,
  greatsword: GREATSWORD,
  dagger: (
    <>
      <path d="M12 4.2 14.6 9v5.8H9.4V9Z" />
      <path d="M6.8 14.8h10.4v2.4H6.8Z" />
      <rect x="10.4" y="17.2" width="3.2" height="4.4" rx="1.4" />
    </>
  ),
  // Needle blade through a cup guard.
  rapier: (
    <>
      <rect x="10.9" y="1.4" width="2.2" height="11.8" rx="1.1" />
      <path d="M5.8 13.2h12.4c0 3.5-2.6 5.8-6.2 5.8s-6.2-2.3-6.2-5.8Z" />
      <rect x="10.4" y="19" width="3.2" height="3.6" rx="1.4" />
    </>
  ),
  cleaver: (
    <>
      {HAFT}
      <path d="M5.4 2.4c6 0 10.8 3.8 10.8 8.6 0 1.6-.5 3-1.4 4.2-1.2-4.8-4.6-8-9.4-9Z" />
    </>
  ),
  // Head set ACROSS the haft, or it reads as one more blade.
  hammer: (
    <>
      {HAFT}
      <g transform="rotate(36 18.2 6.4)">
        <rect x="11.7" y="3.1" width="13" height="6.6" rx="1.5" />
      </g>
    </>
  ),
  staff: (
    <>
      {HAFT}
      <path d="M13.6 1.4c3.8 0 6.4 2.2 6.4 5 0 2.4-1.8 4-4.2 4-2 0-3.4-1.2-3.4-2.8 0-1.2.8-2 1.9-2 .8 0 1.4.5 1.4 1.2 0 .5-.3.9-.8.9.7.5 1.7.2 1.7-1 0-1.6-1.4-2.7-3.4-2.7Z" />
    </>
  ),
  // Shaft tipped with the Intelligence spark.
  wand: (
    <>
      <path d="M3.4 20.4 13.2 10.6l2.6 2.6L6 23Z" transform="translate(0 -1.2)" />
      <g transform="translate(15.6 7.4) scale(0.62) translate(-12 -12)">{STAT_PATHS.intelligence}</g>
    </>
  ),
  sceptre: (
    <>
      {HAFT}
      <circle cx="16.8" cy="5.4" r="4.4" />
    </>
  ),
  // Limb bowing left, string dead straight — the contrast is the glyph.
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
  claws: (
    <>
      <path d="M4.6 3.2c2.2 4.4 3 9.4 2.2 15-2.6-4.6-3.4-9.6-2.2-15Z" transform="rotate(-16 6 12)" />
      <path d="M11.4 2.6c2.4 4.6 3.2 9.8 2.4 15.8-2.8-4.8-3.6-10.2-2.4-15.8Z" />
      <path d="M18.2 3.2c2.2 4.4 3 9.4 2.2 15-2.6-4.6-3.4-9.6-2.2-15Z" transform="rotate(16 19 12)" />
      <path d="M4.8 18.6c4.6 2.6 9.6 2.6 14.4 0v3.6H4.8Z" />
    </>
  ),
  fang: (
    <path d="M8.2 1.8h7.6c1 6.6-.2 13.6-3.8 20.4-3.6-6.8-4.8-13.8-3.8-20.4Z" />
  ),
  scythe: (
    <>
      <path d="M8.4 21.8 16.4 8.2l2.6 1.5-8 13.6Z" />
      <path d="M2.4 3.4c8.2-.6 14.6 2.4 18.4 8.6-4.6-3.4-9.6-4.6-15-3.4l1.6 3.2C4.6 10.2 2.8 7.2 2.4 3.4Z" />
    </>
  ),
  // Closed book (the map's open tome means "a Class is taught here").
  tome: (
    <path
      fillRule="evenodd"
      d="M3.4 3.8a2.2 2.2 0 0 1 2.2-2.2h13a2.2 2.2 0 0 1 2.2 2.2v16.4a2.2 2.2 0 0 1-2.2 2.2h-13a2.2 2.2 0 0 1-2.2-2.2ZM7.8 1.6v20.8h1.9V1.6Zm4.5 5v2.2h6.2V6.6Zm0 4.6v2.2h6.2v-2.2Z"
    />
  ),
  // Sphere with a glint (focus / orb / core).
  orb: (
    <path
      fillRule="evenodd"
      d="M12 2.4a9.6 9.6 0 1 1 0 19.2 9.6 9.6 0 0 1 0-19.2ZM8.4 6.2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z"
    />
  ),

  // --- Armor ---
  // Breastplate: widest at the SHOULDERS (two pauldrons), or it is a shield.
  plate: (
    <>
      <circle cx="4.4" cy="8.6" r="3.6" />
      <circle cx="19.6" cy="8.6" r="3.6" />
      <path d="M7 5.2h3.4L12 7.2l1.6-2H17v10c0 3.4-1.7 5.9-5 7.4-3.3-1.5-5-4-5-7.4Z" />
    </>
  ),
  // Sleeved hauberk (a scalloped hem under a dome is the Haunt ghost).
  mail: (
    <path
      fillRule="evenodd"
      d="M9.2 3h5.6l6.6 3.4-2.4 5.4-2.4-1.2v10.4H7.4V10.6L5 11.8 2.6 6.4ZM12 4.2l-1.4 1.6L12 7.4l1.4-1.6Z"
    />
  ),
  robe: (
    <>
      <path d="M9 2.6h6l4.6 3-2.2 4-1.6-1v3.2H8.2V8.6l-1.6 1-2.2-4Z" />
      <path d="M8.2 13.4h7.6l3 8.8H5.2Z" />
    </>
  ),
  // Collar over a cape hanging open down the front.
  cloak: (
    <>
      <path d="M8.4 2.2h7.2l-.4 2.8a3.9 3.9 0 0 1-6.4 0Z" />
      <path d="M8.8 6 12 9.2 15.2 6c3.4 1.7 5.4 6.2 6 13.4-3 1.6-6.1 2.4-9.2 2.4s-6.2-.8-9.2-2.4C3.4 12.2 5.4 7.7 8.8 6Z" />
    </>
  ),
  // Pelt pegged out flat.
  hide: (
    <path d="M6.6 1.8c1.4 1.8 2.4 3.4 3 4.8h4.8c.6-1.4 1.6-3 3-4.8 2.2 2 3.4 4.2 3.6 6.6.2 1.8-.4 3.2-1.8 4.2.6 3.2.2 6-1.2 8.4-1.6-1.6-3.4-2.4-5.4-2.4h-1.2c-2 0-3.8.8-5.4 2.4-1.4-2.4-1.8-5.2-1.2-8.4-1.4-1-2-2.4-1.8-4.2.2-2.4 1.4-4.6 3.6-6.6Z" />
  ),
  shield: STAT_PATHS.defense,

  // --- Accessories ---
  ring: (
    <>
      <path d="M12 1.4 15.6 5.6 12 9.8 8.4 5.6Z" />
      <path fillRule="evenodd" d="M12 8.6a6.7 6.7 0 1 1 0 13.4 6.7 6.7 0 0 1 0-13.4Zm0 3.4a3.3 3.3 0 1 0 0 6.6 3.3 3.3 0 0 0 0-6.6Z" />
    </>
  ),
  necklace: (
    <>
      <path fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" d="M4 2.6c0 5.6 3.6 9.4 8 9.4s8-3.8 8-9.4" />
      <path d="M12 12.8c2.8 3.4 4.2 5.7 4.2 7.3a4.2 4.2 0 0 1-8.4 0c0-1.6 1.4-3.9 4.2-7.3Z" />
    </>
  ),
  // The necklace's drop alone, on its loop.
  pendant: (
    <>
      <circle cx="12" cy="4.4" r="3" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <path d="M12 8 18.4 15 12 22.4 5.6 15Z" />
    </>
  ),
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
  // Boot on a ground line, or it reads as a sock.
  boots: (
    <>
      <path d="M6.4 2.6h5.4v7.8c0 2 .8 3.4 2.6 4.6l4 2.6c1.2.8 1.8 1.8 1.8 3.2H6.4Z" />
      <rect x="4.2" y="21.4" width="17" height="2.2" rx="1.1" />
    </>
  ),
  crown: (
    <>
      <path d="M2.6 4.6 7.6 9.4 12 3.2l4.4 6.2 5-4.8-1.4 9.4H4Z" />
      <rect x="4" y="16.2" width="16" height="3.8" rx="1.4" />
    </>
  ),
  // Loupe: the handle is what separates it from `orb` and the "forbidden" sign.
  lens: (
    <>
      <circle cx="10.4" cy="9.8" r="7" fill="none" stroke="currentColor" strokeWidth="3.2" />
      <path d="M15.4 15.6 20.8 21l-2.6 2.6-5.4-5.4Z" />
    </>
  ),
  // Medal: ribbons behind a struck disc (sigil / insignia / emblem / seal).
  sigil: (
    <>
      <path d="M6 1.6h4.4L8 9.6 3.8 6.8Z" />
      <path d="M13.6 1.6H18l2.2 5.2-4.2 2.8Z" />
      <path fillRule="evenodd" d="M12 8.2a7.5 7.5 0 1 1 0 15 7.5 7.5 0 0 1 0-15Zm0 3.8a3.7 3.7 0 1 0 0 7.4 3.7 3.7 0 0 0 0-7.4Z" />
    </>
  ),
  // Carved figure on a plinth.
  idol: (
    <>
      <circle cx="12" cy="5.4" r="3.6" />
      <path d="M8 9.8h8l2.2 9.4H5.8Z" />
      <rect x="3.8" y="20" width="16.4" height="3" rx="1" />
    </>
  ),
  // An open socket: what a slot with nothing in it draws, and the last resort for an
  // unrecognised name. Deliberately not a weapon — a slot no longer implies a kind.
  socket: (
    <path
      fillRule="evenodd"
      d="M12 1.8 21.6 7v10L12 22.2 2.4 17V7Zm0 4.4L6.2 9.4v5.2L12 17.8l5.8-3.2V9.4Z"
    />
  ),
} satisfies Record<string, ReactNode>;

export type EquipmentFormName = keyof typeof EQUIP_FORM_PATHS;

/** What an empty slot draws, and the last resort for an item whose name matches nothing. */
const FALLBACK_FORM: EquipmentFormName = 'socket';

// Noun -> form. Unordered on purpose: the resolver reads a name LAST WORD FIRST (English puts the
// head noun last — "Thornbriar Bow", "Alpha Fang Necklace"), so no entry can shadow another.
// Keys are singular; the resolver strips a trailing "s" and matches compound endings ("Forgehammer").
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
  gem: 'orb',
  crystal: 'orb',
  shard: 'orb',
  book: 'tome',
  folio: 'tome',
  ledger: 'tome',
  torch: 'sceptre',
  brand: 'sceptre',
  glove: 'hammer',
  gauntlet: 'hammer',
  knuckle: 'hammer',
  memento: 'idol',
  keepsake: 'idol',
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
  jerkin: 'hide',
  gambeson: 'hide',
  tunic: 'robe',
  wrap: 'cloak',
  shawl: 'cloak',
  sash: 'cloak',
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

/** Shortest key safe to match as a word ENDING; below this "rod" is found inside "shroud". */
const MIN_SUFFIX_MATCH = 4;

const SUFFIX_NOUNS = Object.keys(NOUN_FORMS).filter((noun) => noun.length >= MIN_SUFFIX_MATCH);

/** One word, matched whole, then de-pluralised, then as a compound ending. */
function wordForm(word: string): EquipmentFormName | undefined {
  if (NOUN_FORMS[word]) return NOUN_FORMS[word];
  const singular = word.endsWith('s') ? word.slice(0, -1) : word;
  if (NOUN_FORMS[singular]) return NOUN_FORMS[singular];
  for (const noun of SUFFIX_NOUNS) {
    if (singular.length > noun.length && singular.endsWith(noun)) return NOUN_FORMS[noun];
  }
  return undefined;
}

// Per-id overrides for items whose name does not contain the noun. Prefer renaming the item.
const ID_FORMS: Partial<Record<string, EquipmentFormName>> = {
  worldbreaker: 'greatsword',
  // Would hit the `focus` row anyway; pinned so a rename can't silently move it.
  arcaneFocus: 'orb',
};

/** Id override, then the name read last word first, then the empty-socket shape. */
export function equipmentForm(item: EquipmentDefinition): EquipmentFormName {
  const override = ID_FORMS[item.id];
  if (override) return override;
  // Possessives are stripped so "Sage's" reduces to a word that simply fails to match.
  const words = item.name.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean);
  for (let i = words.length - 1; i >= 0; i--) {
    const form = wordForm(words[i]);
    if (form) return form;
  }
  return FALLBACK_FORM;
}

/** The one place an item is drawn. `aria-hidden`: the item's name sits beside it. */
export function EquipmentFormGlyph({ item, className }: { item: EquipmentDefinition | null; className?: string }) {
  const form = item ? equipmentForm(item) : FALLBACK_FORM;
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
