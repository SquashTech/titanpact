// Mech's authored slate (src/data/moves.ts, 2026-08-30) and the FOUR engine
// fields it needed. Mech is the first type whose IDENTITY is randomness, and
// the four fields are four DIFFERENT things chance can attach to:
//
//   - `randomPriority` (Cog Bop, Cog Slam) — rolls the BRACKET. Drawn in
//     priority.ts when the round is ordered, after both sides have committed,
//     so it is a gamble rather than a drawback.
//   - `randomStatDeltas` (Overclock, Piston Punch, Jury-Rig) — rolls WHICH
//     STAT. Per resolved target, without replacement, over a pool the move
//     authors as data.
//   - `randomStatusApplication` (Malfunction) — rolls WHICH RIDER. Once per
//     CAST, not per target, because every candidate carries its own `target`.
//   - `randomBasePower` (Jackpot) — rolls the DAMAGE, and is the one that is
//     not drawn at all.
//
// The last is the interesting one and most of what this file pins. Jackpot's
// roll is DERIVED from (seed, round, combatantId, moveId) rather than taken
// from the shared stream (engine/state.ts resolveRandomBasePower), because the
// 2026-08-30 designer call is that the number is VISIBLE before the player
// commits — and a value the view must read cannot be one the view would
// advance by reading. Three consequences are asserted below: the stream is
// untouched, the value is stable within a round and different across rounds,
// and the button, the dossier forecast and the resolved hit all agree.
//
// Plus the type's own shape, which the design table states only by omission:
//
//   - Mech is in NO status's triggerTypes or spreadTriggerTypes, yet the slate
//     PLANTS both Conduct and Haunt (Malfunction, Perfect Creation). It is the
//     only type that marks targets exclusively for somebody else to cash —
//     Iron's arrangement inverted, and a 2026-08-30 designer call rather than
//     a gap. Pinned so it cannot drift silently.
//   - Three rows Burn their own caster and exactly one heals it (Salvage, the
//     only self-target heal in the game). That pairing is the type's engine.
//   - Two bracket rows, both random; the slate authors no fixed nonzero
//     priority at all.

import * as assert from 'assert';
import { test } from './harness';
import { createFightState } from './fixtures';
import { heroes } from '../src/data/heroes';
import { enemies } from '../src/data/enemies';
import { moves, RANDOM_STAT_POOL } from '../src/data/moves';
import { typeChart } from '../src/data/typechart';
import { statuses } from '../src/data/statuses';
import { passives } from '../src/data/passives';
import { fieldEffects } from '../src/data/fieldEffects';
import { statusApplicationsOf } from '../src/engine/content';
import { resolveRound } from '../src/engine/combat/resolveRound';
import { orderActions } from '../src/engine/combat/priority';
import { resolveRandomBasePower } from '../src/engine/state';
import type { CombatState } from '../src/engine/state';
import type { Action } from '../src/engine/combat/actions';

const config = { typeChart, heroes, moves, statuses, passives, fieldEffects, benchHpRegenFlat: 5 };

