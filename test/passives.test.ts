// The Passives contract (engine/content.ts PassiveDefinition, passiveEngine.ts): reactive (Sanguine,
// Firestarter), damage modifier (Emberheart), conditional stat grant (Bloodthirsty), run-tier aggregation.

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
import { matchesTrigger, collectPassiveDamageModifiers } from '../src/engine/combat/passiveEngine';
import { getEffectiveStat, hasStatus } from '../src/engine/state';
import { resolveMultiplierTerm } from '../src/engine/damage/damagePipeline';
import type { CombatState, PassiveInstance } from '../src/engine/state';
import { equipmentPassiveGrants, relicTeamPassiveGrants, mergePassiveGrants, toPassiveInstances } from '../src/run/passives';
import { createEmptyLoadout, equipItem, type EquipmentDefinition } from '../src/run/equipment';
import { relics } from '../src/data/relics';
import { isValidPassiveDefinition } from '../src/engine/content';

const config = { typeChart, heroes, moves, statuses, passives, fieldEffects, benchHpRegenFlat: 5 };

function twoVTwoFixture(seed: number) {
  return createFightState(
    seed,
    [
      { combatantId: 'a1', heroId: 'cinderKnight', side: 'A' },
      { combatantId: 'a2', heroId: 'tidecaller', side: 'A' },
    ],
    [
      { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
      { combatantId: 'b2', heroId: 'wildOracle', side: 'B' },
    ]
  );
}

function withStatus(state: CombatState, combatantId: string, statusId: string, fields: { magnitude?: number; duration?: number }): CombatState {
  const combatant = state.combatants[combatantId];
  return {
    ...state,
    combatants: {
      ...state.combatants,
      [combatantId]: { ...combatant, statuses: { ...combatant.statuses, [statusId]: { statusId, ...fields } } },
    },
  };
}

function withPassive(state: CombatState, combatantId: string, passiveId: string, stacks = 1): CombatState {
  const combatant = state.combatants[combatantId];
  const instance: PassiveInstance = { passiveId, stacks };
  return {
    ...state,
    combatants: {
      ...state.combatants,
      [combatantId]: { ...combatant, passives: { ...combatant.passives, [passiveId]: instance } },
    },
  };
}

// --- isValidPassiveDefinition ---

test('passives: fixture catalog (sanguine, emberheart, and the merged-in Class catalog) is all valid content', () => {
  for (const passive of Object.values(passives)) {
    assert.ok(isValidPassiveDefinition(passive), `${passive.id} is not a valid PassiveDefinition`);
  }
});

test('passives: isValidPassiveDefinition rejects a passive with no reactive/damageModifier/statGrants — nothing for it to do', () => {
  assert.strictEqual(isValidPassiveDefinition({ id: 'inert', name: 'Inert', description: '' }), false);
});

test('passives: isValidPassiveDefinition rejects a non-multiple-of-5 statGrants entry', () => {
  assert.strictEqual(
    isValidPassiveDefinition({ id: 'bad', name: 'Bad', description: '', statGrants: { attack: 7 } }),
    false
  );
});

test('passives: isValidPassiveDefinition accepts a statGrants-only passive (a Class)', () => {
  assert.strictEqual(
    isValidPassiveDefinition({ id: 'ok', name: 'Ok', description: '', statGrants: { attack: 10, defense: 10 } }),
    true
  );
});

// --- matchesTrigger ---

test('passives: matchesTrigger relation — self/ally/enemy read correctly off side + identity', () => {
  const selfCond = { relativeTo: 'self' as const };
  const allyCond = { relativeTo: 'ally' as const };
  const enemyCond = { relativeTo: 'enemy' as const };

  assert.strictEqual(matchesTrigger(selfCond, {}, 'a1', 'A', 'a1', 'A'), true);
  assert.strictEqual(matchesTrigger(selfCond, {}, 'a1', 'A', 'a2', 'A'), false);
  assert.strictEqual(matchesTrigger(allyCond, {}, 'a1', 'A', 'a2', 'A'), true);
  assert.strictEqual(matchesTrigger(allyCond, {}, 'a1', 'A', 'a1', 'A'), false); // ally excludes the owner itself
  assert.strictEqual(matchesTrigger(enemyCond, {}, 'a1', 'A', 'b1', 'B'), true);
  assert.strictEqual(matchesTrigger(enemyCond, {}, 'a1', 'A', 'a2', 'A'), false);
});

test('passives: matchesTrigger also requires every eventFieldEquals key to match', () => {
  const cond = { relativeTo: 'enemy' as const, eventFieldEquals: { statusId: 'Bleed', kind: 'damage' } };
  assert.strictEqual(matchesTrigger(cond, { statusId: 'Bleed', kind: 'damage' }, 'a1', 'A', 'b1', 'B'), true);
  assert.strictEqual(matchesTrigger(cond, { statusId: 'Burn', kind: 'damage' }, 'a1', 'A', 'b1', 'B'), false);
  assert.strictEqual(matchesTrigger(cond, { statusId: 'Bleed', kind: 'duration' }, 'a1', 'A', 'b1', 'B'), false);
});

// --- Sanguine: reactive, off an enemy's Bleed tick ---

test('passives: Sanguine heals its owner by the enemy Bleed tick amount', () => {
  const state = twoVTwoFixture(300);
  const hurt = { ...state, combatants: { ...state.combatants, a1: { ...state.combatants.a1, currentHp: 10 } } };
  const withGrant = withPassive(hurt, 'a1', 'sanguine');
  const bleeding = withStatus(withGrant, 'b1', 'Bleed', {});

  const maxHp = heroes.ironWarden.baseStats.hp;
  const expectedTick = Math.ceil(maxHp * 0.05);

  const { state: next, events } = resolveRound(bleeding, [], config);

  assert.strictEqual(next.combatants.a1.currentHp, 10 + expectedTick);
  assert.strictEqual(next.combatants.b1.currentHp, maxHp - expectedTick);
  assert.ok(events.some((e) => e.type === 'HpChanged' && e.combatantId === 'a1' && e.newHp === 10 + expectedTick));
});

test('passives: Sanguine does not fire off an ally taking Bleed damage', () => {
  const state = twoVTwoFixture(301);
  const hurt = { ...state, combatants: { ...state.combatants, a1: { ...state.combatants.a1, currentHp: 10 } } };
  const withGrant = withPassive(hurt, 'a1', 'sanguine');
  const bleeding = withStatus(withGrant, 'a2', 'Bleed', {}); // ally, not enemy

  const { state: next } = resolveRound(bleeding, [], config);
  assert.strictEqual(next.combatants.a1.currentHp, 10); // untouched
});

test('passives: two stacks of Sanguine heal twice per enemy Bleed tick', () => {
  const state = twoVTwoFixture(302);
  const hurt = { ...state, combatants: { ...state.combatants, a1: { ...state.combatants.a1, currentHp: 10 } } };
  const withGrant = withPassive(hurt, 'a1', 'sanguine', 2);
  const bleeding = withStatus(withGrant, 'b1', 'Bleed', {});

  const maxHp = heroes.ironWarden.baseStats.hp;
  const expectedTick = Math.ceil(maxHp * 0.05);

  const { state: next } = resolveRound(bleeding, [], config);
  assert.strictEqual(next.combatants.a1.currentHp, 10 + expectedTick * 2);
});

// --- Emberheart: damage-pipeline modifier, conditional + stacking ---

test('passives: collectPassiveDamageModifiers only matches the conditioned move type', () => {
  const state = twoVTwoFixture(310);
  const withGrant = withPassive(state, 'a1', 'emberheart');

  const fireMods = collectPassiveDamageModifiers(withGrant.combatants.a1, moves.singe, passives);
  assert.deepStrictEqual(fireMods, [{ source: 'emberheart', amount: 0.2 }]);

  const waterMods = collectPassiveDamageModifiers(withGrant.combatants.a1, moves.splash, passives);
  assert.deepStrictEqual(waterMods, []);
});

test('passives: two stacks of Emberheart push two modifier entries, stacking multiplicatively', () => {
  const state = twoVTwoFixture(311);
  const withGrant = withPassive(state, 'a1', 'emberheart', 2);

  const mods = collectPassiveDamageModifiers(withGrant.combatants.a1, moves.singe, passives);
  assert.strictEqual(mods.length, 2);
  assert.strictEqual(resolveMultiplierTerm(mods), 1.2 * 1.2);
});

test('passives: Emberheart actually raises rolled damage on a Fire move end to end', () => {
  const state = twoVTwoFixture(312);
  const withGrant = withPassive(state, 'a1', 'emberheart');
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'singe', declaredTarget: 'b1' }];

  const plain = resolveRound(state, actions, config);
  const boosted = resolveRound(withGrant, actions, config);

  const maxHp = heroes.ironWarden.baseStats.hp;
  const plainDamage = maxHp - plain.state.combatants.b1.currentHp;
  const boostedDamage = maxHp - boosted.state.combatants.b1.currentHp;
  assert.ok(boostedDamage > plainDamage, `expected boosted damage (${boostedDamage}) > plain damage (${plainDamage})`);
});

