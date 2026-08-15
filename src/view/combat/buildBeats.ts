// Groups the engine's flat event stream into player-legible "beats" for
// sequenced playback. A beat is the unit FightScreen reveals per tap: e.g.
// MoveDeclared + MoveUsed + ManaChanged land together so the mana bar drains
// at the exact moment the "uses Move!" banner appears, rather than a step
// later. This is presentation-only grouping — it doesn't change what
// happened, just how many taps it takes to read it.

import type {
  BenchRegenTickedEvent,
  CombatEvent,
} from '../../engine/events';
import type { CombatState } from '../../engine/state';
import type { HeroDefinition, MoveDefinition } from '../../engine/content';

export interface BeatPopup {
  combatantId: string;
  text: string;
  className: string;
}

export interface Beat {
  /** Events to apply, in order, when this beat is revealed. */
  events: CombatEvent[];
  banner: string;
  popups: BeatPopup[];
}

export function buildBeats(
  events: readonly CombatEvent[],
  heroes: Record<string, HeroDefinition>,
  moves: Record<string, MoveDefinition>,
  combatants: CombatState['combatants']
): Beat[] {
  const name = (id: string) => heroes[combatants[id]?.heroId]?.name ?? id;
  const beats: Beat[] = [];
  // Events with no beat of their own (RoundStarted, TurnStarted, RoundEnded —
  // no state effect, and RoundStarted's log line is the only one worth
  // keeping) ride along on the next beat that has one.
  let carry: CombatEvent[] = [];
  let i = 0;

  function push(applied: CombatEvent[], banner: string, popups: BeatPopup[] = []) {
    beats.push({ events: [...carry, ...applied], banner, popups });
    carry = [];
  }

  while (i < events.length) {
    const e = events[i];

    switch (e.type) {
      case 'RoundStarted':
      case 'TurnStarted':
      case 'RoundEnded':
        carry.push(e);
        i++;
        break;

      case 'MoveDeclared': {
        const applied: CombatEvent[] = [e];
        i++;
        if (events[i]?.type === 'MoveUsed') applied.push(events[i++]);
        if (events[i]?.type === 'ManaChanged') applied.push(events[i++]);
        push(applied, `${name(e.combatantId)} uses ${moves[e.moveId].name}!`);
        break;
      }

      case 'DamageDealt': {
        const applied: CombatEvent[] = [e];
        i++;
        if (events[i]?.type === 'HpChanged') applied.push(events[i++]);
        let knockedOut = false;
        if (events[i]?.type === 'Fainted') {
          applied.push(events[i++]);
          knockedOut = true;
        }
        const tag = e.isCrit
          ? ' — Critical hit!'
          : e.typeMult >= 2
            ? ' — Super effective!'
            : e.typeMult <= 0.5
              ? ' — Not very effective...'
              : '';
        const targetName = name(e.targetCombatantId);
        const knockoutText = knockedOut ? ' — Knocked out!' : '';
        push(applied, `${targetName} takes ${e.amount} damage${tag}${knockoutText}`, [
          { combatantId: e.targetCombatantId, text: `-${e.amount}`, className: e.isCrit ? 'popup-crit' : 'popup-damage' },
        ]);
        break;
      }

      case 'SwitchedIn':
        push([e], `${name(e.inCombatantId)} switches in!`);
        i++;
        break;

      case 'BenchRegenTicked': {
        const applied: CombatEvent[] = [];
        const popups: BeatPopup[] = [];
        const names: string[] = [];
        while (events[i]?.type === 'BenchRegenTicked') {
          const be = events[i] as BenchRegenTickedEvent;
          applied.push(be);
          popups.push({ combatantId: be.combatantId, text: `+${be.hpRegen}`, className: 'popup-heal' });
          names.push(name(be.combatantId));
          i++;
        }
        push(applied, `${names.join(' and ')} recover HP on the bench`, popups);
        break;
      }

      default:
        carry.push(e);
        i++;
        break;
    }
  }

  // Leftover trailing bookkeeping (e.g. a final RoundEnded) with nothing after
  // it to ride along on — fold it into the last real beat rather than drop it.
  if (carry.length > 0 && beats.length > 0) {
    beats[beats.length - 1].events.push(...carry);
  }

  return beats;
}
