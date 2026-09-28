// What a map node PAYS, as figures rather than as a sentence (2026-09-11, per user direction):
// the ledger the node dossier prints under a long press. Every number is read off the constant
// the game rolls with, so the readout cannot say 25% where the roll says 60. Beside the ledger,
// each node says in plain words what it does and defines the words it leans on (2026-09-28).

import type { MapNodeType } from '../../run/map';
import type { EquipmentRarity } from '../../run/equipment';
import { ENCHANT_FORCE_BY_RARITY, EQUIPMENT_DROP_CHANCE, LOOT_SOURCE, RARITY_ORDER, rarityWeightsFor } from '../../run/equipment';
import { goldRangeFor, purseRangeFor } from '../../run/runProgress';
import { MASTERY_EVOLUTION, SCRIBE_PICKS, SCRIBE_PIPS_EACH, SCROLL_CACHE_COUNT, SCROLL_PURCHASE_COST, SCROLL_PURCHASE_LIMIT } from '../../run/mastery';
import { ENCOUNTER_XP_MULTIPLIER, encounterXpForAct, encounterXpKind } from '../../run/growth';
import { LEY_LINE_FORCE, MANA_WELL_AMOUNT } from '../../run/runProgress';
import { BOON_OFFER_COUNT } from '../../run/boons';
import { championLevel, enemyLevelFor, guildHallLevel, openerEscortTiersFor, spawnLeaderTierFor, type EncounterNodeKind } from '../../run/difficulty';
import type { SpawnTier } from '../../data/titanspawn';
import { ROSTER_CAP, SEAL_ACTS } from '../../run/state';
import { ANVIL_PRICE_BY_TARGET, ENCHANT_PRICE_BY_RARITY } from '../../run/shop';
import { CONTRACT_PURCHASE_COST, GUILD_HALL_RECRUIT_COST } from '../../data/recruitment';
import { CONSUMABLE_PRICE, REVIVE_PRICE } from '../../run/consumables';
import { MEND_PRICE_PER_HERO } from '../../run/wounds';
import { TYPE_DAMAGE_BONUS } from '../../data/passives';

/** The mark at the head of a row — resolved to a glyph by the view. */
export type NodeFactGlyph =
  | 'gold'
  | 'xp'
  | 'scroll'
  | 'mana'
  | 'hp'
  | 'contract'
  | 'item'
  | 'banner'
  | 'recruit'
  | 'move'
  | 'passive'
  | 'class'
  | 'enemy'
  | 'hero'
  | 'anvil'
  | 'enchant'
  | 'hidden';

export interface NodeFact {
  glyph: NodeFactGlyph;
  label: string;
  /** The figure. `null` is a lane this node does not pay, printed as a dash so the fork's rows line up. */
  value: string | null;
  /** Fine print beside the figure — who it goes to, what tier it rolls at. */
  note?: string;
}

/** A word the explanation leans on, defined where it is used. */
export interface NodeTerm {
  term: string;
  text: string;
}

export interface NodeDossier {
  /** The register line under the name: tier, lane, and whether the fight is recruitable. */
  kind: string;
  facts: NodeFact[];
  /** What the node actually does, in plain words. */
  about: string;
  terms: NodeTerm[];
  /** Rarity odds for a node that hands out an item, already windowed to the act. Null where nothing drops. */
  odds: Record<EquipmentRarity, number> | null;
}

const RECRUITABLE: readonly MapNodeType[] = ['skirmish', 'elite', 'boss'];

function range([min, max]: readonly [number, number]): string {
  return min === max ? `${min}` : `${min}–${max}`;
}

function percent(chance: number): string {
  return `${Math.round(chance * 100)}%`;
}

function priceBand(table: Record<EquipmentRarity, number>): string {
  const prices = RARITY_ORDER.map((r) => table[r]).filter((p) => p > 0);
  return `${Math.min(...prices)}–${Math.max(...prices)}g`;
}

