// Map events (src/data/events.ts, src/run/events.ts) plus the engine hook the first event passive
// needed: PassiveHook 'SwitchedIn' and the 'activeEnemies' group target (passiveEngine.ts).

import * as assert from 'assert';
import { test } from './harness';
import { createFightState } from './fixtures';
import { heroes } from '../src/data/heroes';
import { moves } from '../src/data/moves';
import { statuses } from '../src/data/statuses';
import { passives } from '../src/data/passives';
import { fieldEffects } from '../src/data/fieldEffects';
import { typeChart } from '../src/data/typechart';
import { equipment } from '../src/data/equipment';
import { locations } from '../src/data/locations';
import { runEvents, type RunEventDefinition } from '../src/data/events';
import { isValidFlatStatGrant } from '../src/engine/content';
import type { PassiveInstance, CombatState } from '../src/engine/state';
import type { CombatEvent } from '../src/engine/events';
import { getEffectiveStat } from '../src/engine/state';
import { resolveRound } from '../src/engine/combat/resolveRound';
import { resolveBattleStartEntries, resolvePassiveReactions } from '../src/engine/combat/passiveEngine';
import { applyForcedReplacement } from '../src/engine/combat/switching';
import type { Action } from '../src/engine/combat/actions';
import {
  applyStatShift,
  eligibleEvents,
  grantEventPassive,
  movePoolFor,
  MIN_HP_AFTER_SHIFT,
  rollEventMove,
  rollRunEvent,
  RunEventError,
  statShiftAllowed,
} from '../src/run/events';
import { entryPassiveCounts } from '../src/run/entryStats';
import { addRosterEntry, createRosterEntry, createRunState } from '../src/run/state';

const config = { typeChart, heroes, moves, statuses, passives, fieldEffects, benchHpRegenFlat: 5 };

function seedRoster(heroIds: string[]) {
  let run = createRunState(0, 0);
  for (const heroId of heroIds) {
    run = addRosterEntry(run, createRosterEntry(heroId, heroId, heroes[heroId].moveIds));
  }
  return run;
}

// --- The authored catalog ---

test('events: every authored event is coherent content — a resolvable outcome, and nothing that would dead-end a node', () => {
  const problems: string[] = [];
  for (const event of Object.values(runEvents)) {
    const { outcome } = event;
    if (!event.name || !event.eyebrow || !event.flavor) problems.push(`${event.id} is missing a name/eyebrow/flavor`);
    if (outcome.kind === 'learnMove') {
      const pool = movePoolFor(outcome.pool, moves);
      if (pool.length === 0) problems.push(`${event.id} has a learnMove filter that matches no move`);
    }
    if (outcome.kind === 'statShift') {
      const entries = Object.entries(outcome.deltas).filter(([, amount]) => amount);
      if (entries.length === 0) problems.push(`${event.id} is a statShift that shifts nothing`);
      for (const [stat, amount] of entries) {
        // The multiples-of-5 rule is about magnitude, so a cost obeys it exactly as a grant does.
        if (!isValidFlatStatGrant(Math.abs(amount as number))) problems.push(`${event.id}'s ${stat} delta ${amount} is not a multiple of 5`);
      }
    }
    if (outcome.kind === 'grantPassive' && !passives[outcome.passiveId]) {
      problems.push(`${event.id} grants unknown passive '${outcome.passiveId}'`);
    }
    if (outcome.kind === 'loot' && outcome.count < 1) problems.push(`${event.id} is a loot event granting ${outcome.count} items`);
    for (const locationId of event.locationIds ?? []) {
      if (!locations[locationId]) problems.push(`${event.id} is gated to unknown location '${locationId}'`);
    }
  }
  assert.deepStrictEqual(problems, []);
});

test("events: Fruit Slicer's pool is exactly the Slice moves, and Wildcard's is the whole catalog", () => {
  const slicePool = movePoolFor({ nameIncludes: 'Slice' }, moves);
  assert.ok(slicePool.length >= 5, `expected several Slice moves, found ${slicePool.length}`);
  assert.ok(
    slicePool.every((id) => moves[id].name.includes('Slice')),
    'the Slice filter let a non-Slice move through'
  );
  assert.ok(slicePool.length < Object.keys(moves).length);
  assert.strictEqual(movePoolFor(undefined, moves).length, Object.keys(moves).length);
});

