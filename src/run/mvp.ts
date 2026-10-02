// The fight's MVP: one free Mastery pip to the hero that dominated a column, not the one that hit
// hardest (docs/mastery.md "The MVP pip"). Pure: the ledger is built off the fight's event stream.

import type { StatusDefinition } from '../engine/content';
import type { CombatEvent } from '../engine/events';
import type { CombatState, Side } from '../engine/state';
import { rosterIdOfCombatant } from './combatantIds';

export type MvpColumn = 'damage' | 'finishes' | 'support' | 'anchor' | 'control';

export const MVP_COLUMNS: readonly MvpColumn[] = ['damage', 'finishes', 'support', 'anchor', 'control'];

/** One player hero's fight, in the columns' own units — a share is read per column, so units never mix. */
export interface MvpLedger {
  rosterId: string;
  /** Turns taken on the field — what the presence floor reads. */
  roundsActive: number;
  /** HP removed from enemies, Shield-absorbed and DoT ticks included. */
  damage: number;
  /** Knockouts landed. */
  finishes: number;
  /** Healing done (drain excluded) plus Shield this hero granted that a hit then emptied. */
  support: number;
  /** Damage taken from enemies, recoil and self-costs excluded. */
  anchor: number;
  /** Statuses and stat drops landed on enemies, buffs landed on allies. */
  control: number;
}

/** Finishes are lumpy — two of three knockouts is 67% — so the column counts a little less. */
export const MVP_COLUMN_WEIGHT: Record<MvpColumn, number> = { damage: 1, finishes: 0.8, support: 1, anchor: 1, control: 1 };

/** A hero must stand on the field this many rounds, or a one-turn switch-in takes a whole column. */
export const MVP_MIN_ROUNDS = 2;

export interface MvpPick {
  rosterId: string;
  column: MvpColumn;
  /** The hero's share of the team's column, 0..1. */
  share: number;
  score: number;
}

