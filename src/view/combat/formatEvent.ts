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
        lines.push({ key, text: `${name(e.combatantId)} uses ${move?.name ?? e.moveId} (-${e.manaSpent} MP)`, className: 'log-mana' });
        break;
      }
      case 'DamageDealt': {
        const move = moves[e.moveId];
        const tag = e.isCrit ? ' CRIT!' : '';
        const eff = e.typeMult >= 2 ? ' Super effective!' : e.typeMult <= 0.5 ? ' Not very effective...' : '';
        lines.push({
          key,
          text: `${move?.name ?? e.moveId} -> ${e.amount} dmg to ${name(e.targetCombatantId)}${tag}${eff}`,
          className: e.isCrit ? 'log-crit' : 'log-damage',
        });

        const [offLabel, defLabel] = e.category === 'physical' ? ['Atk', 'Def'] : ['Int', 'Wis'];
        const modsText =
          e.modifiers.length > 0
            ? `, Mods ${fmt(e.multiplierTerm)}× (${e.modifiers.map((m) => `${m.source} ${m.amount >= 0 ? '+' : ''}${Math.round(m.amount * 100)}%`).join(', ')})`
            : '';
        lines.push({
          key: `${key}-math`,
          text:
            `${e.basePower} BP × (${e.offStat} ${offLabel} ÷ ${e.defStat} ${defLabel} = ${fmt(e.ratio)}) ` +
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
      case 'SwitchedIn': {
        const outText = e.outCombatantId ? ` for ${name(e.outCombatantId)}` : '';
        lines.push({ key, text: `${name(e.inCombatantId)} switches in${outText}`, className: 'log-mana' });
        break;
      }
      case 'Healed':
        lines.push({ key, text: `${name(e.targetCombatantId)} heals ${e.amount} HP`, className: 'log-heal' });
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
        lines.push({ key, text: `${name(e.combatantId)} ${verb} ${e.amount} from ${e.statusId}`, className: e.kind === 'damage' ? 'log-damage' : 'log-heal' });
        break;
      }
      case 'StatusRemoved':
        lines.push({ key, text: `${name(e.combatantId)}'s ${e.statusId} clears (${e.reason})`, className: 'log-status' });
        break;
      case 'Rested':
        lines.push({ key, text: `${name(e.combatantId)} rests, restoring Mana to full`, className: 'log-mana' });
        break;
      case 'ActionBlocked': {
        const reasonText = e.reason === 'dazed' ? 'dazed' : e.reason === 'bound' ? 'bound' : "out of valid targets";
        lines.push({ key, text: `${name(e.combatantId)} is ${reasonText} and can't act`, className: 'log-faint' });
        break;
      }
      default:
        break; // TurnStarted / MoveDeclared / HpChanged / ManaChanged / RoundEnded: omitted for readability
    }
  });

  return lines;
}
