// What a map node PAYS, as figures rather than as a sentence (2026-09-11, per user direction):
// the ledger the map's preview sheet prints. Every number is read off the constant the game rolls
// with, so the readout cannot say 25% where the roll says 60. Above it, one line of lore and no
// more (2026-10-13, per user direction): the rules live in How to Play, not on the sheet.

import type { MapNodeType } from '../../run/map';
import type { EquipmentRarity } from '../../run/equipment';
import { EQUIPMENT_DROP_CHANCE, LOOT_SOURCE, RARITY_ORDER, rarityWeightsFor } from '../../run/equipment';
import { goldRangeFor, purseRangeFor } from '../../run/runProgress';
import { GEM_CACHE_COUNT, GEM_DROP, SCRIBE_GEMS, SHELF_GEM_PRICE_PER_POINT, gemPointsForAct } from '../../run/gems';
import { ENCOUNTER_XP_MULTIPLIER, encounterXpForAct, encounterXpKind } from '../../run/growth';
import { LEY_LINE_FORCE, MANA_WELL_AMOUNT, MANA_WELL_REGEN } from '../../run/runProgress';
import { BOON_OFFER_COUNT } from '../../run/boons';
import { mentorXpFor } from '../../run/mentor';
import { championLevel, enemyLevelFor, guildHallLevel, openerEscortTiersFor, type EncounterNodeKind } from '../../run/difficulty';
import { SEAL_ACTS } from '../../run/state';
import { ANVIL_PRICE_BY_TARGET, ENCHANT_PRICE_BY_RARITY } from '../../run/shop';
import { smithyPrice } from '../../run/cycles';
import { CONTRACT_BASE_PRICE, CONTRACT_DROP_CHANCE } from '../../run/recruitment';
import { MEND_PRICE_PER_HERO } from '../../run/wounds';

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
  /** What the node fields against you, drawn apart from what it pays. */
  threat?: boolean;
  label: string;
  /** The figure. `null` is a lane this node does not pay; the dossier leaves the row out. */
  value: string | null;
  /** A few words beside the figure — who it goes to, how much. */
  note?: string;
}

