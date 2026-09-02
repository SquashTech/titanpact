// Stone's authored movepool: offStatOverride, retributionPercent, recoilPercent, statDeltaTarget, Provoke. Mechanics, not numbers.

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
import { applyStatus, selectableTargets } from '../src/engine/combat/statusEngine';
import { calcDamage, resolveStatRatio, statKeysForMove } from '../src/engine/damage/damagePipeline';
import type { CombatState } from '../src/engine/state';
import { getEffectiveStat, hasStatus } from '../src/engine/state';

const config = { typeChart, heroes, moves, statuses, passives, fieldEffects, benchHpRegenFlat: 5 };

/** Crag (Atk 90, the bruiser) and Sentinel (Def 100, the wall the Defense line is built for) attack; wildOracle/ironWarden defend. */
function stoneFixture(seed: number) {
  return createFightState(
    seed,
    [
      { combatantId: 'a1', heroId: 'crag', side: 'A' },
      { combatantId: 'a2', heroId: 'sentinel', side: 'A' },
      { combatantId: 'a3', heroId: 'tempest', side: 'A' },
    ],
    [
      { combatantId: 'b1', heroId: 'wildOracle', side: 'B' },
      { combatantId: 'b2', heroId: 'ironWarden', side: 'B' },
    ]
  );
}

/** Deep mana and HP so no test is gated on the mana curve or turned into a KO test; the hp modifier moves with currentHp because getMaxHp reads both. */
function withDeepPools(state: CombatState): CombatState {
  const combatants = Object.fromEntries(
    Object.entries(state.combatants).map(([id, c]) => [
      id,
      {
        ...c,
        currentMana: 999,
        currentHp: 1200,
        statModifiers: { ...c.statModifiers, manaPool: 999, hp: 1200 },
      },
    ])
  );
  return { ...state, combatants } as CombatState;
}

function withBanked(state: CombatState, combatantId: string, amount: number): CombatState {
  return {
    ...state,
    combatants: {
      ...state.combatants,
      [combatantId]: { ...state.combatants[combatantId], damageTakenSinceLastTurn: amount },
    },
  };
}

// --- offStatOverride ---

test('stone: Body Blow reads the caster Defense in place of Attack, on the RATIO', () => {
  const state = withDeepPools(stoneFixture(101));
  const sentinel = state.combatants.a2;
  const defender = state.combatants.b1;
  const attackerHero = heroes[sentinel.heroId];
  const defenderHero = heroes[defender.heroId];

  const swapped = resolveStatRatio('physical', attackerHero, sentinel, defenderHero, defender, undefined, 'defense');
  const normal = resolveStatRatio('physical', attackerHero, sentinel, defenderHero, defender);

  const atk = getEffectiveStat(attackerHero, sentinel, 'attack');
  const def = getEffectiveStat(attackerHero, sentinel, 'defense');
  const targetDef = getEffectiveStat(defenderHero, defender, 'defense');

  assert.strictEqual(swapped, def / targetDef, 'the numerator is the caster Defense');
  assert.strictEqual(normal, atk / targetDef, 'and the un-overridden call is unchanged');
  assert.notStrictEqual(swapped, normal, 'Sentinel is exactly the hero this swap exists for');
});

test('stone: the Defense swap does NOT leak into the multiplier term', () => {
  const result = calcDamage(moves.bodyBlow, 2, ['Stone'], ['Nature'], typeChart, 1, false);
  assert.strictEqual(result.multiplierTerm, 1, 'no modifiers authored, so the term stays 1');
  assert.strictEqual(result.basePowerMultiplier, 1, 'and it is not a BasePower-stage term either');
  assert.strictEqual(result.basePowerBonus, 0);
});

test('stone: only the numerator moves — the defender still defends with the category stat', () => {
  const [offKey, defKey] = statKeysForMove(moves.bodyCrush);
  assert.strictEqual(offKey, 'defense', 'the caster hits with Defense');
  assert.strictEqual(defKey, 'defense', 'and the target still blocks with Defense, as any physical move');

  const [plainOff, plainDef] = statKeysForMove(moves.faultLine);
  assert.strictEqual(plainOff, 'attack', 'a move authoring no override is untouched');
  assert.strictEqual(plainDef, 'defense');
});

