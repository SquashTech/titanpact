// Map events (src/data/events.ts, src/run/events.ts) plus the engine hook the first event passive
// needed: PassiveHook 'SwitchedIn' and the 'activeEnemies' group target (passiveEngine.ts).

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { test } from './harness';
import { createFightState } from './fixtures';
import { heroes } from '../src/data/heroes';
import { moves } from '../src/data/moves';
import { statuses } from '../src/data/statuses';
import { passives } from '../src/data/passives';
import { fieldEffects } from '../src/data/fieldEffects';
import { typeChart, TYPES } from '../src/data/typechart';
import { curses } from '../src/data/curses';
import { equipment } from '../src/data/equipment';
import { signatureMoves } from '../src/data/signatures';
import { classMoves } from '../src/data/classes';
import { locations } from '../src/data/locations';
import { runEvents, type EventCost, type HeroOutcome, type ResolvableOutcome, type RunEventDefinition } from '../src/data/events';
import { isValidFlatStatGrant } from '../src/engine/content';
import type { PassiveInstance, CombatState } from '../src/engine/state';
import type { CombatEvent } from '../src/engine/events';
import { getEffectiveStat, getMaxHp } from '../src/engine/state';
import { resolveRound } from '../src/engine/combat/resolveRound';
import { resolveBattleStartEntries, resolvePassiveReactions } from '../src/engine/combat/passiveEngine';
import { applyForcedReplacement } from '../src/engine/combat/switching';
import type { Action } from '../src/engine/combat/actions';
import {
  applyStatShift,
  eligibleEvents,
  grantEventPassive,
  movePoolFor,
  recruitCandidates,
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
  let run = createRunState(0);
  for (const heroId of heroIds) {
    run = addRosterEntry(run, createRosterEntry(heroId, heroId, heroes[heroId].moveIds));
  }
  return run;
}

// --- The authored catalog ---

