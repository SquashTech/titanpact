// What a map node PAYS, as figures rather than as a sentence (2026-09-11, per user direction):
// the ledger the node dossier prints under a long press. Every number is read off the constant
// the game rolls with, so the readout cannot say 25% where the roll says 60.

import type { MapNodeType } from '../../run/map';
import type { EquipmentRarity } from '../../run/equipment';
import { EQUIPMENT_DROP_CHANCE, LOOT_SOURCE, MAX_ITEM_SLOTS, RARITY_ORDER, rarityWeightsFor } from '../../run/equipment';
import { GOLD_REWARD_RANGE, PURSE_GOLD_RANGE } from '../../run/runProgress';
import { LONE_SCROLL_COUNT, SCROLL_REWARD_COUNT } from '../../run/progression';
import { BOON_OFFER_COUNT } from '../../run/boons';
import { guildHallLevel, scrollsFor, type EncounterNodeKind } from '../../run/difficulty';
import { ROSTER_CAP, SEAL_ACTS } from '../../run/state';
import {
  ANVIL_PRICE_BY_TARGET,
  ENCHANT_PRICE_BY_RARITY,
  EQUIPMENT_PRICE_BY_RARITY,
  EQUIPMENT_SELL_SHARE,
  GUILD_HALL_EQUIPMENT_OFFER_COUNT,
  SLOT_PRICE_BY_TARGET,
} from '../../run/shop';
import { CONTRACT_PURCHASE_COST, GUILD_HALL_RECRUIT_COST, SCROLL_PURCHASE_COST, SCROLL_PURCHASE_LIMIT } from '../../data/recruitment';

/** The mark at the head of a row — resolved to a glyph by the view. */
export type NodeFactGlyph =
  | 'gold'
  | 'scroll'
  | 'contract'
  | 'item'
  | 'banner'
  | 'recruit'
  | 'move'
  | 'passive'
  | 'slot'
  | 'class'
  | 'enemy'
  | 'hero'
  | 'anvil'
  | 'enchant'
  | 'sell'
  | 'hidden';

export interface NodeFact {
  glyph: NodeFactGlyph;
  label: string;
  /** The figure. `null` is a lane this node does not pay, printed as a dash so the fork's rows line up. */
  value: string | null;
  /** Fine print beside the figure — who it goes to, what tier it rolls at. */
  note?: string;
}

