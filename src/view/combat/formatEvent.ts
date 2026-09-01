// Renders the engine's event stream as human-readable log lines. This is
// presentation-layer code: the engine only knows it emitted a DamageDealt
// event, not that it should read as "super effective!" in prose.
//
// The Battle Log is the one place the full damage-formula math is spelled
// out (docs/combat.md "The damage formula") — everywhere else in the view
// (banners, popups) stays terse. formatEvents is only ever fed into that
// optional log panel, so the verbosity here is deliberate.

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

/**
 * Trims to 4dp for non-integer terms (variance, ratios) without cluttering
 * whole numbers like BasePower or a 2x type multiplier. 4dp rather than 2dp
 * so the printed line actually multiplies out to the shown `amount` before
 * rounding — this log exists for players to verify the math by hand,
 * and 0.85-1.0 variance rolls lose enough precision at 2dp to visibly
 * disagree with the final rounded damage.
 */
function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(4);
}

/** Per-status log color (styles.css) for the DoT/HoT statuses' end-of-round tick — mirrors STATUS_COLOR in statusIcons.tsx so the log reads consistently with the badge. */
const STATUS_TICK_LOG_CLASS: Record<string, string> = {
  Burn: 'log-burn',
  Bleed: 'log-bleed',
  Poison: 'log-poison',
  Renew: 'log-renew',
};

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
        // The discount is stated, not just absorbed into a smaller number:
        // a cost that silently drops between rounds looks like a bug in the
        // log, which is the one place claiming to show the whole accounting.
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
        // Recoil is the caster hitting itself, and reads as nonsense in the
        // attack phrasing below ("Rubble Rush -> 18 dmg to Crag"). Its own
        // line, and no math line at all, because no formula was evaluated
        // (events.ts DamageDealtEvent.recoil).
        if (e.recoil) {
          const pct = Math.round(e.recoil.percent * 100);
          lines.push({
            key,
            text: `${name(e.targetCombatantId)} takes ${e.amount} recoil from ${move?.name ?? e.moveId} (${pct}% of ${e.recoil.damageDealt} dealt)`,
            className: 'log-damage',
          });
          break;
        }
        // The self-cost is the caster paying its own bill, and it reads as
        // nonsense in the attack phrasing below for the same reason recoil
        // does. Its own line, no math line, and the parenthetical names the
        // BILL rather than a hit: unlike recoil, what this cost was is
        // something the player could read off their own bar before pressing
        // it (events.ts DamageDealtEvent.selfCost).
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

        // Retribution never ran the formula, so printing the locked chain with
        // every term at 1 would be a readout of a calculation that did not
        // happen. The derivation it DID use goes out instead
        // (events.ts DamageDealtEvent.retribution).
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
        // offStatOverride (content.ts) swaps the numerator's stat, so the log
        // has to name the stat actually read — "90 Atk" on a Body Blow that
        // read 100 Defense would make the printed math fail to multiply out.
        const OFF_ABBR: Record<string, string> = { attack: 'Atk', defense: 'Def', intelligence: 'Int', wisdom: 'Wis' };
        const offStatLabel = move?.offStatOverride ? (OFF_ABBR[move.offStatOverride] ?? offLabel) : offLabel;
        const modsText =
          e.modifiers.length > 0
            ? `, Mods ${fmt(e.multiplierTerm)}× (${e.modifiers.map((m) => `${m.source} ${m.amount >= 0 ? '+' : ''}${Math.round(m.amount * 100)}%`).join(', ')})`
            : '';
        // BasePower's own two stage-1 terms, spelled out in the order the
        // pipeline applies them: authored BP x conditional multiplier, then
        // + Elemental Force (damagePipeline.ts calcDamage).
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
      // Named source AND named overflow. ManaChanged is deliberately omitted
      // from this log as bookkeeping, so a grant with no line of its own would
      // simply not appear — and the overflow half is the part a player cannot
      // work out from the bar, which clamps its fill (events.ts
      // ManaGrantedEvent).
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
        // A drain says whose HP it was: the log's job is the whole causal
        // chain, and "Riptide heals 12 HP" on a turn Riptide attacked reads as
        // a second, unexplained action (events.ts HealedEvent.drain).
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
        if (e.kind === 'duration') break; // no HP/log-worthy change; the eventual StatusRemoved covers expiry
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
              ? // The gate, named as the reason it failed — "out of valid targets"
                // would be true but would read as "everything died" rather than
                // "nothing out there is Frozen" (content.ts requiresTargetStatus).
                'left without a marked target'
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
