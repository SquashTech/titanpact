import type { CSSProperties, ReactNode } from 'react';
import type { StatKey } from '../../engine/content';
import { STAT_ORDER } from '../../engine/content';
import type { RelicDefinition } from '../../run/relics';
import { relics } from '../../data/relics';
import { EQUIP_FORM_PATHS } from './equipmentIcons';
import { passiveColor } from './passiveIcons';
import { STAT_COLORS, STAT_PATHS } from './statIcons';
import { hexTint, statusColor } from './statusIcons';

// A relic drawn the way every other content type is: 24x24, `currentColor` only, nothing finer
// than ~2 units. Two halves, each derived rather than authored per id — the FORM comes from the
// relic's name (what the object is), the COLOUR from its grant (what it does). So an Idol is
// always a figure on a plinth, and Stormcaller's Idol is that figure in Storm's purple.
//
// Forms an item already has are borrowed from EQUIP_FORM_PATHS rather than redrawn: a bulwark is
// the same bulwark on either axis, and the shrine's own badge is what says "relic, not gear".

/** A round-bellied bottle — the Statuses header's flask is an erlenmeyer, and these coexist. */
const FLASK = (
  <>
    <rect x="9.8" y="1.6" width="4.4" height="2.8" rx="1.1" />
    <rect x="10.4" y="4.4" width="3.2" height="4.8" />
    <circle cx="12" cy="15.4" r="7" />
  </>
);

/**
 * The Gem (docs/run-loop.md): one unbroken brilliant — flat table, girdle at the shoulders, a
 * point — with the table facet knocked OUT of the crown. `crystal` is the same cut split in two
 * at the girdle, so the two never read as the same picture: a Gem is one solid stone with a
 * window in it, a crystal is two shards. Exported because the map node wears it too (nodeIcons).
 */
export const GEM = <path fillRule="evenodd" d="M7.4 2.6h9.2l5 6.4L12 21.8 2.4 9ZM8.8 5h6.4l2.4 3H6.4Z" />;

const RELIC_FORM_PATHS = {
  // Crossbar over a swallowtail field. No pole: at 14px the pole and the field merge into a lolly.
  banner: (
    <>
      <rect x="2.8" y="1.8" width="18.4" height="2.6" rx="1.2" />
      <path d="M5.4 5.2h13.2v16.2L12 15.4 5.4 21.4Z" />
    </>
  ),
  // Cut bell at the wide end, tapering onto a mouthpiece knob. A crescent of even width is a moon.
  horn: (
    <>
      <path d="M14.2 2.2H21.6C21.6 12.4 15.2 19.8 3.6 22.2 10.4 17.4 13.6 10.8 14.2 2.2Z" />
      <circle cx="3.6" cy="21.4" r="2.4" />
    </>
  ),
  // Hoop, dome, glazed window, foot. The window is what keeps it off `SECTION_PATHS.equipment`.
  lantern: (
    <>
      <path fill="none" stroke="currentColor" strokeWidth="2.2" d="M9.2 4.2a2.8 2.8 0 0 1 5.6 0" />
      <path d="M5.4 5.4h13.2l-1.8 3.2H7.2Z" />
      <path fillRule="evenodd" d="M7 9.4h10v9.4H7Zm2.4 2.4v4.6h5.2v-4.6Z" />
      <rect x="4.6" y="19.6" width="14.8" height="2.8" rx="1" />
    </>
  ),
  // Standing rune stone, not the Stone element's boulder: upright, tapered, cut across twice.
  stone: (
    <path fillRule="evenodd" d="M6.4 2.4h11.2l1.8 19.2H4.6ZM8.8 7.6v2.6h6.4V7.6Zm0 5.4v2.6h6.4V13Z" />
  ),
  heart: STAT_PATHS.hp,
  // Drawstring bag: gathered neck, tie across, body FLARING to a flat base. A round body is a coin.
  pouch: (
    <>
      <path d="M8.4 2.2h7.2l2 5.2H6.4Z" />
      <path d="M7.8 10.2h8.4c2.9 2.4 4.4 5.1 4.4 8.2 0 2.3-1.3 3.4-3.8 3.4H7.2c-2.5 0-3.8-1.1-3.8-3.4 0-3.1 1.5-5.8 4.4-8.2Z" />
      <rect x="5.8" y="6.8" width="12.4" height="2.8" rx="1.2" />
    </>
  ),
  flask: FLASK,
  // Goblet: bowl, stem, foot, all one silhouette.
  chalice: (
    <path d="M3.6 3.2h16.8l-1.6 5.4c-.9 3-2.8 4.9-5.2 5.4v4.2h4.2v3H6.2v-3h4.2v-4.2c-2.4-.5-4.3-2.4-5.2-5.4Z" />
  ),
  // Wellhead: a basin wider than anything else here, fed by a falling drop. That width is what keeps
  // it off the idol, which is also a shape standing on a base.
  font: (
    <>
      <path d="M12 1.2c2.7 3.3 4.1 5.6 4.1 7.4a4.1 4.1 0 0 1-8.2 0c0-1.8 1.4-4.1 4.1-7.4Z" />
      <path d="M1.4 12.2h21.2c0 4.2-2.6 7-6.8 7.9v.3h4.2v3.2H4v-3.2h4.2v-.3c-4.2-.9-6.8-3.7-6.8-7.9Z" />
    </>
  ),
  // Cut gem: crown and pavilion split at the girdle.
  crystal: (
    <>
      <path d="M7 2.6h10l4.4 5.6H2.6Z" />
      <path d="M2.6 9.8h18.8L12 22.2Z" />
    </>
  ),
  gem: GEM,
  core: EQUIP_FORM_PATHS.orb,
  shield: EQUIP_FORM_PATHS.shield,
  plate: EQUIP_FORM_PATHS.plate,
  crown: EQUIP_FORM_PATHS.crown,
  ring: EQUIP_FORM_PATHS.ring,
  crest: EQUIP_FORM_PATHS.sigil,
  pendant: EQUIP_FORM_PATHS.pendant,
  idol: EQUIP_FORM_PATHS.idol,
} satisfies Record<string, ReactNode>;

