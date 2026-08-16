// Renders the engine's event stream as human-readable log lines. This is
// presentation-layer code: the engine only knows it emitted a DamageDealt
// event, not that it should read as "super effective!" in prose.

import type { CombatEvent } from '../../engine/events';
import type { HeroDefinition } from '../../engine/content';
import type { CombatState } from '../../engine/state';

export interface LogLine {
  key: string;
  text: string;
  className: string;
}

export function formatEvents(
  events: readonly CombatEvent[],
  heroes: Record<string, HeroDefinition>,
  combatants: CombatState['combatants']
): LogLine[] {
  const name = (id: string) => heroes[combatants[id]?.heroId]?.name ?? id;
  const lines: LogLine[] = [];

  events.forEach((e, i) => {
    const key = `${e.round}-${i}-${e.type}`;
    switch (e.type) {
      case 'RoundStarted':
        lines.push({ key, text: `Round ${e.round}`, className: 'log-round' });
        break;
      case 'MoveUsed':
        lines.push({ key, text: `${name(e.combatantId)} uses a move (-${e.manaSpent} MP)`, className: 'log-mana' });
        break;
      case 'DamageDealt': {
        const tag = e.isCrit ? ' CRIT!' : '';
        const eff = e.typeMult >= 2 ? ' Super effective!' : e.typeMult <= 0.5 ? ' Not very effective...' : '';
        lines.push({
          key,
          text: `  -> ${e.amount} dmg to ${name(e.targetCombatantId)}${tag}${eff}`,
          className: e.isCrit ? 'log-crit' : 'log-damage',
        });
        break;
      }
      case 'Fainted':
        lines.push({ key, text: `${name(e.combatantId)} fainted!`, className: 'log-faint' });
        break;
      case 'BenchRegenTicked':
        lines.push({ key, text: `${name(e.combatantId)} regens ${e.hpRegen} HP on the bench`, className: 'log-mana' });
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