/** `side`'s ledgers, one per roster id that took the field, read off the whole fight's events. */
export function mvpLedgersFromEvents(
  events: readonly CombatEvent[],
  state: CombatState,
  side: Side,
  statusDefs: Record<string, StatusDefinition>
): MvpLedger[] {
  const sideOf = (id: string | undefined): Side | undefined => (id ? state.combatants[id]?.side : undefined);
  const ledgers = new Map<string, MvpLedger>();
  const ledger = (combatantId: string | undefined): MvpLedger | undefined => {
    if (!combatantId || sideOf(combatantId) !== side) return undefined;
    const rosterId = rosterIdOfCombatant(combatantId);
    let found = ledgers.get(rosterId);
    if (!found) {
      found = { rosterId, roundsActive: 0, damage: 0, finishes: 0, support: 0, anchor: 0, control: 0 };
      ledgers.set(rosterId, found);
    }
    return found;
  };
  const opposed = (a: string | undefined, b: string | undefined) => !!sideOf(a) && !!sideOf(b) && sideOf(a) !== sideOf(b);

  const shieldGranter: Record<string, string> = {};
  const dotApplier: Record<string, string> = {};
  const lastHitter: Record<string, string> = {};
  let casterId: string | undefined;

  for (const event of events) {
    switch (event.type) {
      case 'TurnStarted': {
        const own = ledger(event.combatantId);
        if (own) own.roundsActive += 1;
        break;
      }
      case 'MoveUsed':
        casterId = event.combatantId;
        break;
      case 'DamageDealt': {
        if (event.recoil || event.selfCost || !opposed(event.sourceCombatantId, event.targetCombatantId)) break;
        const hit = event.amount + (event.absorbed ?? 0);
        const source = ledger(event.sourceCombatantId);
        if (source) source.damage += hit;
        const target = ledger(event.targetCombatantId);
        if (target) target.anchor += hit;
        const granter = ledger(shieldGranter[event.targetCombatantId]);
        if (granter && event.absorbed) granter.support += event.absorbed;
        lastHitter[event.targetCombatantId] = event.sourceCombatantId;
        break;
      }
      case 'StatusTicked': {
        if (event.kind !== 'damage' || event.amount <= 0) break;
        const applier = dotApplier[`${event.combatantId}:${event.statusId}`];
        const source = ledger(applier);
        if (source) source.damage += event.amount;
        if (applier) lastHitter[event.combatantId] = applier;
        break;
      }
      case 'StatusDetonated': {
        const applier = event.sourceCombatantId ?? dotApplier[`${event.combatantId}:${event.statusId}`];
        if (opposed(applier, event.combatantId)) {
          const source = ledger(applier);
          if (source) source.damage += event.amount + (event.absorbed ?? 0);
          if (applier) lastHitter[event.combatantId] = applier;
        }
        const granter = ledger(shieldGranter[event.combatantId]);
        if (granter && event.absorbed) granter.support += event.absorbed;
        break;
      }
      case 'Healed': {
        const source = ledger(event.sourceCombatantId);
        if (source && !event.drain) source.support += event.amount;
        break;
      }
      case 'StatusApplied': {
        if (!event.sourceCombatantId || !sideOf(event.combatantId)) break;
        const pipeline = statusDefs[event.statusId]?.pipeline;
        if (pipeline === 'shield') {
          shieldGranter[event.combatantId] = event.sourceCombatantId;
          break;
        }
        if (pipeline === 'dot' || pipeline === 'timer') {
          if (opposed(event.sourceCombatantId, event.combatantId)) dotApplier[`${event.combatantId}:${event.statusId}`] = event.sourceCombatantId;
          if (pipeline === 'dot') break;
        }
        const source = ledger(event.sourceCombatantId);
        if (source) source.control += 1;
        break;
      }
      case 'StatChanged': {
        if (event.delta === 0 || !sideOf(casterId) || !sideOf(event.combatantId)) break;
        const hostile = opposed(casterId, event.combatantId);
        if ((hostile && event.delta < 0) || (!hostile && event.delta > 0)) {
          const caster = ledger(casterId);
          if (caster) caster.control += 1;
        }
        break;
      }
      case 'Fainted': {
        const killer = lastHitter[event.combatantId];
        if (opposed(killer, event.combatantId)) {
          const own = ledger(killer);
          if (own) own.finishes += 1;
        }
        break;
      }
      default:
        break;
    }
  }
  return [...ledgers.values()];
}

/** Every qualifying hero, best first, each scored by its weighted share of the one column it led most. */
export function rankMvp(ledgers: readonly MvpLedger[]): MvpPick[] {
  const totals = Object.fromEntries(MVP_COLUMNS.map((c) => [c, ledgers.reduce((sum, l) => sum + l[c], 0)])) as Record<MvpColumn, number>;
  const picks: MvpPick[] = [];
  for (const ledger of ledgers) {
    if (ledger.roundsActive < MVP_MIN_ROUNDS) continue;
    let best: MvpPick | undefined;
    for (const column of MVP_COLUMNS) {
      if (totals[column] <= 0) continue;
      const share = ledger[column] / totals[column];
      const score = share * MVP_COLUMN_WEIGHT[column];
      if (!best || score > best.score) best = { rosterId: ledger.rosterId, column, share, score };
    }
    if (best && best.score > 0) picks.push(best);
  }
  return picks.sort((a, b) => b.score - a.score || a.rosterId.localeCompare(b.rosterId));
}

export interface MvpRules {
  /** Roster ids that cannot take the pip — at the Mastery cap, or no longer on the roster. */
  ineligible: ReadonlySet<string>;
  /** Last fight's MVP: never twice running while anyone else qualifies. */
  lastMvpRosterId?: string;
}

/** The MVP after the two rules; undefined when nobody qualifies. */
export function chooseMvp(ledgers: readonly MvpLedger[], rules: MvpRules): MvpPick | undefined {
  const ranked = rankMvp(ledgers).filter((pick) => !rules.ineligible.has(pick.rosterId));
  return ranked.find((pick) => pick.rosterId !== rules.lastMvpRosterId) ?? ranked[0];
}