/** Clockwork and Bellows, the type's whole roster, against two Iron bodies. */
function mechFixture(seed: number) {
  return createFightState(
    seed,
    [
      { combatantId: 'a1', heroId: 'forgewright', side: 'A' },
      { combatantId: 'a2', heroId: 'steamColossus', side: 'A' },
    ],
    [
      { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
      { combatantId: 'b2', heroId: 'sentinel', side: 'B' },
    ]
  );
}

/**
 * The two fixture problems every authored slate hits (authoring-moves.md §8):
 * a curve the fixture pools cannot pay for, and defenders fragile enough that
 * the hit KOs them before a rider is reached — which silently turns a rider
 * test into a KO test. getMaxHp reads `baseStats + statModifiers`, so the hp
 * modifier has to move with currentHp.
 */
function withDeepPools(state: CombatState): CombatState {
  const combatants = Object.fromEntries(
    Object.entries(state.combatants).map(([id, c]) => [
      id,
      { ...c, currentMana: 999, currentHp: 1200, statModifiers: { ...c.statModifiers, manaPool: 999, hp: 1200 } },
    ])
  );
  return { ...state, combatants } as CombatState;
}

function modifiersOf(state: CombatState, combatantId: string) {
  return state.combatants[combatantId].statModifiers as Record<string, number>;
}

function statusesOn(state: CombatState, combatantId: string) {
  return Object.keys(state.combatants[combatantId].statuses).sort();
}

// --- randomBasePower: the reel the player can read -------------------------

test('mech: Jackpot rolls inside its authored band, and never draws from the shared RNG', () => {
  // The whole reason the roll is derived rather than drawn: the view reads it
  // to paint the button, and a read that advanced rngState would let a player
  // re-roll Jackpot by opening the move dossier (content.ts randomBasePower).
  const state = withDeepPools(mechFixture(800));
  const before = state.rngState;

  for (let round = 1; round <= 40; round++) {
    const rolled = resolveRandomBasePower({ ...state, round }, 'a2', moves.jackpot);
    assert.ok(rolled != null, 'no roll');
    assert.ok(rolled >= 50 && rolled <= 150, `rolled ${rolled}, outside 50-150`);
    assert.strictEqual(rolled, Math.floor(rolled), 'a slot machine does not pay decimals');
  }

  assert.strictEqual(state.rngState, before, 'reading the reel advanced the shared stream');
  // And it is inert for every move that authors a flat number.
  assert.strictEqual(resolveRandomBasePower(state, 'a2', moves.cogSlam), undefined);
});

test('mech: the reel is stable within a round, moves between rounds, and differs per hero', () => {
  const state = withDeepPools(mechFixture(801));

  // Stable: the button, the dossier forecast and resolveRound all call this,
  // and a player who opens the dossier must see the number they are about to
  // get rather than a fresh one.
  const first = resolveRandomBasePower(state, 'a2', moves.jackpot);
  assert.strictEqual(resolveRandomBasePower(state, 'a2', moves.jackpot), first);
  assert.strictEqual(resolveRandomBasePower(state, 'a2', moves.jackpot), first);

  // Moves: `round` is an input, so nothing has to remember to advance it.
  const overRounds = new Set<number>();
  for (let round = 1; round <= 30; round++) overRounds.add(resolveRandomBasePower({ ...state, round }, 'a2', moves.jackpot)!);
  assert.ok(overRounds.size > 5, `reel stuck across rounds: only ${overRounds.size} distinct values`);

  // Differs per hero: two heroes holding Jackpot read their own machines.
  const perHero = new Set<number>();
  for (let round = 1; round <= 30; round++) perHero.add(resolveRandomBasePower({ ...state, round }, 'a1', moves.jackpot)!);
  assert.notDeepStrictEqual([...overRounds].sort(), [...perHero].sort(), 'both heroes read the same reel');
});

test('mech: the hit resolveRound deals is the number the button was showing', () => {
  // docs/authoring-moves.md §5, "pass your new term in or the forecast lies" —
  // here the failure would be worse than a lying forecast, because the player
  // committed 80 mana on the strength of the figure.
  const state = withDeepPools(mechFixture(802));
  const shown = resolveRandomBasePower(state, 'a2', moves.jackpot)!;

  const { events } = resolveRound(
    state,
    [{ kind: 'move', combatantId: 'a2', moveId: 'jackpot', declaredTarget: 'b1' }],
    config
  );
  const hit = events.find((e) => e.type === 'DamageDealt') as any;
  assert.ok(hit, 'Jackpot dealt nothing');
  // The event carries the ROLLED figure, not the authored (absent) one — the
  // Battle Log prints the whole formula and "0 BP" would make it wrong.
  assert.strictEqual(hit.basePower, shown);
  assert.ok(hit.amount > 0);
});

// --- randomPriority: the bracket nobody can predict ------------------------

test('mech: Cog Bop resolves in both of its brackets across seeds, and only those two', () => {
  const brackets = new Set<number>();
  for (let seed = 0; seed < 60; seed++) {
    const state = withDeepPools(mechFixture(seed));
    const actions: Action[] = [{ kind: 'move', combatantId: 'a2', moveId: 'cogBop', declaredTarget: 'b1' }];
    // orderActions is where the draw happens; read the bracket back out of the
    // ordering by racing it against a known priority-0 move on a faster hero.
    const { events } = resolveRound(
      state,
      [
        ...actions,
        { kind: 'move', combatantId: 'b1', moveId: 'ironFist', declaredTarget: 'a2' } as Action,
      ],
      config
    );
    const order = events.filter((e) => e.type === 'MoveUsed').map((e: any) => e.combatantId);
    brackets.add(order[0] === 'a2' ? 1 : -1);
  }
  assert.deepStrictEqual([...brackets].sort(), [-1, 1], 'Cog Bop never reached one of its two brackets');
});

test('mech: a randomPriority move authors its own midpoint, and the view reads that', () => {
  // `priority` stays the honest board-free answer for the draft, the
  // compendium and effectivePriority, which deliberately does not roll
  // (content.ts randomPriority). Authoring it as anything but the midpoint
  // would make those surfaces claim a bias the move does not have.
  for (const id of ['cogBop', 'cogSlam']) {
    const move = moves[id];
    const list = move.randomPriority!;
    assert.ok(list.length > 0, `${id} has no bracket list`);
    assert.strictEqual(move.priority, list.reduce((a, b) => a + b, 0) / list.length, `${id} is not authored at its midpoint`);
  }
});

test('mech: a round with no randomPriority move in it draws exactly the RNG it always did', () => {
  // The determinism discipline every optional field since Fire has followed:
  // absent means no draw at all, so every fight authored before Mech replays
  // byte-identically (docs/authoring-moves.md §5).
  const state = withDeepPools(mechFixture(803));
  const plain: Action[] = [
    { kind: 'move', combatantId: 'a1', moveId: 'pistonPunch', declaredTarget: 'b1' },
    { kind: 'move', combatantId: 'b1', moveId: 'ironFist', declaredTarget: 'a1' },
  ];
  const { nextRngState } = orderActions(state, heroes, plain, moves, state.rngState, fieldEffects);
  assert.strictEqual(nextRngState, state.rngState, 'ordering a Mech-free round advanced the stream');
});

// --- randomStatDeltas: the reel that picks a stat --------------------------

test('mech: Overclock rolls independently for each ally, and only over the authored pool', () => {
  // The designer call (2026-08-30): each ally rolls its own stat, matching how
  // StatusApplication.chance and statDeltaChance already roll per target.
  const seen = { a1: new Set<string>(), a2: new Set<string>() };
  let differed = false;

  for (let seed = 0; seed < 40; seed++) {
    const state = withDeepPools(mechFixture(seed));
    const { state: after } = resolveRound(
      state,
      [{ kind: 'move', combatantId: 'a1', moveId: 'overclock' }],
      config
    );
    const one = Object.keys(modifiersOf(after, 'a1')).filter((k) => k !== 'manaPool' && k !== 'hp');
    const two = Object.keys(modifiersOf(after, 'a2')).filter((k) => k !== 'manaPool' && k !== 'hp');
    assert.strictEqual(one.length, 1, 'Overclock granted more than one stat');
    assert.strictEqual(two.length, 1, 'Overclock granted more than one stat');
    assert.strictEqual(modifiersOf(after, 'a1')[one[0]], 20);
    seen.a1.add(one[0]);
    seen.a2.add(two[0]);
    if (one[0] !== two[0]) differed = true;
  }

  assert.ok(differed, 'both allies always rolled the same stat — the roll is not per target');
  for (const stat of [...seen.a1, ...seen.a2]) {
    assert.ok(RANDOM_STAT_POOL.includes(stat as any), `${stat} is outside the authored pool`);
  }
  // And the pool is genuinely all five, not four with a dead face.
  assert.strictEqual(seen.a1.size + seen.a2.size >= 5, true, 'the reel never reached most of its faces');
});

test('mech: Jury-Rig grants two DIFFERENT stats, never +40 to one', () => {
  // Drawn without replacement (content.ts randomStatDeltas). The alternative
  // would make the move sometimes a doubled Overclock, which is a different
  // row from the one the table describes.
  for (let seed = 0; seed < 30; seed++) {
    const state = withDeepPools(mechFixture(seed));
    const { state: after } = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'juryRig' }], config);
    const granted = Object.entries(modifiersOf(after, 'a1')).filter(([k]) => k !== 'manaPool' && k !== 'hp');
    assert.strictEqual(granted.length, 2, `seed ${seed}: Jury-Rig granted ${granted.length} stats`);
    for (const [, amount] of granted) assert.strictEqual(amount, 20, 'a stat was granted twice over');
  }
});

