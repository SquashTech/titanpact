// Groups the engine's flat event stream into player-legible "beats" for
// sequenced playback. A beat is the unit FightScreen reveals per tap: e.g.
// MoveDeclared + MoveUsed + ManaChanged land together so the mana bar drains
// at the exact moment the "uses Move!" banner appears, rather than a step
// later. This is presentation-only grouping — it doesn't change what
// happened, just how many taps it takes to read it.

import type {
  BenchRegenTickedEvent,
  CombatEvent,
  ManaRegenTickedEvent,
  MoveUsedEvent,
} from '../../engine/events';
import type { CombatState, Side } from '../../engine/state';
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
  /** Secondary readout shown alongside the banner — currently just the mana cost of a declared move. */
  bannerMeta?: string;
  popups: BeatPopup[];
}

/**
 * "TargetA" / "TargetA and TargetB" / "TargetA, TargetB and TargetC" — the
 * banner's "on {target}" clause. A move that targets only its own user (no
 * spread moves do yet, but 'self' is a defined TargetMode) omits the clause
 * entirely rather than reading "X uses Move on X".
 */
function targetClause(targetIds: readonly string[], actorId: string, name: (id: string) => string): string {
  const ids = targetIds.filter((id) => id !== actorId);
  if (ids.length === 0) return '';
  const names = ids.map(name);
  const joined = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return ` on ${joined}`;
}

