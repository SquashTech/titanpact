// Beast slate: requiresPartnerType (power / mana cost / stat deltas), statusApplication lists, derived Apex Predator. Hand-off findings: docs/authoring-moves.md §10.

import * as assert from 'assert';
import { test } from './harness';
import { createFightState, withFullPools } from './fixtures';
import { heroes } from '../src/data/heroes';
import { enemies } from '../src/data/enemies';
import { moves } from '../src/data/moves';
import { typeChart } from '../src/data/typechart';
import { statuses } from '../src/data/statuses';
import { passives } from '../src/data/passives';
import { fieldEffects } from '../src/data/fieldEffects';
import { statusApplicationsOf } from '../src/engine/content';
import { resolveRound } from '../src/engine/combat/resolveRound';
import { calcDamage } from '../src/engine/damage/damagePipeline';
import {
  activePartnerTypes,
  effectiveManaCost,
  getEffectiveStat,
  hasStatus,
  resolveManaCost,
  statusMagnitude,
} from '../src/engine/state';
import type { CombatState } from '../src/engine/state';

const config = { typeChart, heroes, moves, statuses, passives, fieldEffects, benchHpRegenFlat: 5 };

/** Fang with a chosen partner; `packAlpha` twice is legal at this layer and the only way to field two Beasts. */
function beastFixture(seed: number, partnerHeroId: string) {
  return createFightState(
    seed,
    [
      { combatantId: 'a1', heroId: 'packAlpha', side: 'A' },
      { combatantId: 'a2', heroId: partnerHeroId, side: 'A' },
    ],
    [
      { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
      { combatantId: 'b2', heroId: 'sentinel', side: 'B' },
    ]
  );
}

/** Deep mana/HP so riders are reached; the hp modifier must move with currentHp (getMaxHp reads both). */
function withDeepPools(state: CombatState): CombatState {
  const combatants = Object.fromEntries(
    Object.entries(state.combatants).map(([id, c]) => [
      id,
      withFullPools({ ...c, statModifiers: { ...c.statModifiers, manaPool: 999, hp: 1200 } }),
    ])
  );
  return { ...state, combatants } as CombatState;
}

function withStatus(state: CombatState, combatantId: string, statusId: string, magnitude?: number): CombatState {
  const c = state.combatants[combatantId];
  return {
    ...state,
    combatants: {
      ...state.combatants,
      [combatantId]: { ...c, statuses: { ...c.statuses, [statusId]: { statusId, magnitude } } },
    },
  } as CombatState;
}

function modifiersOf(state: CombatState, combatantId: string) {
  return state.combatants[combatantId].statModifiers as Record<string, number>;
}

function damageOf(events: readonly { type: string }[]) {
  return events.find((e) => e.type === 'DamageDealt') as
    | { type: 'DamageDealt'; amount: number; basePowerMultiplier: number; multiplierTerm: number }
    | undefined;
}

// --- statusApplication as a list ---

test('beast: Toxic Fangs lands BOTH of its statuses in one cast', () => {
  const state = withDeepPools(beastFixture(700, 'cinderKnight'));
  const { state: after } = resolveRound(
    state,
    [{ kind: 'move', combatantId: 'a1', moveId: 'toxicFangs', declaredTarget: 'b1' }],
    config
  );
  assert.ok(hasStatus(after.combatants.b1, 'Bleed'), 'the Bleed half landed');
  assert.ok(hasStatus(after.combatants.b1, 'Poison'), 'and so did the Poison half');
  // Poison does not decay, so the authored 10 survives the end-of-round tick.
  assert.strictEqual(statusMagnitude(after.combatants.b1, 'Poison'), 10);
});

test('beast: a rider LIST draws no more RNG than a single rider — the determinism rule the field was widened under', () => {
  // Both moves have unchanced riders, so the only draw is the damage roll; per-rider draws would diverge.
  const state = withDeepPools(beastFixture(701, 'cinderKnight'));
  const one = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'lacerate', declaredTarget: 'b1' }], config);
  const two = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'toxicFangs', declaredTarget: 'b1' }], config);
  assert.deepStrictEqual(two.state.rngState, one.state.rngState);
});

