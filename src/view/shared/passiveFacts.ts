// A passive's rule as rows rather than as its sentence (2026-09-11, per user direction): the
// trigger, the effect, the cap, the damage term, the grants — each read off the declarative
// fields the engine itself matches on, so the readout says what the passiveEngine will do and not
// what the author remembered to write. The authored `description` stays as fine print under it.

import type {
  PassiveAmount,
  PassiveDefinition,
  PassiveEffect,
  PassiveEffectTarget,
  PassiveHook,
  PassiveRelation,
  PassiveTriggerCondition,
  StatKey,
} from '../../engine/content';
import { fieldEffects } from '../../data/fieldEffects';
import { statuses } from '../../data/statuses';
import type { MoveKindGlyphKind } from './statIcons';
import { STAT_FULL_LABELS } from './relicStacks';
import { BURDEN_SURPLUS, HERO_STAT_TOTAL } from '../../run/statBudget';

/** The mark at the head of a row — resolved to a glyph by the view. */
export type PassiveFactGlyph =
  | { kind: 'status'; statusId: string }
  | { kind: 'stat'; stat: StatKey }
  | { kind: 'element'; type: string }
  | { kind: 'move'; move: MoveKindGlyphKind };

export interface PassiveFact {
  /** The row's register word: When / Then / Limit / Damage / While. */
  label: string;
  text: string;
  glyph: PassiveFactGlyph;
  /** The row's own colour — a status's, an element's. Absent rows take the passive's. */
  color?: 'status' | 'element';
}

function statusName(statusId: string | undefined): string {
  return statusId ? (statuses[statusId]?.name ?? statusId) : 'a status';
}

function subject(relativeTo: PassiveRelation): string {
  switch (relativeTo) {
    case 'self':
      return 'This hero';
    case 'ally':
      return 'Its partner';
    case 'enemy':
      return 'An enemy';
  }
}

function possessive(relativeTo: PassiveRelation): string {
  switch (relativeTo) {
    case 'self':
      return "This hero's";
    case 'ally':
      return "Its partner's";
    case 'enemy':
      return "An enemy's";
  }
}

function targetWord(target: PassiveEffectTarget, condition: PassiveTriggerCondition, hook: PassiveHook): string {
  switch (target) {
    case 'self':
      return 'this hero';
    case 'ally':
      return 'its partner';
    case 'triggerSubject':
      return condition.relativeTo === 'self' ? 'this hero' : condition.relativeTo === 'ally' ? 'that partner' : 'that enemy';
    case 'triggerTarget':
      return hook === 'Healed' ? 'the one healed' : 'the target';
    case 'activeEnemies':
      return 'both active enemies';
    case 'randomEnemy':
      return 'a random enemy';
  }
}

/** A flat amount with its unit, or a share of the triggering event's own figure. */
function amountWord(amount: PassiveAmount, unit: string): string {
  if (amount.kind === 'flat') return `${amount.value} ${unit}`.trim();
  if (amount.kind === 'percentMaxHp') return `${Math.round(amount.value * 100)}% of max ${unit || 'HP'}`.trim();
  const share = amount.multiplier ?? 1;
  if (share === 1) return 'the same amount';
  return share > 1 ? `${share}× that amount` : `${Math.round(share * 100)}% of it`;
}

function fmt(amount: number): string {
  return amount > 0 ? `+${amount}` : `${amount}`;
}

function ordinalWord(n: number): string {
  return n === 2 ? 'second' : n === 3 ? 'third' : n === 4 ? 'fourth' : n === 5 ? 'fifth' : `${n}th`;
}