test('events: a learnMove roll always lands on a move that exists', () => {
  for (let i = 0; i < 40; i++) {
    const rolled = rollEventMove({ nameIncludes: 'Slice' }, moves);
    assert.ok(rolled && moves[rolled], `rolled ${rolled}, which is not a move`);
  }
});

test('events: movePoolFor ANDs its filters, and an empty filter object is permissive rather than empty', () => {
  const fireDamage = movePoolFor({ types: ['Fire'], kinds: ['damage'] }, moves);
  assert.ok(fireDamage.length > 0);
  assert.ok(fireDamage.every((id) => moves[id].type === 'Fire' && moves[id].kind === 'damage'));
  assert.strictEqual(movePoolFor({}, moves).length, Object.keys(moves).length);
});

// --- Selection: the act and Location gates ---

test('events: an ungated event is eligible in every act and every Location', () => {
  const eligible = eligibleEvents(runEvents, 1, 'wildsEdge').map((e) => e.id);
  assert.deepStrictEqual(eligible.sort(), Object.keys(runEvents).sort());
});

test('events: a Location-gated event is only eligible in its own Locations', () => {
  const gated: Record<string, RunEventDefinition> = {
    ...runEvents,
    forgeRite: {
      id: 'forgeRite',
      name: 'Forge Rite',
      eyebrow: 'Test',
      flavor: 'Test',
      tone: 'gold',
      outcome: { kind: 'loot', count: 1 },
      locationIds: ['moltenFoundry'],
    },
  };
  assert.ok(eligibleEvents(gated, 3, 'moltenFoundry').some((e) => e.id === 'forgeRite'));
  assert.ok(!eligibleEvents(gated, 3, 'wildsEdge').some((e) => e.id === 'forgeRite'));
  // A run with no itinerary must not roll a Location-specific event.
  assert.ok(!eligibleEvents(gated, 3, null).some((e) => e.id === 'forgeRite'));
});

test('events: a minAct-gated event is withheld until its act', () => {
  const gated: Record<string, RunEventDefinition> = {
    lateBloom: { id: 'lateBloom', name: 'Late Bloom', eyebrow: 'Test', flavor: 'Test', tone: 'arcane', outcome: { kind: 'loot', count: 1 }, minAct: 4 },
  };
  assert.strictEqual(eligibleEvents(gated, 3, 'wildsEdge').length, 0);
  assert.strictEqual(eligibleEvents(gated, 4, 'wildsEdge').length, 1);
  assert.strictEqual(rollRunEvent(gated, 3, 'wildsEdge'), null);
  assert.strictEqual(rollRunEvent(gated, 5, 'wildsEdge')?.id, 'lateBloom');
});

test('events: rollRunEvent only ever returns something eligible', () => {
  for (let i = 0; i < 40; i++) {
    const rolled = rollRunEvent(runEvents, 2, 'necropolis');
    assert.ok(rolled && runEvents[rolled.id], 'rolled an event outside the catalog');
  }
});

// --- Resolution: stat shift ---

test('events: applyStatShift folds every delta onto one hero in a single transform', () => {
  const run = seedRoster(['cinderKnight', 'tidecaller']);
  const next = applyStatShift(run, 'cinderKnight', { hp: -20, manaPool: 20 });
  assert.deepStrictEqual(next.roster[0].bonusStatGrants, { hp: -20, manaPool: 20 });
  assert.deepStrictEqual(next.roster[1].bonusStatGrants, {});
});

test('events: repeated stat shifts accumulate rather than overwrite', () => {
  let run = seedRoster(['cinderKnight']);
  run = applyStatShift(run, 'cinderKnight', { hp: -20, manaPool: 20 });
  run = applyStatShift(run, 'cinderKnight', { hp: -20, manaPool: 20 });
  assert.deepStrictEqual(run.roster[0].bonusStatGrants, { hp: -40, manaPool: 40 });
});