// --- The pack condition, in all three places ---

test('beast: Pack Hunt doubles beside a Beast and is a plain 40 BP move otherwise', () => {
  const swing = (partnerHeroId: string) => {
    const state = withDeepPools(beastFixture(710, partnerHeroId));
    const { events } = resolveRound(
      state,
      [{ kind: 'move', combatantId: 'a1', moveId: 'packHunt', declaredTarget: 'b1' }],
      config
    );
    return damageOf(events);
  };

  const alone = swing('cinderKnight');
  const pack = swing('packAlpha');
  assert.ok(alone && pack);
  // Same seed, so the same variance and crit roll.
  assert.strictEqual(alone.basePowerMultiplier, 1);
  assert.strictEqual(pack.basePowerMultiplier, 2);
  assert.ok(pack.amount > alone.amount, `expected the pack swing to hit harder (${pack.amount} vs ${alone.amount})`);
});

test('beast: the pack multiplier is a BasePower-stage term, not a damage modifier', () => {
  // Two-pipeline separation (CLAUDE.md).
  const doubled = calcDamage(moves.packHunt, 1, ['Beast'], ['Iron'], typeChart, 1, false, [], undefined, undefined, 0, 2);
  assert.strictEqual(doubled.basePowerMultiplier, 2, 'the multiplier rides the BasePower input');
  assert.strictEqual(doubled.multiplierTerm, 1, 'and never becomes a multiplier on the finished hit');

  const plain = calcDamage(moves.packHunt, 1, ['Beast'], ['Iron'], typeChart, 1, false, [], undefined, undefined, 0, 1);
  assert.strictEqual(doubled.damage, plain.damage * 2, 'BasePower is linear, so ×2 BasePower is ×2 damage');
});

test('beast: the pack condition reads the ACTIVE partner — a downed one counts for nothing', () => {
  const state = withDeepPools(beastFixture(711, 'packAlpha'));
  assert.deepStrictEqual(activePartnerTypes(state, 'a1', heroes), ['Beast']);

  const downed = {
    ...state,
    combatants: { ...state.combatants, a2: { ...state.combatants.a2, fainted: true, currentHp: 0 } },
  } as CombatState;
  assert.strictEqual(activePartnerTypes(downed, 'a1', heroes), null);

  const { events } = resolveRound(
    downed,
    [{ kind: 'move', combatantId: 'a1', moveId: 'packHunt', declaredTarget: 'b1' }],
    config
  );
  assert.strictEqual(damageOf(events)?.basePowerMultiplier, 1, 'a corpse is not a pack');
});

test('beast: Prowl grants +10/+10 alone and +20/+20 beside a Beast, as one delta either way', () => {
  const prowl = (partnerHeroId: string) => {
    const state = withDeepPools(beastFixture(712, partnerHeroId));
    const { state: after, events } = resolveRound(
      state,
      [{ kind: 'move', combatantId: 'a1', moveId: 'prowl', declaredTarget: 'a1' }],
      config
    );
    return { mods: modifiersOf(after, 'a1'), changes: events.filter((e) => e.type === 'StatChanged') };
  };

  const alone = prowl('cinderKnight');
  assert.strictEqual(alone.mods.attack, 10);
  assert.strictEqual(alone.mods.speed, 10);

  const pack = prowl('packAlpha');
  assert.strictEqual(pack.mods.attack, 20);
  assert.strictEqual(pack.mods.speed, 20);
  // The multiplier scales the amounts rather than applying the deltas twice.
  assert.strictEqual(pack.changes.length, 2, 'one beat per stat, not per application');
});