// --- Firestarter: subjectRole attribution + oncePerFight ---

const burnAlly: Action = { kind: 'move', combatantId: 'a2', moveId: 'setAlight', declaredTarget: 'b1' };
const burnOwner: Action = { kind: 'move', combatantId: 'a1', moveId: 'setAlight', declaredTarget: 'b1' };

test('passives: Firestarter sets Scorched Land when ITS OWNER applies Burn', () => {
  const state = withPassive(twoVTwoFixture(320), 'a1', 'firestarter');
  const { state: next, events } = resolveRound(state, [burnOwner], config);

  assert.strictEqual(next.activeFieldEffect?.fieldEffectId, 'scorchedLand');
  assert.ok(events.some((e) => e.type === 'PassiveTriggered' && e.combatantId === 'a1' && e.passiveId === 'firestarter'));
  assert.strictEqual(next.combatants.a1.passives.firestarter.firedThisFight, true);
});

test('passives: Firestarter does NOT fire off an ALLY applying Burn — subjectRole source is attribution, not proximity', () => {
  const state = withPassive(twoVTwoFixture(321), 'a1', 'firestarter');
  const { state: next } = resolveRound(state, [burnAlly], config);

  assert.strictEqual(next.activeFieldEffect, null);
  assert.ok(!next.combatants.a1.passives.firestarter.firedThisFight);
});

test('passives: Firestarter does NOT fire when its owner is the one BURNED — source role, not target role', () => {
  const state = withPassive(twoVTwoFixture(322), 'b1', 'firestarter'); // the victim holds it
  const { state: next } = resolveRound(state, [burnOwner], config);

  assert.strictEqual(next.activeFieldEffect, null);
});

test('passives: Firestarter fires only once per fight — a later Burn does not re-set the field', () => {
  const state = withPassive(twoVTwoFixture(323), 'a1', 'firestarter');
  const first = resolveRound(state, [burnOwner], config);
  assert.strictEqual(first.state.activeFieldEffect?.fieldEffectId, 'scorchedLand');

  // Override the field first: a re-apply of the same effect is already a no-op, so it could not tell a spent trigger apart.
  const overridden: CombatState = { ...first.state, activeFieldEffect: { fieldEffectId: 'stasisBubble', roundsRemaining: 5 } };
  const second = resolveRound(overridden, [burnOwner], config);

  assert.strictEqual(second.state.activeFieldEffect?.fieldEffectId, 'stasisBubble');
  assert.ok(!second.events.some((e) => e.type === 'PassiveTriggered' && e.passiveId === 'firestarter'));
});

test('passives: two stacks of a oncePerFight passive still fire only once', () => {
  const state = withPassive(twoVTwoFixture(324), 'a1', 'firestarter', 2);
  const { events } = resolveRound(state, [burnOwner], config);

  const fired = events.filter((e) => e.type === 'PassiveTriggered' && e.passiveId === 'firestarter');
  assert.strictEqual(fired.length, 1);
});

// --- Bloodthirsty: PassiveConditionalStatGrants, resolved live in getEffectiveStat ---

const boardOf = (state: CombatState) => ({ active: state.activeFieldEffect, defs: fieldEffects, board: { state, passives } });

// --- Frozen Stone (Rime's Glacier): the StatChanged hook, a positive-delta gate, a rolled target ---

/** a1 buffs its own Defense; frostArmor is +20 Defense to one ally. */
const guardSelf: Action = { kind: 'move', combatantId: 'a1', moveId: 'frostArmor', declaredTarget: 'a1' };
const frozenEnemies = (state: CombatState) => ['b1', 'b2'].filter((id) => hasStatus(state.combatants[id], 'Freeze'));

test('passives: Frozen Stone freezes exactly one enemy when its owner\'s Defense rises', () => {
  const state = withPassive(twoVTwoFixture(360), 'a1', 'frozenStone');
  const { state: next, events } = resolveRound(state, [guardSelf], config);

  assert.strictEqual(frozenEnemies(next).length, 1, 'one of the two, not both — this is a rolled target, not a spread');
  assert.ok(events.some((e) => e.type === 'PassiveTriggered' && e.combatantId === 'a1' && e.passiveId === 'frozenStone'));
});

test('passives: Frozen Stone reads the SIGN — a Defense debuff is a stat change, but not a rise', () => {
  const state = withPassive(twoVTwoFixture(361), 'b1', 'frozenStone'); // the hero being peeled holds it
  const { state: next } = resolveRound(
    state,
    [{ kind: 'move', combatantId: 'a1', moveId: 'rendArmor', declaredTarget: 'b1' }],
    config
  );

  assert.strictEqual(frozenEnemies(next).length, 0);
  assert.ok(!hasStatus(next.combatants.a1, 'Freeze'), 'and nothing lands on the attacker either');
});

test('passives: Frozen Stone reads the STAT — a Speed buff on its owner does nothing', () => {
  const state = withPassive(twoVTwoFixture(362), 'a1', 'frozenStone');
  const { state: next } = resolveRound(state, [{ kind: 'move', combatantId: 'a2', moveId: 'charge' }], config);
  assert.strictEqual(frozenEnemies(next).length, 0);
});

test('passives: Frozen Stone is relative to its OWNER — a partner\'s Defense rising is not its own', () => {
  const state = withPassive(twoVTwoFixture(363), 'a1', 'frozenStone');
  const { state: next } = resolveRound(
    state,
    [{ kind: 'move', combatantId: 'a2', moveId: 'frostArmor', declaredTarget: 'a2' }],
    config
  );
  assert.strictEqual(frozenEnemies(next).length, 0);
});