test('events: applyStatShift rejects an unknown roster id', () => {
  assert.throws(() => applyStatShift(seedRoster(['cinderKnight']), 'nobody', { hp: -20 }), RunEventError);
});

test('events: the HP floor blocks a drain that would leave a hero unplayable, and allows one that would not', () => {
  assert.ok(statShiftAllowed({ hp: -20 }, 100));
  assert.ok(!statShiftAllowed({ hp: -20 }, MIN_HP_AFTER_SHIFT + 19));
  assert.ok(statShiftAllowed({ hp: -20 }, MIN_HP_AFTER_SHIFT + 20));
  assert.ok(statShiftAllowed({ manaPool: 20 }, 1));
});

test('events: Soul Transfer is applicable to every authored hero at base — the floor is a safety net, not a gate on the roster', () => {
  const soulTransfer = runEvents.soulTransfer.outcome;
  assert.strictEqual(soulTransfer.kind, 'statShift');
  if (soulTransfer.kind !== 'statShift') return;
  for (const hero of Object.values(heroes)) {
    assert.ok(statShiftAllowed(soulTransfer.deltas, hero.baseStats.hp), `${hero.id} cannot take Soul Transfer at base HP`);
  }
});

// --- Resolution: passive grant ---

test('events: grantEventPassive lands the passive on the chosen hero and nowhere else', () => {
  const run = seedRoster(['cinderKnight', 'tidecaller']);
  const next = grantEventPassive(run, 'tidecaller', 'imposingPresence', passives);
  assert.deepStrictEqual(next.roster[1].bonusPassiveGrants, ['imposingPresence']);
  assert.deepStrictEqual(next.roster[0].bonusPassiveGrants, []);
});

test('events: a second grant of the same passive stacks rather than being swallowed', () => {
  let run = seedRoster(['cinderKnight']);
  run = grantEventPassive(run, 'cinderKnight', 'imposingPresence', passives);
  run = grantEventPassive(run, 'cinderKnight', 'imposingPresence', passives);
  assert.strictEqual(entryPassiveCounts(run.roster[0], equipment).imposingPresence, 2);
});

test('events: grantEventPassive rejects an unknown hero or an unknown passive', () => {
  const run = seedRoster(['cinderKnight']);
  assert.throws(() => grantEventPassive(run, 'nobody', 'imposingPresence', passives), RunEventError);
  assert.throws(() => grantEventPassive(run, 'cinderKnight', 'notAPassive', passives), RunEventError);
});

test('events: an event-granted passive reaches the combat seam through entryPassiveCounts', () => {
  const run = grantEventPassive(seedRoster(['cinderKnight']), 'cinderKnight', 'imposingPresence', passives);
  assert.strictEqual(entryPassiveCounts(run.roster[0], equipment).imposingPresence, 1);
});

// --- The engine hook: Imposing Presence ---