test('beast: Pack Leader is 100 mana alone and 50 beside a Beast, and effectiveManaCost stays the board-free answer', () => {
  const alone = withDeepPools(beastFixture(713, 'cinderKnight'));
  const pack = withDeepPools(beastFixture(713, 'packAlpha'));

  assert.strictEqual(resolveManaCost(alone, 'a1', moves.packLeader, heroes), 100);
  assert.strictEqual(resolveManaCost(pack, 'a1', moves.packLeader, heroes), 50);

  // Omitting the roster leaves the ally side inert rather than throwing.
  assert.strictEqual(resolveManaCost(pack, 'a1', moves.packLeader), 100);
  assert.strictEqual(effectiveManaCost(moves.packLeader), 100);
});

test('beast: the pack price is spent at the price the BOARD says, not the one the button said', () => {
  const cast = (partnerHeroId: string) => {
    const state = withDeepPools(beastFixture(714, partnerHeroId));
    const { state: after } = resolveRound(
      state,
      [{ kind: 'move', combatantId: 'a1', moveId: 'packLeader', declaredTarget: 'a1' }],
      config
    );
    return after;
  };
  // Compare the two casts rather than the absolute spend: both regen identically at the round boundary.
  const alonePaid = cast('cinderKnight').combatants.a1.currentMana;
  const after = cast('packAlpha');
  assert.strictEqual(after.combatants.a1.currentMana - alonePaid, 50);
  assert.strictEqual(modifiersOf(after, 'a1').attack, 50);
  assert.strictEqual(modifiersOf(after, 'a2').attack, 50);
  assert.strictEqual(modifiersOf(after, 'a2').speed, 50);
});

// --- Apex Predator: the derived grant ---

test('beast: Apex Predator grants Attack equal to the Attack the caster currently has', () => {
  const state = withDeepPools(beastFixture(720, 'cinderKnight'));
  const fang = heroes.packAlpha;
  const before = getEffectiveStat(fang, state.combatants.a1, 'attack');
  const { state: after } = resolveRound(
    state,
    [{ kind: 'move', combatantId: 'a1', moveId: 'apexPredator', declaredTarget: 'a1' }],
    config
  );
  assert.strictEqual(modifiersOf(after, 'a1').attack, before, 'the grant is the figure it read');
  assert.strictEqual(getEffectiveStat(fang, after.combatants.a1, 'attack'), before * 2, 'which doubles the bar');
});

test('beast: Apex Predator COMPOUNDS, and a buff cast first is doubled with everything else', () => {
  const state = withDeepPools(beastFixture(721, 'cinderKnight'));
  const fang = heroes.packAlpha;
  const base = getEffectiveStat(fang, state.combatants.a1, 'attack');

  const rallied = resolveRound(
    state,
    [{ kind: 'move', combatantId: 'a1', moveId: 'rally', declaredTarget: 'a1' }],
    config
  ).state;
  assert.strictEqual(getEffectiveStat(fang, rallied.combatants.a1, 'attack'), base + 20);

  const once = resolveRound(
    rallied,
    [{ kind: 'move', combatantId: 'a1', moveId: 'apexPredator', declaredTarget: 'a1' }],
    config
  ).state;
  assert.strictEqual(getEffectiveStat(fang, once.combatants.a1, 'attack'), (base + 20) * 2, 'the Rally is inside the doubling');

  const twice = resolveRound(
    once,
    [{ kind: 'move', combatantId: 'a1', moveId: 'apexPredator', declaredTarget: 'a1' }],
    config
  ).state;
  assert.strictEqual(getEffectiveStat(fang, twice.combatants.a1, 'attack'), (base + 20) * 4, 'and a second cast doubles again');
});

// --- Bleed as a currency ---

