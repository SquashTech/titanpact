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
      default:
        break; // TurnStarted / MoveDeclared / HpChanged / ManaChanged / RoundEnded: omitted for readability
    }
  });

  return lines;
}
