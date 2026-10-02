// The fight's MVP (src/run/mvp.ts): the best share of one column, the presence floor, the two rules.

import * as assert from 'assert';
import { test } from './harness';
import { statuses } from '../src/data/statuses';
import type { CombatEvent } from '../src/engine/events';
import type { CombatState } from '../src/engine/state';
import { MVP_MIN_ROUNDS, chooseMvp, mvpLedgersFromEvents, rankMvp, type MvpLedger } from '../src/run/mvp';

function ledger(rosterId: string, columns: Partial<MvpLedger>): MvpLedger {
  return { rosterId, roundsActive: 5, damage: 0, finishes: 0, support: 0, anchor: 0, control: 0, ...columns };
}

test('mvp: the winner is the biggest share of ONE column, not the biggest number', () => {
  const ledgers = [
    ledger('striker', { damage: 600, anchor: 100 }),
    ledger('partner', { damage: 500, anchor: 100 }),
    ledger('medic', { damage: 50, support: 300 }),
  ];
  const [best] = rankMvp(ledgers);
  assert.strictEqual(best.rosterId, 'medic', 'all of the healing beats 52% of the damage');
  assert.strictEqual(best.column, 'support');
  assert.strictEqual(best.share, 1);
});

test('mvp: a hero under the presence floor never qualifies', () => {
  const ledgers = [ledger('blip', { control: 1, roundsActive: MVP_MIN_ROUNDS - 1 }), ledger('steady', { damage: 100 })];
  assert.deepStrictEqual(rankMvp(ledgers).map((p) => p.rosterId), ['steady']);
});

test('mvp: never the same hero twice running, and never a hero at the cap — the runner-up takes it', () => {
  const ledgers = [ledger('carry', { damage: 900, anchor: 100 }), ledger('tank', { anchor: 200, damage: 100 })];
  assert.strictEqual(chooseMvp(ledgers, { ineligible: new Set() })?.rosterId, 'carry');
  assert.strictEqual(chooseMvp(ledgers, { ineligible: new Set(), lastMvpRosterId: 'carry' })?.rosterId, 'tank');
  assert.strictEqual(chooseMvp(ledgers, { ineligible: new Set(['carry']) })?.rosterId, 'tank');
  // Alone on the field, the last MVP can win again rather than nobody.
  assert.strictEqual(chooseMvp([ledgers[0]], { ineligible: new Set(), lastMvpRosterId: 'carry' })?.rosterId, 'carry');
  assert.strictEqual(chooseMvp([ledgers[0]], { ineligible: new Set(['carry']) }), undefined);
});

test('mvp: the ledger reads the event stream — hits, finishes, anchor, and nothing self-inflicted', () => {
  const state = {
    combatants: {
      'A:hero': { side: 'A' },
      'A:ally': { side: 'A' },
      'B:foe': { side: 'B' },
    },
  } as unknown as CombatState;
  const hit = (source: string, target: string, amount: number, extra: Partial<CombatEvent> = {}) =>
    ({ type: 'DamageDealt', round: 1, sourceCombatantId: source, targetCombatantId: target, moveId: 'm', amount, ...extra }) as unknown as CombatEvent;
  const events: CombatEvent[] = [
    { type: 'TurnStarted', round: 1, combatantId: 'A:hero' },
    { type: 'TurnStarted', round: 1, combatantId: 'A:ally' },
    hit('A:hero', 'B:foe', 80),
    hit('B:foe', 'A:ally', 50),
    hit('A:hero', 'A:hero', 20, { recoil: { damageDealt: 80, percent: 25 } } as Partial<CombatEvent>),
    { type: 'Fainted', round: 1, combatantId: 'B:foe', side: 'B', koCount: 1 },
  ];
  const byId = Object.fromEntries(mvpLedgersFromEvents(events, state, 'A', statuses).map((l) => [l.rosterId, l]));
  assert.strictEqual(byId.hero.damage, 80, 'the recoil is the move\'s price, not its output');
  assert.strictEqual(byId.hero.anchor, 0);
  assert.strictEqual(byId.hero.finishes, 1);
  assert.strictEqual(byId.ally.anchor, 50);
  assert.strictEqual(byId.hero.roundsActive, 1);
  assert.ok(!('foe' in byId), 'only the asked side has a ledger');
});