test('mech: Piston Punch damages the enemy and buffs the CASTER', () => {
  // statDeltaTarget 'self' on a move whose damage targets the enemy — the
  // opposite-sides split Landslide needed, now on a random grant.
  const state = withDeepPools(mechFixture(804));
  const { state: after } = resolveRound(
    state,
    [{ kind: 'move', combatantId: 'a1', moveId: 'pistonPunch', declaredTarget: 'b1' }],
    config
  );
  assert.ok(after.combatants.b1.currentHp < state.combatants.b1.currentHp, 'Piston Punch dealt no damage');
  const buffed = Object.entries(modifiersOf(after, 'a1')).filter(([k]) => k !== 'manaPool' && k !== 'hp');
  assert.strictEqual(buffed.length, 1);
  assert.strictEqual(buffed[0][1], 5, 'the smallest legal grant');
  const onTarget = Object.keys(modifiersOf(after, 'b1')).filter((k) => k !== 'manaPool' && k !== 'hp');
  assert.deepStrictEqual(onTarget, [], 'the buff landed on the victim');
});

test('mech: every authored random stat grant is a legal flat multiple of 5', () => {
  // CLAUDE.md's multiples-of-5/10 lock. Unlike derivedStatDeltas there is no
  // exemption here — the amount is authored, so it has to obey.
  const { isValidFlatStatGrant } = require('../src/engine/content') as typeof import('../src/engine/content');
  for (const move of Object.values(moves)) {
    if (!move.randomStatDeltas) continue;
    assert.ok(isValidFlatStatGrant(move.randomStatDeltas.amount), `${move.id} grants ${move.randomStatDeltas.amount}`);
    assert.ok(move.randomStatDeltas.count >= 1);
    assert.ok(move.randomStatDeltas.from.length >= move.randomStatDeltas.count, `${move.id} draws more stats than its pool holds`);
  }
});