test('stone: the DamageDealt event reports the stat actually read, so the log math multiplies out', () => {
  const state = withDeepPools(stoneFixture(102));
  const after = resolveRound(state, [{ kind: 'move', combatantId: 'a2', moveId: 'bodyBlow', declaredTarget: 'b1' }], config);
  const hit = after.events.find((e) => e.type === 'DamageDealt') as any;

  const sentinel = state.combatants.a2;
  assert.strictEqual(hit.offStat, getEffectiveStat(heroes[sentinel.heroId], sentinel, 'defense'));
  assert.notStrictEqual(hit.offStat, getEffectiveStat(heroes[sentinel.heroId], sentinel, 'attack'));
});

test('stone: Bastion into Body Crush is the type engine — the buff raises the hit', () => {
  const base = withDeepPools(stoneFixture(103));
  const buffed = {
    ...base,
    combatants: { ...base.combatants, a2: { ...base.combatants.a2, statModifiers: { ...base.combatants.a2.statModifiers, defense: 30 } } },
  } as CombatState;

  const plainHit = resolveRound(base, [{ kind: 'move', combatantId: 'a2', moveId: 'bodyCrush', declaredTarget: 'b1' }], config).events.find(
    (e) => e.type === 'DamageDealt'
  ) as any;
  const buffedHit = resolveRound(buffed, [{ kind: 'move', combatantId: 'a2', moveId: 'bodyCrush', declaredTarget: 'b1' }], config).events.find(
    (e) => e.type === 'DamageDealt'
  ) as any;

  assert.ok(buffedHit.offStat > plainHit.offStat, 'Bastion +30 Defense shows up as offense');
  assert.ok(buffedHit.amount > plainHit.amount, 'and the hit is bigger — same seed, same variance roll');
});

// --- retributionPercent ---

test('stone: Retribution deals a flat share of what the user absorbed, with no formula applied', () => {
  const state = withBanked(withDeepPools(stoneFixture(201)), 'a1', 80);
  const after = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'retribution', declaredTarget: 'b1' }], config);
  const hit = after.events.find((e) => e.type === 'DamageDealt') as any;

  assert.strictEqual(hit.amount, 40, 'exactly 50% of the 80 banked');
  assert.strictEqual(hit.stab, 1, 'no STAB, even though Crag is a Stone hero casting a Stone move');
  assert.strictEqual(hit.typeMult, 1, 'no type chart');
  assert.strictEqual(hit.variance, 1, 'no variance');
  assert.strictEqual(hit.isCrit, false);
  assert.strictEqual(hit.ratio, 1, 'no off/def ratio');
  assert.deepStrictEqual(hit.retribution, { damageTaken: 80, percent: 0.5 }, 'the derivation rides on the event for the Battle Log');
});

test('stone: Stoneheart returns the whole figure', () => {
  const state = withBanked(withDeepPools(stoneFixture(202)), 'a1', 63);
  const after = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'stoneheart', declaredTarget: 'b1' }], config);
  const hit = after.events.find((e) => e.type === 'DamageDealt') as any;
  assert.strictEqual(hit.amount, 63);
});

test('stone: a retribution move draws NO rng', () => {
  const state = withBanked(withDeepPools(stoneFixture(203)), 'a1', 50);
  const after = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'retribution', declaredTarget: 'b1' }], config);
  assert.deepStrictEqual(after.state.rngState, state.rngState, 'variance and crit were never rolled');
});

test('stone: with nothing banked, a retribution move still presses and still costs its mana', () => {
  const state = withDeepPools(stoneFixture(204));
  const after = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'stoneheart', declaredTarget: 'b1' }], config);

  const blocked = after.events.find((e) => e.type === 'ActionBlocked');
  assert.strictEqual(blocked, undefined, 'not fizzled');
  const hit = after.events.find((e) => e.type === 'DamageDealt') as any;
  assert.strictEqual(hit.amount, 0);
  // Read the spend off the event: regen has already topped the pool back up at the round boundary.
  const used = after.events.find((e) => e.type === 'MoveUsed') as any;
  assert.strictEqual(used.manaSpent, moves.stoneheart.manaCost, 'the mana is spent regardless');
});

// --- damageTakenSinceLastTurn ---

