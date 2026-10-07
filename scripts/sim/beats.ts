// How many taps a round costs to watch. Mirrors the grouping in
// src/view/combat/buildBeats.ts, which the sim cannot import without pulling
// React in — when that file changes its grouping, this must change with it.

import type { CombatEvent } from '../../src/engine/events';
import { passives } from '../../src/data/passives';

/** A passive's name without its parenthetical — each type's Mark of the Titan is one family. */
function passiveFamily(passiveId: string): string {
  return (passives[passiveId]?.name ?? passiveId).replace(/\s*\([^)]*\)$/, '');
}

/** Everything the round's end beat absorbs (buildBeats.ts roundEnd). */
const ROUND_END_EVENTS: ReadonlySet<CombatEvent['type']> = new Set([
  'BenchRegenTicked',
  'ManaRegenTicked',
  'StatusTicked',
  'HpChanged',
  'PassiveTriggered',
  'StatusApplied',
  'StatChanged',
  'ManaGranted',
  'FieldEffectExpired',
  'StatusRemoved',
  'Healed',
  'ManaChanged',
  'ManaSurcharged',
  'Endured',
  'BlessingSpent',
  'FieldEffectTicked',
  'RoundEnded',
]);

export function countBeats(events: readonly CombatEvent[]): number {
  let beats = 0;
  let i = 0;
  // Beats counted when the round's end beat was the last one — a field lapsing then rides on it.
  let roundEndAt = -1;
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
          // Consecutive triggers of one passive family are one beat.
          while (
            events[i]?.type === 'PassiveTriggered' &&
            events[i + 1]?.type === 'StatusApplied' &&
            passives[(events[i] as typeof e).passiveId]?.reactive?.effect.kind === 'applyStatus' &&
            passiveFamily((events[i] as typeof e).passiveId) === passiveFamily(e.passiveId)
          ) {
            i += 2;
          }
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
        beats += 1;
        i++;
        if (events[i]?.type === 'ManaChanged') i++;
        break;

      // Consecutive plain heals (both allies) are one beat; a drain stands alone.
      case 'Healed':
        beats += 1;
        i++;
        if (events[i]?.type === 'HpChanged') i++;
        while (!e.drain && events[i]?.type === 'Healed' && !(events[i] as typeof e).drain) {
          i++;
          if (events[i]?.type === 'HpChanged') i++;
        }
        break;

      // The same status landing on several targets back to back is one beat.
      case 'StatusApplied':
        beats += 1;
        i++;
        while (events[i]?.type === 'StatusApplied' && (events[i] as typeof e).statusId === e.statusId && (events[i] as typeof e).combatantId !== e.combatantId) i++;
        break;

      case 'StatusRemoved':
        if (e.reason === 'cleanse') beats += 1;
        i++;
        break;

      // The round's end: one beat for all of its upkeep — regen, ticks, the passives that fire on
      // them or on the round's end and their payloads, a field lapsing — plus one for a run of KOs,
      // which ends it. A bare RoundEnded opens it only when a passive stands behind it.
      case 'RoundEnded':
        if (events[i + 1]?.type !== 'PassiveTriggered') {
          i++;
          break;
        }
      // falls through
      case 'BenchRegenTicked':
      case 'ManaRegenTicked':
      case 'StatusTicked': {
        beats += 1;
        const endBeat = beats;
        while (i < events.length) {
          const next = events[i];
          if (next.type === 'Fainted') {
            beats += 1;
            while (events[i]?.type === 'Fainted') i++;
            break;
          }
          if (!ROUND_END_EVENTS.has(next.type)) break;
          i++;
        }
        // A KO split off behind it means the round's end is no longer the last beat.
        roundEndAt = beats === endBeat ? beats : -1;
        break;
      }

      case 'FieldEffectExpired':
        if (beats !== roundEndAt) beats += 1;
        i++;
        break;

      case 'PactTicked':
      case 'FieldEffectDrained':
        beats += 1;
        i++;
        while (events[i]?.type === 'HpChanged' || events[i]?.type === 'Fainted') {
          if (events[i].type === 'Fainted') beats += 1;
          i++;
        }
        break;

      case 'SwitchedIn':
      case 'ActionBlocked':
      case 'MoveGuarded':
      case 'StatusRefused':
      case 'FieldEffectSet':
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
