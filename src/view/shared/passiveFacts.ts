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
import { statusAmountText } from './statusFacts';
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
  if (amount.kind === 'targetStat') return `${amount.multiplier && amount.multiplier !== 1 ? `${amount.multiplier}× ` : ''}its current ${STAT_FULL_LABELS[amount.stat]}`;
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
    case 'SwitchedOut':
      return { label: 'When', text: `${who} switches out`, glyph: { kind: 'move', move: 'debuff' } };
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
    case 'RoundStarted':
      return { label: 'When', text: 'A round begins', glyph: { kind: 'move', move: 'buff' } };
    case 'FieldEffectSet': {
      const field = fields.fieldEffectId ? fieldEffects[fields.fieldEffectId] : undefined;
      return {
        label: 'When',
        text: `${field?.name ?? 'A field'} is set`,
        glyph: field?.flavorType ? { kind: 'element', type: field.flavorType } : { kind: 'move', move: 'buff' },
        color: field?.flavorType ? 'element' : undefined,
      };
    }
    case 'Rested':
      return { label: 'When', text: `${who} Rests`, glyph: { kind: 'stat', stat: 'manaPool' } };
    case 'Endured':
      return { label: 'When', text: `${who} refuses a knockout`, glyph: { kind: 'stat', stat: 'hp' } };
    case 'ManaGained':
      return { label: 'When', text: `${who} gains Mana — regen, a grant or a Rest`, glyph: { kind: 'stat', stat: 'manaPool' } };
    case 'MoveUsed':
      return {
        label: 'When',
        text: fields.damaging === 'false' ? `${who} uses a move that deals no damage` : fields.damaging === 'true' ? `${who} attacks` : `${who} uses a move`,
        glyph: { kind: 'move', move: fields.damaging === 'true' ? 'physical' : 'buff' },
      };
  }
}