test('passives: a rolled passive target does not always land on the same enemy', () => {
  const hit = new Set<string>();
  for (let seed = 0; seed < 40; seed++) {
    const state = withPassive(twoVTwoFixture(seed), 'a1', 'frozenStone');
    const { state: next } = resolveRound(state, [guardSelf], config);
    for (const id of frozenEnemies(next)) hit.add(id);
  }
  assert.deepStrictEqual([...hit].sort(), ['b1', 'b2'], 'both slots are reachable — the draw is real, not a fixed slot order');
});

test('passives: the rolled target draws RNG only when a passive asks for one', () => {
  const bare = twoVTwoFixture(364);
  const held = withPassive(bare, 'a1', 'frozenStone');
  const without = resolveRound(bare, [guardSelf], config);
  const with_ = resolveRound(held, [guardSelf], config);

  assert.notDeepStrictEqual(with_.state.rngState, without.state.rngState, 'the draw is real');
  // And the same board with an unrelated passive costs exactly what no passive costs.
  const unrelated = resolveRound(withPassive(bare, 'a1', 'firestarter'), [guardSelf], config);
  assert.deepStrictEqual(unrelated.state.rngState, without.state.rngState);
});

// --- Static Tide (Riptide's Maelstrom): a source-role reaction that lands on the DEFENDER ---

const waterHitByOwner: Action = { kind: 'move', combatantId: 'a2', moveId: 'splash', declaredTarget: 'b1' };

test('passives: Static Tide plants Conduct on the hero its owner just hit with a Water move, and not on the owner', () => {
  const state = withPassive(twoVTwoFixture(340), 'a2', 'staticTide');
  const { state: next, events } = resolveRound(state, [waterHitByOwner], config);

  assert.ok(hasStatus(next.combatants.b1, 'Conduct'), 'the defender is left conducting');
  assert.ok(!hasStatus(next.combatants.a2, 'Conduct'), 'triggerTarget, not triggerSubject — the source role must not mark itself');
  assert.ok(events.some((e) => e.type === 'PassiveTriggered' && e.combatantId === 'a2' && e.passiveId === 'staticTide'));
});

test('passives: Static Tide reads the move TYPE — a Fire hit from the same owner plants nothing', () => {
  const state = withPassive(twoVTwoFixture(341), 'a1', 'staticTide');
  const { state: next } = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'setAlight', declaredTarget: 'b1' }], config);

  assert.ok(!hasStatus(next.combatants.b1, 'Conduct'));
});

test('passives: Static Tide is attribution, not proximity — an ALLY\'s Water move does not plant it', () => {
  const state = withPassive(twoVTwoFixture(342), 'a1', 'staticTide'); // a1 holds it, a2 does the hitting
  const { state: next } = resolveRound(state, [waterHitByOwner], config);

  assert.ok(!hasStatus(next.combatants.b1, 'Conduct'));
});

test('passives: Static Tide marks EVERY target of a spread Water move — one DamageDealt each', () => {
  const state = withPassive(twoVTwoFixture(343), 'a2', 'staticTide');
  const { state: next } = resolveRound(state, [{ kind: 'move', combatantId: 'a2', moveId: 'deluge', declaredTarget: 'b1' }], config);

  assert.ok(hasStatus(next.combatants.b1, 'Conduct'));
  assert.ok(hasStatus(next.combatants.b2, 'Conduct'));
});

test('passives: Bloodthirsty is OFF with no Bleeding enemy and ON the moment one appears', () => {
  const base = twoVTwoFixture(340);
  const held = withPassive(base, 'a1', 'bloodthirsty');
  const hero = heroes.cinderKnight;

  const off = getEffectiveStat(hero, held.combatants.a1, 'attack', boardOf(held));
  assert.strictEqual(off, hero.baseStats.attack, 'no Bleed on the board — the condition does not hold');

  const bleeding = withStatus(held, 'b1', 'Bleed', {});
  assert.strictEqual(getEffectiveStat(hero, bleeding.combatants.a1, 'attack', boardOf(bleeding)), hero.baseStats.attack + 20);
  assert.strictEqual(getEffectiveStat(hero, bleeding.combatants.a1, 'speed', boardOf(bleeding)), hero.baseStats.speed + 20);
});

test('passives: Bloodthirsty reads ENEMIES only — an ally or the owner Bleeding does not arm it', () => {
  const held = withPassive(twoVTwoFixture(341), 'a1', 'bloodthirsty');
  const hero = heroes.cinderKnight;

  for (const id of ['a1', 'a2']) {
    const state = withStatus(held, id, 'Bleed', {});
    assert.strictEqual(getEffectiveStat(hero, state.combatants.a1, 'attack', boardOf(state)), hero.baseStats.attack, `${id} Bleeding must not arm it`);
  }
});

test('passives: Bloodthirsty switches OFF again when the Bleeding enemy faints — nothing has to revoke it', () => {
  const held = withPassive(twoVTwoFixture(342), 'a1', 'bloodthirsty');
  const bleeding = withStatus(held, 'b1', 'Bleed', {});
  const hero = heroes.cinderKnight;
  assert.strictEqual(getEffectiveStat(hero, bleeding.combatants.a1, 'attack', boardOf(bleeding)), hero.baseStats.attack + 20);

  const downed: CombatState = {
    ...bleeding,
    combatants: { ...bleeding.combatants, b1: { ...bleeding.combatants.b1, fainted: true } },
  };
  assert.strictEqual(getEffectiveStat(hero, downed.combatants.a1, 'attack', boardOf(downed)), hero.baseStats.attack);
});

test('passives: a BENCHED Bleeding enemy does not arm Bloodthirsty — active enemies only', () => {
  // Own fixture: twoVTwoFixture has no bench, and a bench is the whole point here.
  const withBench = createFightState(
    343,
    [
      { combatantId: 'a1', heroId: 'cinderKnight', side: 'A' },
      { combatantId: 'a2', heroId: 'tidecaller', side: 'A' },
    ],
    [
      { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
      { combatantId: 'b2', heroId: 'wildOracle', side: 'B' },
      { combatantId: 'b3', heroId: 'stormRanger', side: 'B' },
    ]
  );
  const held = withPassive(withBench, 'a1', 'bloodthirsty');
  assert.deepStrictEqual(held.bench.B, ['b3']);
  const state = withStatus(held, 'b3', 'Bleed', {});
  assert.strictEqual(
    getEffectiveStat(heroes.cinderKnight, state.combatants.a1, 'attack', boardOf(state)),
    heroes.cinderKnight.baseStats.attack
  );
});

test('passives: without a board in the context the conditional grant is simply absent, not applied', () => {
  const held = withPassive(twoVTwoFixture(344), 'a1', 'bloodthirsty');
  const bleeding = withStatus(held, 'b1', 'Bleed', {});
  assert.strictEqual(getEffectiveStat(heroes.cinderKnight, bleeding.combatants.a1, 'attack'), heroes.cinderKnight.baseStats.attack);
});

test('passives: Bloodthirsty moves the damage roll and the turn order, not just the readout', () => {
  const base = withPassive(twoVTwoFixture(345), 'a1', 'bloodthirsty');
  const bleeding = withStatus(base, 'b2', 'Bleed', {});
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'singe', declaredTarget: 'b1' }];

  // b2 Bleeds, b1 is hit, so the Bleed tick does not fold into the HP comparison.
  const maxHp = heroes.ironWarden.baseStats.hp;
  const plain = maxHp - resolveRound(base, actions, config).state.combatants.b1.currentHp;
  const armed = maxHp - resolveRound(bleeding, actions, config).state.combatants.b1.currentHp;
  assert.ok(armed > plain, `expected the armed roll (${armed}) to beat the plain one (${plain})`);

  const withBonus = getEffectiveStat(heroes.cinderKnight, bleeding.combatants.a1, 'speed', boardOf(bleeding));
  assert.strictEqual(withBonus, heroes.cinderKnight.baseStats.speed + 20);
});