/** The lanes every fight is compared on, in one order, so Elite and Skirmish read as two columns of one table. */
function encounterFacts(type: EncounterNodeKind, actNumber: number): NodeFact[] {
  const gold = goldRangeFor(type, actNumber);
  const drop = EQUIPMENT_DROP_CHANCE[type];
  const xpKind = encounterXpKind(type);
  const xp = Math.round(encounterXpForAct(actNumber) * ENCOUNTER_XP_MULTIPLIER[xpKind]);
  const level = enemyLevelFor(type, actNumber);
  return [
    {
      glyph: 'enemy',
      label: 'Enemies',
      value: `Lv ${level}`,
      note: type === 'boss' ? `the Guardian Lv ${championLevel(level)}` : undefined,
    },
    { glyph: 'xp', label: 'XP', value: `${xp}`, note: xpKind === 'standard' ? undefined : `×${ENCOUNTER_XP_MULTIPLIER[xpKind]}` },
    { glyph: 'gold', label: 'Gold', value: gold[1] > 0 ? range(gold) : null },
    {
      glyph: 'item',
      label: 'Item',
      value: drop > 0 ? percent(drop) : null,
      note: drop > 0 && LOOT_SOURCE[type] === 'elite' ? 'one tier up' : undefined,
    },
    { glyph: 'recruit', label: 'Recruit', value: RECRUITABLE.includes(type) ? 'Contract' : null },
  ];
}

const SPAWN_TIER_NAMES: Record<SpawnTier, string> = { early: 'Early', mid: 'Mid', late: 'Late' };

/** What a Titanspawn tile fields, read off the opener's shape (run/spawn.ts mobEncounter): two bare Earlies in Act 1, a leader over the act's escorts after. */
function spawnLine(actNumber: number): { value: string; note: string } {
  const escorts = openerEscortTiersFor(actNumber);
  if (actNumber <= 1) return { value: `${escorts.length} Titanspawn`, note: `both ${SPAWN_TIER_NAMES.early}` };
  return {
    value: `${escorts.length + 1} Titanspawn`,
    note: `a ${SPAWN_TIER_NAMES[spawnLeaderTierFor(actNumber)]} over ${escorts.map((tier) => SPAWN_TIER_NAMES[tier]).join(', ')}`,
  };
}

const FORCE_BY_TIER = Object.values(ENCHANT_FORCE_BY_RARITY);

const TERMS = {
  contract: {
    term: 'Recruit Contract',
    text: 'Spent after a won Skirmish, Elite or Guardian to sign one hero you beat. It joins finished: at its level, evolved, its kit chosen, wearing the piece it fought in.',
  },
  mastery: {
    term: 'Mastery',
    text: `Ten pips a hero. The ${MASTERY_EVOLUTION}th opens its Evolution, a one-time choice of path; the 10th masters its innate passive into a stronger form. Pips past 10 are lost.`,
  },
  force: {
    term: 'Elemental Force',
    text: `Flat power added to every hit of a move of that element — per hit and per target, before the stat ratio and the type chart multiply it — so it counts for most on cheap moves. Enchanted gear carries ${Math.min(...FORCE_BY_TIER)}–${Math.max(...FORCE_BY_TIER)} by tier.`,
  },
  wounds: {
    term: 'Wounds',
    text: 'HP carries from fight to fight inside an act. A knocked-out hero is Down and sits out until a Rest, the Guild Hall mend, a Revive, or the act ends.',
  },
  sockets: {
    term: 'Sockets',
    text: 'Every hero wears three pieces. A piece is given the moment it is received and never comes off; a second of a family the hero already wears merges into it, a tier up.',
  },
  boon: {
    term: 'Boon',
    text: `A passive given to one hero for the run. Boons stack. A type's +${Math.round(TYPE_DAMAGE_BONUS * 100)}% damage Boon and its field Herald are only offered while your roster fields that type.`,
  },
  banner: {
    term: 'Banner',
    text: 'A team-wide stat grant, chosen 1 of 3 at each Guardian: Warcry (offense), Bulwark (defense) or Wellspring (HP, Mana, MP Regen). They stack across acts.',
  },
  class: {
    term: 'Class',
    text: 'The Crucible tempers one hero into a Class: a move or a passive in its own element, one per hero.',
  },
  moveCap: {
    term: 'Four moves',
    text: 'A hero holds four moves. Offered a fifth, it replaces one or declines — and a declined roll is spent.',
  },
} satisfies Record<string, NodeTerm>;