/** "Then" — the payload, on whom, for how much. */
function effectFact(effect: PassiveEffect, condition: PassiveTriggerCondition, hook: PassiveHook): PassiveFact {
  switch (effect.kind) {
    case 'heal':
      return {
        label: 'Then',
        text: `Heals ${targetWord(effect.target, condition, hook)} ${amountWord(effect.amount, 'HP')}${effect.scaledBy ? `, scaled by ${STAT_FULL_LABELS[effect.scaledBy]}` : ''}`,
        glyph: { kind: 'stat', stat: 'hp' },
      };
    case 'applyStatus': {
      const magnitude =
        effect.magnitude === undefined
          ? ''
          : typeof effect.magnitude === 'number'
            ? ` ${statusAmountText(effect.statusId, effect.magnitude)}`
            : ` at ${amountWord(effect.magnitude, '').replace('the same amount', hook === 'Rested' ? 'the Mana restored' : 'the same magnitude')}`;
      const duration = effect.duration ? `, ${effect.duration} ${effect.duration === 1 ? 'round' : 'rounds'}` : '';
      const scaled = (effect.scaledBy ? `, scaled by ${STAT_FULL_LABELS[effect.scaledBy]}` : '') + (effect.maxMagnitude !== undefined ? `, up to ${effect.maxMagnitude}` : '');
      return {
        label: 'Then',
        text: `${statusName(effect.statusId)}${magnitude} on ${targetWord(effect.target, condition, hook)}${duration}${scaled}`,
        glyph: { kind: 'status', statusId: effect.statusId },
        color: 'status',
      };
    }
    case 'statDelta': {
      const stats: readonly StatKey[] = Array.isArray(effect.stat) ? (effect.stat as readonly StatKey[]) : [effect.stat as StatKey];
      if (typeof effect.amount !== 'number' && effect.amount.kind === 'targetStat') {
        const times = 1 + (effect.amount.multiplier ?? 1);
        return {
          label: 'Then',
          text: `${times === 2 ? 'Doubles' : times === 3 ? 'Triples' : `×${times}`} the ${STAT_FULL_LABELS[effect.amount.stat]} of ${targetWord(effect.target, condition, hook)}${effect.uncapped ? ', with no limit' : ''}`,
          glyph: { kind: 'stat', stat: effect.amount.stat },
        };
      }
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
    case 'loseMana':
      return { label: 'Then', text: `${targetWord(effect.target, condition, hook)} loses ${effect.amount} Mana`, glyph: { kind: 'stat', stat: 'manaPool' } };
    case 'restoreMana':
      return { label: 'Then', text: `Refills ${targetWord(effect.target, condition, hook)}'s Mana to its pool`, glyph: { kind: 'stat', stat: 'manaPool' } };
    case 'restoreCharge': {
      const which = effect.triggeringMove ? 'that move' : effect.moveTag === 'arrow' ? 'every Arrow' : 'every move with Charges';
      const amount = effect.amount === 'all' ? 'refills' : `gets ${effect.amount === 1 ? 'a Charge' : `${effect.amount} Charges`} back`;
      return { label: 'Then', text: `${which[0].toUpperCase()}${which.slice(1)} ${amount}`, glyph: { kind: 'move', move: 'buff' } };
    }
    case 'manaGrant':
      return {
        label: 'Then',
        text:
          effect.amount.kind === 'flat'
            ? `+${effect.amount.value} Mana to ${targetWord(effect.target, condition, hook)}, past the pool`
            : `Mana equal to ${amountWord(effect.amount, '')} to ${targetWord(effect.target, condition, hook)}, past the pool`,
        glyph: { kind: 'stat', stat: 'manaPool' },
      };
    case 'manaSurcharge':
      return {
        label: 'Then',
        text: `Every move costs ${targetWord(effect.target, condition, hook)} ${effect.amount} more Mana for the fight, up to ${effect.max}`,
        glyph: { kind: 'stat', stat: 'manaPool' },
      };
    case 'damage':
      return {
        label: 'Then',
        text: effect.perHeldStatus
          ? `${Math.round(effect.percentMaxHp * 100)}% of max HP off ${targetWord(effect.target, condition, hook)} per ${statusName(effect.perHeldStatus)} held, all of them spent — direct, past any Shield`
          : `${Math.round(effect.percentMaxHp * 100)}% of max HP off ${targetWord(effect.target, condition, hook)}${effect.onlyWithStatus ? ` that are ${statusName(effect.onlyWithStatus)}` : ''} — direct, past any Shield`,
        glyph: effect.onlyWithStatus ? { kind: 'status', statusId: effect.onlyWithStatus } : effect.perHeldStatus ? { kind: 'status', statusId: effect.perHeldStatus } : { kind: 'stat', stat: 'hp' },
        color: effect.onlyWithStatus || effect.perHeldStatus ? 'status' : undefined,
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

/** The rows one reaction carries: its trigger, its effect(s), and every qualifier on either. */
function reactiveFacts(reactive: NonNullable<PassiveDefinition['reactive']>): PassiveFact[] {
  const rows: PassiveFact[] = [triggerFact(reactive)];
  if (reactive.whileBenched) rows.push({ label: 'Only', text: 'While this hero is on the bench', glyph: { kind: 'move', move: 'buff' } });
  if (reactive.chance !== undefined) rows.push({ label: 'Odds', text: `${Math.round(reactive.chance * 100)}% of the time`, glyph: { kind: 'move', move: 'debuff' } });
  rows.push(effectFact(reactive.effect, reactive.condition, reactive.hook));
  if (reactive.alsoEffect) rows.push({ ...effectFact(reactive.alsoEffect, reactive.condition, reactive.hook), label: 'And' });
  if (reactive.condition.moveTag === 'arrow') rows.push({ label: 'Only', text: 'An Arrow', glyph: { kind: 'move', move: 'physical' } });
  if (reactive.condition.finishingBlow) rows.push({ label: 'Only', text: 'A hit that knocks its target out', glyph: { kind: 'stat', stat: 'attack' } });
  if (reactive.condition.eventTargetHasStatus) rows.push({ label: 'While', text: `The one struck is ${statusName(reactive.condition.eventTargetHasStatus)}`, glyph: { kind: 'status', statusId: reactive.condition.eventTargetHasStatus }, color: 'status' });
  if (reactive.condition.sideOutspeeds) rows.push({ label: 'While', text: 'Both active allies move before both active enemies', glyph: { kind: 'stat', stat: 'speed' } });
  if (reactive.oncePerFight) rows.push({ label: 'Limit', text: 'Once per fight', glyph: { kind: 'move', move: 'debuff' } });
  if (reactive.maxFiresPerFight !== undefined) rows.push({ label: 'Limit', text: `${reactive.maxFiresPerFight} times per fight`, glyph: { kind: 'move', move: 'debuff' } });
  return rows;
}

/** Every rule row a passive carries, in reading order. Flat grants are numbers, not rows — see `passiveStatGrants`. */
export function passiveFacts(def: PassiveDefinition): PassiveFact[] {
  const rows: PassiveFact[] = [];
  for (const reactive of [def.reactive, def.alsoReactive]) if (reactive) rows.push(...reactiveFacts(reactive));
  if (def.damageModifier) {
    const type = def.damageModifier.eventFieldEquals?.moveType;
    rows.push({
      label: 'Damage',
      text: `${fmt(Math.round(def.damageModifier.amount * 100))}% on ${type ? `${type}-type hits` : 'every hit'}`,
      glyph: type ? { kind: 'element', type } : { kind: 'move', move: 'physical' },
      color: type ? 'element' : undefined,
    });
    if (def.damageModifier.perTargetStatusLevel) {
      rows[rows.length - 1].text = `${fmt(Math.round(def.damageModifier.amount * 100))}% on every hit, per level of ${statusName(def.damageModifier.perTargetStatusLevel)} on the target`;
    }
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
  if (def.partnerStatGrants) {
    const grants = Object.entries(def.partnerStatGrants).map(([stat, amount]) => `${fmt(amount as number)} ${STAT_FULL_LABELS[stat as StatKey]}`).join(', ');
    rows.push({ label: 'Aura', text: `Its active partner has ${grants} while this hero stands beside it`, glyph: { kind: 'move', move: 'buff' } });
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
  if (def.sideRefusesStatuses?.length) {
    const names = def.sideRefusesStatuses.map(statusName).join(' and ');
    rows.push({ label: 'While', text: 'This hero is on the field', glyph: { kind: 'move', move: 'buff' } });
    rows.push({ label: 'Then', text: `Its side's active heroes can't gain ${names}, and any already held does no harm`, glyph: { kind: 'status', statusId: def.sideRefusesStatuses[0] }, color: 'status' });
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