test('beast: Maul and Eviscerate double against a Bleeding target and never spend the mark', () => {
  for (const moveId of ['maul', 'eviscerate']) {
    const clean = withDeepPools(beastFixture(730, 'cinderKnight'));
    const bleeding = withStatus(clean, 'b1', 'Bleed');

    const bare = damageOf(
      resolveRound(clean, [{ kind: 'move', combatantId: 'a1', moveId, declaredTarget: 'b1' }], config).events
    );
    const cashed = resolveRound(bleeding, [{ kind: 'move', combatantId: 'a1', moveId, declaredTarget: 'b1' }], config);
    const boosted = damageOf(cashed.events);
    assert.ok(bare && boosted);
    assert.strictEqual(bare.basePowerMultiplier, 1, `${moveId} pays nothing on a clean target`);
    assert.strictEqual(boosted.basePowerMultiplier, 2, `${moveId} doubles on a Bleeding one`);
    assert.ok(hasStatus(cashed.state.combatants.b1, 'Bleed'), `${moveId} must not consume the mark`);
    assert.strictEqual(moves[moveId].conditionalPower?.consumesStatus, undefined);
  }
});

test('beast: Rampage bills a quarter of the damage it actually dealt back to its own caster', () => {
  const state = withDeepPools(beastFixture(731, 'cinderKnight'));
  const { state: after, events } = resolveRound(
    state,
    [{ kind: 'move', combatantId: 'a1', moveId: 'rampage', declaredTarget: 'b1' }],
    config
  );
  const hit = damageOf(events);
  assert.ok(hit);
  const lost = state.combatants.a1.currentHp - after.combatants.a1.currentHp;
  assert.strictEqual(lost, Math.round(hit.amount * 0.25));
});

// --- The slate's own shape ---

test('beast: the slate is fifteen moves, and every status it names exists', () => {
  const beast = Object.values(moves).filter((m) => m.type === 'Beast');
  assert.strictEqual(beast.length, 15);
  for (const move of beast) {
    for (const app of statusApplicationsOf(move)) {
      assert.ok(statuses[app.statusId], `${move.id} applies unknown status ${app.statusId}`);
    }
  }
});

test('beast: three rows plant Bleed, two cash it, and one move applies two statuses at once', () => {
  const beast = Object.values(moves).filter((m) => m.type === 'Beast');
  const planters = beast.filter((m) => statusApplicationsOf(m).some((a) => a.statusId === 'Bleed'));
  assert.deepStrictEqual(planters.map((m) => m.id).sort(), ['claw', 'lacerate', 'toxicFangs']);

  const cashers = beast.filter((m) => m.conditionalPower?.requiresTargetStatus === 'Bleed');
  assert.deepStrictEqual(cashers.map((m) => m.id).sort(), ['eviscerate', 'maul']);

  const multi = beast.filter((m) => statusApplicationsOf(m).length > 1);
  assert.deepStrictEqual(multi.map((m) => m.id), ['toxicFangs']);
  assert.strictEqual(statusApplicationsOf(moves.toxicFangs).length, 2);
});

test('beast: three rows read the partner, and none of them reads anything else', () => {
  const beast = Object.values(moves).filter((m) => m.type === 'Beast');
  const pack = beast.filter(
    (m) =>
      m.conditionalPower?.requiresPartnerType != null ||
      m.conditionalManaCost?.requiresPartnerType != null ||
      m.conditionalStatDeltas != null
  );
  assert.deepStrictEqual(pack.map((m) => m.id).sort(), ['packHunt', 'packLeader', 'prowl']);
  for (const move of pack) {
    const type =
      move.conditionalPower?.requiresPartnerType ??
      move.conditionalManaCost?.requiresPartnerType ??
      move.conditionalStatDeltas?.requiresPartnerType;
    assert.strictEqual(type, 'Beast', `${move.id} reads a partner type the slate did not author`);
  }
});

test('beast: no damage row carries a free type-keyed rider — Beast triggers nothing', () => {
  for (const def of Object.values(statuses)) {
    assert.ok(!(def.triggerTypes ?? []).includes('Beast'), `${def.id} would fire off every Beast damage move`);
    assert.ok(!(def.spreadTriggerTypes ?? []).includes('Beast'), `${def.id} would spread off every Beast damage move`);
  }
});