export interface NodeDossier {
  /** The register line under the name: tier, lane, and whether the fight is recruitable. */
  kind: string;
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

function priceBand(table: Record<EquipmentRarity, number>): string {
  const prices = RARITY_ORDER.map((r) => table[r]).filter((p) => p > 0);
  return `${Math.min(...prices)}–${Math.max(...prices)}g`;
}

/** The four lanes every fight is compared on, in one order, so Elite and Battle read as two columns of one table. Scrolls scale by act (difficulty.ts scrollsFor). */
function encounterFacts(type: EncounterNodeKind, actNumber: number): NodeFact[] {
  const gold = GOLD_REWARD_RANGE[type];
  const scrolls = scrollsFor(type, actNumber);
  const drop = EQUIPMENT_DROP_CHANCE[type];
  return [
    { glyph: 'gold', label: 'Gold', value: gold[1] > 0 ? range(gold) : null },
    { glyph: 'scroll', label: 'Scrolls', value: scrolls > 0 ? `${scrolls}` : null },
    {
      glyph: 'item',
      label: 'Item',
      value: drop > 0 ? percent(drop) : null,
      note: drop > 0 && LOOT_SOURCE[type] === 'elite' ? 'one tier up' : undefined,
    },
    { glyph: 'recruit', label: 'Recruit', value: RECRUITABLE.includes(type) ? 'Contract' : null },
  ];
}

export function nodeDossier(type: MapNodeType, actNumber: number): NodeDossier {
  const odds = (kind: EncounterNodeKind | 'standard') =>
    rarityWeightsFor(actNumber, kind === 'standard' ? 'standard' : LOOT_SOURCE[kind]);

  switch (type) {
    case 'fight':
      return { kind: 'Encounter · Monsters', facts: encounterFacts('fight', actNumber), odds: odds('fight') };
    case 'battle':
      return {
        kind: 'Encounter · Monsters',
        facts: [...encounterFacts('battle', actNumber), { glyph: 'enemy', label: 'Enemies', value: 'Faction leader' }],
        odds: odds('battle'),
      };
    case 'skirmish':
      return { kind: 'Encounter · Recruitable', facts: encounterFacts('skirmish', actNumber), odds: odds('skirmish') };
    case 'elite':
      return {
        kind: 'Elite · Recruitable',
        facts: [...encounterFacts('elite', actNumber), { glyph: 'enemy', label: 'Enemies', value: '+10', note: 'to 2 stats each' }],
        odds: odds('elite'),
      };
    case 'boss':
      return {
        kind: 'Act boss · Recruitable',
        facts: [
          ...encounterFacts('boss', actNumber),
          { glyph: 'contract', label: 'Contract', value: '1' },
          { glyph: 'banner', label: 'Banner', value: '1 of 5', note: 'team-wide' },
          { glyph: 'class', label: 'Class', value: '1 hero', note: 'the Crucible' },
          { glyph: 'enemy', label: 'Enemies', value: '+20', note: 'to 3 stats each' },
        ],
        odds: odds('boss'),
      };
    case 'finale':
      return {
        kind: 'The final battle',
        facts: [
          { glyph: 'enemy', label: 'Enemies', value: `${SEAL_ACTS} Guardians`, note: 'as you beat them' },
          { glyph: 'hero', label: 'Roster', value: '6 v 6' },
        ],
        odds: null,
      };
    case 'shop':
      return {
        kind: 'Landmark · Spend',
        facts: [
          { glyph: 'hero', label: 'Hire', value: `${GUILD_HALL_RECRUIT_COST}g`, note: `Lv ${guildHallLevel(actNumber)}, raw` },
          { glyph: 'contract', label: 'Contract', value: `${CONTRACT_PURCHASE_COST}g` },
          { glyph: 'scroll', label: `${scrollsFor('fight', actNumber)} Scrolls`, value: `${SCROLL_PURCHASE_COST}g`, note: `up to ${SCROLL_PURCHASE_LIMIT}` },
          { glyph: 'item', label: 'Gear', value: `${GUILD_HALL_EQUIPMENT_OFFER_COUNT} on shelf`, note: priceBand(EQUIPMENT_PRICE_BY_RARITY) },
          { glyph: 'sell', label: 'Sell', value: `${Math.round(EQUIPMENT_SELL_SHARE * 100)}%`, note: 'of buy price' },
        ],
        odds: odds('standard'),
      };
    case 'blacksmith':
      return {
        kind: 'Landmark · Spend',
        facts: [
          { glyph: 'slot', label: 'Item slot', value: `${SLOT_PRICE_BY_TARGET[2]}g`, note: `${SLOT_PRICE_BY_TARGET[3]}g for the ${MAX_ITEM_SLOTS}rd` },
          { glyph: 'anvil', label: 'Anvil', value: priceBand(ANVIL_PRICE_BY_TARGET), note: '+1 tier' },
          { glyph: 'enchant', label: 'Enchanter', value: priceBand(ENCHANT_PRICE_BY_RARITY), note: 'one element' },
        ],
        odds: null,
      };
    case 'muster':
      return {
        kind: 'Landmark · The last stop',
        facts: [
          { glyph: 'hero', label: 'Recruits', value: `to ${ROSTER_CAP}`, note: 'free' },
          { glyph: 'item', label: 'Gear', value: `${GUILD_HALL_EQUIPMENT_OFFER_COUNT} on shelf`, note: 'one tier up' },
          { glyph: 'sell', label: 'Sell', value: `${Math.round(EQUIPMENT_SELL_SHARE * 100)}%`, note: 'of buy price' },
        ],
        odds: rarityWeightsFor(actNumber, 'elite'),
      };
    case 'equipmentReward':
      return {
        kind: 'Reward · Gear',
        facts: [{ glyph: 'item', label: 'Item', value: '1 of 3' }],
        odds: odds('standard'),
      };
    case 'scrollReward':
      return { kind: 'Reward · Growth', facts: [{ glyph: 'scroll', label: 'Scrolls', value: `${SCROLL_REWARD_COUNT}` }], odds: null };
    case 'loneScrollReward':
      return { kind: 'Reward · Growth', facts: [{ glyph: 'scroll', label: 'Scroll', value: `${LONE_SCROLL_COUNT}` }], odds: null };
    case 'currencyReward':
      return { kind: 'Reward · Purse', facts: [{ glyph: 'gold', label: 'Gold', value: range(PURSE_GOLD_RANGE) }], odds: null };
    case 'passiveReward':
      return {
        kind: 'Reward · Build',
        facts: [{ glyph: 'passive', label: 'Boon', value: `1 of ${BOON_OFFER_COUNT}`, note: 'to 1 hero, permanent' }],
        odds: null,
      };
    case 'forgeReward':
      return {
        kind: 'Reward · Build',
        facts: [{ glyph: 'slot', label: 'Item slot', value: '+1', note: `to 1 hero, max ${MAX_ITEM_SLOTS}` }],
        odds: null,
      };
    case 'mentorReward':
      return {
        kind: 'Reward · Growth',
        facts: [{ glyph: 'move', label: 'Move', value: '1', note: 'Mid tier, rolled — to 1 hero' }],
        odds: null,
      };
    case 'tutorReward':
      return {
        kind: 'Reward · Growth',
        facts: [{ glyph: 'move', label: 'Move', value: 'Any', note: 'from 1 hero’s pool' }],
        odds: null,
      };
    case 'event':
      return {
        kind: 'Reward · Unknown',
        facts: [
          { glyph: 'hidden', label: 'Offer', value: '1 of 4 kinds', note: 'revealed on arrival' },
          { glyph: 'move', label: 'Kinds', value: 'Move · Passive · Gear · Stat trade' },
        ],
        odds: null,
      };
  }
}

/** The ledger as one line, for an aria-label: `Skirmish — Gold 15–25, Scrolls 2, Item 60%, Recruit Contract`. */
export function nodeFactsLine(name: string, type: MapNodeType, actNumber: number): string {
  const parts = nodeDossier(type, actNumber)
    .facts.filter((fact) => fact.value !== null)
    .map((fact) => `${fact.label} ${fact.value}${fact.note ? ` (${fact.note})` : ''}`);
  return `${name} — ${parts.join(', ')}`;
}