export interface NodeDossier {
  /** One line of lore, only where the node is vague without it; the figures say the rest. A
   *  `[contract]` token prints the Contract's mark, so the line teaches the icon it names. */
  about: string | null;
  facts: NodeFact[];
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

/** A Smithy price band as a figure and its note: the cheapest work large, the dearest beside it. */
function priceBand(table: Record<EquipmentRarity, number>, cycle: number): { value: string; note: string } {
  const prices = RARITY_ORDER.map((r) => smithyPrice({ cycle }, table[r])).filter((p) => p > 0);
  return { value: `${Math.min(...prices)}g`, note: `to ${Math.max(...prices)}g` };
}

/** The lanes every fight is compared on, in one order, so Elite and Skirmish read as two columns of one table. */
function encounterFacts(type: EncounterNodeKind, actNumber: number): NodeFact[] {
  const gold = goldRangeFor(type, actNumber);
  const drop = EQUIPMENT_DROP_CHANCE[type];
  const xp = Math.round(encounterXpForAct(actNumber) * ENCOUNTER_XP_MULTIPLIER[encounterXpKind(type)]);
  const level = enemyLevelFor(type, actNumber);
  return [
    { glyph: 'enemy', label: 'Enemies', threat: true, value: `Lv ${level}`, note: type === 'boss' ? `Guardian Lv ${championLevel(level)}` : undefined },
    { glyph: 'xp', label: 'XP', value: `${xp}` },
    { glyph: 'gold', label: 'Gold', value: gold[1] > 0 ? range(gold) : null },
    { glyph: 'item', label: 'Item', value: drop > 0 ? percent(drop) : null, note: drop > 0 && LOOT_SOURCE[type] === 'elite' ? 'rarer' : undefined },
    gemFact(type),
    { glyph: 'contract', label: 'Recruit', value: RECRUITABLE.includes(type) ? '1' : null },
  ];
}

/** A won fight's Gem drop (run/gems.ts GEM_DROP): a sure count, or the chance of one. */
function gemFact(type: EncounterNodeKind): NodeFact {
  const { chance, count } = GEM_DROP[type];
  if (chance <= 0 || count <= 0) return { glyph: 'scroll', label: 'Gems', value: null };
  return { glyph: 'scroll', label: 'Gems', value: chance >= 1 ? `${count}` : percent(chance) };
}

/** A Titanspawn tile: its level, and how many. */
function spawnFacts(type: 'fight' | 'battle', actNumber: number, shapeAct: number): NodeFact[] {
  const count = openerEscortTiersFor(shapeAct).length + (shapeAct <= 1 ? 0 : 1);
  return encounterFacts(type, actNumber).map((fact) => (fact.label === 'Enemies' ? { ...fact, note: `× ${count}` } : fact));
}

const gemNote = (actNumber: number) => `+${gemPointsForAct(actNumber)} to a stat each`;

export function nodeDossier(type: MapNodeType, actNumber: number, cycle = 1): NodeDossier {
  const odds = (kind: EncounterNodeKind | 'standard' | 'cache') =>
    rarityWeightsFor(actNumber, kind === 'standard' || kind === 'cache' ? kind : LOOT_SOURCE[kind]);

  switch (type) {
    case 'fight':
      return { about: null, facts: spawnFacts('fight', actNumber, actNumber), odds: odds('fight') };
    case 'battle':
      return { about: null, facts: spawnFacts('battle', actNumber, Math.max(2, actNumber)), odds: odds('battle') };
    case 'skirmish':
      return { about: 'Rival heroes. Beat them, and spend a [contract] Contract to recruit one.', facts: encounterFacts('skirmish', actNumber), odds: odds('skirmish') };
    case 'elite':
      return {
        about: 'Their finest. Beat them, and a [contract] Contract recruits one, stronger than any hire.',
        facts: [...encounterFacts('elite', actNumber), { glyph: 'contract', label: 'Contract', value: percent(CONTRACT_DROP_CHANCE.elite ?? 0) }],
        odds: odds('elite'),
      };
    case 'boss':
      return {
        about: null,
        facts: [...encounterFacts('boss', actNumber), { glyph: 'banner', label: 'Banner', value: '1 of 3', note: 'whole team' }],
        odds: odds('boss'),
      };
    case 'finale':
      return {
        about: 'The Titan’s Herald, and what watches from behind it.',
        facts: [{ glyph: 'enemy', label: 'The Herald', value: `Lv ${enemyLevelFor('finale', actNumber)}`, note: `${SEAL_ACTS} Titanspawn with it` }],
        odds: null,
      };
    case 'shop':
      return {
        about: null,
        facts: [
          { glyph: 'hero', label: 'Hire', value: `Lv ${guildHallLevel(actNumber)}`, note: '1 Contract' },
          { glyph: 'contract', label: 'Contract', value: `${CONTRACT_BASE_PRICE}g`, note: 'more each time' },
          { glyph: 'scroll', label: 'Gem', value: `${gemPointsForAct(actNumber) * SHELF_GEM_PRICE_PER_POINT}g` },
          { glyph: 'hp', label: 'Meal', value: `${MEND_PRICE_PER_HERO}g`, note: 'per hero hurt' },
        ],
        odds: null,
      };
    case 'muster':
      return {
        about: null,
        facts: [
          { glyph: 'scroll', label: 'Gem', value: `${gemPointsForAct(actNumber) * SHELF_GEM_PRICE_PER_POINT}g` },
          { glyph: 'anvil', label: 'Anvil', ...priceBand(ANVIL_PRICE_BY_TARGET, cycle) },
          { glyph: 'enchant', label: 'Enchanter', ...priceBand(ENCHANT_PRICE_BY_RARITY, cycle) },
        ],
        odds: null,
      };
    case 'equipmentReward':
      return { about: null, facts: [{ glyph: 'item', label: 'Item', value: '1 of 3' }], odds: odds('cache') };
    case 'scrollReward':
      return { about: null, facts: [{ glyph: 'scroll', label: 'Gems', value: `${GEM_CACHE_COUNT}`, note: gemNote(actNumber) }], odds: null };
    case 'scribeReward':
      return { about: null, facts: [{ glyph: 'scroll', label: 'Gems', value: `${SCRIBE_GEMS}`, note: gemNote(actNumber) }], odds: null };
    case 'manaWellReward':
      return {
        about: null,
        facts: [
          { glyph: 'mana', label: 'Max Mana', value: `+${MANA_WELL_AMOUNT}`, note: 'one hero' },
          { glyph: 'mana', label: 'MP Regen', value: `+${MANA_WELL_REGEN}` },
        ],
        odds: null,
      };
    case 'forgeReward':
      return {
        about: null,
        facts: [
          { glyph: 'anvil', label: 'Lift', value: '1 piece', note: 'a tier up' },
          { glyph: 'enchant', label: 'Bind', value: '1 element', note: 'your pick' },
        ],
        odds: null,
      };
    case 'leyLineReward':
      return {
        about: 'Raw power runs under the ground here. One hero draws on it.',
        facts: [{ glyph: 'enchant', label: 'Force', value: `+${LEY_LINE_FORCE}`, note: 'one hero, its own element' }],
        odds: null,
      };
    case 'restReward':
      return { about: null, facts: [{ glyph: 'hp', label: 'Heal', value: 'Everyone' }], odds: null };
    case 'currencyReward':
      return { about: null, facts: [{ glyph: 'gold', label: 'Gold', value: range(purseRangeFor(actNumber)) }], odds: null };
    case 'contractReward':
      return { about: null, facts: [{ glyph: 'contract', label: 'Contract', value: '+1' }], odds: null };
    case 'passiveReward':
      return { about: 'A gift for one hero to carry.', facts: [{ glyph: 'passive', label: 'Boon', value: `1 of ${BOON_OFFER_COUNT}`, note: 'one hero' }], odds: null };
    case 'blessingReward':
      return { about: 'The Pactwarden shields one hero from a fatal blow.', facts: [{ glyph: 'hero', label: 'Blessing', value: '1 hero' }], odds: null };
    case 'mentorReward':
      return {
        about: 'An old veteran. He will teach one hero how to fight.',
        facts: [{ glyph: 'xp', label: 'XP', value: `+${mentorXpFor(actNumber).toLocaleString()}`, note: 'one hero' }],
        odds: null,
      };
    case 'academyReward':
      return { about: 'The Academy trains one hero in a Class.', facts: [{ glyph: 'class', label: 'Class', value: '1 of 3', note: 'one hero' }], odds: null };
    case 'tutorReward':
      return { about: 'A master of every school. One hero learns any move it can.', facts: [{ glyph: 'move', label: 'Move', value: 'Your pick', note: 'one hero' }], odds: null };
    case 'event':
      return { about: 'Something waits on the road ahead.', facts: [{ glyph: 'hidden', label: 'What', value: 'Unknown' }], odds: null };
  }
}

/** The ledger as one line, for an aria-label: `Skirmish — Gold 15–25, Item 60%`. */
export function nodeFactsLine(name: string, type: MapNodeType, actNumber: number, cycle = 1): string {
  const parts = nodeDossier(type, actNumber, cycle)
    .facts.filter((fact) => fact.value !== null)
    .map((fact) => `${fact.label} ${fact.value}${fact.note ? ` (${fact.note})` : ''}`);
  return `${name} — ${parts.join(', ')}`;
}