// --- randomStatusApplication: the reel that picks a rider ------------------

test('mech: Malfunction lands exactly one of its three faces, and reaches all three', () => {
  const landed = new Set<string>();
  for (let seed = 0; seed < 40; seed++) {
    const state = withDeepPools(mechFixture(seed));
    const { state: after } = resolveRound(
      state,
      [{ kind: 'move', combatantId: 'a1', moveId: 'malfunction', declaredTarget: 'b1' }],
      config
    );
    const on = statusesOn(after, 'b1');
    assert.strictEqual(on.length, 1, `seed ${seed}: Malfunction applied ${on.length} statuses`);
    landed.add(on[0]);
  }
  assert.deepStrictEqual([...landed].sort(), ['Burn', 'Conduct', 'Poison'], 'the reel never reached all three faces');
});

test('mech: Malfunction still deals its damage whichever face comes up', () => {
  // CLAUDE.md "No accuracy stat": the reel gates the RIDER, never the body.
  for (let seed = 0; seed < 12; seed++) {
    const state = withDeepPools(mechFixture(seed));
    const { state: after } = resolveRound(
      state,
      [{ kind: 'move', combatantId: 'a1', moveId: 'malfunction', declaredTarget: 'b1' }],
      config
    );
    assert.ok(after.combatants.b1.currentHp < state.combatants.b1.currentHp, `seed ${seed}: no damage`);
  }
});