test('stone: damage taken accumulates from every source, at the one choke point', () => {
  const state = withDeepPools(stoneFixture(301));
  const after = resolveRound(state, [{ kind: 'move', combatantId: 'b1', moveId: 'vineLash', declaredTarget: 'a1' }], config);
  const hit = after.events.find((e) => e.type === 'DamageDealt') as any;
  assert.ok(hit.amount > 0);
  assert.strictEqual(after.state.combatants.a1.damageTakenSinceLastTurn, hit.amount);
});

test('stone: taking a turn resets the counter; being blocked does not', () => {
  const banked = withBanked(withDeepPools(stoneFixture(302)), 'a1', 90);

  const acted = resolveRound(banked, [{ kind: 'move', combatantId: 'a1', moveId: 'rockToss', declaredTarget: 'b1' }], config);
  assert.strictEqual(acted.state.combatants.a1.damageTakenSinceLastTurn, 0);

  const rested = resolveRound(banked, [{ kind: 'rest', combatantId: 'a1' }], config);
  assert.strictEqual(rested.state.combatants.a1.damageTakenSinceLastTurn, 0);

  const dazed = applyStatus(banked, 1, 'a1', statuses.Daze, {}).state;
  const stalled = resolveRound(dazed, [{ kind: 'move', combatantId: 'a1', moveId: 'rockToss', declaredTarget: 'b1' }], config);
  assert.ok(
    stalled.events.some((e) => e.type === 'ActionBlocked' && (e as any).reason === 'dazed'),
    'the move was blocked'
  );
  assert.strictEqual(stalled.state.combatants.a1.damageTakenSinceLastTurn, 90, 'a hero that never acted keeps banking');
});

test('stone: the counter is read once, before the payload, so a move cannot bill for its own recoil', () => {
  const state = withBanked(withDeepPools(stoneFixture(303)), 'a1', 40);
  const after = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'retribution', declaredTarget: 'b1' }], config);
  const hit = after.events.find((e) => e.type === 'DamageDealt') as any;
  assert.strictEqual(hit.amount, 20, 'half of the 40 that was standing when the turn began');
});

// --- recoilPercent ---

test('stone: Rubble Rush bills its user a quarter of what it dealt', () => {
  const state = withDeepPools(stoneFixture(401));
  const after = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'rubbleRush', declaredTarget: 'b1' }], config);

  const hits = after.events.filter((e) => e.type === 'DamageDealt') as any[];
  const attack = hits.find((h) => h.targetCombatantId === 'b1');
  const recoil = hits.find((h) => h.targetCombatantId === 'a1');

  assert.ok(attack.amount > 0);
  assert.ok(recoil, 'the recoil is its own event so the log and the beat can name it');
  assert.strictEqual(recoil.amount, Math.round(attack.amount * 0.25));
  assert.deepStrictEqual(recoil.recoil, { damageDealt: attack.amount, percent: 0.25 });
  assert.strictEqual(recoil.sourceCombatantId, 'a1');
  assert.strictEqual(recoil.sourceCombatantId, recoil.targetCombatantId, 'source and target are both the caster');
});

test('stone: recoil scales the HP actually removed, not the rolled amount', () => {
  const state = withDeepPools(stoneFixture(402));
  const nearlyDead = {
    ...state,
    combatants: { ...state.combatants, b1: { ...state.combatants.b1, currentHp: 4 } },
  } as CombatState;

  const after = resolveRound(nearlyDead, [{ kind: 'move', combatantId: 'a1', moveId: 'rubbleRush', declaredTarget: 'b1' }], config);
  const recoil = (after.events.filter((e) => e.type === 'DamageDealt') as any[]).find((h) => h.targetCombatantId === 'a1');
  assert.strictEqual(recoil.recoil.damageDealt, 4, 'only the 4 HP that were actually there');
  assert.strictEqual(recoil.amount, 1);
});

test('stone: recoil can faint the user, with no floor', () => {
  const state = withDeepPools(stoneFixture(403));
  const brittle = {
    ...state,
    combatants: { ...state.combatants, a1: { ...state.combatants.a1, currentHp: 3 } },
  } as CombatState;

  const after = resolveRound(brittle, [{ kind: 'move', combatantId: 'a1', moveId: 'rubbleRush', declaredTarget: 'b1' }], config);
  assert.strictEqual(after.state.combatants.a1.fainted, true);
  assert.ok(
    after.events.some((e) => e.type === 'Fainted' && (e as any).combatantId === 'a1'),
    'and it is a real faint, not a silent HP change'
  );
  assert.strictEqual(after.state.koCount.A, 1);
});