test('beast: exactly one bracket row, exactly one magical row, and no heal, cleanse, field effect or debuff', () => {
  const beast = Object.values(moves).filter((m) => m.type === 'Beast');
  assert.deepStrictEqual(beast.filter((m) => m.priority !== 0).map((m) => m.id), ['pounce']);
  assert.strictEqual(moves.pounce.priority, 1, 'and it is a positive bracket — the type buys speed, never trades it');

  assert.deepStrictEqual(beast.filter((m) => m.category === 'magical').map((m) => m.id), ['animalSpirit']);

  assert.strictEqual(beast.filter((m) => m.kind === 'heal').length, 0);
  assert.strictEqual(beast.filter((m) => m.cleanses).length, 0);
  assert.strictEqual(beast.filter((m) => m.fieldEffectApplication).length, 0);
  assert.strictEqual(beast.filter((m) => m.drainPercent != null).length, 0);
  for (const move of beast) {
    for (const { stat, amount } of move.statDeltas ?? []) {
      assert.ok(amount > 0, `${move.id} debuffs ${stat}, which the slate does nowhere else`);
    }
  }
});

// --- Distribution ---

test('beast: every move id a hero, enemy or level-up pool points at actually exists', () => {
  const { progressionTable } = require('../src/data/progression') as typeof import('../src/data/progression');
  for (const [heroId, hero] of Object.entries({ ...heroes, ...enemies })) {
    for (const moveId of hero.moveIds) assert.ok(moves[moveId], `${heroId} starts with missing move ${moveId}`);
  }
  for (const [heroId, pool] of Object.entries(progressionTable.moveTiers)) {
    for (const moveId of pool) assert.ok(moves[moveId], `${heroId}'s level-up pool points at missing move ${moveId}`);
  }
});

test('beast: no hero in the ROSTER lists a starting move in its own level-up pool', () => {
  const { progressionTable } = require('../src/data/progression') as typeof import('../src/data/progression');
  for (const [heroId, hero] of Object.entries(heroes)) {
    for (const moveId of progressionTable.moveTiers[heroId] ?? []) {
      assert.ok(!hero.moveIds.includes(moveId), `${heroId}'s pool lists its own starting move ${moveId}`);
    }
  }
});

test('beast: every Beast hero and enemy can afford its own kit, and Fang attacks off its better stat', () => {
  const fang = heroes.packAlpha;
  const cheapest = Math.min(...fang.moveIds.map((id) => moves[id].manaCost));
  assert.ok(cheapest <= fang.baseStats.manaPool, 'Fang cannot afford its own cheapest starting move');
  const attacks = fang.moveIds.map((id) => moves[id]).filter((m) => m.kind === 'damage');
  assert.ok(attacks.length > 0 && attacks.every((m) => m.category === 'physical'));

  for (const id of ['goblinGrunt', 'goblinChief']) {
    const enemy = enemies[id];
    const floor = Math.min(...enemy.moveIds.map((mid) => moves[mid].manaCost));
    assert.ok(floor <= enemy.baseStats.manaPool, `${id} cannot afford its own cheapest move`);
  }
});

test('beast: every authored Beast move has a holder', () => {
  const { progressionTable } = require('../src/data/progression') as typeof import('../src/data/progression');
  const held = new Set<string>();
  for (const hero of [...Object.values(heroes), ...Object.values(enemies)]) for (const id of hero.moveIds) held.add(id);
  for (const pool of Object.values(progressionTable.moveTiers)) for (const id of pool) held.add(id);

  const orphans = Object.values(moves)
    .filter((m) => m.type === 'Beast' && !held.has(m.id))
    .map((m) => m.id);
  assert.deepStrictEqual(orphans, [], `unreachable Beast moves: ${orphans.join(', ')}`);
});