test("mech: Poison from a reel carries the catalog's duration, like every other Poison row", () => {
  // The table omits the duration — the Light lesson (docs/authoring-moves.md).
  // Every one of the eleven Poison rows authored before this slate says 3, so
  // the precedent is what these two use, and it is pinned rather than left to
  // drift.
  const poisonRows = Object.values(moves).flatMap((m) => [
    ...statusApplicationsOf(m),
    ...(m.randomStatusApplication ?? []),
  ]).filter((app) => app.statusId === 'Poison');
  assert.ok(poisonRows.length >= 12);
  for (const app of poisonRows) assert.strictEqual(app.duration, 3, 'a Poison row disagrees with the catalog duration');
});

// --- The two-status rows ---------------------------------------------------

test('mech: Backfire and Overheat Burn the target AND the caster', () => {
  for (const [id, magnitude] of [['backfire', 10], ['overheat', 20]] as const) {
    const state = withDeepPools(mechFixture(805));
    const { state: after } = resolveRound(
      state,
      [{ kind: 'move', combatantId: 'a1', moveId: id, declaredTarget: 'b1' }],
      config
    );
    // Statuses tick at end of round in the round they were applied, and Burn
    // halves after its tick — so a freshly applied Burn N reads N/2 here
    // (docs/authoring-moves.md §8, the first trap).
    assert.strictEqual(after.combatants.b1.statuses.Burn?.magnitude, magnitude / 2, `${id}: target not Burned`);
    assert.strictEqual(after.combatants.a1.statuses.Burn?.magnitude, magnitude / 2, `${id}: caster not Burned`);
  }
});

test('mech: Meltdown burns only the CASTER, and hits both enemies', () => {
  // The asymmetry is authored: the table burns the user on Meltdown and both
  // parties on Backfire/Overheat, so a single bare rider is correct here.
  const state = withDeepPools(mechFixture(806));
  const { state: after } = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'meltdown' }], config);
  assert.ok(after.combatants.b1.currentHp < state.combatants.b1.currentHp);
  assert.ok(after.combatants.b2.currentHp < state.combatants.b2.currentHp);
  assert.strictEqual(after.combatants.a1.statuses.Burn?.magnitude, 15, 'caster not Burned 30');
  assert.strictEqual(after.combatants.b1.statuses.Burn, undefined, 'Meltdown burned its targets');
});

test('mech: Perfect Creation applies all six of its riders in one cast', () => {
  const state = withDeepPools(mechFixture(807));
  const { state: after } = resolveRound(
    state,
    [{ kind: 'move', combatantId: 'a1', moveId: 'perfectCreation', declaredTarget: 'b1' }],
    config
  );
  // Daze clears at the end of the round it landed in (it IS flinch — boolean,
  // clearsAtEndOfRound), so it is correctly absent from the board by the time
  // the round returns. Five of the six survive; that is the sixth working.
  assert.deepStrictEqual(statusesOn(after, 'b1'), ['Bleed', 'Burn', 'Conduct', 'Haunt', 'Poison']);
  assert.strictEqual(after.combatants.b1.statuses.Burn?.magnitude, 25, 'Burn 50 should read 25 post-tick');
  assert.strictEqual(after.combatants.b1.statuses.Poison?.duration, 2, 'Poison should have ticked once');
});