// --- Run-tier grant aggregation (src/run/passives.ts) ---

const fireCharm: EquipmentDefinition = { id: 'fireCharm', name: 'Fire Charm', slot: 'accessory', rarity: 'rare', statGrants: {}, grantsPassiveIds: ['emberheart'] };
const plainSword: EquipmentDefinition = { id: 'plainSword', name: 'Plain Sword', slot: 'weapon', rarity: 'common', statGrants: { attack: 5 } };
const equipmentLookup: Record<string, EquipmentDefinition> = { fireCharm, plainSword };

test('passives: equipmentPassiveGrants tallies grants across equipped slots, ignoring stat-only gear', () => {
  const loadout = equipItem(equipItem(createEmptyLoadout(), fireCharm), plainSword);
  assert.deepStrictEqual(equipmentPassiveGrants(loadout, equipmentLookup), { emberheart: 1 });
});

test('passives: relicTeamPassiveGrants stacks a duplicate relic id, matching relicTeamStatModifiers', () => {
  assert.deepStrictEqual(relicTeamPassiveGrants(['emberheart', 'emberheart', 'ironStandard'], relics), { emberheart: 2 });
});

test('passives: mergePassiveGrants sums equipment + relic + Evolution sources additively', () => {
  const merged = mergePassiveGrants({ sanguine: 1 }, { emberheart: 2 }, { sanguine: 1 });
  assert.deepStrictEqual(merged, { sanguine: 2, emberheart: 2 });
});

test('passives: toPassiveInstances converts counts to PassiveInstance records and drops zero counts', () => {
  const instances = toPassiveInstances({ sanguine: 2, emberheart: 0 });
  assert.deepStrictEqual(instances, { sanguine: { passiveId: 'sanguine', stacks: 2 } });
});

// --- Feedback Loop (Tempest / Thunderhead) ---

function stormFixture(seed: number) {
  return createFightState(
    seed,
    [
      { combatantId: 'a1', heroId: 'tempest', side: 'A' },
      { combatantId: 'a2', heroId: 'tempest', side: 'A' },
    ],
    [
      { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
      { combatantId: 'b2', heroId: 'wildOracle', side: 'B' },
    ]
  );
}

const ionizeByOwner: Action = { kind: 'move', combatantId: 'a1', moveId: 'ionize' };

test('passives: Feedback Loop ramps the holder once per Conduct it plants — Ionize marks both foes for +20', () => {
  const state = withPassive(stormFixture(350), 'a1', 'feedbackLoop');
  const { state: next, events } = resolveRound(state, [ionizeByOwner], config);

  assert.ok(hasStatus(next.combatants.b1, 'Conduct') && hasStatus(next.combatants.b2, 'Conduct'));
  assert.strictEqual(next.combatants.a1.statModifiers.intelligence, 20, 'one firing per application');
  assert.strictEqual(events.filter((e) => e.type === 'PassiveTriggered' && e.passiveId === 'feedbackLoop').length, 2);
});

test('passives: Feedback Loop does not re-ramp on an already-Conducting target — Conduct stacks none, so no event fires', () => {
  const marked = withStatus(withStatus(withPassive(stormFixture(351), 'a1', 'feedbackLoop'), 'b1', 'Conduct', {}), 'b2', 'Conduct', {});
  const { state: next } = resolveRound(marked, [ionizeByOwner], config);

  assert.strictEqual(next.combatants.a1.statModifiers.intelligence ?? 0, 0, 'the ramp is priced in fresh marks');
});

test('passives: Feedback Loop is attribution, not proximity — an ally planting Conduct does not ramp the holder', () => {
  const state = withPassive(stormFixture(352), 'a1', 'feedbackLoop'); // a1 holds it, a2 does the marking
  const { state: next } = resolveRound(state, [{ kind: 'move', combatantId: 'a2', moveId: 'ionize' } as Action], config);

  assert.ok(hasStatus(next.combatants.b1, 'Conduct'), 'the mark still lands');
  assert.strictEqual(next.combatants.a1.statModifiers.intelligence ?? 0, 0);
  assert.strictEqual(next.combatants.a2.statModifiers.intelligence ?? 0, 0, 'and the planter does not ramp either');
});

test('passives: Feedback Loop reads the STATUS — a Bleed the holder inflicts pays nothing', () => {
  const state = withPassive(stormFixture(353), 'a1', 'feedbackLoop');
  const { state: next } = resolveRound(
    state,
    [{ kind: 'move', combatantId: 'a1', moveId: 'serratedSlice', declaredTarget: 'b1' } as Action],
    config
  );

  assert.strictEqual(next.combatants.a1.statModifiers.intelligence ?? 0, 0);
});

// --- Restorative Toxin and Nature's Purification (Sylva / Apothecary, Lightsage) ---

function natureFixture(seed: number) {
  return createFightState(
    seed,
    [
      { combatantId: 'a1', heroId: 'wildOracle', side: 'A' },
      { combatantId: 'a2', heroId: 'cinderKnight', side: 'A' },
    ],
    [
      { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
      { combatantId: 'b2', heroId: 'mordax', side: 'B' },
    ]
  );
}

test('passives: Restorative Toxin reads the Poison it just applied — Toxic Spores 10 pays Renew 20', () => {
  const state = withPassive(natureFixture(360), 'a1', 'restorativeToxin');
  const { state: next } = resolveRound(
    state,
    [{ kind: 'move', combatantId: 'a1', moveId: 'toxicSpores', declaredTarget: 'b1' } as Action],
    config
  );

  assert.strictEqual(next.combatants.b1.statuses.Poison?.magnitude, 10);
  // 2x the TRIGGERING magnitude, not an authored flat — the Renew has already ticked and halved once
  // by end of round, so read what it was worth when it landed: 20 healed, 10 left.
  assert.strictEqual(next.combatants.a1.statuses.Renew?.magnitude, 10);
});

test('passives: Restorative Toxin scales with the Poison, so Blight 20 on both foes pays four times over', () => {
  const state = withPassive(natureFixture(361), 'a1', 'restorativeToxin');
  const { events } = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'blight' } as Action], config);

  const renews = events.filter((e) => e.type === 'StatusApplied' && (e as any).statusId === 'Renew') as any[];
  assert.strictEqual(renews.length, 2, 'one firing per Poison application');
  assert.deepStrictEqual(renews.map((r) => r.magnitude), [40, 80], 'Renew 40 twice, stacking additively');
});

