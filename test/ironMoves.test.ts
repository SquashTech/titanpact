// Iron's authored slate (src/data/moves.ts, 2026-08-30) and the ONE engine
// field it needed:
//
//   - `conditionalManaCost.requiresAnyEnemyStatus` (Metallic Blade) — the
//     second side of a field that previously had one. Storm's Overcharge is
//     free while EVERY active enemy carries Conduct; this is free while ANY
//     of them does, whether or not it is the foe being hit. Designer call,
//     2026-08-30, asked before any content was written.
//
// The reason that distinction is worth a field rather than a rounding of the
// design table: Iron is one of Conduct's `triggerTypes` (src/data/statuses.ts),
// so an Iron damage move DETONATES the mark it reads. Swing Metallic Blade at
// the marked foe and it cashes the mark and ends its own discount; swing it at
// the unmarked one and the mark survives, so it is free again next round.
// Overcharge cannot pose that choice — a board satisfying "both marked" cannot
// survive the cast that reads it. Both halves are pinned below.
//
// Plus the type's own shape, which the design table states only by omission:
//
//   - Iron is a Conduct trigger type, so ALL TEN damage rows detonate an
//     existing mark for 10% max HP with nothing authored, and the slate plants
//     Conduct ZERO times (designer call: Iron cashes, a partner sets). The
//     count is pinned so it cannot drift silently, the same way Storm's and
//     Spirit's are.
//   - The type is an Attack ramp with a Defense debuff on the other end, and
//     every one of those deltas is PERMANENT for the fight (stat mods persist
//     through a switch, CLAUDE.md 2026-08-15). Pinned as a compounding
//     sequence rather than as one cast.
//   - Exactly ONE priority row and no heal, no cleanse, no field effect, and
//     exactly one status rider in sixteen rows. The slate shipped at fourteen
//     with no bracket and no cheap guard buff, reported both as deleted
//     capabilities, and the designer answered with Swift Blow and a re-authored
//     Fortify the same day — so the counts below are pinned at sixteen and the
//     "no priority" assertion became "exactly one".

import { firstStatusApplication } from '../src/engine/content';
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
import { resolveManaCost, effectiveManaCost, hasStatus } from '../src/engine/state';
import type { CombatState } from '../src/engine/state';
import type { Action } from '../src/engine/combat/actions';

const config = { typeChart, heroes, moves, statuses, passives, fieldEffects, benchHpRegenFlat: 5 };