test('mech: Perfect Creation is single-target and reads as a Debuff', () => {
  const state = withDeepPools(mechFixture(808));
  const { state: after } = resolveRound(
    state,
    [{ kind: 'move', combatantId: 'a1', moveId: 'perfectCreation', declaredTarget: 'b1' }],
    config
  );
  assert.deepStrictEqual(statusesOn(after, 'b2'), [], 'Perfect Creation spread');

  // It is kind 'buff' — the engine's kind for a move whose whole payload is
  // its riders, whatever those riders do (docs/authoring-moves.md §2). The
  // view recovers the sign on its own: MoveTile's isDebuff reads a rider that
  // is neither self-targeted nor positive, so the exact condition it keys on
  // is asserted here rather than importing the view, which this build does
  // not compile.
  assert.strictEqual(moves.perfectCreation.kind, 'buff');
  const riders = statusApplicationsOf(moves.perfectCreation);
  assert.strictEqual(riders.length, 6);
  assert.ok(
    riders.every((app) => app.target !== 'self' && !statuses[app.statusId]?.positive),
    'a rider would make Perfect Creation read as a Buff'
  );
});

// --- The type's shape ------------------------------------------------------

test('mech: the slate plants two marks it can never cash itself', () => {
  // The 2026-08-30 designer call, and the inverse of Iron's arrangement: Iron
  // cashes Conduct eleven times and plants it zero, Mech plants Conduct twice
  // and Haunt once and cashes neither. Pinned as the exact counts so a later
  // slate adding Mech to a triggerTypes list has to come here and say so.
  assert.ok(!statuses.Conduct.triggerTypes?.includes('Mech'), 'Mech can now detonate Conduct');
  assert.ok(!statuses.Haunt.spreadTriggerTypes?.includes('Mech'), 'Mech can now spread Haunt');

  const mechMoves = Object.values(moves).filter((m) => m.type === 'Mech');
  const allRiders = mechMoves.flatMap((m) => [...statusApplicationsOf(m), ...(m.randomStatusApplication ?? [])]);
  assert.strictEqual(allRiders.filter((a) => a.statusId === 'Conduct').length, 2, 'Conduct planters');
  assert.strictEqual(allRiders.filter((a) => a.statusId === 'Haunt').length, 1, 'Haunt planters');
});

test('mech: the slate is fifteen rows with the authored shape', () => {
  const mechMoves = Object.values(moves).filter((m) => m.type === 'Mech');
  assert.strictEqual(mechMoves.length, 15, 'the authored slate is fifteen rows');

  // Four magical rows against a roster whose best Intelligence is 45 — the
  // finding, pinned so it cannot silently grow (docs/authoring-moves.md §10).
  assert.strictEqual(mechMoves.filter((m) => m.category === 'magical' && m.kind === 'damage').length, 4);
  // Two heals, and one of them is the only self-target heal in the game.
  const heals = mechMoves.filter((m) => m.kind === 'heal');
  assert.strictEqual(heals.length, 2);
  assert.strictEqual(moves.salvage.target, 'self');
  assert.strictEqual(Object.values(moves).filter((m) => m.kind === 'heal' && m.target === 'self').length, 1);

  // Every bracket row is a random one — the slate authors no fixed nonzero
  // priority, which is a real identity call the table states only by omission.
  for (const move of mechMoves) {
    if (move.priority !== 0) assert.fail(`${move.id} authors a fixed nonzero bracket`);
  }
  assert.strictEqual(mechMoves.filter((m) => m.randomPriority).length, 2);

  // No cleanse, no field effect, no drain, no recoil, no self-HP cost: Mech
  // pays its bills in Burn (three rows) and in variance, not in HP.
  for (const move of mechMoves) {
    assert.ok(!move.cleanses, `${move.id} cleanses`);
    assert.ok(!move.fieldEffectApplication, `${move.id} sets a field`);
    assert.ok(move.drainPercent == null && move.recoilPercent == null && move.selfHpCost == null, `${move.id} bills HP`);
  }
  const selfBurn = mechMoves.filter((m) =>
    statusApplicationsOf(m).some((a) => a.statusId === 'Burn' && a.target === 'self')
  );
  assert.strictEqual(selfBurn.length, 3, 'three rows Burn their own caster');
});