test('passives: Restorative Toxin is source-role — a Poison the holder RECEIVES pays nothing', () => {
  const held = withStatus(withPassive(natureFixture(362), 'a1', 'restorativeToxin'), 'a1', 'Poison', { magnitude: 10, duration: 3 });
  assert.ok(!hasStatus(held.combatants.a1, 'Renew'), 'the fixture itself grants nothing');

  const { state: next } = resolveRound(
    held,
    [{ kind: 'move', combatantId: 'b2', moveId: 'toxicSpores', declaredTarget: 'a1' } as Action],
    config
  );
  assert.ok(!hasStatus(next.combatants.a1, 'Renew'), 'being poisoned is not applying Poison');
});

// Sylva benched behind a pair, so arriving is a real switch (a3 in, a1 out) rather than a lead.
function benchedSylvaFixture(seed: number) {
  return createFightState(
    seed,
    [
      { combatantId: 'a1', heroId: 'cinderKnight', side: 'A' },
      { combatantId: 'a2', heroId: 'mordax', side: 'A' },
      { combatantId: 'a3', heroId: 'wildOracle', side: 'A' },
    ],
    [
      { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
      { combatantId: 'b2', heroId: 'tidecaller', side: 'B' },
    ]
  );
}

const sylvaArrives: Action = { kind: 'switch', combatantId: 'a1', benchedCombatantId: 'a3' };

test("passives: Nature's Purification cleanses the PARTNER on arrival, and never the owner", () => {
  const base = withPassive(benchedSylvaFixture(363), 'a3', 'naturesPurification');
  const afflicted = withStatus(withStatus(base, 'a2', 'Burn', { magnitude: 10 }), 'a3', 'Burn', { magnitude: 10 });
  const { state: next } = resolveRound(afflicted, [sylvaArrives], config);

  assert.ok(!hasStatus(next.combatants.a2, 'Burn'), 'the partner is cleansed');
  assert.ok(hasStatus(next.combatants.a3, 'Burn'), "the owner is not — 'ally' aims sideways, never at self");
});

test("passives: Nature's Purification spares a positive status — the partner keeps its Renew", () => {
  const base = withPassive(benchedSylvaFixture(364), 'a3', 'naturesPurification');
  const mixed = withStatus(withStatus(base, 'a2', 'Poison', { magnitude: 10, duration: 3 }), 'a2', 'Renew', { magnitude: 40 });
  const { state: next } = resolveRound(mixed, [sylvaArrives], config);

  assert.ok(!hasStatus(next.combatants.a2, 'Poison'));
  assert.ok(hasStatus(next.combatants.a2, 'Renew'), 'Cleanse spares `positive`, so it never strips its own side up');
});

// --- Entanglement (Cortex / Overmind) ---

function cortexFixture(seed: number) {
  return createFightState(
    seed,
    [
      { combatantId: 'a1', heroId: 'mindweaver', side: 'A' },
      { combatantId: 'a2', heroId: 'tidecaller', side: 'A' },
    ],
    [
      { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
      { combatantId: 'b2', heroId: 'wildOracle', side: 'B' },
    ]
  );
}

test('passives: Entanglement Haunts the enemy whose Wisdom just dropped — Enervate marks without any damage', () => {
  const state = withPassive(cortexFixture(370), 'a1', 'entanglement');
  const { state: next } = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'enervate', declaredTarget: 'b1' } as Action], config);

  assert.ok(hasStatus(next.combatants.b1, 'Haunt'), 'the -30 Wisdom planted the mark');
  assert.ok(!hasStatus(next.combatants.b2, 'Haunt'), 'and only on the one it hit');
});

test('passives: Entanglement reads the SIGN — an enemy whose Wisdom RISES is not marked', () => {
  const state = withPassive(cortexFixture(371), 'a1', 'entanglement');
  // The enemy side buffs its own Wisdom: a stat change on an enemy, but not a drop.
  const { state: next } = resolveRound(state, [{ kind: 'move', combatantId: 'b2', moveId: 'mentalFortress' } as Action], config);

  assert.ok(next.combatants.b1.statModifiers.wisdom! > 0, 'the buff landed');
  assert.ok(!hasStatus(next.combatants.b1, 'Haunt') && !hasStatus(next.combatants.b2, 'Haunt'));
});

test('passives: Entanglement reads the STAT — Lull drops Intelligence and marks nobody', () => {
  const state = withPassive(cortexFixture(372), 'a1', 'entanglement');
  const { state: next } = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'lull', declaredTarget: 'b1' } as Action], config);

  assert.strictEqual(next.combatants.b1.statModifiers.intelligence, -20, 'the debuff landed');
  assert.ok(!hasStatus(next.combatants.b1, 'Haunt'));
});

test("passives: Entanglement is relative to the ENEMY side — the owner's own Wisdom dropping marks nothing", () => {
  const state = withPassive(cortexFixture(373), 'a1', 'entanglement');
  const { state: next } = resolveRound(state, [{ kind: 'move', combatantId: 'b2', moveId: 'enervate', declaredTarget: 'a1' }], config);

  assert.ok(next.combatants.a1.statModifiers.wisdom! < 0, 'Cortex took the Wisdom hit');
  assert.ok(!hasStatus(next.combatants.a1, 'Haunt'));
});

test('passives: Entanglement is what the path is FOR — Disorient marks both, then one Psi Bolt hits both', () => {
  const state = withPassive(cortexFixture(374), 'a1', 'entanglement');
  const marked = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'disorient' } as Action], config).state;
  assert.ok(hasStatus(marked.combatants.b1, 'Haunt') && hasStatus(marked.combatants.b2, 'Haunt'), 'one spread debuff, two marks');

  const { events } = resolveRound(marked, [{ kind: 'move', combatantId: 'a1', moveId: 'psiBolt', declaredTarget: 'b1' } as Action], config);
  const hits = events.filter((e) => e.type === 'DamageDealt') as any[];
  assert.deepStrictEqual(hits.map((h) => h.targetCombatantId).sort(), ['b1', 'b2'], 'aimed at one, lands on both');
  assert.strictEqual(hits.find((h) => h.targetCombatantId === 'b2').viaStatusId, 'Haunt');
});

test('passives: Entanglement does not double a move that ALREADY spreads — only singleEnemy expands', () => {
  // Disorient 50 + Psionic Wave 60 is past Cortex's 75 pool, so this one needs the mana to cast both.
  const base = cortexFixture(375);
  const state = withPassive(
    { ...base, combatants: Object.fromEntries(Object.entries(base.combatants).map(([id, c]) => [id, { ...c, currentMana: 999 }])) } as CombatState,
    'a1',
    'entanglement'
  );
  const marked = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'disorient' } as Action], config).state;
  const { events } = resolveRound(marked, [{ kind: 'move', combatantId: 'a1', moveId: 'psionicWave' } as Action], config);

  const hits = events.filter((e) => e.type === 'DamageDealt') as any[];
  assert.strictEqual(hits.length, 2, 'two foes, two hits — not four');
});

// --- Afterimage (Nightshade / Penumbra) ---

