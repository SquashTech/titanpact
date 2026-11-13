// What a map node PAYS, as figures rather than as a sentence (2026-09-11, per user direction):
// the ledger the map's preview sheet prints. Every number is read off the constant the game rolls
// with, so the readout cannot say 25% where the roll says 60. Above it, one line of lore and no
// more (2026-10-13, per user direction): the rules live in How to Play, not on the sheet.

import type { MapNodeType } from '../../run/map';
import type { EquipmentRarity } from '../../run/equipment';
import { EQUIPMENT_DROP_CHANCE, LOOT_SOURCE, rarityWeightsFor } from '../../run/equipment';
import { GEM_CACHE_COUNT, GEM_DROP, SCRIBE_GEMS, gemPointsForAct } from '../../run/gems';
import { CAMP_DOOR_COUNT } from '../../run/camp';
import { ENCOUNTER_XP_MULTIPLIER, encounterXpForAct, encounterXpKind } from '../../run/growth';
import { LEY_LINE_FORCE, MANA_WELL_AMOUNT, MANA_WELL_REGEN } from '../../run/runProgress';
import { BOON_OFFER_COUNT } from '../../run/boons';
import { mentorXpFor } from '../../run/mentor';
import { championLevel, enemyLevelFor, openerEscortTiersFor, type EncounterNodeKind } from '../../run/difficulty';
import { SEAL_ACTS } from '../../run/state';
import { RECRUIT_TYPE_COUNT } from '../../run/recruitNode';

/** The mark at the head of a row — resolved to a glyph by the view. */
export type NodeFactGlyph =
  | 'xp'
  | 'scroll'
  | 'mana'
  | 'hp'
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
  /** A few words beside the figure — how much, or on what. */
  note?: string;
  /** Who it goes to, drawn as the move strip's ally figures: one hero, or the whole team. */
  who?: 'one' | 'team';
}

export interface NodeDossier {
  /** One line, kept only where the figures cannot say what the node does or what it means. */
  about: string | null;
  facts: NodeFact[];
  /** Rarity odds for a node that hands out an item, already windowed to the act. Null where nothing drops. */
  odds: Record<EquipmentRarity, number> | null;
}

function range([min, max]: readonly [number, number]): string {
  return min === max ? `${min}` : `${min}–${max}`;
}

function percent(chance: number): string {
  return `${Math.round(chance * 100)}%`;
}