test('events: every authored event is coherent content — a resolvable outcome, and nothing that would dead-end a node', () => {
  const problems: string[] = [];
  const checkDeltas = (id: string, deltas: Partial<Record<string, number>>) => {
    const entries = Object.entries(deltas).filter(([, amount]) => amount);
    if (entries.length === 0) problems.push(`${id} is a statShift that shifts nothing`);
    for (const [stat, amount] of entries) {
      // The multiples-of-5 rule is about magnitude, so a cost obeys it exactly as a grant does.
      if (!isValidFlatStatGrant(Math.abs(amount as number))) problems.push(`${id}'s ${stat} delta ${amount} is not a multiple of 5`);
    }
  };
  const checkHero = (id: string, outcome: HeroOutcome) => {
    if (outcome.kind === 'statShift') checkDeltas(id, outcome.deltas);
    else if (!passives[outcome.passiveId]) problems.push(`${id} grants unknown passive '${outcome.passiveId}'`);
  };
  const checkCost = (id: string, cost: EventCost | undefined) => {
    if (!cost) return;
    if (cost.gold !== undefined && cost.gold <= 0) problems.push(`${id} costs ${cost.gold} gold`);
    if (cost.woundAll !== undefined && !(cost.woundAll > 0 && cost.woundAll < 1)) problems.push(`${id} wounds by ${cost.woundAll}, not a share of max HP`);
  };
  const check = (id: string, outcome: ResolvableOutcome) => {
    if (outcome.kind === 'learnMove' && movePoolFor(outcome.pool, moves).length === 0) problems.push(`${id} has a learnMove filter that matches no move`);
    if (outcome.kind === 'statShift' || outcome.kind === 'grantPassive') checkHero(id, outcome);
    if (outcome.kind === 'loot' && outcome.count < 1) problems.push(`${id} is a loot event granting ${outcome.count} items`);
    if (outcome.kind === 'gamble') {
      if (!(outcome.chance > 0 && outcome.chance < 1)) problems.push(`${id} gambles at ${outcome.chance}, which is no gamble`);
      checkHero(`${id} (win)`, outcome.win);
      checkHero(`${id} (lose)`, outcome.lose);
    }
    if (outcome.kind === 'curse') {
      const curse = curses[outcome.curseId];
      if (!curse) problems.push(`${id} marks with unknown curse '${outcome.curseId}'`);
      else {
        if (curse.types.length < 1 || curse.types.length > 2) problems.push(`${curse.id} turns into ${curse.types.length} types`);
        for (const type of curse.types) if (!(TYPES as readonly string[]).includes(type)) problems.push(`${curse.id} turns into unknown type '${type}'`);
        if (!moves[curse.moveId]) problems.push(`${curse.id} teaches unknown move '${curse.moveId}'`);
        for (const passiveId of [...curse.passiveIds, ...curse.masteredPassiveIds]) if (!passives[passiveId]) problems.push(`${curse.id} grants unknown passive '${passiveId}'`);
      }
    }
    if (outcome.kind === 'recruit') {
      if (outcome.count < 1) problems.push(`${id} recruits from ${outcome.count} candidates`);
      // Against the whole catalog with an empty roster: a filter that admits nobody is a typo.
      if (recruitCandidates(createRunState(0), outcome.pool, heroes).length === 0) problems.push(`${id}'s recruit filter admits no hero`);
      for (const heroId of outcome.pool.heroIds ?? []) if (!heroes[heroId]) problems.push(`${id} recruits unknown hero '${heroId}'`);
    }
  };
  for (const event of Object.values(runEvents)) {
    const { outcome } = event;
    if (!event.name || !event.eyebrow || !event.flavor) problems.push(`${event.id} is missing a name/eyebrow/flavor`);
    if (event.weight !== undefined && !(event.weight > 0)) problems.push(`${event.id} has weight ${event.weight}`);
    if (outcome.kind === 'choice') {
      if (outcome.options.length < 1 || outcome.options.length > 3) problems.push(`${event.id} offers ${outcome.options.length} options (1–3, plus Leave)`);
      if (event.cost) problems.push(`${event.id} is a choice with an event-level cost — price the options instead`);
      const labels = new Set(outcome.options.map((o) => o.label));
      if (labels.size !== outcome.options.length) problems.push(`${event.id} repeats an option label`);
      for (const option of outcome.options) {
        check(`${event.id}/${option.label}`, option.outcome);
        checkCost(`${event.id}/${option.label}`, option.cost);
      }
    } else {
      check(event.id, outcome);
      checkCost(event.id, event.cost);
      // A risk or a price is only fair with a way out, and only a choice has Leave.
      if (outcome.kind === 'gamble') problems.push(`${event.id} is a bare gamble — put it in a choice so it can be left`);
      if (event.cost) problems.push(`${event.id} carries a cost outside a choice — put it in one so it can be left`);
    }
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
  const owned = Object.keys(moves).filter((id) => signatureMoves[id] || classMoves[id] || moves[id].metamorphic);
  assert.strictEqual(movePoolFor(undefined, moves).length, Object.keys(moves).length - owned.length);
});

test("events: no event pool can teach a signature or a Class move — both are somebody's already", () => {
  const pool = new Set(movePoolFor(undefined, moves));
  for (const id of Object.keys(signatureMoves)) assert.ok(!pool.has(id), `signature ${id} is in the event pool`);
  for (const id of Object.keys(classMoves)) assert.ok(!pool.has(id), `class move ${id} is in the event pool`);
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
  assert.strictEqual(movePoolFor({}, moves).length, movePoolFor(undefined, moves).length);
});

// --- Selection: the act and Location gates ---

test('events: an ungated event is eligible in every act and every Location', () => {
  const ungated = Object.values(runEvents).filter((e) => !e.locationIds && e.minAct === undefined).map((e) => e.id);
  for (const locationId of Object.keys(locations)) {
    const eligible = new Set(eligibleEvents(runEvents, 1, locationId).map((e) => e.id));
    for (const id of ungated) assert.ok(eligible.has(id), `${id} is not eligible in ${locationId}`);
  }
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

/** Rounds of Renew left (docs/timed-statuses.md): a timed status carries no number. */
function renewOf(state: CombatState, id: string): number {
  return state.combatants[id].statuses.Renew?.duration ?? 0;
}

/** Each Renew landing on `id`, as the rounds its StatusApplied reports. */
function renewGrants(events: readonly CombatEvent[], id: string): number[] {
  return events
    .filter((e): e is Extract<CombatEvent, { type: 'StatusApplied' }> => e.type === 'StatusApplied' && e.combatantId === id && e.statusId === 'Renew')
    .map((e) => e.duration ?? 0);
}

test('unstoppableGrowth: arriving grants the hero itself its Renew, and nobody else', () => {
  const state = withPassive(fixture(20), 'a3', 'unstoppableGrowth');
  const result = resolveRound(state, [{ kind: 'switch', combatantId: 'a1', benchedCombatantId: 'a3' }], config);

  assert.deepStrictEqual(renewGrants(result.events, 'a3'), [3]);
  assert.strictEqual(renewOf(result.state, 'a3'), 2, 'one round spent at the round end');
  assert.strictEqual(renewOf(result.state, 'a2'), 0, 'the partner is not part of this');
  assert.strictEqual(renewOf(result.state, 'b1'), 0);
});

test('unstoppableGrowth: the opening lead counts as arriving', () => {
  const state = withPassive(fixture(21), 'a1', 'unstoppableGrowth');
  const opened = resolveBattleStartEntries(state, 1, heroes, statuses, passives, fieldEffects);
  assert.strictEqual(renewOf(opened.state, 'a1'), 3, 'three rounds, nothing healed yet');
});

test('unstoppableGrowth: a pivot out and back re-seeds it — a fresh three rounds, reset rather than added', () => {
  let state = withPassive(fixture(22), 'a3', 'unstoppableGrowth');
  state = resolveRound(state, [{ kind: 'switch', combatantId: 'a1', benchedCombatantId: 'a3' }], config).state;
  state = resolveRound(state, [{ kind: 'switch', combatantId: 'a3', benchedCombatantId: 'a1' }], config).state;
  assert.strictEqual(renewOf(state, 'a3'), 1, 'it keeps ticking on the bench');

  const back = resolveRound(state, [{ kind: 'switch', combatantId: 'a1', benchedCombatantId: 'a3' }], config);
  assert.deepStrictEqual(renewGrants(back.events, 'a3'), [3], 'a fresh Renew on the way back in');
  assert.strictEqual(renewOf(back.state, 'a3'), 2, 'reset to three and ticked once, not 1 + 3');
});

test('unstoppableGrowth: a passive-applied Renew heals a tenth of the holder\'s max HP whatever its Wisdom', () => {
  assert.notStrictEqual(
    heroes.cinderKnight.baseStats.wisdom,
    heroes.sentinel.baseStats.wisdom,
    'the two holders must differ in Wisdom for this to prove anything'
  );
  const lead = resolveBattleStartEntries(withPassive(fixture(23), 'a1', 'unstoppableGrowth'), 1, heroes, statuses, passives, fieldEffects);
  const leadTick = resolveRound(lead.state, [], config).events.find(
    (e) => e.type === 'StatusTicked' && e.combatantId === 'a1' && e.statusId === 'Renew'
  );
  const arrival = resolveRound(
    withPassive(fixture(24), 'a3', 'unstoppableGrowth'),
    [{ kind: 'switch', combatantId: 'a1', benchedCombatantId: 'a3' }],
    config
  );
  const arrivalTick = arrival.events.find((e) => e.type === 'StatusTicked' && e.combatantId === 'a3' && e.statusId === 'Renew');

  const tenth = (id: string, s: CombatState) => Math.ceil(getMaxHp(heroes[s.combatants[id].heroId], s.combatants[id]) * 0.1);
  assert.strictEqual(leadTick && leadTick.type === 'StatusTicked' ? leadTick.amount : -1, tenth('a1', lead.state));
  assert.strictEqual(arrivalTick && arrivalTick.type === 'StatusTicked' ? arrivalTick.amount : -1, tenth('a3', arrival.state));
});

test('events: every event has its own road icon in art/events', () => {
  const dir = path.resolve(__dirname, '../../art/events');
  const missing = Object.keys(runEvents).filter((id) => !fs.existsSync(path.join(dir, `${id}.png`)));
  assert.deepStrictEqual(missing, [], `events with no icon in art/events: ${missing.join(', ')}`);
});