// Deep mana on both sides; the point of these is the ramp and the targeting, not the economy.
function nightshadeFixture(seed: number) {
  const base = createFightState(
    seed,
    [
      { combatantId: 'a1', heroId: 'nightshade', side: 'A' },
      { combatantId: 'a2', heroId: 'crag', side: 'A' },
    ],
    [
      { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
      { combatantId: 'b2', heroId: 'crag', side: 'B' },
    ]
  );
  return {
    ...base,
    combatants: Object.fromEntries(Object.entries(base.combatants).map(([id, c]) => [id, { ...c, currentMana: 999 }])),
  } as CombatState;
}

const vanishes: Action = { kind: 'move', combatantId: 'a1', moveId: 'vanish' };
const strikes: Action = { kind: 'move', combatantId: 'a1', moveId: 'backstab', declaredTarget: 'b1' };

test('passives: Afterimage pays 20 Attack for going hidden', () => {
  const state = withPassive(nightshadeFixture(400), 'a1', 'afterimage');
  const { state: next } = resolveRound(state, [vanishes], config);

  assert.ok(hasStatus(next.combatants.a1, 'Stealth'));
  assert.strictEqual(next.combatants.a1.statModifiers.attack, 20);
});

test("passives: Afterimage costs a FRESH Stealth — Vanishing again while still hidden pays nothing", () => {
  const state = withPassive(nightshadeFixture(401), 'a1', 'afterimage');
  const once = resolveRound(state, [vanishes], config).state;
  const twice = resolveRound(once, [vanishes], config).state;

  // Stealth is stacking 'none', so the second application emits no StatusApplied at all.
  assert.strictEqual(twice.combatants.a1.statModifiers.attack, 20, 'the ramp is gated by the status, not by a cooldown');
});

test('passives: Afterimage ramps on the vanish-strike loop — 20 per cycle, hidden throughout', () => {
  let state = withPassive(nightshadeFixture(402), 'a1', 'afterimage');
  const expected = [20, 20, 40, 40, 60];
  [vanishes, strikes, vanishes, strikes, vanishes].forEach((action, i) => {
    state = resolveRound(state, [action], config).state;
    assert.strictEqual(state.combatants.a1.statModifiers.attack, expected[i], `round ${i + 1}`);
    assert.ok(hasStatus(state.combatants.a1, 'Stealth'), `round ${i + 1} stays hidden`);
  });
});

test('passives: Afterimage pays on top of Shadow Form, which brings its own +75', () => {
  const state = withPassive(nightshadeFixture(403), 'a1', 'afterimage');
  const { state: next } = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'shadowForm' } as Action], config);

  assert.strictEqual(next.combatants.a1.statModifiers.attack, 95, "the move's 75 and the passive's 20 in one cast");
});

test('passives: Afterimage is the RECEIVER role — an enemy going hidden pays Nightshade nothing', () => {
  const state = withPassive(nightshadeFixture(404), 'a1', 'afterimage');
  const { state: next } = resolveRound(state, [{ kind: 'move', combatantId: 'b1', moveId: 'vanish' } as Action], config);

  assert.ok(hasStatus(next.combatants.b1, 'Stealth'));
  assert.strictEqual(next.combatants.a1.statModifiers.attack ?? 0, 0);
});

test('passives: the Stealth Penumbra runs on still bills the PARTNER — a single-target swing redirects', () => {
  const state = withPassive(nightshadeFixture(405), 'a1', 'afterimage');
  const hidden = resolveRound(state, [vanishes], config).state;
  const { events } = resolveRound(hidden, [{ kind: 'move', combatantId: 'b1', moveId: 'heavyBlow', declaredTarget: 'a1' } as Action], config);

  const swing = (events.filter((e) => e.type === 'DamageDealt') as any[]).find((e) => e.sourceCombatantId === 'b1');
  assert.strictEqual(swing.targetCombatantId, 'a2', 'aimed at Nightshade, landed on Crag — that is the price of the path');
});

test('passives: Stealth is not immunity — a SPREAD move ignores it and lands on Nightshade', () => {
  const state = withPassive(nightshadeFixture(406), 'a1', 'afterimage');
  const hidden = resolveRound(state, [vanishes], config).state;
  const { events } = resolveRound(hidden, [{ kind: 'move', combatantId: 'b1', moveId: 'swingingChain' } as Action], config);

  const hits = (events.filter((e) => e.type === 'DamageDealt') as any[]).filter((e) => e.sourceCombatantId === 'b1');
  assert.deepStrictEqual(hits.map((h) => h.targetCombatantId).sort(), ['a1', 'a2'], 'hitting both is the counterplay');
});

// --- Afterglow (Solace / Dawnherald), and the Healed hook it needed ---

// Everyone at a third HP so a heal has room to land, and deep mana.
function solaceFixture(seed: number) {
  const base = createFightState(
    seed,
    [
      { combatantId: 'a1', heroId: 'dawnwarden', side: 'A' },
      { combatantId: 'a2', heroId: 'crag', side: 'A' },
    ],
    [
      { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
      { combatantId: 'b2', heroId: 'dawnwarden', side: 'B' },
    ]
  );
  return {
    ...base,
    combatants: Object.fromEntries(
      Object.entries(base.combatants).map(([id, c]) => [id, { ...c, currentMana: 999, currentHp: Math.floor(c.currentHp / 3) }])
    ),
  } as CombatState;
}

const mends: Action = { kind: 'move', combatantId: 'a1', moveId: 'mend', declaredTarget: 'a2' };

test('passives: Afterglow buys the healed ally 20 Attack AND 20 Intelligence', () => {
  const state = withPassive(solaceFixture(500), 'a1', 'afterglow');
  const { state: next } = resolveRound(state, [mends], config);

  assert.strictEqual(next.combatants.a2.statModifiers.attack, 20);
  assert.strictEqual(next.combatants.a2.statModifiers.intelligence, 20);
  assert.strictEqual(next.combatants.a1.statModifiers.attack ?? 0, 0, 'only the one healed');
});

test('passives: Afterglow reports one StatChanged per stat, the way a move does', () => {
  const state = withPassive(solaceFixture(501), 'a1', 'afterglow');
  const { events } = resolveRound(state, [mends], config);

  const changes = (events.filter((e) => e.type === 'StatChanged') as any[]).filter((e) => e.combatantId === 'a2');
  assert.deepStrictEqual(changes.map((c) => c.stat).sort(), ['attack', 'intelligence']);
  assert.ok(changes.every((c) => c.delta === 20));
});

test('passives: Afterglow fires once per target of a spread heal, and stacks across casts', () => {
  const state = withPassive(solaceFixture(502), 'a1', 'afterglow');
  const consecrates: Action = { kind: 'move', combatantId: 'a1', moveId: 'consecrate' };
  const once = resolveRound(state, [consecrates], config).state;
  assert.strictEqual(once.combatants.a1.statModifiers.attack, 20, 'a self-heal counts');
  assert.strictEqual(once.combatants.a2.statModifiers.attack, 20);

  const twice = resolveRound(once, [consecrates], config).state;
  assert.strictEqual(twice.combatants.a2.statModifiers.attack, 40, 'nothing caps it but the mana');
});

test('passives: Afterglow is source-role — being healed BY someone does not arm it', () => {
  const state = withPassive(solaceFixture(503), 'a2', 'afterglow');
  const { state: next } = resolveRound(state, [mends], config);

  assert.strictEqual(next.combatants.a2.statModifiers.attack ?? 0, 0, 'receiving a heal is not casting one');
});

test('passives: Afterglow pays at FULL HP — the heal is wasted and the buff is not', () => {
  const base = solaceFixture(504);
  const full = {
    ...base,
    combatants: Object.fromEntries(
      Object.entries(base.combatants).map(([id, c]) => [id, { ...c, currentHp: heroes[c.heroId].baseStats.hp }])
    ),
  } as CombatState;
  const { state: next } = resolveRound(withPassive(full, 'a1', 'afterglow'), [mends], config);

  assert.strictEqual(next.combatants.a2.currentHp, heroes.crag.baseStats.hp, 'no HP to give back');
  assert.strictEqual(next.combatants.a2.statModifiers.attack, 20, 'the turn still bought something');
});

// --- The last four starters: Overspill, Communion, Tempering, Combustion ---

function pairFixture(seed: number, a1: string, a2: string, bench?: string) {
  const allies = [
    { combatantId: 'a1', heroId: a1, side: 'A' as const },
    { combatantId: 'a2', heroId: a2, side: 'A' as const },
    ...(bench ? [{ combatantId: 'a3', heroId: bench, side: 'A' as const }] : []),
  ];
  const base = createFightState(seed, allies, [
    { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
    { combatantId: 'b2', heroId: 'crag', side: 'B' },
  ]);
  return {
    ...base,
    combatants: Object.fromEntries(
      Object.entries(base.combatants).map(([id, c]) => [id, { ...c, currentMana: 999, currentHp: Math.floor(c.currentHp / 2) }])
    ),
  } as CombatState;
}

test('passives: Overspill grants mana on arrival, and it OVERFLOWS the pool', () => {
  const state = withPassive(pairFixture(600, 'crag', 'crag', 'runescribe'), 'a3', 'overspill');
  const before = state.combatants.a3.currentMana;
  const { state: next, events } = resolveRound(state, [{ kind: 'switch', combatantId: 'a1', benchedCombatantId: 'a3' } as Action], config);

  assert.strictEqual(next.combatants.a3.currentMana, before + 50);
  const granted = events.find((e) => e.type === 'ManaGranted') as any;
  assert.strictEqual(granted.amount, 50);
  assert.ok(granted.overflow > 0, 'past the 85 pool — uncapped, like a move grant');
  assert.strictEqual(granted.moveId, undefined, 'no move did this');
});

test('passives: Overspill is what makes Singularity castable — 150 mana against an 85 pool', () => {
  const base = pairFixture(601, 'crag', 'crag', 'runescribe');
  const drained = {
    ...base,
    combatants: { ...base.combatants, a3: { ...base.combatants.a3, currentMana: 110 } },
  } as CombatState;
  const { state: next } = resolveRound(
    withPassive(drained, 'a3', 'overspill'),
    [{ kind: 'switch', combatantId: 'a1', benchedCombatantId: 'a3' } as Action],
    config
  );

  assert.ok(next.combatants.a3.currentMana >= moves.singularity.manaCost, 'arrives able to cast it');
});

test('passives: Communion passes a DRAIN through to the partner, one for one', () => {
  const state = withPassive(pairFixture(602, 'revenant', 'crag'), 'a1', 'communion');
  const before = state.combatants.a2.currentHp;
  const { state: next, events } = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'drain', declaredTarget: 'b1' } as Action], config);

  const drained = (events.find((e) => e.type === 'Healed') as any).amount;
  assert.ok(drained > 0, 'the drain landed');
  assert.strictEqual(next.combatants.a2.currentHp, before + drained, 'the partner got the same');
});