type RelicFormName = keyof typeof RELIC_FORM_PATHS;

// Noun -> form, read LAST WORD FIRST like equipmentIcons' table, so "Banner of the Wellspring"
// falls through its tail and lands on `banner`. Keys are singular; the resolver strips a trailing
// "s" and matches compound endings ("Wellstone", "Emberheart").
const NOUN_FORMS: Readonly<Record<string, RelicFormName>> = {
  standard: 'banner',
  banner: 'banner',
  pennant: 'banner',
  flag: 'banner',
  horn: 'horn',
  trumpet: 'horn',
  lantern: 'lantern',
  lamp: 'lantern',
  beacon: 'lantern',
  stone: 'stone',
  menhir: 'stone',
  monolith: 'stone',
  obelisk: 'stone',
  heart: 'heart',
  kit: 'pouch',
  pouch: 'pouch',
  satchel: 'pouch',
  pack: 'pouch',
  bag: 'pouch',
  flask: 'flask',
  vial: 'flask',
  phial: 'flask',
  bottle: 'flask',
  chalice: 'chalice',
  vessel: 'chalice',
  goblet: 'chalice',
  cup: 'chalice',
  font: 'font',
  basin: 'font',
  fountain: 'font',
  crystal: 'crystal',
  catalyst: 'crystal',
  shard: 'crystal',
  prism: 'crystal',
  // Every Gem is named for a stone and nothing else, so the stone names ARE the lookup.
  gem: 'gem',
  gemstone: 'gem',
  jewel: 'gem',
  emerald: 'gem',
  ruby: 'gem',
  onyx: 'gem',
  amethyst: 'gem',
  aquamarine: 'gem',
  citrine: 'gem',
  sapphire: 'gem',
  peridot: 'gem',
  garnet: 'gem',
  topaz: 'gem',
  opal: 'gem',
  jade: 'gem',
  diamond: 'gem',
  core: 'core',
  focus: 'core',
  orb: 'core',
  sphere: 'core',
  bulwark: 'shield',
  aegis: 'shield',
  shield: 'shield',
  ward: 'shield',
  plate: 'plate',
  cuirass: 'plate',
  armor: 'plate',
  crown: 'crown',
  circlet: 'crown',
  diadem: 'crown',
  tiara: 'crown',
  ring: 'ring',
  signet: 'ring',
  band: 'ring',
  crest: 'crest',
  sigil: 'crest',
  emblem: 'crest',
  insignia: 'crest',
  seal: 'crest',
  medal: 'crest',
  pendant: 'pendant',
  talisman: 'pendant',
  charm: 'pendant',
  amulet: 'pendant',
  locket: 'pendant',
  idol: 'idol',
  totem: 'idol',
  effigy: 'idol',
  fetish: 'idol',
};

