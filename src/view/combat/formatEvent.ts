// Renders the engine's event stream as Battle Log lines. This is the one
// place the full damage-formula math is spelled out; everywhere else stays terse.

import type { CombatEvent } from '../../engine/events';
import type { HeroDefinition, MoveDefinition } from '../../engine/content';
import type { CombatState } from '../../engine/state';
import { passives } from '../../data/passives';
import { fieldEffects } from '../../data/fieldEffects';

export interface LogLine {
  key: string;
  text: string;
  className: string;
}

// 4dp, not 2: the printed line must multiply out to the shown amount by hand.
function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(4);
}

/** Per-status log color for DoT/HoT ticks — mirrors STATUS_COLOR in statusIcons.tsx. */
const STATUS_TICK_LOG_CLASS: Record<string, string> = {
  Burn: 'log-burn',
  Bleed: 'log-bleed',
  Poison: 'log-poison',
  Renew: 'log-renew',
};

const OFF_ABBR: Record<string, string> = { attack: 'Atk', defense: 'Def', intelligence: 'Int', wisdom: 'Wis' };

export function formatEvents(
  events: readonly CombatEvent[],
  heroes: Record<string, HeroDefinition>,
  combatants: CombatState['combatants'],
  moves: Record<string, MoveDefinition>
): LogLine[] {
  const name = (id: string) => heroes[combatants[id]?.heroId]?.name ?? id;
  const lines: LogLine[] = [];

  events.forEach((e, i) => {
    const key = `${e.round}-${i}-${e.type}`;
    switch (e.type) {
      case 'RoundStarted':
        lines.push({ key, text: `Round ${e.round}`, className: 'log-round' });
        break;
      case 'MoveUsed': {
        const move = moves[e.moveId];
        const discount = e.manaDiscount ? `, -${e.manaDiscount} discount` : '';
        lines.push({
          key,
          text: `${name(e.combatantId)} uses ${move?.name ?? e.moveId} (-${e.manaSpent} MP${discount})`,
          className: 'log-mana',
        });
        break;
      }
      case 'DamageDealt': {
        const move = moves[e.moveId];
        // Recoil and self-cost are the caster billing itself: own line, no math line.
        if (e.recoil) {
          const pct = Math.round(e.recoil.percent * 100);
          lines.push({
            key,
            text: `${name(e.targetCombatantId)} takes ${e.amount} recoil from ${move?.name ?? e.moveId} (${pct}% of ${e.recoil.damageDealt} dealt)`,
            className: 'log-damage',
          });
          break;
        }
        if (e.selfCost) {
          const bill =
            e.selfCost.mode === 'percentMaxHp'
              ? `${Math.round(e.selfCost.amount * 100)}% of max HP`
              : `down to ${e.selfCost.amount} HP`;
          lines.push({
            key,
            text: `${name(e.targetCombatantId)} pays ${e.amount} HP for ${move?.name ?? e.moveId} (${bill})`,
            className: 'log-damage',
          });
          break;
        }
        const tag = e.isCrit ? ' CRIT!' : '';
        const eff = e.typeMult >= 2 ? ' Super effective!' : e.typeMult <= 0.5 ? ' Not very effective...' : '';
        const via = e.viaStatusId ? ` (via ${e.viaStatusId})` : '';
        lines.push({
          key,
          text: `${move?.name ?? e.moveId} -> ${e.amount} dmg to ${name(e.targetCombatantId)}${via}${tag}${eff}`,
          className: e.viaStatusId ? 'log-haunt' : e.isCrit ? 'log-crit' : 'log-damage',
        });

        // Retribution never ran the formula; print the derivation it did use.
        if (e.retribution) {
          lines.push({
            key: `${key}-math`,
            text:
              `${e.retribution.damageTaken} damage taken since last turn × ${fmt(e.retribution.percent)} = ${e.amount} dmg ` +
              `(fixed — no ratio, STAB, type, variance or crit)`,
            className: 'log-math',
          });
          break;
        }

        const [offLabel, defLabel] = e.category === 'physical' ? ['Atk', 'Def'] : ['Int', 'Wis'];
        // offStatOverride swaps the numerator's stat; name the stat actually read.
        const offStatLabel = move?.offStatOverride ? (OFF_ABBR[move.offStatOverride] ?? offLabel) : offLabel;
        const modsText =
          e.modifiers.length > 0
            ? `, Mods ${fmt(e.multiplierTerm)}× (${e.modifiers.map((m) => `${m.source} ${m.amount >= 0 ? '+' : ''}${Math.round(m.amount * 100)}%`).join(', ')})`
            : '';
        // Stage-1 terms in pipeline order: authored BP × conditional multiplier, then + Elemental Force.
        const conditionalMult = e.basePowerMultiplier ?? 1;
        const scaledBp = e.basePower * conditionalMult;
        const bpParts: string[] = [];
        if (conditionalMult !== 1) bpParts.push(`${e.basePower} × ${fmt(conditionalMult)}`);
        if (e.elementalForceBonus > 0) bpParts.push(`${bpParts.length ? '' : `${e.basePower} `}+ ${e.elementalForceBonus} Force`);
        const bpText = bpParts.length
          ? `${scaledBp + e.elementalForceBonus} BP (${bpParts.join(' ')})`
          : `${e.basePower} BP`;
        lines.push({
          key: `${key}-math`,
          text:
            `${bpText} × (${e.offStat} ${offStatLabel} ÷ ${e.defStat} ${defLabel} = ${fmt(e.ratio)}) ` +
            `× STAB ${fmt(e.stab)}× × Type ${fmt(e.typeMult)}× × Var ${fmt(e.variance)}× × Crit ${fmt(e.critMultiplier)}×${modsText} = ${e.amount} dmg`,
          className: 'log-math',
        });
        break;
      }
      case 'Fainted':
        lines.push({ key, text: `${name(e.combatantId)} fainted!`, className: 'log-faint' });
        break;
      case 'BenchRegenTicked':
        lines.push({ key, text: `${name(e.combatantId)} regens ${e.hpRegen} HP on the bench`, className: 'log-mana' });
        break;
      case 'ManaRegenTicked':
        lines.push({ key, text: `${name(e.combatantId)} regens ${e.manaRegen} MP`, className: 'log-mana' });
        break;
      // ManaChanged is omitted as bookkeeping, so the grant needs its own line, overflow included.
      case 'ManaGranted':
        lines.push({
          key,
          text:
            `${name(e.sourceCombatantId)} gives ${name(e.targetCombatantId)} ${e.amount} MP` +
            (e.overflow > 0 ? ` (${e.newMana}/${e.maxMana} — ${e.overflow} over)` : ''),
          className: 'log-mana',
        });
        break;
      case 'SwitchedIn': {
        const outText = e.outCombatantId ? ` for ${name(e.outCombatantId)}` : '';
        lines.push({ key, text: `${name(e.inCombatantId)} switches in${outText}`, className: 'log-mana' });
        break;
      }
      case 'Healed':
        lines.push({
          key,
          text: e.drain
            ? `${name(e.targetCombatantId)} drains ${e.amount} HP from ${name(e.drain.fromCombatantId)}`
            : `${name(e.targetCombatantId)} heals ${e.amount} HP`,
          className: 'log-heal',
        });
        break;
      case 'StatChanged': {
        const sign = e.delta > 0 ? '+' : '';
        lines.push({ key, text: `${name(e.combatantId)}'s ${e.stat} ${sign}${e.delta}`, className: e.delta > 0 ? 'log-buff' : 'log-debuff' });
        break;
      }
      case 'StatusApplied': {
        const detail = e.magnitude !== undefined ? ` (${e.magnitude})` : e.duration !== undefined ? ` (${e.duration})` : '';
        lines.push({ key, text: `${name(e.combatantId)} afflicted with ${e.statusId}${detail}`, className: 'log-status' });
        break;
      }
      case 'StatusTicked': {
        if (e.kind === 'duration') break; // the eventual StatusRemoved covers expiry
        const verb = e.kind === 'damage' ? 'takes' : 'heals';
        const className = STATUS_TICK_LOG_CLASS[e.statusId] ?? (e.kind === 'damage' ? 'log-damage' : 'log-heal');
        lines.push({ key, text: `${name(e.combatantId)} ${verb} ${e.amount} from ${e.statusId}`, className });
        break;
      }
      case 'StatusRemoved':
        lines.push({ key, text: `${name(e.combatantId)}'s ${e.statusId} clears (${e.reason})`, className: 'log-status' });
        break;
      case 'StatusDetonated':
        lines.push({ key, text: `${name(e.combatantId)}'s ${e.statusId} detonates for ${e.amount} dmg!`, className: 'log-conduct' });
        break;
      case 'PassiveTriggered':
        lines.push({ key, text: `${name(e.combatantId)}'s ${passives[e.passiveId]?.name ?? e.passiveId} triggers`, className: 'log-heal' });
        break;
      case 'Rested':
        lines.push({ key, text: `${name(e.combatantId)} rests, restoring Mana to full`, className: 'log-mana' });
        break;
      case 'ActionBlocked': {
        const reasonText =
          e.reason === 'dazed'
            ? 'dazed'
            : e.reason === 'targetStatusMissing'
              ? 'left without a marked target'
              : 'out of valid targets';
        lines.push({ key, text: `${name(e.combatantId)} is ${reasonText} and can't act`, className: 'log-faint' });
        break;
      }
      case 'FieldEffectSet': {
        const fx = fieldEffects[e.fieldEffectId];
        const verb = e.previousFieldEffectId ? 'overrides the field with' : 'sets the field to';
        lines.push({ key, text: `The battlefield ${verb} ${fx?.name ?? e.fieldEffectId}`, className: 'log-field-effect' });
        break;
      }
      case 'FieldEffectTicked': {
        const fx = fieldEffects[e.fieldEffectId];
        lines.push({ key, text: `${fx?.name ?? e.fieldEffectId} continues (${e.roundsRemaining} rounds left)`, className: 'log-field-effect' });
        break;
      }
      case 'PactTicked': {
        lines.push({
          key,
          text: `The pact comes due — every combatant loses ${Math.round(e.fraction * 100)}% of their max HP`,
          className: 'log-field-effect',
        });
        break;
      }
      case 'FieldEffectExpired': {
        const fx = fieldEffects[e.fieldEffectId];
        lines.push({ key, text: `${fx?.name ?? e.fieldEffectId} fades from the battlefield`, className: 'log-field-effect' });
        break;
      }
      default:
        break; // TurnStarted / MoveDeclared / HpChanged / ManaChanged / RoundEnded: omitted for readability
    }
  });

  return lines;
}