/** "When" — the event the hook matches, in the subject's own terms. */
function triggerFact(def: NonNullable<PassiveDefinition['reactive']>): PassiveFact {
  const { hook, condition } = def;
  const who = subject(condition.relativeTo);
  const whose = possessive(condition.relativeTo);
  const source = condition.subjectRole === 'source';
  const fields = condition.eventFieldEquals ?? {};
  const statusId = fields.statusId;
  const moveType = fields.moveType;
  const category = fields.category;
  const stat = fields.stat as StatKey | undefined;

  const hitWord = moveType ? `a ${moveType} hit` : category ? `a ${category} hit` : 'a hit';
  const damageWord = moveType ? `${moveType} damage` : category ? `${category} damage` : 'damage';
  const elementGlyph: PassiveFactGlyph | null = moveType ? { kind: 'element', type: moveType } : null;

  switch (hook) {
    case 'DamageDealt':
      return {
        label: 'When',
        text: source ? `${who} lands ${hitWord}` : `${who} takes ${damageWord}`,
        glyph: elementGlyph ?? { kind: 'move', move: category === 'magical' ? 'magical' : 'physical' },
        color: elementGlyph ? 'element' : undefined,
      };
    case 'Healed':
      return { label: 'When', text: source ? `${who} heals someone` : `${who} is healed`, glyph: { kind: 'move', move: 'heal' } };
    case 'StatusApplied':
      return {
        label: 'When',
        text: source ? `${who} applies ${statusName(statusId)}` : `${who} gains ${statusName(statusId)}`,
        glyph: statusId ? { kind: 'status', statusId } : { kind: 'move', move: 'debuff' },
        color: statusId ? 'status' : undefined,
      };
    case 'StatusTicked':
      return {
        label: 'When',
        text: `${whose} ${statusName(statusId)} ${fields.kind === 'heal' ? 'heals' : fields.kind === 'damage' ? 'deals damage' : 'ticks'}`,
        glyph: statusId ? { kind: 'status', statusId } : { kind: 'move', move: 'debuff' },
        color: statusId ? 'status' : undefined,
      };
    case 'SwitchedIn':
      return { label: 'When', text: `${who} enters the battlefield`, glyph: { kind: 'move', move: 'buff' } };
    case 'RoundEnded':
      return {
        label: 'When',
        text: condition.everyNRounds ? `Every ${ordinalWord(condition.everyNRounds)} round ends` : 'A round ends',
        glyph: { kind: 'move', move: 'buff' },
      };
    case 'StatChanged': {
      const change = condition.eventFieldPositive ? 'rises' : condition.eventFieldNegative ? 'drops' : 'changes';
      return {
        label: 'When',
        text: `${whose} ${stat ? STAT_FULL_LABELS[stat] : 'stat'} ${change}`,
        glyph: stat ? { kind: 'stat', stat } : { kind: 'move', move: 'buff' },
      };
    }
    case 'StatusDetonated':
      return {
        label: 'When',
        text: source ? `${who} sets off ${statusName(statusId)}` : `${whose} ${statusName(statusId)} is set off`,
        glyph: statusId ? { kind: 'status', statusId } : { kind: 'move', move: 'debuff' },
        color: statusId ? 'status' : undefined,
      };
    case 'Rested':
      return { label: 'When', text: `${who} Rests`, glyph: { kind: 'stat', stat: 'manaPool' } };
  }
}

/** "Then" — the payload, on whom, for how much. */
function effectFact(effect: PassiveEffect, condition: PassiveTriggerCondition, hook: PassiveHook): PassiveFact {
  switch (effect.kind) {
    case 'heal':
      return {
        label: 'Then',
        text: `Heals ${targetWord(effect.target, condition, hook)} ${amountWord(effect.amount, 'HP')}`,
        glyph: { kind: 'stat', stat: 'hp' },
      };
    case 'applyStatus': {
      const magnitude =
        effect.magnitude === undefined
          ? ''
          : typeof effect.magnitude === 'number'
            ? ` ${effect.magnitude}`
            : ` at ${amountWord(effect.magnitude, '').replace('the same amount', hook === 'Rested' ? 'the Mana restored' : 'the same magnitude')}`;
      const duration = effect.duration ? `, ${effect.duration} ${effect.duration === 1 ? 'round' : 'rounds'}` : '';
      const scaled = effect.scaledBy ? `, scaled by ${STAT_FULL_LABELS[effect.scaledBy]}` : '';
      return {
        label: 'Then',
        text: `${statusName(effect.statusId)}${magnitude} on ${targetWord(effect.target, condition, hook)}${duration}${scaled}`,
        glyph: { kind: 'status', statusId: effect.statusId },
        color: 'status',
      };
    }
    case 'statDelta': {
      const stats: readonly StatKey[] = Array.isArray(effect.stat) ? (effect.stat as readonly StatKey[]) : [effect.stat as StatKey];
      const amount = typeof effect.amount === 'number' ? fmt(effect.amount) : `${amountWord(effect.amount, '').replace('the same amount', 'as much')}`;
      return {
        label: 'Then',
        text: `${amount} ${stats.map((s) => STAT_FULL_LABELS[s]).join(' & ')} to ${targetWord(effect.target, condition, hook)}${effect.permanent ? ', kept for the whole run' : ''}`,
        glyph: { kind: 'stat', stat: stats[0] },
      };
    }
    case 'cleanse':
      return {
        label: 'Then',
        text: `Cleanses ${targetWord(effect.target, condition, hook)}${effect.count ? ` — ${effect.count} at random` : ''}`,
        glyph: { kind: 'move', move: 'buff' },
      };
    case 'manaGrant':
      return {
        label: 'Then',
        text:
          effect.amount.kind === 'flat'
            ? `+${effect.amount.value} Mana to ${targetWord(effect.target, condition, hook)}, past the pool`
            : `Mana equal to ${amountWord(effect.amount, '')} to ${targetWord(effect.target, condition, hook)}, past the pool`,
        glyph: { kind: 'stat', stat: 'manaPool' },
      };
    case 'damage':
      return {
        label: 'Then',
        text: `${Math.round(effect.percentMaxHp * 100)}% of max HP off ${targetWord(effect.target, condition, hook)}${effect.onlyWithStatus ? ` that are ${statusName(effect.onlyWithStatus)}` : ''} — direct, past any Shield`,
        glyph: effect.onlyWithStatus ? { kind: 'status', statusId: effect.onlyWithStatus } : { kind: 'stat', stat: 'hp' },
        color: effect.onlyWithStatus ? 'status' : undefined,
      };
    case 'setFieldEffect': {
      const field = fieldEffects[effect.fieldEffectId];
      return {
        label: 'Then',
        text: `Sets ${field?.name ?? effect.fieldEffectId} on the field`,
        glyph: field?.flavorType ? { kind: 'element', type: field.flavorType } : { kind: 'move', move: 'buff' },
        color: field?.flavorType ? 'element' : undefined,
      };
    }

  }
}