function fixture(seed: number): CombatState {
  return createFightState(
    seed,
    [
      { combatantId: 'a1', heroId: 'cinderKnight', side: 'A' },
      { combatantId: 'a2', heroId: 'tidecaller', side: 'A' },
      { combatantId: 'a3', heroId: 'sentinel', side: 'A' },
    ],
    [
      { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
      { combatantId: 'b2', heroId: 'wildOracle', side: 'B' },
      { combatantId: 'b3', heroId: 'lucius', side: 'B' },
    ]
  );
}

function withPassive(state: CombatState, combatantId: string, passiveId: string, stacks = 1): CombatState {
  const combatant = state.combatants[combatantId];
  const instance: PassiveInstance = { passiveId, stacks };
  return {
    ...state,
    combatants: { ...state.combatants, [combatantId]: { ...combatant, passives: { ...combatant.passives, [passiveId]: instance } } },
  };
}

function attackOf(state: CombatState, id: string): number {
  return getEffectiveStat(heroes[state.combatants[id].heroId], state.combatants[id], 'attack');
}

test('imposingPresence: switching in drops BOTH active enemies 10 Attack, and leaves the enemy bench alone', () => {
  const state = withPassive(fixture(7), 'a3', 'imposingPresence');
  const before = [attackOf(state, 'b1'), attackOf(state, 'b2'), attackOf(state, 'b3')];

  const actions: Action[] = [{ kind: 'switch', combatantId: 'a1', benchedCombatantId: 'a3' }];
  const result = resolveRound(state, actions, config);

  assert.strictEqual(attackOf(result.state, 'b1'), before[0] - 10);
  assert.strictEqual(attackOf(result.state, 'b2'), before[1] - 10);
  assert.strictEqual(attackOf(result.state, 'b3'), before[2]);
});

test('imposingPresence: the passive does not touch its own side', () => {
  const state = withPassive(fixture(8), 'a3', 'imposingPresence');
  const allyBefore = attackOf(state, 'a2');
  const result = resolveRound(state, [{ kind: 'switch', combatantId: 'a1', benchedCombatantId: 'a3' }], config);
  assert.strictEqual(attackOf(result.state, 'a2'), allyBefore);
});

test('imposingPresence: it fires for the OPENING lead too, not only for a later switch', () => {
  const state = withPassive(fixture(9), 'a1', 'imposingPresence');
  const before = attackOf(state, 'b1');
  const opened = resolveBattleStartEntries(state, 1, heroes, statuses, passives, fieldEffects);
  assert.strictEqual(attackOf(opened.state, 'b1'), before - 10);
  assert.ok(opened.events.some((e) => e.type === 'PassiveTriggered'));
  // The synthesised SwitchedIn events must not leak out — the view would narrate a switch that never happened.
  assert.ok(!opened.events.some((e) => e.type === 'SwitchedIn'));
});

test('imposingPresence: a benched holder is silent — the hook is about arriving, not about being present', () => {
  const state = withPassive(fixture(10), 'a3', 'imposingPresence');
  const before = attackOf(state, 'b1');
  const opened = resolveBattleStartEntries(state, 1, heroes, statuses, passives, fieldEffects);
  assert.strictEqual(attackOf(opened.state, 'b1'), before);
  assert.deepStrictEqual(opened.events, []);
});

test('imposingPresence: a forced replacement after a KO is an arrival like any other', () => {
  const state = withPassive(fixture(11), 'a3', 'imposingPresence');
  const before = attackOf(state, 'b1');
  const replaced = applyForcedReplacement(state, 1, 'A', 0, 'a3', statuses);
  const entry = resolvePassiveReactions(replaced.state, 1, replaced.events, heroes, statuses, passives, fieldEffects);
  assert.strictEqual(attackOf(entry.state, 'b1'), before - 10);
});

test('imposingPresence: re-entering re-applies — the debuff compounds across a fight', () => {
  let state = withPassive(fixture(12), 'a3', 'imposingPresence');
  const before = attackOf(state, 'b1');
  state = resolveRound(state, [{ kind: 'switch', combatantId: 'a1', benchedCombatantId: 'a3' }], config).state;
  state = resolveRound(state, [{ kind: 'switch', combatantId: 'a3', benchedCombatantId: 'a1' }], config).state;
  state = resolveRound(state, [{ kind: 'switch', combatantId: 'a1', benchedCombatantId: 'a3' }], config).state;
  assert.strictEqual(attackOf(state, 'b1'), before - 20);
});

test('imposingPresence: two held stacks resolve twice, same discipline as every other passive', () => {
  const state = withPassive(fixture(13), 'a3', 'imposingPresence', 2);
  const before = attackOf(state, 'b1');
  const result = resolveRound(state, [{ kind: 'switch', combatantId: 'a1', benchedCombatantId: 'a3' }], config);
  assert.strictEqual(attackOf(result.state, 'b1'), before - 20);
});

test('imposingPresence: one trigger emits one PassiveTriggered followed by one StatChanged per enemy', () => {
  const state = withPassive(fixture(14), 'a1', 'imposingPresence');
  const opened = resolveBattleStartEntries(state, 1, heroes, statuses, passives, fieldEffects);
  assert.strictEqual(opened.events.filter((e) => e.type === 'PassiveTriggered').length, 1);
  assert.strictEqual(opened.events.filter((e) => e.type === 'StatChanged').length, 2);
  // buildBeats reads the trigger, then consumes the run of StatChanged events behind it into one beat.
  assert.strictEqual(opened.events[0].type, 'PassiveTriggered');
});


// --- The same hook pointed inward: Unstoppable Growth (Crag's Rootwarden) ---

function renewOf(state: CombatState, id: string): number {
  return state.combatants[id].statuses.Renew?.magnitude ?? 0;
}

/** Renew's magnitude as each StatusApplied reports it — the RESULTING total, read before the round-boundary tick halves it. */
function renewGrants(events: readonly CombatEvent[], id: string): number[] {
  return events
    .filter((e): e is Extract<CombatEvent, { type: 'StatusApplied' }> => e.type === 'StatusApplied' && e.combatantId === id && e.statusId === 'Renew')
    .map((e) => e.magnitude ?? 0);
}

test('unstoppableGrowth: arriving grants the hero itself Renew 40, and nobody else', () => {
  const state = withPassive(fixture(20), 'a3', 'unstoppableGrowth');
  const result = resolveRound(state, [{ kind: 'switch', combatantId: 'a1', benchedCombatantId: 'a3' }], config);

  assert.deepStrictEqual(renewGrants(result.events, 'a3'), [40]);
  assert.strictEqual(renewOf(result.state, 'a3'), 20, 'and the round boundary has already healed it once and halved it');
  assert.strictEqual(renewOf(result.state, 'a2'), 0, 'the partner is not part of this');
  assert.strictEqual(renewOf(result.state, 'b1'), 0);
});

test('unstoppableGrowth: the opening lead counts as arriving', () => {
  const state = withPassive(fixture(21), 'a1', 'unstoppableGrowth');
  const opened = resolveBattleStartEntries(state, 1, heroes, statuses, passives, fieldEffects);
  assert.strictEqual(renewOf(opened.state, 'a1'), 40);
});

test('unstoppableGrowth: a pivot out and back re-seeds it, stacking onto what survived the tick', () => {
  let state = withPassive(fixture(22), 'a3', 'unstoppableGrowth');
  state = resolveRound(state, [{ kind: 'switch', combatantId: 'a1', benchedCombatantId: 'a3' }], config).state;
  assert.strictEqual(renewOf(state, 'a3'), 20, '40 granted, ticked, halved');

  state = resolveRound(state, [{ kind: 'switch', combatantId: 'a3', benchedCombatantId: 'a1' }], config).state;
  const back = resolveRound(state, [{ kind: 'switch', combatantId: 'a1', benchedCombatantId: 'a3' }], config);

  // Renew survives switching and stacks additively, so the second grant lands ON the remainder (10 + 40).
  assert.deepStrictEqual(renewGrants(back.events, 'a3'), [50]);
  assert.ok(renewOf(back.state, 'a3') > 20, 'the second arrival adds to what was left, it does not replace it');
});

test('unstoppableGrowth: a passive-applied HoT is FLAT — it is not run through the healing formula', () => {
  // cinderKnight and sentinel hold different Wisdom and must both read the authored 40.
  assert.notStrictEqual(
    heroes.cinderKnight.baseStats.wisdom,
    heroes.sentinel.baseStats.wisdom,
    'the two holders must differ in Wisdom for this to prove anything'
  );
  const lead = resolveBattleStartEntries(withPassive(fixture(23), 'a1', 'unstoppableGrowth'), 1, heroes, statuses, passives, fieldEffects);
  const arrival = resolveRound(
    withPassive(fixture(24), 'a3', 'unstoppableGrowth'),
    [{ kind: 'switch', combatantId: 'a1', benchedCombatantId: 'a3' }],
    config
  );

  assert.strictEqual(renewOf(lead.state, 'a1'), 40);
  assert.deepStrictEqual(renewGrants(arrival.events, 'a3'), [40]);
});
