import * as assert from 'assert';
import { test } from './harness';
import { createFightState } from './fixtures';
import { heroes } from '../src/data/heroes';
import { moves } from '../src/data/moves';
import { typeChart } from '../src/data/typechart';
import { statuses } from '../src/data/statuses';
import { passives } from '../src/data/passives';
import { fieldEffects } from '../src/data/fieldEffects';
import { resolveRound } from '../src/engine/combat/resolveRound';
import type { Action } from '../src/engine/combat/actions';
import type { CombatState } from '../src/engine/state';
import type { PactTickedEvent } from '../src/engine/events';
import { DEFAULT_PACT_CLOCK, pactFractionFor, tickPactClock } from '../src/engine/combat/pactClock';

const baseConfig = { typeChart, heroes, moves, statuses, passives, fieldEffects, benchHpRegenFlat: 5 };

/** Starts at round 2 so a fixture can cross the threshold in a single resolveRound call. */
const SHORT_CLOCK = { startRound: 2, baseFraction: 0.1, stepFraction: 0.05 };

function fixture(seed: number): CombatState {
  return createFightState(
    seed,
    [
      { combatantId: 'a1', heroId: 'cinderKnight', side: 'A' },
      { combatantId: 'a2', heroId: 'tidecaller', side: 'A' },
      { combatantId: 'a3', heroId: 'ironWarden', side: 'A' },
    ],
    [
      { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
      { combatantId: 'b2', heroId: 'wildOracle', side: 'B' },
    ]
  );
}

const maxHpOf = (state: CombatState) => (id: string) => heroes[state.combatants[id].heroId].baseStats.hp;

// --- The curve -------------------------------------------------------------

test('pact: no fraction before the start round, then base, then a step per round', () => {
  const c = DEFAULT_PACT_CLOCK;
  assert.strictEqual(pactFractionFor(c.startRound - 1, c), 0);
  assert.strictEqual(pactFractionFor(c.startRound, c), c.baseFraction);
  assert.ok(Math.abs(pactFractionFor(c.startRound + 2, c) - (c.baseFraction + 2 * c.stepFraction)) < 1e-9);
});

test('pact: the defaults kill a full-HP combatant within five rounds of starting', () => {
  const c = DEFAULT_PACT_CLOCK;
  let total = 0;
  let rounds = 0;
  while (total < 1) {
    total += pactFractionFor(c.startRound + rounds, c);
    rounds++;
  }
  // 10 + 15 + 20 + 25 + 30 = 100%. Load-bearing: the clock has to be a
  // terminator, not a tax. If this ever exceeds 5 the stall outlives the fix.
  assert.strictEqual(rounds, 5);
});

// --- The tick --------------------------------------------------------------

test('pact: the tick is inert before the start round and emits nothing', () => {
  const state = fixture(1);
  const result = tickPactClock(state, SHORT_CLOCK.startRound - 1, SHORT_CLOCK, maxHpOf(state));
  assert.strictEqual(result.events.length, 0);
  assert.strictEqual(result.state, state);
});

test('pact: the tick hits every living combatant on BOTH sides, bench included', () => {
  const state = fixture(2);
  const result = tickPactClock(state, SHORT_CLOCK.startRound, SHORT_CLOCK, maxHpOf(state));

  const hit = new Set(result.events.filter((e) => e.type === 'HpChanged').map((e) => (e as { combatantId: string }).combatantId));
  // a3 is on the bench (fixtures.ts places slot 2 onward there) and is hit anyway:
  // a stalling side must not be able to cycle fresh bodies in to outlast the clock.
  assert.deepStrictEqual([...hit].sort(), ['a1', 'a2', 'a3', 'b1', 'b2']);

  for (const id of hit) {
    const expected = Math.ceil(heroes[state.combatants[id].heroId].baseStats.hp * SHORT_CLOCK.baseFraction);
    assert.strictEqual(state.combatants[id].currentHp - result.state.combatants[id].currentHp, expected, id);
  }
});

test('pact: one PactTicked announces the whole board, and it comes first', () => {
  const state = fixture(3);
  const result = tickPactClock(state, SHORT_CLOCK.startRound + 1, SHORT_CLOCK, maxHpOf(state));

  const announcements = result.events.filter((e) => e.type === 'PactTicked') as PactTickedEvent[];
  assert.strictEqual(announcements.length, 1);
  assert.strictEqual(result.events[0].type, 'PactTicked');
  assert.strictEqual(announcements[0].step, 1);
  assert.ok(Math.abs(announcements[0].fraction - (SHORT_CLOCK.baseFraction + SHORT_CLOCK.stepFraction)) < 1e-9);
});

test('pact: a fraction that rounds to nothing still takes at least 1 HP', () => {
  const state = fixture(4);
  const tiny = { startRound: 1, baseFraction: 0.0001, stepFraction: 0 };
  const result = tickPactClock(state, 1, tiny, maxHpOf(state));
  assert.strictEqual(state.combatants.a1.currentHp - result.state.combatants.a1.currentHp, 1);
});

test('pact: it faints, and a fainted combatant is not hit twice', () => {
  const state = fixture(5);
  const lethal = { startRound: 1, baseFraction: 1, stepFraction: 0 };
  const first = tickPactClock(state, 1, lethal, maxHpOf(state));

  const faints = first.events.filter((e) => e.type === 'Fainted');
  assert.strictEqual(faints.length, 5, 'every combatant on the board goes down at 100%');
  assert.strictEqual(first.state.koCount.A, 3);
  assert.strictEqual(first.state.koCount.B, 2);

  // Everyone is already down, so a second tick is a no-op with no events —
  // applyHpDelta's already-fainted guard, exercised through the pact.
  const second = tickPactClock(first.state, 2, lethal, maxHpOf(state));
  assert.deepStrictEqual(
    second.events.filter((e) => e.type !== 'PactTicked'),
    []
  );
});

// --- Wired into the round --------------------------------------------------

test('pact: resolveRound ticks it at the round boundary, after the status ticks', () => {
  const state = { ...fixture(6), round: SHORT_CLOCK.startRound };
  const actions: Action[] = [
    { kind: 'rest', combatantId: 'a1' },
    { kind: 'rest', combatantId: 'a2' },
    { kind: 'rest', combatantId: 'b1' },
    { kind: 'rest', combatantId: 'b2' },
  ];
  const result = resolveRound(state, actions, { ...baseConfig, pactClock: SHORT_CLOCK });

  const pactIndex = result.events.findIndex((e) => e.type === 'PactTicked');
  const endIndex = result.events.findIndex((e) => e.type === 'RoundEnded');
  assert.ok(pactIndex > -1, 'expected the pact to tick');
  assert.ok(pactIndex < endIndex, 'the pact ticks inside the round it belongs to');

  const expected = Math.ceil(heroes[state.combatants.a1.heroId].baseStats.hp * SHORT_CLOCK.baseFraction);
  assert.strictEqual(state.combatants.a1.currentHp - result.state.combatants.a1.currentHp, expected);
});

test('pact: a fight that ends before the start round never sees it', () => {
  const state = fixture(7);
  const actions: Action[] = [
    { kind: 'rest', combatantId: 'a1' },
    { kind: 'rest', combatantId: 'a2' },
    { kind: 'rest', combatantId: 'b1' },
    { kind: 'rest', combatantId: 'b2' },
  ];
  // Default clock, round 1: the overwhelming majority of fights, untouched.
  const result = resolveRound(state, actions, baseConfig);
  assert.strictEqual(
    result.events.some((e) => e.type === 'PactTicked'),
    false
  );
});

// --- The acceptance test: the stall it exists to break ---------------------

/**
 * The scenario the Pact Clock was built for, run end-to-end.
 *
 * Side A is a wall with an effectively infinite mana pool spamming Reinforce
 * (+20 Attack / +20 Defense to both allies, no cap on either — see
 * docs/combat.md, stat modifiers have no ceiling). Side B attacks it every
 * round. Within a handful of rounds A's Defense outruns B's Attack by enough
 * that the damage ratio collapses, and from then on nothing on the board can
 * finish the fight: A's mana never runs out, B's damage never lands, and the
 * engine had no round limit to notice.
 *
 * The two halves of the assertion are the whole design claim:
 *   1. With the clock pushed out of reach, 80 rounds pass with nobody down.
 *      That is the bug, reproduced.
 *   2. With the default clock, the same fight is over — and it takes the
 *      SETUP side down too, because the pact does not care who is winning the
 *      attrition war.
 */
function stall(): { state: CombatState; actions: Action[] } {
  const base = createFightState(
    99,
    [{ combatantId: 'wall', heroId: 'ironWarden', side: 'A' }],
    [{ combatantId: 'foe', heroId: 'cinderKnight', side: 'B' }]
  );
  return {
    state: {
      ...base,
      combatants: {
        ...base.combatants,
        // The wall as it stands AFTER a player has already set up and geared:
        // an effectively infinite mana pool (so mana never ends the fight) and
        // enough Defense and HP that the foe's damage ratio has collapsed. This
        // is not a contrived number — it is the state the reported bug
        // describes, reached and then held. It goes on baselineStatModifiers,
        // the loadout channel, so `statModifiers` below stays a clean record of
        // what Reinforce alone added over the fight.
        wall: {
          ...base.combatants.wall,
          currentMana: 1_000_000,
          currentHp: 2_135,
          baselineStatModifiers: { defense: 2_000, hp: 2_000 },
        },
        foe: { ...base.combatants.foe, currentMana: 1_000_000 },
      },
    },
    actions: [
      { kind: 'move', combatantId: 'wall', moveId: 'reinforce' },
      { kind: 'move', combatantId: 'foe', moveId: 'singe', declaredTarget: 'wall' },
    ],
  };
}

function runStall(rounds: number, pactClock: { startRound: number; baseFraction: number; stepFraction: number }) {
  const { state, actions } = stall();
  let working = state;
  let lastRound = 0;
  for (let r = 0; r < rounds; r++) {
    if (working.combatants.wall.fainted || working.combatants.foe.fainted) break;
    working = resolveRound(working, actions, { ...baseConfig, pactClock }).state;
    lastRound = r + 1;
  }
  return { state: working, lastRound };
}

test('pact: WITHOUT the clock, an infinite-mana setup loop never resolves', () => {
  // startRound past anything reachable = the engine as it stood before the clock.
  const { state } = runStall(80, { startRound: 10_000, baseFraction: 0.1, stepFraction: 0.05 });
  assert.strictEqual(state.combatants.wall.fainted, false);
  assert.strictEqual(state.combatants.foe.fainted, false);
  // ...and the wall is still climbing, with nothing in the engine to stop it.
  assert.ok(
    (state.combatants.wall.statModifiers.defense ?? 0) >= 20 * 70,
    'Defense should have compounded for the whole fight, unbounded'
  );
});

test('pact: WITH the clock, the same stall is over inside five rounds of round 30', () => {
  const { state, lastRound } = runStall(80, DEFAULT_PACT_CLOCK);
  assert.ok(
    state.combatants.wall.fainted || state.combatants.foe.fainted,
    'the clock has to actually end it'
  );
  // 10+15+20+25+30 = 100% of max HP: round 34 at the latest, from full.
  assert.ok(lastRound <= DEFAULT_PACT_CLOCK.startRound + 5, `ended on round ${lastRound}`);
  // The setup side goes down too. The pact is not a tiebreaker that rewards
  // whoever stalled better — it is the fight being taken away from both of them.
  assert.strictEqual(state.combatants.wall.fainted, true);
});