test('stone: the recoil event carries no formula, because none was run', () => {
  const state = withDeepPools(stoneFixture(404));
  const after = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'rubbleRush', declaredTarget: 'b1' }], config);
  const recoil = (after.events.filter((e) => e.type === 'DamageDealt') as any[]).find((h) => h.targetCombatantId === 'a1');
  assert.strictEqual(recoil.stab, 1);
  assert.strictEqual(recoil.typeMult, 1);
  assert.strictEqual(recoil.variance, 1);
  assert.strictEqual(recoil.isCrit, false);
});

// --- statDeltaTarget ---

test('stone: Landslide hits both enemies and buffs both ALLIES', () => {
  const state = withDeepPools(stoneFixture(501));
  const after = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'landslide' }], config);

  const hits = (after.events.filter((e) => e.type === 'DamageDealt') as any[]).map((h) => h.targetCombatantId);
  assert.deepStrictEqual(hits.sort(), ['b1', 'b2'], 'the damage lands on the enemy side');

  const buffs = (after.events.filter((e) => e.type === 'StatChanged') as any[]).map((s) => s.combatantId);
  assert.deepStrictEqual(buffs.sort(), ['a1', 'a2'], 'and the deltas land on the caster side, caster included');

  assert.strictEqual(after.state.combatants.b1.statModifiers.defense ?? 0, 0, 'no enemy was buffed');
  assert.strictEqual(after.state.combatants.a1.statModifiers.defense, 20);
  assert.strictEqual(after.state.combatants.a2.statModifiers.defense, 20);
});

test('stone: a move authoring no statDeltaTarget still puts its deltas on its own target', () => {
  const state = withDeepPools(stoneFixture(502));
  const after = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'mudBall', declaredTarget: 'b1' }], config);
  assert.strictEqual(after.state.combatants.b1.statModifiers.speed, -10, 'the debuff is on the enemy it hit');
  assert.strictEqual(after.state.combatants.a1.statModifiers.speed ?? 0, 0);
});

// --- Provoke ---

test('stone: Provoke pulls a single-target enemy attack off the partner and onto the taunt', () => {
  const state = withDeepPools(stoneFixture(601));
  const taunted = applyStatus(state, 1, 'a2', statuses.Provoke, { duration: 1 }).state;

  const after = resolveRound(taunted, [{ kind: 'move', combatantId: 'b1', moveId: 'vineLash', declaredTarget: 'a1' }], config);
  const hit = after.events.find((e) => e.type === 'DamageDealt') as any;
  assert.strictEqual(hit.targetCombatantId, 'a2', 'the attack declared at a1 landed on the taunt');
});

test('stone: Provoke catches every move KIND, not just damage', () => {
  const state = withDeepPools(stoneFixture(602));
  const taunted = applyStatus(state, 1, 'a2', statuses.Provoke, { duration: 1 }).state;

  const after = resolveRound(taunted, [{ kind: 'move', combatantId: 'b1', moveId: 'weaken', declaredTarget: 'a1' }], config);
  const declared = after.events.find((e) => e.type === 'MoveDeclared') as any;
  assert.deepStrictEqual(declared.targetCombatantIds, ['a2'], 'the debuff was redirected too');
});

test('stone: Provoke does not touch spread moves, or moves aimed at the enemy own side', () => {
  const state = withDeepPools(stoneFixture(603));
  const taunted = applyStatus(state, 1, 'a2', statuses.Provoke, { duration: 1 }).state;

  const spread = resolveRound(taunted, [{ kind: 'move', combatantId: 'b1', moveId: 'rockfall' }], config);
  const spreadHits = (spread.events.filter((e) => e.type === 'DamageDealt') as any[]).map((h) => h.targetCombatantId);
  assert.deepStrictEqual(spreadHits.sort(), ['a1', 'a2'], 'a spread move still hits both, taunt or no taunt');

  const selfBuff = resolveRound(taunted, [{ kind: 'move', combatantId: 'b1', moveId: 'toughenUp', declaredTarget: 'b2' }], config);
  const declared = selfBuff.events.find((e) => e.type === 'MoveDeclared') as any;
  assert.deepStrictEqual(declared.targetCombatantIds, ['b2'], "an ally-side move is never dragged onto the enemy taunt");
});