// Shortest key safe to match as a word ENDING. One higher than equipmentIcons' 4, because "ring"
// is found inside "Wellspring" and turns the Banner of the Wellspring into a signet. Only "heart"
// and "stone" are actually needed as suffixes (Emberheart, Wellstone), so nothing is lost.
const MIN_SUFFIX_MATCH = 5;

/** Longest first, so a compound ending never loses to a shorter key that also matches. */
const SUFFIX_NOUNS = Object.keys(NOUN_FORMS)
  .filter((noun) => noun.length >= MIN_SUFFIX_MATCH)
  .sort((a, b) => b.length - a.length);

/** One word, matched whole, then de-pluralised, then as a compound ending. */
function wordForm(word: string): RelicFormName | undefined {
  if (NOUN_FORMS[word]) return NOUN_FORMS[word];
  const singular = word.endsWith('s') ? word.slice(0, -1) : word;
  if (NOUN_FORMS[singular]) return NOUN_FORMS[singular];
  for (const noun of SUFFIX_NOUNS) {
    if (singular.length > noun.length && singular.endsWith(noun)) return NOUN_FORMS[noun];
  }
  return undefined;
}

/** The name read last word first; a relic named after nothing in the table is a gem. */
export function relicForm(relic: RelicDefinition): RelicFormName {
  const words = relic.name.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean);
  for (let i = words.length - 1; i >= 0; i--) {
    const form = wordForm(words[i]);
    if (form) return form;
  }
  return 'crystal';
}

/** The stat a relic leads with — highest grant, ties broken by STAT_ORDER. */
function dominantStat(grants: Partial<Record<StatKey, number>>): StatKey | undefined {
  let best: StatKey | undefined;
  for (const stat of STAT_ORDER) {
    if (!grants[stat]) continue;
    if (best === undefined || grants[stat]! > grants[best]!) best = stat;
  }
  return best;
}

const FALLBACK_COLOR = '#8b7fe0';

/**
 * What the relic DOES, in one colour: an Elemental Force Standard wears its type, a passive relic
 * wears that passive's colour, a stat relic wears its lead stat. Same derivation order as
 * passiveIcons' `passiveArt`, so a relic and the passive it grants never disagree.
 */
export function relicColor(relicId: string): string {
  const relic = relics[relicId];
  if (!relic) return FALLBACK_COLOR;
  const forceStatus = relic.grantsStatusIds?.[0]?.statusId;
  if (forceStatus) return statusColor(forceStatus);
  const passiveId = relic.grantsPassiveIds?.[0];
  if (passiveId) return passiveColor(passiveId);
  const stat = dominantStat(relic.statGrants);
  return stat ? STAT_COLORS[stat] : FALLBACK_COLOR;
}

export function relicTint(relicId: string, alpha: number): string {
  return hexTint(relicColor(relicId), alpha);
}

/**
 * The header mark for a screen that OFFERS relics, as opposed to one particular relic. Wears
 * `.section-glyph` because it sits in the same NodeHeader slot as the Equipment Cache's, and the
 * two headers should be the same size.
 */
export function RelicKindGlyph({ form }: { form: 'crystal' | 'banner' | 'gem' }) {
  return (
    <svg className="section-glyph" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      {RELIC_FORM_PATHS[form]}
    </svg>
  );
}

/** The one place a relic is drawn. `aria-hidden`: every caller states the name in text beside it. */
export function RelicGlyph({ relicId, className }: { relicId: string; className?: string }) {
  const relic = relics[relicId];
  return (
    <svg
      className={`relic-glyph${className ? ` ${className}` : ''}`}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      style={{ color: relicColor(relicId) } as CSSProperties}
    >
      {RELIC_FORM_PATHS[relic ? relicForm(relic) : 'crystal']}
    </svg>
  );
}