/** Every rule row a passive carries, in reading order. Flat grants are numbers, not rows — see `passiveStatGrants`. */
export function passiveFacts(def: PassiveDefinition): PassiveFact[] {
  const rows: PassiveFact[] = [];
  if (def.reactive) {
    rows.push(triggerFact(def.reactive));
    if (def.reactive.chance !== undefined) rows.push({ label: 'Odds', text: `${Math.round(def.reactive.chance * 100)}% of the time`, glyph: { kind: 'move', move: 'debuff' } });
    rows.push(effectFact(def.reactive.effect, def.reactive.condition, def.reactive.hook));
    if (def.reactive.condition.finishingBlow) rows.push({ label: 'Only', text: 'A hit that knocks its target out', glyph: { kind: 'stat', stat: 'attack' } });
    if (def.reactive.condition.eventTargetHasStatus) rows.push({ label: 'While', text: `The one struck is ${statusName(def.reactive.condition.eventTargetHasStatus)}`, glyph: { kind: 'status', statusId: def.reactive.condition.eventTargetHasStatus }, color: 'status' });
    if (def.reactive.oncePerFight) rows.push({ label: 'Limit', text: 'Once per fight', glyph: { kind: 'move', move: 'debuff' } });
  }
  if (def.damageModifier) {
    const type = def.damageModifier.eventFieldEquals?.moveType;
    rows.push({
      label: 'Damage',
      text: `${fmt(Math.round(def.damageModifier.amount * 100))}% on ${type ? `${type}-type hits` : 'every hit'}`,
      glyph: type ? { kind: 'element', type } : { kind: 'move', move: 'physical' },
      color: type ? 'element' : undefined,
    });
    const needs = def.damageModifier.requiresTargetStatuses;
    if (needs && needs.length > 0) {
      rows.push({ label: 'While', text: `The target has ${needs.map(statusName).join(' and ')}`, glyph: { kind: 'status', statusId: needs[0] }, color: 'status' });
    }
  }
  if (def.conditionalStatGrants) {
    const statusId = def.conditionalStatGrants.requiresEnemyStatus;
    rows.push({
      label: 'While',
      text: `An active enemy has ${statusName(statusId)} — a benched carrier does nothing`,
      glyph: { kind: 'status', statusId },
      color: 'status',
    });
  }
  if (def.wardedWhileCompanyStands) {
    rows.push({ label: 'While', text: 'Any ally of its company still stands, on the field or behind it', glyph: { kind: 'move', move: 'buff' } });
    rows.push({ label: 'Then', text: 'Every move the far side aims at it turns away, and no affliction touches it', glyph: { kind: 'move', move: 'debuff' } });
  }
  if (def.enduresOnce) {
    rows.push({ label: 'When', text: 'It would be knocked out — by anything, the Pact Clock included', glyph: { kind: 'stat', stat: 'hp' } });
    rows.push({ label: 'Then', text: 'It stands at 1 HP instead', glyph: { kind: 'move', move: 'heal' } });
    rows.push({ label: 'Limit', text: 'Once per fight', glyph: { kind: 'move', move: 'debuff' } });
  }
  if (def.cannotSwitchOut) {
    rows.push({ label: 'Rule', text: 'It never switches out on its own; a pivot move keeps its buff and stays', glyph: { kind: 'move', move: 'debuff' } });
    rows.push({ label: 'KO', text: 'When it falls, another takes its place as usual', glyph: { kind: 'move', move: 'buff' } });
  }
  if (def.burden) {
    rows.push({ label: 'Price', text: `A Burden — its stat line is ${BURDEN_SURPLUS} over the roster's ${HERO_STAT_TOTAL} for carrying it`, glyph: { kind: 'stat', stat: 'attack' } });
  }
  return rows;
}