test('stone: Provoke lasts exactly the round it was cast in', () => {
  const state = withDeepPools(stoneFixture(604));
  const after = resolveRound(state, [{ kind: 'move', combatantId: 'a2', moveId: 'provoke' }], config);
  assert.strictEqual(
    hasStatus(after.state.combatants.a2, 'Provoke'),
    false,
    'the end-of-round tick takes the duration-1 status to 0 and removes it'
  );
  // But it WAS standing while the round resolved — Priority +1 is what buys that.
  assert.ok(after.events.some((e) => e.type === 'StatusApplied' && (e as any).statusId === 'Provoke'));
});

test('stone: Provoke self-casts, so the taunt lands on the caster and nobody else', () => {
  const state = withDeepPools(stoneFixture(605));
  const after = resolveRound(state, [{ kind: 'move', combatantId: 'a2', moveId: 'provoke' }], config);
  const applied = after.events.filter((e) => e.type === 'StatusApplied') as any[];
  assert.deepStrictEqual(
    applied.map((e) => e.combatantId),
    ['a2']
  );
});

test('stone: the target picker narrows to the taunt, so the player never aims where the move will not go', () => {
  const state = withDeepPools(stoneFixture(606));
  const taunted = applyStatus(state, 1, 'b2', statuses.Provoke, { duration: 1 }).state;
  const enemies = ['b1', 'b2'];

  assert.deepStrictEqual(selectableTargets(taunted, 'singleEnemy', 'damage', enemies, statuses), ['b2']);
  assert.deepStrictEqual(selectableTargets(taunted, 'singleEnemy', 'buff', enemies, statuses), ['b2'], 'every kind, matching the redirect');
  assert.deepStrictEqual(selectableTargets(taunted, 'bothEnemies', 'damage', enemies, statuses), enemies, 'spread is untouched');
  assert.deepStrictEqual(
    selectableTargets(taunted, 'singleEnemy', 'damage', enemies),
    enemies,
    'omitting the catalog keeps the exact pre-Provoke behaviour'
  );
});

// --- Slate-wide ---

test('stone: the slate authors no new field effect and no type-keyed status hook', () => {
  // If a status ever adds 'Stone' to triggerTypes, every number in this slate silently changes.
  const stone = Object.values(moves).filter((m) => m.type === 'Stone');
  // The designed fifteen, plus the two Evolution moves — Fang's Spire Claw and Crag's Titanic Crush.
  assert.strictEqual(stone.length, 17);

  for (const def of Object.values(statuses)) {
    assert.ok(!def.triggerTypes?.includes('Stone'), `${def.id} would detonate off every Stone damage move`);
    assert.ok(!def.spreadTriggerTypes?.includes('Stone'), `${def.id} would spread every Stone single-target move`);
  }
  assert.ok(!stone.some((m) => m.fieldEffectApplication), 'no Stone move sets a Field Effect');
});

test('stone: every retribution move authors no basePower, and every other damage move authors one', () => {
  for (const move of Object.values(moves).filter((m) => m.type === 'Stone')) {
    if (move.retributionPercent != null) {
      assert.strictEqual(move.kind, 'damage', `${move.id} deals damage, so it is a damage-kind move`);
      assert.strictEqual(move.basePower, undefined, `${move.id} has no BasePower — the counter IS its body`);
    } else if (move.kind === 'damage') {
      assert.ok(move.basePower != null, `${move.id} is a damage move with no BasePower`);
    }
  }
});

// --- Distribution ---

test('stone: every move id a hero or level-up pool points at actually exists', () => {
  const { progressionTable } = require('../src/data/progression') as typeof import('../src/data/progression');
  const { enemies } = require('../src/data/enemies') as typeof import('../src/data/enemies');
  for (const [heroId, hero] of Object.entries({ ...heroes, ...enemies })) {
    for (const moveId of hero.moveIds) assert.ok(moves[moveId], `${heroId}'s kit points at missing move ${moveId}`);
  }
  for (const [heroId, pool] of Object.entries(progressionTable.moveTiers)) {
    for (const moveId of pool) assert.ok(moves[moveId], `${heroId}'s level-up pool points at missing move ${moveId}`);
  }
});

