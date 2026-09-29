// The lead pick (FightScreen, run/squad.ts openingSquad, switching.ts placeLeads): a run fight
// opens with the player's slots empty and the enemy's leads on the field, the player's leads are
// placed without a switch, and a hero the act left down comes in fallen for the fight's Revive.

import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { equipment } from '../src/data/equipment';
import { getMaxHp, lockInThreshold } from '../src/engine/state';
import { placeLeads, replacementCandidates } from '../src/engine/combat/switching';
import { useConsumable } from '../src/engine/combat/consumables';
import { buildCombatState } from '../src/run/buildCombatState';
import { openingSquad, pickSquad } from '../src/run/squad';
import { addRosterEntry, createRosterEntry, createRunState, type RunState } from '../src/run/state';

function seedRoster(ids: string[]): RunState {
  let run = createRunState(0);
  for (const id of ids) run = addRosterEntry(run, createRosterEntry(id, id, heroes[id].moveIds));
  return run;
}

function withDown(run: RunState, rosterId: string): RunState {
  return { ...run, roster: run.roster.map((e) => (e.rosterId === rosterId ? { ...e, down: true, wounds: 999 } : e)) };
}

function openingState(run: RunState) {
  const ai = seedRoster(['ironWarden']);
  return buildCombatState(1, heroes, equipment, [
    { side: 'A', squad: openingSquad(run.roster), roster: run.roster },
    { side: 'B', squad: pickSquad(ai.roster, ['ironWarden']), roster: ai.roster },
  ]);
}

const THREE = ['cinderKnight', 'tidecaller', 'ironWarden'];

test('lead pick: three standing open with both slots empty and everyone benched', () => {
  const squad = openingSquad(seedRoster(THREE).roster);
  assert.deepStrictEqual(squad.activeIds, [null, null]);
  assert.deepStrictEqual(squad.benchIds, THREE);
  assert.deepStrictEqual(squad.downIds, []);
});

test('lead pick: two standing with nobody down have nothing to decide and lead straight away', () => {
  const squad = openingSquad(seedRoster(['cinderKnight', 'tidecaller']).roster);
  assert.deepStrictEqual(squad.activeIds, ['cinderKnight', 'tidecaller']);
});

test('lead pick: placing leads is not a switch — no first-turn loss, the bench keeps the rest', () => {
  const state = openingState(seedRoster(THREE));
  const placed = placeLeads(state, 'A', ['A:tidecaller', 'A:ironWarden']);
  assert.deepStrictEqual(placed.active.A, ['A:tidecaller', 'A:ironWarden']);
  assert.deepStrictEqual(placed.bench.A, ['A:cinderKnight']);
  assert.strictEqual(placed.combatants['A:tidecaller'].firstActionRound, undefined);
  assert.throws(() => placeLeads(placed, 'A', ['A:cinderKnight']), 'a side leads once');
  assert.throws(() => placeLeads(state, 'A', ['A:tidecaller', 'A:tidecaller']));
  assert.throws(() => placeLeads(state, 'A', ['B:ironWarden']));
});

test('lead pick: a downed hero comes in fallen, outside the lock-in count, and a Revive stands it onto the bench', () => {
  const run = withDown(seedRoster(THREE), 'tidecaller');
  const state = openingState(run);
  const tide = state.combatants['A:tidecaller'];
  assert.ok(tide.fainted && tide.enteredDown);
  assert.strictEqual(tide.currentHp, 0);
  assert.ok(!state.bench.A.includes('A:tidecaller'));
  assert.deepStrictEqual(replacementCandidates(state, 'A'), ['A:cinderKnight', 'A:ironWarden']);
  assert.strictEqual(lockInThreshold(state, 'A'), 2, 'sized off the two standing');

  const maxHpOf = (id: string) => getMaxHp(heroes[state.combatants[id].heroId], state.combatants[id]);
  const withKo = { ...state, koCount: { ...state.koCount, A: 1 } };
  const revived = useConsumable(withKo, 1, 'A:tidecaller', 'revive', maxHpOf, () => 0).state;
  assert.strictEqual(revived.combatants['A:tidecaller'].fainted, false);
  assert.strictEqual(revived.combatants['A:tidecaller'].enteredDown, false);
  assert.ok(revived.bench.A.includes('A:tidecaller'));
  assert.strictEqual(revived.koCount.A, 1, 'no knockout of this fight is taken back');
  assert.strictEqual(lockInThreshold(revived, 'A'), 2);
});