const SPAWN_ABOUT = 'The Titan’s brood, one line per type. Win and every hero on the roster gains the XP, fielded or not. Spawn never sign a contract.';

export function nodeDossier(type: MapNodeType, actNumber: number): NodeDossier {
  const odds = (kind: EncounterNodeKind | 'standard') =>
    rarityWeightsFor(actNumber, kind === 'standard' ? 'standard' : LOOT_SOURCE[kind]);

  switch (type) {
    case 'fight':
      return {
        kind: 'Encounter · Not recruitable',
        facts: [...encounterFacts('fight', actNumber), { glyph: 'enemy', label: 'Titanspawn', ...spawnLine(actNumber) }],
        odds: odds('fight'),
        about: SPAWN_ABOUT,
        terms: [TERMS.wounds],
      };
    case 'battle':
      return {
        kind: 'Encounter · Not recruitable',
        facts: [...encounterFacts('battle', actNumber), { glyph: 'enemy', label: 'Titanspawn', ...spawnLine(Math.max(2, actNumber)) }],
        odds: odds('battle'),
        about: SPAWN_ABOUT,
        terms: [TERMS.wounds],
      };
    case 'skirmish':
      return {
        kind: 'Encounter · Recruitable',
        facts: encounterFacts('skirmish', actNumber),
        odds: odds('skirmish'),
        about: 'A band of heroes at your level. Beat them and you may spend a Recruit Contract on one of them. The typing on the tile is the typing you will face.',
        terms: [TERMS.contract, TERMS.wounds],
      };
    case 'elite':
      return {
        kind: 'Elite · Recruitable',
        facts: encounterFacts('elite', actNumber),
        odds: odds('elite'),
        about: `A level over you, and it pays for it: ×${ENCOUNTER_XP_MULTIPLIER.elite} XP and an item rolled a tier up. Recruitable like a Skirmish, and its hero arrives stronger than any hire.`,
        terms: [TERMS.contract, TERMS.wounds],
      };
    case 'boss':
      return {
        kind: 'Act boss · Recruitable',
        facts: [
          ...encounterFacts('boss', actNumber),
          { glyph: 'contract', label: 'Contract', value: '1' },
          { glyph: 'banner', label: 'Banner', value: '1 of 3', note: 'team-wide' },
          { glyph: 'class', label: 'Class', value: '1 hero', note: 'the Crucible' },
        ],
        odds: odds('boss'),
        about: 'The act’s end: its champion stands over an escort. Beat it for a Banner, a Contract and the chance to spend one, and the Crucible. Closing the act mends the roster and stands the Down up.',
        terms: [TERMS.banner, TERMS.class, TERMS.contract],
      };
    case 'finale':
      return {
        kind: 'The final battle',
        facts: [
          // The Eyes behind the Herald are not on the tile (docs/titan-eyes.md §10.4): the dossier says what is scouted.
          { glyph: 'enemy', label: 'The Herald', value: `Lv ${enemyLevelFor('finale', actNumber)}`, note: `${SEAL_ACTS} Titanspawn with it` },
          // Whoever arrives: the Vigil recruits nobody (2026-09-24), so the side is the roster the run kept.
          { glyph: 'hero', label: 'Roster', value: `up to ${ROSTER_CAP} v ${SEAL_ACTS + 1}` },
        ],
        odds: null,
        about: 'The Herald leads one Late Titanspawn for every seal you broke, and nothing reaches it while any of its company stands. Nobody is recruited here: you arrive with the roster you kept.',
        terms: [TERMS.wounds],
      };
    case 'shop':
      return {
        kind: 'Landmark · Spend',
        facts: [
          { glyph: 'hero', label: 'Hire', value: `${GUILD_HALL_RECRUIT_COST}g`, note: `Lv ${guildHallLevel(actNumber)}, raw` },
          { glyph: 'contract', label: 'Contract', value: `${CONTRACT_PURCHASE_COST}g` },
          { glyph: 'scroll', label: 'Mastery Scroll', value: `${SCROLL_PURCHASE_COST}g`, note: `up to ${SCROLL_PURCHASE_LIMIT}` },
          { glyph: 'anvil', label: 'Anvil', value: priceBand(ANVIL_PRICE_BY_TARGET), note: '+1 tier' },
          { glyph: 'enchant', label: 'Enchanter', value: priceBand(ENCHANT_PRICE_BY_RARITY), note: 'one element' },
          { glyph: 'hp', label: 'Mend', value: `${MEND_PRICE_PER_HERO}g`, note: 'a hero’s worth of missing HP' },
          { glyph: 'hp', label: 'Potion · Revive', value: `${CONSUMABLE_PRICE}g · ${REVIVE_PRICE}g` },
        ],
        odds: null,
        about: 'Where gold is spent. The Tavern hires heroes raw — an act behind, unevolved, bare-socketed. The shelf sells Scrolls, potions and one Revive; the Smithy works worn gear; the mend heals everyone, the Down included.',
        terms: [TERMS.contract, TERMS.force, TERMS.wounds],
      };
    case 'muster':
      return {
        kind: 'Landmark · The last stop',
        facts: [
          { glyph: 'scroll', label: 'Mastery Scroll', value: `${SCROLL_PURCHASE_COST}g`, note: `up to ${SCROLL_PURCHASE_LIMIT}` },
          { glyph: 'anvil', label: 'Anvil', value: priceBand(ANVIL_PRICE_BY_TARGET), note: '+1 tier' },
          { glyph: 'enchant', label: 'Enchanter', value: priceBand(ENCHANT_PRICE_BY_RARITY), note: 'one element' },
          { glyph: 'hp', label: 'Mend', value: `${MEND_PRICE_PER_HERO}g`, note: 'a hero’s worth of missing HP' },
          { glyph: 'hp', label: 'Potion · Revive', value: `${CONSUMABLE_PRICE}g · ${REVIVE_PRICE}g` },
        ],
        odds: null,
        about: 'The last stop before the final battle: the Guild Hall without its Tavern. Heal up, stock the Bag, finish the gear.',
        terms: [TERMS.force, TERMS.wounds],
      };
    case 'equipmentReward':
      return {
        kind: 'Reward · Gear',
        facts: [{ glyph: 'item', label: 'Item', value: '1 of 3' }],
        odds: odds('standard'),
        about: 'A chest with three pieces in it: claim one and choose who wears it. Declining a piece is selling it.',
        terms: [TERMS.sockets],
      };
    case 'scrollReward':
      return {
        kind: 'Reward · Growth',
        facts: [{ glyph: 'scroll', label: 'Mastery', value: `+${SCROLL_CACHE_COUNT}`, note: `divided as you like — ${MASTERY_EVOLUTION} Evolves` }],
        odds: null,
        about: `${SCROLL_CACHE_COUNT} Mastery pips, one tap at a time — all on one hero or spread across the roster.`,
        terms: [TERMS.mastery],
      };
    case 'manaWellReward':
      return {
        kind: 'Reward · Growth',
        facts: [{ glyph: 'mana', label: 'Max Mana', value: `+${MANA_WELL_AMOUNT}`, note: 'to 1 hero, permanent' }],
        odds: null,
        about: `One hero’s Mana pool grows by ${MANA_WELL_AMOUNT} for the run. Moves are priced in Mana, so a bigger pool is more casts before a Rest — about one more Late move a fight.`,
        terms: [],
      };
    case 'forgeReward':
      return {
        kind: 'Reward · Gear',
        facts: [
          { glyph: 'anvil', label: 'Lift', value: '1 piece', note: 'a tier up, free — the act still caps it' },
          { glyph: 'enchant', label: 'Bind', value: '1 element', note: 'yours to pick, replacing any' },
        ],
        odds: null,
        about: 'The Smithy’s two works on one worn piece, free: lifted a tier where the act allows, and bound to the element you pick. Only a roster that wears nothing gets nothing here.',
        terms: [TERMS.force],
      };
    case 'leyLineReward':
      return {
        kind: 'Reward · Build',
        facts: [{ glyph: 'enchant', label: 'Force', value: `+${LEY_LINE_FORCE}`, note: 'to 1 hero, its own element, permanent' }],
        odds: null,
        about: `One hero draws +${LEY_LINE_FORCE} Elemental Force at its primary element for the run, on top of any from its gear. It pays on moves of that element only, so count them.`,
        terms: [TERMS.force],
      };
    case 'restReward':
      return {
        kind: 'Reward · Recovery',
        facts: [{ glyph: 'hp', label: 'Mend', value: 'whole roster', note: 'HP carries between fights' }],
        odds: null,
        about: 'Every hero heals to full and the Down stand up. Nothing to choose — it is worth exactly what your roster is missing.',
        terms: [TERMS.wounds],
      };
    case 'currencyReward':
      return {
        kind: 'Reward · Purse',
        facts: [{ glyph: 'gold', label: 'Gold', value: range(purseRangeFor(actNumber)) }],
        odds: null,
        about: 'Gold, paid the moment you arrive. It is spent at the Guild Hall.',
        terms: [],
      };
    case 'passiveReward':
      return {
        kind: 'Reward · Build',
        facts: [{ glyph: 'passive', label: 'Boon', value: `1 of ${BOON_OFFER_COUNT}`, note: 'to 1 hero, permanent' }],
        odds: null,
        about: `Pick one of ${BOON_OFFER_COUNT} passives, then the hero who keeps it.`,
        terms: [TERMS.boon],
      };
    case 'scribeReward':
      return {
        kind: 'Reward · Growth',
        facts: [{ glyph: 'scroll', label: 'Mastery', value: `+${SCRIBE_PIPS_EACH}`, note: `to ${SCRIBE_PICKS} heroes — ${MASTERY_EVOLUTION} Evolves` }],
        odds: null,
        about: `${SCRIBE_PICKS} different heroes take ${SCRIBE_PIPS_EACH} Mastery pips each.`,
        terms: [TERMS.mastery],
      };
    case 'mentorReward':
      return {
        kind: 'Reward · Growth',
        facts: [{ glyph: 'move', label: 'Move', value: '1', note: 'Mid tier, rolled — to 1 hero' }],
        odds: null,
        about: 'Pick a hero, and one Mid-tier move is rolled from its own pool — a move ahead of its schedule. A hero with nothing left to roll is greyed out.',
        terms: [TERMS.moveCap],
      };
    case 'tutorReward':
      return {
        kind: 'Reward · Growth',
        facts: [{ glyph: 'move', label: 'Move', value: '1', note: 'Late tier, rolled — to 1 hero' }],
        odds: null,
        about: 'Pick a hero, and one Late-tier move — its strongest band — is rolled from its own pool, whatever its level.',
        terms: [TERMS.moveCap],
      };
    case 'event':
      return {
        kind: 'Reward · Unknown',
        facts: [
          { glyph: 'hidden', label: 'Offer', value: '1 of 4 kinds', note: 'revealed on arrival' },
          { glyph: 'move', label: 'Kinds', value: 'Move · Passive · Gear · Stat trade' },
        ],
        odds: null,
        about: 'Something on the road, unknown until you arrive: a move to teach, a passive, a pile of loot, or one stat traded for another.',
        terms: [TERMS.moveCap, TERMS.sockets],
      };
  }
}

/** The ledger as one line, for an aria-label: `Skirmish — Gold 15–25, Item 60%, Recruit Contract`. */
export function nodeFactsLine(name: string, type: MapNodeType, actNumber: number): string {
  const parts = nodeDossier(type, actNumber)
    .facts.filter((fact) => fact.value !== null)
    .map((fact) => `${fact.label} ${fact.value}${fact.note ? ` (${fact.note})` : ''}`);
  return `${name} — ${parts.join(', ')}`;
}