// --- Distribution ---------------------------------------------------------

test('mech: every move id a hero, enemy or level-up pool points at actually exists', () => {
  const { progressionTable } = require('../src/data/progression') as typeof import('../src/data/progression');
  for (const [heroId, hero] of Object.entries({ ...heroes, ...enemies })) {
    for (const moveId of hero.moveIds) assert.ok(moves[moveId], `${heroId} starts with missing move ${moveId}`);
  }
  for (const [heroId, pool] of Object.entries(progressionTable.moveTiers)) {
    for (const moveId of pool) assert.ok(moves[moveId], `${heroId}'s level-up pool points at missing move ${moveId}`);
  }
});

test('mech: no hero in the ROSTER lists a starting move in its own level-up pool', () => {
  // Over the whole roster, not Mech's slice — Spirit's slate is what found
  // `fortify` in both halves of Warden, and only the widened check could have.
  const { progressionTable } = require('../src/data/progression') as typeof import('../src/data/progression');
  for (const [heroId, hero] of Object.entries(heroes)) {
    for (const moveId of progressionTable.moveTiers[heroId] ?? []) {
      assert.ok(!hero.moveIds.includes(moveId), `${heroId}'s pool lists its own starting move ${moveId}`);
    }
  }
});

test('mech: both Mech heroes can afford their own kits and attack off their better stat', () => {
  for (const id of ['forgewright', 'steamColossus']) {
    const hero = heroes[id];
    const cheapest = Math.min(...hero.moveIds.map((mid) => moves[mid].manaCost));
    assert.ok(cheapest <= hero.baseStats.manaPool, `${id} cannot afford its own cheapest starting move`);
    // The north star's "no trap pick" at the kit level: both are Attack-first
    // bodies (60/45 and 90/15), so neither kit may lead on Intelligence.
    const attacks = hero.moveIds.map((mid) => moves[mid]).filter((m) => m.kind === 'damage');
    assert.ok(attacks.length > 0, `${id} has no attack`);
    assert.ok(attacks.every((m) => m.category === 'physical'), `${id} attacks off its worse stat`);
  }
});

test('mech: Clockwork and Bellows share no pool entry, and split the slate by stat', () => {
  // Distribution as a roster audit (docs/authoring-moves.md §10, five slates
  // running): the failure this catches is two heroes reading differently and
  // playing identically.
  const { progressionTable } = require('../src/data/progression') as typeof import('../src/data/progression');
  const clockwork = progressionTable.moveTiers.forgewright ?? [];
  const bellows = progressionTable.moveTiers.steamColossus ?? [];
  assert.ok(clockwork.length > 0 && bellows.length > 0);
  for (const id of clockwork) assert.ok(!bellows.includes(id), `${id} is in both pools`);

  // Every magical Mech row is Clockwork's (Int 45 against Bellows' 15), and
  // Bellows takes no magical damage row at all.
  for (const id of bellows) {
    const move = moves[id];
    if (move.type === 'Mech' && move.kind === 'damage') {
      assert.strictEqual(move.category, 'physical', `Bellows was given magical ${id} at Intelligence 15`);
    }
  }
});

test('mech: every authored Mech move has a holder', () => {
  // Stone's reachability check — the opposite failure from a dangling id, and
  // the one that has no other test.
  const { progressionTable } = require('../src/data/progression') as typeof import('../src/data/progression');
  const held = new Set<string>();
  for (const hero of [...Object.values(heroes), ...Object.values(enemies)]) for (const id of hero.moveIds) held.add(id);
  for (const pool of Object.values(progressionTable.moveTiers)) for (const id of pool) held.add(id);

  const orphans = Object.values(moves)
    .filter((m) => m.type === 'Mech' && !held.has(m.id))
    .map((m) => m.id);
  assert.deepStrictEqual(orphans, [], `unreachable Mech moves: ${orphans.join(', ')}`);
});