export function buildBeats(
  events: readonly CombatEvent[],
  heroes: Record<string, HeroDefinition>,
  moves: Record<string, MoveDefinition>,
  combatants: CombatState['combatants'],
  playerSide: Side
): Beat[] {
  const name = (id: string) => heroes[combatants[id]?.heroId]?.name ?? id;
  const beats: Beat[] = [];
  // Events with no beat of their own (RoundStarted, TurnStarted, RoundEnded —
  // no state effect, and RoundStarted's log line is the only one worth
  // keeping) ride along on the next beat that has one.
  let carry: CombatEvent[] = [];
  let i = 0;

  function push(applied: CombatEvent[], banner: string, popups: BeatPopup[] = [], bannerMeta?: string) {
    beats.push({ events: [...carry, ...applied], banner, bannerMeta, popups });
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
        let manaSpent: number | undefined;
        if (events[i]?.type === 'MoveUsed') {
          manaSpent = (events[i] as MoveUsedEvent).manaSpent;
          applied.push(events[i++]);
        }
        if (events[i]?.type === 'ManaChanged') applied.push(events[i++]);

        const move = moves[e.moveId];
        const actorSide = combatants[e.combatantId]?.side;
        const actorName = `${actorSide && actorSide !== playerSide ? 'Enemy ' : ''}${name(e.combatantId)}`;
        const clause = targetClause(e.targetCombatantIds, e.combatantId, name);
        const cost = manaSpent ?? move.manaCost;
        push(applied, `${actorName} uses ${move.name}${clause}`, [], `${cost} MP`);
        break;
      }

      case 'DamageDealt': {
        const applied: CombatEvent[] = [e];
        i++;
        if (events[i]?.type === 'HpChanged') applied.push(events[i++]);
        // Fainted is deliberately held back into its OWN beat below, rather
        // than bundled into this one: applying it here would clear the
        // combatant's active slot (applyEventToState) in the same tap that
        // drains the HP bar, so the card would vanish before the player ever
        // saw it hit 0. Splitting the beat gives that a tap of its own.
        let faintEvent: CombatEvent | null = null;
        if (events[i]?.type === 'Fainted') faintEvent = events[i++];
        const tag = e.isCrit
          ? ' — Critical hit!'
          : e.typeMult >= 2
            ? ' — Super effective!'
            : e.typeMult <= 0.5
              ? ' — Not very effective...'
              : '';
        const targetName = name(e.targetCombatantId);
        push(applied, `${targetName} takes ${e.amount} damage${tag}`, [
          { combatantId: e.targetCombatantId, text: `-${e.amount}`, className: e.isCrit ? 'popup-crit' : 'popup-damage' },
        ]);
        if (faintEvent) push([faintEvent], `${targetName} is knocked out!`);
        break;
      }

      case 'SwitchedIn':
        push([e], `${name(e.inCombatantId)} switches in!`);
        i++;
        break;

      case 'Rested': {
        const applied: CombatEvent[] = [e];
        i++;
        if (events[i]?.type === 'ManaChanged') applied.push(events[i++]);
        const actorSide = combatants[e.combatantId]?.side;
        const actorName = `${actorSide && actorSide !== playerSide ? 'Enemy ' : ''}${name(e.combatantId)}`;
        push(applied, `${actorName} rests, restoring Mana to full`, [
          { combatantId: e.combatantId, text: 'Full MP', className: 'popup-mana' },
        ]);
        break;
      }

      case 'Healed': {
        const applied: CombatEvent[] = [e];
        i++;
        if (events[i]?.type === 'HpChanged') applied.push(events[i++]);
        const targetName = name(e.targetCombatantId);
        push(applied, `${targetName} recovers ${e.amount} HP`, [
          { combatantId: e.targetCombatantId, text: `+${e.amount}`, className: 'popup-heal' },
        ]);
        break;
      }

      case 'StatChanged': {
        const targetName = name(e.combatantId);
        const sign = e.delta > 0 ? '+' : '';
        push([e], `${targetName}'s ${e.stat} ${e.delta > 0 ? 'rises' : 'falls'} (${sign}${e.delta})`, [
          { combatantId: e.combatantId, text: `${sign}${e.delta} ${e.stat}`, className: e.delta > 0 ? 'popup-buff' : 'popup-debuff' },
        ]);
        i++;
        break;
      }

      case 'StatusApplied': {
        const targetName = name(e.combatantId);
        const detail = e.magnitude !== undefined ? ` (${e.magnitude})` : e.duration !== undefined ? ` (${e.duration})` : '';
        push([e], `${targetName} is afflicted with ${e.statusId}${detail}`, [
          { combatantId: e.combatantId, text: e.statusId, className: 'popup-status' },
        ]);
        i++;
        break;
      }

      case 'StatusTicked': {
        const applied: CombatEvent[] = [e];
        i++;
        if (events[i]?.type === 'HpChanged') applied.push(events[i++]);
        // Same split as DamageDealt above — Fainted gets its own beat so a
        // DoT-tick KO also shows the drained bar before the card disappears.
        let faintEvent: CombatEvent | null = null;
        if (events[i]?.type === 'Fainted') faintEvent = events[i++];
        const targetName = name(e.combatantId);
        if (e.kind === 'duration') {
          push(applied, `${targetName}'s ${e.statusId} counts down (${e.newDuration} left)`);
          break;
        }
        const verb = e.kind === 'damage' ? 'takes' : 'recovers';
        push(applied, `${targetName} ${verb} ${e.amount} from ${e.statusId}`, [
          { combatantId: e.combatantId, text: e.kind === 'damage' ? `-${e.amount}` : `+${e.amount}`, className: e.kind === 'damage' ? 'popup-damage' : 'popup-heal' },
        ]);
        if (faintEvent) push([faintEvent], `${targetName} is knocked out!`);
        break;
      }

      case 'StatusRemoved': {
        const targetName = name(e.combatantId);
        const verb =
          e.reason === 'switch' ? 'clears' : e.reason === 'cleanse' ? 'is cleansed' : e.reason === 'consumed' ? 'is consumed' : 'fades';
        push([e], `${targetName}'s ${e.statusId} ${verb}`);
        i++;
        break;
      }

      case 'ActionBlocked': {
        const targetName = name(e.combatantId);
        const text =
          e.reason === 'dazed'
            ? `${targetName} is Dazed and can't move!`
            : e.reason === 'bound'
              ? `${targetName} is Bound and can't switch!`
              : `${targetName}'s target is already down!`;
        push([e], text);
        i++;
        break;
      }

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

      case 'ManaRegenTicked': {
        const applied: CombatEvent[] = [];
        const popups: BeatPopup[] = [];
        while (events[i]?.type === 'ManaRegenTicked') {
          const me = events[i] as ManaRegenTickedEvent;
          applied.push(me);
          popups.push({ combatantId: me.combatantId, text: `+${me.manaRegen}`, className: 'popup-mana' });
          i++;
        }
        push(applied, 'Mana recovers', popups);
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
