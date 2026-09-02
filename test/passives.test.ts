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
  const { state: next } = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'ember', declaredTarget: 'b1' }], config);

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