test('stone: neither Stone hero starts with a move it cannot pay for, or has a starter listed in its own pool', () => {
  const { progressionTable } = require('../src/data/progression') as typeof import('../src/data/progression');
  for (const heroId of ['crag', 'sentinel']) {
    const hero = heroes[heroId];
    const cheapest = Math.min(...hero.moveIds.map((id) => moves[id].manaCost));
    assert.ok(cheapest <= hero.baseStats.manaPool, `${heroId} cannot afford its own cheapest starting move`);
    for (const moveId of progressionTable.moveTiers[heroId] ?? []) {
      assert.ok(!hero.moveIds.includes(moveId), `${heroId}'s pool lists its own starting move ${moveId}`);
    }
  }
});

test('stone: each Stone hero attacks with the stat it is actually good at', () => {
  for (const heroId of ['crag', 'sentinel']) {
    const hero = heroes[heroId];
    const wants = hero.baseStats.attack >= hero.baseStats.intelligence ? 'physical' : 'magical';
    const damage = hero.moveIds.map((id) => moves[id]).filter((m) => m.kind === 'damage');
    assert.ok(damage.length > 0, `${heroId} has no damage move at all`);
    assert.ok(
      damage.some((m) => m.category === wants),
      `${heroId} attacks off its weaker stat`
    );
  }
});

test('stone: no move is unreachable that was not already known to be', () => {
  // Pinned as an exact set: an orphan is expected, a NEW one must be added here consciously. Hand-off findings: docs/authoring-moves.md §10.
  const { progressionTable } = require('../src/data/progression') as typeof import('../src/data/progression');
  const { enemies } = require('../src/data/enemies') as typeof import('../src/data/enemies');

  const reachable = new Set<string>();
  for (const hero of Object.values({ ...heroes, ...enemies })) for (const id of hero.moveIds) reachable.add(id);
  for (const pool of Object.values(progressionTable.moveTiers)) for (const id of pool) reachable.add(id);
  // An Evolution path reaches moves two ways: granted outright, or added to the level-up pool.
  for (const nodes of Object.values(progressionTable.evolutions)) {
    for (const node of nodes) {
      for (const path of node.paths) {
        for (const id of path.unlocksMoveIds) reachable.add(id);
        for (const id of path.learnableMoveIds ?? []) reachable.add(id);
      }
    }
  }

  const unreachable = Object.keys(moves).filter((id) => !reachable.has(id)).sort();
  // Runic Blast and Forgotten Curse left this list when Yugzulach was authored (src/data/enemies.ts).
  assert.deepStrictEqual(unreachable, [
    'cerebralShock',
    'landslide',
    'rockfall',
    // RESERVED (2026-09-02), not an accident: Shock Bubble is the Water move that plants Conduct,
    // and it was reachable only through Riptide's Storm graft, which became Water/Mind. Held with
    // the Static Tide passive for a future recruit-only Water hero that grafts Storm.
    'shockBubble',
    'tremor',
  ]);
});

// --- statDeltaTarget 'self' on a damage move (Spire Claw) ---

test('stone: Spire Claw hits an enemy and puts its +20 Defense on the CASTER, not the target', () => {
  const state = withDeepPools(stoneFixture(760));
  const { state: next } = resolveRound(
    state,
    [{ kind: 'move', combatantId: 'a1', moveId: 'spireClaw', declaredTarget: 'b1' }],
    config
  );

  assert.strictEqual(next.combatants.a1.statModifiers.defense, 20);
  assert.strictEqual(next.combatants.b1.statModifiers.defense ?? 0, 0);
  assert.ok(next.combatants.b1.currentHp < state.combatants.b1.currentHp);
});

test('stone: Titanic Crush hits both foes at full power — no spread reduction in a doubles-only game', () => {
  const state = withDeepPools(stoneFixture(770));
  const { events } = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'titanicCrush' }], config);
  const hits = events.filter((e) => e.type === 'DamageDealt') as any[];

  assert.deepStrictEqual(hits.map((h) => h.targetCombatantId).sort(), ['b1', 'b2']);
  for (const hit of hits) assert.strictEqual(hit.basePower, moves.titanicCrush.basePower);
});