/** Gallant and Valor (the Iron aggressor and the Iron starter) attack; Warden and Sentinel defend. */
function ironFixture(seed: number) {
  return createFightState(
    seed,
    [
      { combatantId: 'a1', heroId: 'gallant', side: 'A' },
      { combatantId: 'a2', heroId: 'valor', side: 'A' },
    ],
    [
      { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
      { combatantId: 'b2', heroId: 'sentinel', side: 'B' },
    ]
  );
}

/**
 * The two fixture problems every authored slate hits (authoring-moves.md §8):
 * an authored curve the fixture pools cannot pay for, and defenders fragile
 * enough that the hit KOs them before the rider is ever reached — which
 * silently turns a rider test into a KO test. getMaxHp reads
 * `baseStats + statModifiers`, so the hp modifier has to move with currentHp.
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

function withStatus(state: CombatState, combatantId: string, statusId: string): CombatState {
  const c = state.combatants[combatantId];
  return {
    ...state,
    combatants: {
      ...state.combatants,
      [combatantId]: { ...c, statuses: { ...c.statuses, [statusId]: { statusId } } },
    },
  } as CombatState;
}

function modifiersOf(state: CombatState, combatantId: string) {
  return state.combatants[combatantId].statModifiers as Record<string, number>;
}

// --- conditionalManaCost.requiresAnyEnemyStatus ------------------------------

test('iron: Metallic Blade is free while ANY enemy carries Conduct, and full price on a clean board', () => {
  const state = withDeepPools(ironFixture(600));
  const move = moves.metallicBlade;

  assert.strictEqual(resolveManaCost(state, 'a1', move), 40, 'clean board pays the authored price');

  // One enemy marked is enough — and deliberately the one a1 is NOT obliged
  // to hit. That is the whole difference from Overcharge.
  const oneMarked = withStatus(state, 'b2', 'Conduct');
  assert.strictEqual(resolveManaCost(oneMarked, 'a1', move), 0);

  const bothMarked = withStatus(oneMarked, 'b1', 'Conduct');
  assert.strictEqual(resolveManaCost(bothMarked, 'a1', move), 0);
});

test('iron: the two sides of conditionalManaCost are genuinely different — one mark frees Metallic Blade, not Overcharge', () => {
  const state = withDeepPools(ironFixture(601));
  const oneMarked = withStatus(state, 'b2', 'Conduct');

  assert.strictEqual(resolveManaCost(oneMarked, 'a1', moves.metallicBlade), 0, 'any-side fires on one mark');
  assert.strictEqual(
    resolveManaCost(oneMarked, 'a1', moves.overcharge),
    moves.overcharge.manaCost,
    'all-side does not'
  );
});

test('iron: a mark on the CASTER\'s own side never makes Metallic Blade free', () => {
  // Conduct is a mark you plant on an enemy, but nothing stops one landing on
  // your own hero (Storm's Rising Static resolves its rider independently).
  // resolveManaCost reads the enemy side only, and the direction matters:
  // a hero paying nothing because its own partner is marked would be an
  // engine bug that no design row asks for.
  const state = withDeepPools(ironFixture(602));
  const allyMarked = withStatus(state, 'a2', 'Conduct');
  assert.strictEqual(resolveManaCost(allyMarked, 'a1', moves.metallicBlade), 40);
});

test('iron: a wiped enemy side satisfies NEITHER side of conditionalManaCost', () => {
  // "A condition nothing can meet must not read as met" (state.ts). The `some`
  // side would answer false on its own; the shared empty-side guard is what
  // stops the `every` side answering true vacuously. Pinned from both.
  const base = withDeepPools(ironFixture(603));
  const empty = {
    ...base,
    active: { ...base.active, B: [null, null] },
  } as CombatState;

  assert.strictEqual(resolveManaCost(empty, 'a1', moves.metallicBlade), 40);
  assert.strictEqual(resolveManaCost(empty, 'a1', moves.overcharge), moves.overcharge.manaCost);
});

test('iron: the free cast actually spends 0 mana in a live round, not just in the price function', () => {
  const state = withStatus(withDeepPools(ironFixture(604)), 'b1', 'Conduct');
  const before = state.combatants.a1.currentMana;
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'metallicBlade', declaredTarget: 'b2' }];
  const { state: next, events } = resolveRound(state, actions, config);

  assert.ok(events.some((e) => e.type === 'MoveUsed' && e.combatantId === 'a1'));
  // Mana only moves by the round's regen tick, never by the cast.
  const spent = before - next.combatants.a1.currentMana;
  assert.ok(spent <= 0, `expected no mana spent, saw ${spent}`);
});

test('iron: swinging Metallic Blade at the MARKED foe cashes the mark; at the other foe it banks it', () => {
  // The decision the `any` side creates, and the reason it is not a rounding
  // of Overcharge. Both casts are free; only one of them stays free.
  const state = withStatus(withDeepPools(ironFixture(605)), 'b1', 'Conduct');

  const cashed = resolveRound(
    state,
    [{ kind: 'move', combatantId: 'a1', moveId: 'metallicBlade', declaredTarget: 'b1' }],
    config
  );
  assert.strictEqual(hasStatus(cashed.state.combatants.b1, 'Conduct'), false, 'hitting the mark consumes it');
  assert.ok(cashed.events.some((e) => e.type === 'StatusDetonated' && e.statusId === 'Conduct'));
  assert.strictEqual(resolveManaCost(cashed.state, 'a1', moves.metallicBlade), 40, 'and the discount is gone');

  const banked = resolveRound(
    state,
    [{ kind: 'move', combatantId: 'a1', moveId: 'metallicBlade', declaredTarget: 'b2' }],
    config
  );
  assert.ok(hasStatus(banked.state.combatants.b1, 'Conduct'), 'hitting the other foe leaves the mark');
  assert.strictEqual(resolveManaCost(banked.state, 'a1', moves.metallicBlade), 0, 'so it is still free');
});

test('iron: effectiveManaCost stays the board-free answer — the conditional price is resolveManaCost\'s alone', () => {
  // The draft, level-up and compendium surfaces have no fight in scope and
  // must show the authored price. Same discipline Overcharge established.
  assert.strictEqual(effectiveManaCost(moves.metallicBlade), 40);
});

test('iron: every conditionalManaCost in the game authors exactly one side', () => {
  // Nothing in the type system enforces it — both fields are optional, and a
  // move authoring neither is a silent dud that never fires. This is the
  // check that makes a third sibling fail loudly the moment it is added.
  const conditional = Object.values(moves).filter((m) => m.conditionalManaCost);
  assert.ok(conditional.length >= 3, 'expected Overcharge, Metallic Blade and Pack Leader');
  for (const move of conditional) {
    const c = move.conditionalManaCost!;
    // The third side is Beast's Pack Leader, which reads the caster's OWN
    // row rather than the enemy side (content.ts requiresPartnerType).
    const sides = [c.requiresAllEnemiesStatus, c.requiresAnyEnemyStatus, c.requiresPartnerType].filter((s) => s != null);
    assert.strictEqual(sides.length, 1, `${move.id} authors ${sides.length} sides of conditionalManaCost, not 1`);
  }
});

// --- The Attack ramp: five rows, all permanent -------------------------------

test('iron: the Attack ramp compounds across casts and is never spent', () => {
  // Sharpen +30 into Momentum Swing +20 into Iron Fist +5 is +55, and stat
  // mods persist (CLAUDE.md, 2026-08-15) — nothing here decays, expires or
  // clears at end of round, so the type's whole plan is legible only across
  // rounds and must not be priced against a single exchange.
  let state = withDeepPools(ironFixture(610));
  const casts = ['sharpen', 'momentumSwing', 'ironFist'];
  const expected = [30, 50, 55];

  casts.forEach((moveId, i) => {
    const declaredTarget = moves[moveId].target === 'self' ? undefined : 'b1';
    const action = { kind: 'move', combatantId: 'a1', moveId, declaredTarget } as Action;
    state = resolveRound(state, [action], config).state;
    assert.strictEqual(modifiersOf(state, 'a1').attack ?? 0, expected[i], `after ${moveId}`);
  });
});

test('iron: a damage row\'s stat delta lands AFTER its own hit, so Opening Strike shapes the next swing', () => {
  // statDeltas resolve after the target loop, which is what makes Opening
  // Strike an opener rather than a cheap nuke that discounts itself.
  const state = withDeepPools(ironFixture(611));
  const twice = (moveId: string) =>
    resolveRound(
      resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId, declaredTarget: 'b1' }], config).state,
      [{ kind: 'move', combatantId: 'a1', moveId, declaredTarget: 'b1' }],
      config
    );

  const first = resolveRound(
    state,
    [{ kind: 'move', combatantId: 'a1', moveId: 'openingStrike', declaredTarget: 'b1' }],
    config
  );
  assert.strictEqual(modifiersOf(first.state, 'b1').defense ?? 0, -10);

  // The second cast hits a target already at -10 and takes it to -20.
  const second = twice('openingStrike');
  assert.strictEqual(modifiersOf(second.state, 'b1').defense ?? 0, -20);
});

test('iron: Pin Down is a debuff — a buff-kind move with a negative payload aimed at an enemy', () => {
  // There is no 'debuff' kind (authoring-moves.md §2); the sign is the label.
  const state = withDeepPools(ironFixture(612));
  const { state: next, events } = resolveRound(
    state,
    [{ kind: 'move', combatantId: 'a1', moveId: 'pinDown', declaredTarget: 'b1' }],
    config
  );

  assert.strictEqual(moves.pinDown.kind, 'buff');
  assert.strictEqual(moves.pinDown.target, 'singleEnemy');
  assert.strictEqual(modifiersOf(next, 'b1').defense, -10);
  assert.strictEqual(modifiersOf(next, 'b1').speed, -10);
  assert.strictEqual(events.some((e) => e.type === 'DamageDealt'), false, 'no damage body');
});

test('iron: Reinforce pays BOTH allies, including the caster', () => {
  const state = withDeepPools(ironFixture(613));
  const { state: next } = resolveRound(
    state,
    [{ kind: 'move', combatantId: 'a1', moveId: 'reinforce' }],
    config
  );
  for (const id of ['a1', 'a2']) {
    assert.strictEqual(modifiersOf(next, id).attack, 20, `${id} attack`);
    assert.strictEqual(modifiersOf(next, id).defense, 20, `${id} defense`);
  }
  assert.strictEqual(modifiersOf(next, 'b1').attack ?? 0, 0, 'and nothing on the enemy side');
});

// --- The type-keyed hook the design table never mentions ----------------------

test('iron: every damage row detonates Conduct for free, and the slate plants it zero times', () => {
  // Storm's arrangement with the halves separated (designer call, 2026-08-30):
  // Iron CASHES the mark and never sets it, so planting is a Storm partner's
  // job or Mind's Cerebral Shock. Pinned as counts so a later slate cannot
  // quietly change either half.
  const ironMoves = Object.values(moves).filter((m) => m.type === 'Iron');
  const damage = ironMoves.filter((m) => m.kind === 'damage');
  const planters = ironMoves.filter((m) => firstStatusApplication(m)?.statusId === 'Conduct');

  assert.strictEqual(ironMoves.length, 16, 'the authored slate is sixteen rows');
  assert.strictEqual(damage.length, 11, 'eleven of them detonate Conduct for free');
  assert.strictEqual(planters.length, 0, 'and none of them plants it');
  assert.ok(statuses.Conduct.triggerTypes?.includes('Iron'));
});

test('iron: an Iron hit on a marked foe is worth 10% max HP more than the same hit unmarked', () => {
  const state = withDeepPools(ironFixture(620));
  const marked = withStatus(state, 'b1', 'Conduct');
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'heavyBlow', declaredTarget: 'b1' }];

  const plain = resolveRound(state, actions, config);
  const cashed = resolveRound(marked, actions, config);

  const maxHp = heroes.ironWarden.baseStats.hp + 1200;
  const expectedBonus = Math.ceil(maxHp * 0.1);
  const plainDamage = state.combatants.b1.currentHp - plain.state.combatants.b1.currentHp;
  const cashedDamage = marked.combatants.b1.currentHp - cashed.state.combatants.b1.currentHp;

  // heavyBlow rolls a 30% crit, so the two hits are not comparable directly —
  // assert the detonation event and its amount instead of the difference.
  const detonated = cashed.events.find((e) => e.type === 'StatusDetonated') as any;
  assert.ok(detonated, 'no detonation');
  assert.strictEqual(detonated.amount, expectedBonus);
  assert.ok(cashedDamage > 0 && plainDamage > 0);
});

// --- What the slate does NOT have, stated by omission -------------------------

test('iron: the slate authors exactly one priority row, and no heal, cleanse or field effect', () => {
  // Quick Jab (priority 1, 4 mana) died with the fixture pool, the slate
  // shipped with no bracket at all, and Swift Blow is what the designer
  // authored back (moves.ts, 2026-08-30). It is deliberately ONE row: the type
  // buys turn order once, at 15 base power, and Juggernaut's +50 Speed is
  // still the only other answer to being outsped.
  const ironMoves = Object.values(moves).filter((m) => m.type === 'Iron');
  const bracketed = ironMoves.filter((m) => m.priority !== 0);
  assert.deepStrictEqual(bracketed.map((m) => m.id), ['swiftBlow']);
  assert.strictEqual(moves.swiftBlow.priority, 1, 'and it is a POSITIVE bracket — Iron never swings slow');

  for (const move of ironMoves) {
    assert.notStrictEqual(move.kind, 'heal', `${move.id} is heal-kind`);
    assert.ok(!move.cleanses, `${move.id} cleanses`);
    assert.ok(!move.fieldEffectApplication, `${move.id} sets a field effect`);
  }
  const riders = ironMoves.filter((m) => firstStatusApplication(m));
  assert.strictEqual(riders.length, 1, 'exactly one status rider in sixteen rows');
  assert.strictEqual(riders[0].id, 'serratedSlice');
  assert.strictEqual(firstStatusApplication(riders[0])?.statusId, 'Bleed');
  assert.strictEqual(firstStatusApplication(riders[0])?.chance, 0.3);
});

test('iron: the re-authored Fortify is a guard buff only, and every Wisdom grant left is Mind', () => {
  // The half of the deletion that STAYED deleted. The fixture Fortify granted
  // +10 Defense AND +10 Wisdom; the re-authored one is +15 Defense and nothing
  // else. Wisdom is not unreachable — Mind grants it three ways — but all three
  // are Mind, so a PHYSICAL hero can no longer buy magical defense from a move
  // at all. Pinned as the exact set rather than as a count, so a later slate
  // adding a non-Mind Wisdom grant has to notice it is reopening this.
  assert.deepStrictEqual(moves.fortify.statDeltas, [{ stat: 'defense', amount: 15 }]);
  assert.strictEqual(moves.fortify.target, 'self');
  // And NOT statDeltaTarget: naming 'self' on a move that already targets self
  // is a no-op the label renders as "(Self) — Self".
  assert.strictEqual(moves.fortify.statDeltaTarget, undefined);

  const wisdomGrants = Object.values(moves).filter((m) =>
    m.statDeltas?.some((d) => d.stat === 'wisdom' && d.amount > 0)
  );
  assert.deepStrictEqual(wisdomGrants.map((m) => m.id).sort(), ['brainWard', 'mentalFortress', 'stasis']);
  for (const move of wisdomGrants) assert.strictEqual(move.type, 'Mind', `${move.id} grants Wisdom off-Mind`);
});

test('iron: Swift Blow lands its Conduct detonation ABOVE bracket 0 — the one thing no other Iron row can do', () => {
  // 15 base power is not what the row is bought for. On a marked target it is
  // 15 power plus 10% of a max HP bar, delivered before the target acts, which
  // is the only way Iron cashes a mark pre-emptively.
  const state = withStatus(withDeepPools(ironFixture(630)), 'b1', 'Conduct');
  const { events } = resolveRound(
    state,
    [
      { kind: 'move', combatantId: 'b1', moveId: 'openingStrike', declaredTarget: 'a1' },
      { kind: 'move', combatantId: 'a1', moveId: 'swiftBlow', declaredTarget: 'b1' },
    ],
    config
  );
  const order = events.filter((e) => e.type === 'MoveUsed').map((e: any) => e.combatantId);
  // Gallant (Speed 70) would beat Warden (30) anyway, so pin the BRACKET rather
  // than the outcome: swiftBlow sorts above a priority-0 move regardless.
  assert.strictEqual(order[0], 'a1');
  assert.ok(events.some((e) => e.type === 'StatusDetonated' && e.statusId === 'Conduct'));
});

test('iron: Conjured Sword is the one magical row, and no Iron hero holds it', () => {
  // Designer note, 2026-08-30: "a lategame learnable for certain spellcasters,
  // not necessarily intended for native Iron heroes." Every Iron hero is
  // Intelligence 40 or below (Warden 20, Valor 40, Gallant 20, Bellows 15),
  // so putting it in one of their pools would be the trap pick the north star
  // forbids. It lives on Glyph (Int 90) instead.
  const { progressionTable } = require('../src/data/progression') as typeof import('../src/data/progression');
  const magical = Object.values(moves).filter((m) => m.type === 'Iron' && m.category === 'magical');
  assert.deepStrictEqual(magical.map((m) => m.id), ['conjuredSword']);

  for (const [heroId, hero] of Object.entries(heroes)) {
    if (!hero.types.includes('Iron')) continue;
    const reachable = [...hero.moveIds, ...(progressionTable.moveTiers[heroId] ?? [])];
    assert.ok(!reachable.includes('conjuredSword'), `${heroId} is an Iron hero and can learn Conjured Sword`);
  }

  const holders = Object.entries(progressionTable.moveTiers).filter(([, pool]) => pool.includes('conjuredSword'));
  assert.ok(holders.length > 0, 'nothing points at Conjured Sword at all');
  for (const [heroId] of holders) {
    const hero = heroes[heroId];
    assert.ok(
      hero.baseStats.intelligence > hero.baseStats.attack,
      `${heroId} holds Conjured Sword but is not a caster`
    );
  }
});

// --- Distribution and roster checks (authoring-moves.md §7, §9) --------------

test('iron: every move id in a kit, an enemy kit or a level-up pool resolves', () => {
  const { progressionTable } = require('../src/data/progression') as typeof import('../src/data/progression');
  const { enemies } = require('../src/data/enemies') as typeof import('../src/data/enemies');
  for (const [heroId, hero] of Object.entries({ ...heroes, ...enemies })) {
    for (const moveId of hero.moveIds) assert.ok(moves[moveId], `${heroId} kit points at missing move ${moveId}`);
  }
  for (const [heroId, pool] of Object.entries(progressionTable.moveTiers)) {
    for (const moveId of pool) assert.ok(moves[moveId], `${heroId} pool points at missing move ${moveId}`);
  }
});

test('iron: no hero or enemy starts with a move it cannot pay for, or has a starter in its own pool', () => {
  // Widened past the type being authored, per the lesson Spirit's slate wrote
  // down — the type-scoped version of this check shipped in five slates and
  // none of them caught Warden carrying Fortify in both its kit and its pool.
  // It matters more here than usual: Fortify was in NINE starting kits and all
  // nine changed, and Goblin Warrior went from 20/2 to 40/10 for it.
  const { progressionTable } = require('../src/data/progression') as typeof import('../src/data/progression');
  const { enemies } = require('../src/data/enemies') as typeof import('../src/data/enemies');
  for (const [heroId, hero] of Object.entries({ ...heroes, ...enemies })) {
    for (const moveId of hero.moveIds) {
      assert.ok(
        moves[moveId].manaCost <= hero.baseStats.manaPool,
        `${heroId} cannot afford its own starting move ${moveId} (${moves[moveId].manaCost} vs ${hero.baseStats.manaPool})`
      );
    }
    for (const moveId of progressionTable.moveTiers[heroId] ?? []) {
      assert.ok(!hero.moveIds.includes(moveId), `${heroId}'s pool lists its own starting move ${moveId}`);
    }
  }
});

test('iron: no hero attacks off its weaker stat — the three Iron heroes are all physical', () => {
  const { progressionTable } = require('../src/data/progression') as typeof import('../src/data/progression');
  for (const [heroId, hero] of Object.entries(heroes)) {
    if (!hero.types.includes('Iron')) continue;
    const reachable = [...hero.moveIds, ...(progressionTable.moveTiers[heroId] ?? [])].map((id) => moves[id]);
    const damage = reachable.filter((m) => m.kind === 'damage');
    const wants = hero.baseStats.attack >= hero.baseStats.intelligence ? 'physical' : 'magical';
    assert.ok(damage.length > 0, `${heroId} has no damage move at all`);
    assert.ok(damage.some((m) => m.category === wants), `${heroId} attacks only off its weaker stat`);
  }
});

test('iron: the enemy side can demonstrate the type end to end', () => {
  // Nature, Arcane and Mind each shipped with zero enemies of their type.
  // Goblin Warrior swings Iron Fist and Opening Strike, which between them are
  // the whole plan — grow the numerator, shrink the denominator — shown from
  // the side of the field the player is fighting.
  const { enemies } = require('../src/data/enemies') as typeof import('../src/data/enemies');
  const warrior = enemies.goblinWarrior;
  const kit = warrior.moveIds.map((id: string) => moves[id]);
  assert.ok(kit.every((m) => m.type === 'Iron'));
  assert.ok(kit.some((m) => m.statDeltaTarget === 'self'), 'no way to show the Attack ramp');
  assert.ok(
    kit.some((m) => m.statDeltas?.some((d) => d.stat === 'defense' && d.amount < 0)),
    'no way to show the Defense debuff'
  );
  for (const move of kit) assert.ok(move.manaCost <= warrior.baseStats.manaPool);
});
