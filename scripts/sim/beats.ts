// How many taps a round costs to watch. Mirrors the grouping in
// src/view/combat/buildBeats.ts, which the sim cannot import without pulling
// React in — when that file changes its grouping, this must change with it.

import type { CombatEvent } from '../../src/engine/events';
import { passives } from '../../src/data/passives';

export function countBeats(events: readonly CombatEvent[]): number {
  let beats = 0;
  let i = 0;
  while (i < events.length) {
    const e = events[i];
    switch (e.type) {
      case 'MoveDeclared':
        beats += 1;
        i++;
        if (events[i]?.type === 'MoveUsed') i++;
        if (events[i]?.type === 'ManaChanged') i++;
        break;

      case 'DamageDealt':
        beats += 1;
        i++;
        if (events[i]?.type === 'HpChanged') i++;
        if (events[i]?.type === 'Fainted') {
          beats += 1;
          i++;
        }
        break;

      case 'StatusDetonated':
        beats += 1;
        i++;
        if (events[i]?.type === 'StatusRemoved') i++;
        if (events[i]?.type === 'HpChanged') i++;
        if (events[i]?.type === 'Fainted') {
          beats += 1;
          i++;
        }
        break;

      case 'PassiveTriggered': {
        i++;
        const kind = passives[e.passiveId]?.reactive?.effect.kind;
        const next = events[i]?.type;
        if (kind === 'heal' && next === 'HpChanged') {
          beats += 1;
          i++;
        } else if (kind === 'applyStatus' && next === 'StatusApplied') {
          beats += 1;
          i++;
        } else if (kind === 'statDelta' && next === 'StatChanged') {
          beats += 1;
          while (events[i]?.type === 'StatChanged') i++;
        }
        break;
      }

      case 'StatChanged':
        beats += 1;
        while (events[i]?.type === 'StatChanged') i++;
        break;

      case 'Rested':
      case 'Healed':
        beats += 1;
        i++;
        if (events[i]?.type === 'HpChanged' || events[i]?.type === 'ManaChanged') i++;
        break;

      case 'StatusRemoved':
        if (e.reason === 'cleanse') beats += 1;
        i++;
        break;

      // The round's end: one beat for the whole regen-and-tick block, plus one per KO.
      case 'BenchRegenTicked':
      case 'ManaRegenTicked':
      case 'StatusTicked':
        beats += 1;
        for (;;) {
          const next = events[i];
          if (!next) break;
          if (next.type === 'BenchRegenTicked' || next.type === 'ManaRegenTicked') i++;
          else if (next.type === 'StatusTicked') {
            i++;
            if (events[i]?.type === 'HpChanged') i++;
            if (events[i]?.type === 'Fainted') {
              beats += 1;
              i++;
            }
          } else if (next.type === 'StatusRemoved' && (next.reason === 'expired' || next.reason === 'decay')) i++;
          else break;
        }
        break;

      case 'PactTicked':
        beats += 1;
        i++;
        while (events[i]?.type === 'HpChanged' || events[i]?.type === 'Fainted') {
          if (events[i].type === 'Fainted') beats += 1;
          i++;
        }
        break;

      case 'SwitchedIn':
      case 'StatusApplied':
      case 'ActionBlocked':
      case 'MoveGuarded':
      case 'FieldEffectSet':
      case 'FieldEffectExpired':
      case 'ManaGranted':
        beats += 1;
        i++;
        break;

      default:
        i++;
        break;
    }
  }
  return beats;
}