/** The lanes every fight is compared on, in one order, so Elite and Skirmish read as two columns of one table. */
function encounterFacts(type: EncounterNodeKind, actNumber: number): NodeFact[] {
  const drop = EQUIPMENT_DROP_CHANCE[type];
  const xp = Math.round(encounterXpForAct(actNumber) * ENCOUNTER_XP_MULTIPLIER[encounterXpKind(type)]);
  const level = enemyLevelFor(type, actNumber);
  return [
    { glyph: 'enemy', label: 'Enemies', threat: true, value: `Lv ${level}`, note: type === 'boss' ? `Guardian Lv ${championLevel(level)}` : undefined },
    { glyph: 'xp', label: 'XP', value: `${xp}` },
    { glyph: 'item', label: 'Item', value: drop > 0 ? percent(drop) : null, note: drop > 0 && LOOT_SOURCE[type] === 'elite' ? 'rarer' : undefined },
    gemFact(type),
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

export function nodeDossier(type: MapNodeType, actNumber: number): NodeDossier {
  const odds = (kind: EncounterNodeKind | 'standard' | 'cache') =>
    rarityWeightsFor(actNumber, kind === 'standard' || kind === 'cache' ? kind : LOOT_SOURCE[kind]);

  switch (type) {
    case 'fight':
      return { about: null, facts: spawnFacts('fight', actNumber, actNumber), odds: odds('fight') };
    case 'battle':
      return { about: null, facts: spawnFacts('battle', actNumber, Math.max(2, actNumber)), odds: odds('battle') };
    case 'skirmish':
      return { about: null, facts: encounterFacts('skirmish', actNumber), odds: odds('skirmish') };
    case 'elite':
      return {
        about: null,
        facts: [...encounterFacts('elite', actNumber), { glyph: 'passive', label: 'Boon', value: `1 of ${BOON_OFFER_COUNT}`, who: 'one' }],
        odds: odds('elite'),
      };
    case 'boss':
      return {
        about: null,
        facts: [...encounterFacts('boss', actNumber), { glyph: 'banner', label: 'Banner', value: '1 of 3', who: 'team' }],
        odds: odds('boss'),
      };
    case 'finale':
      return {
        about: 'The Titan’s Herald, and what watches from behind it.',
        facts: [{ glyph: 'enemy', label: 'The Herald', value: `Lv ${enemyLevelFor('finale', actNumber)}`, note: `${SEAL_ACTS} Titanspawn with it` }],
        odds: null,
      };
    case 'camp':
      return {
        about: 'The last stop before the Guardian.',
        facts: [
          { glyph: 'hp', label: 'Mend', value: 'All', who: 'team' },
          { glyph: 'hidden', label: 'Doors', value: `${CAMP_DOOR_COUNT - 1} more` },
        ],
        odds: null,
      };
    case 'equipmentReward':
      return { about: null, facts: [{ glyph: 'item', label: 'Item', value: '1' }], odds: odds('cache') };
    case 'scrollReward':
      return { about: null, facts: [{ glyph: 'scroll', label: 'Gems', value: `${GEM_CACHE_COUNT}`, note: gemNote(actNumber) }], odds: null };
    case 'scribeReward':
      return { about: null, facts: [{ glyph: 'scroll', label: 'Gems', value: `${SCRIBE_GEMS}`, note: gemNote(actNumber) }], odds: null };
    case 'manaWellReward':
      return {
        about: null,
        facts: [
          { glyph: 'mana', label: 'Max Mana', value: `+${MANA_WELL_AMOUNT}`, who: 'one' },
          { glyph: 'mana', label: 'MP Regen', value: `+${MANA_WELL_REGEN}`, who: 'one' },
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
        about: null,
        facts: [{ glyph: 'enchant', label: 'Force', value: `+${LEY_LINE_FORCE}`, who: 'one', note: 'its own element' }],
        odds: null,
      };
    case 'restReward':
      return { about: null, facts: [{ glyph: 'hp', label: 'Heal', value: 'Everyone' }], odds: null };
    case 'recruitReward':
      return { about: null, facts: [{ glyph: 'hero', label: 'Recruit', value: `1 of ${RECRUIT_TYPE_COUNT}`, note: 'types' }], odds: null };
    case 'passiveReward':
      return { about: null, facts: [{ glyph: 'passive', label: 'Boon', value: `1 of ${BOON_OFFER_COUNT}`, who: 'one' }], odds: null };
    case 'blessingReward':
      return { about: 'The Pactwarden shields a hero from a fatal blow.', facts: [{ glyph: 'hero', label: 'Blessing', value: '1', who: 'one' }], odds: null };
    case 'mentorReward':
      return {
        about: null,
        facts: [{ glyph: 'xp', label: 'XP', value: `+${mentorXpFor(actNumber).toLocaleString()}`, who: 'one' }],
        odds: null,
      };
    case 'patronSeat':
      return { about: null, facts: [], odds: null };
    case 'academyReward':
      return { about: null, facts: [{ glyph: 'class', label: 'Class', value: '1 of 3', who: 'one' }], odds: null };
    case 'tutorReward':
      return { about: null, facts: [{ glyph: 'move', label: 'Move', value: 'Your pick', who: 'one' }], odds: null };
    case 'event':
      return { about: null, facts: [{ glyph: 'hidden', label: 'What', value: 'Unknown' }], odds: null };
  }
}

/** The ledger as one line, for an aria-label: `Skirmish — Gold 15–25, Item 60%`. */
export function nodeFactsLine(name: string, type: MapNodeType, actNumber: number): string {
  const parts = nodeDossier(type, actNumber)
    .facts.filter((fact) => fact.value !== null)
    .map((fact) => {
      const asides = [fact.who === 'one' ? 'one hero' : fact.who === 'team' ? 'whole team' : '', fact.note ?? ''].filter(Boolean);
      return `${fact.label} ${fact.value}${asides.length ? ` (${asides.join(', ')})` : ''}`;
    });
  return `${name} — ${parts.join(', ')}`;
}