test('passives: Communion needs a partner — alone on the field it is silent, not a crash', () => {
  const base = pairFixture(603, 'revenant', 'crag');
  const solo = { ...base, active: { ...base.active, A: ['a1', null] } } as CombatState;
  const { state: next } = resolveRound(withPassive(solo, 'a1', 'communion'), [{ kind: 'move', combatantId: 'a1', moveId: 'drain', declaredTarget: 'b1' } as Action], config);

  assert.ok(next.combatants.a1.currentHp > 0);
});

test('passives: Tempering hardens Valor every time it is hit', () => {
  // Full HP: at half, Heavy Blow twice kills Valor before the second stack can land.
  const base = pairFixture(604, 'valor', 'crag');
  const state = withPassive(
    { ...base, combatants: Object.fromEntries(Object.entries(base.combatants).map(([id, c]) => [id, { ...c, currentHp: heroes[c.heroId].baseStats.hp }])) } as CombatState,
    'a1',
    'tempering'
  );
  const swing: Action = { kind: 'move', combatantId: 'b1', moveId: 'heavyBlow', declaredTarget: 'a1' };
  const once = resolveRound(state, [swing], config).state;
  assert.strictEqual(once.combatants.a1.statModifiers.defense, 10);

  const twice = resolveRound(once, [swing], config).state;
  assert.strictEqual(twice.combatants.a1.statModifiers.defense, 20, 'it compounds — the Pact Clock is what ends this');
});

test('passives: Tempering is the RECEIVER role — Valor dealing damage hardens nothing', () => {
  const state = withPassive(pairFixture(605, 'valor', 'crag'), 'a1', 'tempering');
  const { state: next } = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'ironFist', declaredTarget: 'b1' } as Action], config);

  assert.strictEqual(next.combatants.a1.statModifiers.defense ?? 0, 0);
});

test('passives: Combustion turns Clockwork\'s own Meltdown backfire into Attack', () => {
  const state = withPassive(pairFixture(606, 'forgewright', 'crag'), 'a1', 'combustion');
  const { state: next } = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'meltdown' } as Action], config);

  assert.ok(hasStatus(next.combatants.a1, 'Burn'), 'Meltdown burns its own caster');
  assert.strictEqual(next.combatants.a1.statModifiers.attack, 20, 'and that is the point');
});

test('passives: Combustion reads the ROLE — burning a FOE with a clean Fire move pays nothing', () => {
  // Set Alight, not Backfire: Mech's own Burn moves all hit the caster too, so they cannot
  // separate the roles. Fire's line is the only clean way to burn a foe and nobody else.
  const state = withPassive(pairFixture(607, 'forgewright', 'crag'), 'a1', 'combustion');
  const { state: next } = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'setAlight', declaredTarget: 'b1' } as Action], config);

  assert.ok(hasStatus(next.combatants.b1, 'Burn'), 'the foe is burning');
  assert.strictEqual(next.combatants.a1.statModifiers.attack ?? 0, 0, 'but Clockwork is not');
});

// --- Enthrall (Riptide / Siren) ---

