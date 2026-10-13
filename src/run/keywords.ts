import type { PassiveDefinition } from '../engine/content';
import type { TriggerKeywordId } from '../data/keywords';

type PassiveReaction = NonNullable<PassiveDefinition['reactive']>;

/** A passive's trigger as a keyword, plus the marks that ride on it. */
export interface PassiveKeyword {
  id: TriggerKeywordId;
  /** "The first time … each fight". */
  once?: true;
  /** "Every Nth round". */
  everyNRounds?: number;
  /** An On Hit narrowed to one element ("On Fire Hit"). */
  moveType?: string;
  /** An On Hit narrowed to one pipeline ("On Magical Hit"). */
  category?: 'physical' | 'magical';
}

const HIT_QUALIFIERS = new Set(['moveType', 'category']);

/** The keyword a passive's main reaction reads as, or nothing when its trigger stays a sentence. */
export function passiveKeywordOf(def: PassiveDefinition): PassiveKeyword | undefined {
  return def.reactive ? reactionKeywordOf(def.reactive) : undefined;
}

/** The keyword one reaction reads as — a card's second reaction included. */
export function reactionKeywordOf(reactive: PassiveReaction): PassiveKeyword | undefined {
  const { hook, condition } = reactive;
  const fields = condition.eventFieldEquals ?? {};
  const fieldKeys = Object.keys(fields);
  const self = condition.relativeTo === 'self';
  const source = condition.subjectRole === 'source';
  const marks = reactive.oncePerFight ? { once: true as const } : {};

  const id = ((): TriggerKeywordId | undefined => {
    switch (hook) {
      case 'SwitchedIn':
        return self ? 'enter' : undefined;
      case 'SwitchedOut':
        return self ? 'leave' : undefined;
      case 'Rested':
        return self ? 'rest' : undefined;
      case 'Healed':
        return self && !source ? 'healed' : undefined;
      case 'RoundEnded':
        return self && !condition.everyNRoundsOnField && !reactive.whileBenched ? 'roundEnd' : undefined;
      case 'DamageDealt':
        if (self && source && fieldKeys.every((key) => HIT_QUALIFIERS.has(key))) return condition.finishingBlow ? 'takedown' : 'hit';
        if (self && !source && fieldKeys.length === 0 && !condition.finishingBlow) return 'struck';
        if (condition.relativeTo === 'enemy' && source && condition.targetsOwner && fieldKeys.length === 0) return 'struck';
        return undefined;
      default:
        return undefined;
    }
  })();
  if (!id) return undefined;

  return {
    id,
    ...marks,
    ...(id === 'roundEnd' && condition.everyNRounds ? { everyNRounds: condition.everyNRounds } : {}),
    ...(id === 'hit' && fields.moveType ? { moveType: fields.moveType } : {}),
    ...(id === 'hit' && fields.category ? { category: fields.category as 'physical' | 'magical' } : {}),
  };
}

/** The badge's words: "Enter", "On Fire Hit", "Round End". */
export function passiveKeywordLabel(keyword: PassiveKeyword, name: string): string {
  if (keyword.id !== 'hit') return name;
  if (keyword.moveType) return `On ${keyword.moveType} Hit`;
  if (keyword.category) return `On ${keyword.category === 'magical' ? 'Magical' : 'Physical'} Hit`;
  return name;
}