function riptideFixture(seed: number) {
  const base = createFightState(
    seed,
    [
      { combatantId: 'a1', heroId: 'tidecaller', side: 'A' },
      { combatantId: 'a2', heroId: 'crag', side: 'A' },
    ],
    [
      { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
      { combatantId: 'b2', heroId: 'crag', side: 'B' },
    ]
  );
  return {
    ...base,
    combatants: Object.fromEntries(Object.entries(base.combatants).map(([id, c]) => [id, { ...c, currentMana: 999 }])),
  } as CombatState;
}

const waterHit: Action = { kind: 'move', combatantId: 'a1', moveId: 'torrent', declaredTarget: 'b1' };

test('passives: Enthrall Haunts what its Water hits, and only that', () => {
  const state = withPassive(riptideFixture(700), 'a1', 'enthrall');
  const { state: next } = resolveRound(state, [waterHit], config);

  assert.ok(hasStatus(next.combatants.b1, 'Haunt'));
  assert.ok(!hasStatus(next.combatants.b2, 'Haunt'));
});

test('passives: Enthrall plants with Water and cashes with the GRAFT — a Mind move then hits both', () => {
  const state = withPassive(riptideFixture(701), 'a1', 'enthrall');
  const marked = resolveRound(state, [waterHit], config).state;
  const { events } = resolveRound(marked, [{ kind: 'move', combatantId: 'a1', moveId: 'psyshock', declaredTarget: 'b2' } as Action], config);

  const hits = (events.filter((e) => e.type === 'DamageDealt') as any[]).filter((h) => h.sourceCombatantId === 'a1');
  assert.deepStrictEqual(hits.map((h) => h.targetCombatantId).sort(), ['b1', 'b2']);
  assert.strictEqual(hits.find((h) => h.targetCombatantId === 'b1').viaStatusId, 'Haunt');
});

test('passives: Enthrall keeps planting and cashing in SEPARATE columns — Water never spreads off its own mark', () => {
  const state = withPassive(riptideFixture(702), 'a1', 'enthrall');
  const marked = resolveRound(state, [waterHit], config).state;
  // b1 is Haunted; a Water move aimed at b2 would spread if Water triggered Haunt. It does not:
  // Haunt.spreadTriggerTypes is Spirit and Mind, which is what makes the graft load-bearing.
  const { events } = resolveRound(marked, [{ kind: 'move', combatantId: 'a1', moveId: 'torrent', declaredTarget: 'b2' } as Action], config);

  const hits = (events.filter((e) => e.type === 'DamageDealt') as any[]).filter((h) => h.sourceCombatantId === 'a1');
  assert.deepStrictEqual(hits.map((h) => h.targetCombatantId), ['b2']);
});

test('passives: Enthrall reads the move TYPE — a non-Water hit from the same hero plants nothing', () => {
  const state = withPassive(riptideFixture(703), 'a1', 'enthrall');
  const { state: next } = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'psyshock', declaredTarget: 'b1' } as Action], config);

  assert.ok(!hasStatus(next.combatants.b1, 'Haunt'));
});

// --- The recruit-only slate's four NEW shapes (2026-09-05) ---
// The other new passives are transpositions of shapes already pinned above. These four are not:
// a status aimed at a GROUP, a source-role StatusApplied landing on triggerTarget, a source-role
// DamageDealt paying a STAT to the defender, and an arrival applying a duration-shape status.

/** Deep HP and mana so a reaction is never swallowed by a KO — a fainted target is skipped. */
function deepFixture(seed: number, sideA: readonly string[], sideB: readonly string[]): CombatState {
  const base = createFightState(
    seed,
    sideA.map((heroId, i) => ({ combatantId: `a${i + 1}`, heroId, side: 'A' as const })),
    sideB.map((heroId, i) => ({ combatantId: `b${i + 1}`, heroId, side: 'B' as const }))
  );
  return {
    ...base,
    combatants: Object.fromEntries(
      Object.entries(base.combatants).map(([id, c]) => [
        id,
        { ...c, currentMana: 999, currentHp: 1200, statModifiers: { ...c.statModifiers, manaPool: 999, hp: 1200 } },
      ])
    ),
  } as CombatState;
}

test('passives: Cinderguard answers a hit on BOTH active enemies — a status effect aimed at a group', () => {
  // There is no 'triggerSource' target, so a retaliation passive cannot reach its attacker alone.
  const state = withPassive(deepFixture(800, ['cinderKnight', 'aegis'], ['crag', 'sentinel']), 'a1', 'cinderguard');
  const { state: next } = resolveRound(
    state,
    [{ kind: 'move', combatantId: 'b1', moveId: 'rockToss', declaredTarget: 'a1' } as Action],
    config
  );

  assert.ok(hasStatus(next.combatants.b1, 'Burn'), 'the attacker catches it');
  assert.ok(hasStatus(next.combatants.b2, 'Burn'), 'and so does its partner — the group is the target');
  assert.ok(!hasStatus(next.combatants.a2, 'Burn'), 'never the owner\'s own side');
});

test("passives: Widow's Kiss reads a Bleed IT applied and Poisons the same target", () => {
  const state = withPassive(deepFixture(801, ['widow', 'aegis'], ['crag', 'sentinel']), 'a1', 'widowsKiss');
  const { state: next } = resolveRound(
    state,
    [{ kind: 'move', combatantId: 'a1', moveId: 'lacerate', declaredTarget: 'b1' } as Action],
    config
  );

  // Source-role, so 'triggerSubject' is Widow itself — triggerTarget is the only route to the victim.
  assert.ok(hasStatus(next.combatants.b1, 'Bleed'));
  assert.ok(!hasStatus(next.combatants.a1, 'Poison'), 'the rider lands on the bleeder, not the biter');
  assert.ok(!hasStatus(next.combatants.b2, 'Poison'));

  // Poison's 3-round timer is authored per APPLICATION, not defaulted by the catalog. Omit it and
  // the timer starts at 0, so the payload fires at the end of the round it landed in — which is a
  // burst, not a clock. It survived this round, which is the assertion that catches that.
  assert.strictEqual(next.combatants.b1.statuses.Poison?.duration, 2, 'one round off a 3-round timer');
  assert.strictEqual(next.combatants.b1.statuses.Poison?.magnitude, 10);
});

test('passives: Constrict pays a STAT to the hero its magical hit landed on, and reads the category', () => {
  const magical = withPassive(deepFixture(802, ['coil', 'aegis'], ['crag', 'sentinel']), 'a1', 'constrict');
  const { state: slowed } = resolveRound(
    magical,
    [{ kind: 'move', combatantId: 'a1', moveId: 'psiBolt', declaredTarget: 'b1' } as Action],
    config
  );
  assert.strictEqual(slowed.combatants.b1.statModifiers.speed, -10);
  assert.strictEqual(slowed.combatants.b2.statModifiers.speed ?? 0, 0);

  const physical = withPassive(deepFixture(803, ['coil', 'aegis'], ['crag', 'sentinel']), 'a1', 'constrict');
  const { state: untouched } = resolveRound(
    physical,
    [{ kind: 'move', combatantId: 'a1', moveId: 'rally' } as Action],
    config
  );
  assert.strictEqual(untouched.combatants.b1.statModifiers.speed ?? 0, 0, 'a non-damaging Beast buff plants nothing');
});

test('passives: Sentry Provokes Warden on arrival, and the redirect covers the round it arrived in', () => {
  const state = withPassive(deepFixture(804, ['aegis', 'crag', 'ironWarden'], ['crag', 'sentinel']), 'a3', 'sentry');
  // Switches resolve before moves, so the arrival lands the mark in time for the same round — and
  // Provoke ticks at END of round, so it is gone again by the time the round returns. Assert the
  // REDIRECT, not the leftover status: the enemy declares on the partner and hits Warden instead.
  const { events } = resolveRound(
    state,
    [
      { kind: 'switch', combatantId: 'a1', benchedCombatantId: 'a3' } as Action,
      { kind: 'move', combatantId: 'b1', moveId: 'rockToss', declaredTarget: 'a2' } as Action,
    ],
    config
  );

  const applied = events.filter((e) => e.type === 'StatusApplied' && e.statusId === 'Provoke');
  assert.deepStrictEqual(applied.map((e) => (e.type === 'StatusApplied' ? e.combatantId : '')), ['a3']);
  const hit = events.find((e) => e.type === 'DamageDealt');
  assert.ok(hit && hit.type === 'DamageDealt');
  assert.strictEqual(hit.targetCombatantId, 'a3', 'the swing aimed at the partner arrived on Warden');
});
