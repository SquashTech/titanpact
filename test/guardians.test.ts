// The six Guardian champions (src/data/enemies.ts): what the faction test files pinned about
// them before the factions went (docs/titanspawn-overhaul.md §7). A champion is the one place
// the type chart is allowed to lie (§1), so the wall and the kit shape are guarded here.

import * as assert from 'assert';
import { test } from './harness';
import { moves } from '../src/data/moves';
import { statusApplicationsOf } from '../src/engine/content';
import { enemies, CHAMPION_IDS, ELDER_BOUGH_ID, ENDBRINGER_ID, LAVA_BEAST_ID, KRAKEN_ID, SKELETON_KING_ID, YUGZULACH_ID, unsealedIdFor } from '../src/data/enemies';
import { guardianMarkup, isGuardianFigure } from '../src/view/shared/guardianFigures';
import { getTypeColor } from '../src/view/combat/typeColors';
import { locations } from '../src/data/locations';
import { typeChart } from '../src/data/typechart';
import { resolveTypeMult } from '../src/engine/damage/typeMult';
import { MOVE_CAP } from '../src/run/progression';
import { COMBAT_BUDGET_STATS, statBudgetTotal } from '../src/run/statBudget';
import type { HeroDefinition } from '../src/engine/content';

const statTotal = (hero: HeroDefinition) => statBudgetTotal(hero.baseStats, COMBAT_BUDGET_STATS);

test('guardians: every champion is a 550 Ancient-second line at 20 MP Regen with a full kit on both pipelines', () => {
  for (const id of CHAMPION_IDS) {
    const champion = enemies[id];
    assert.strictEqual(statTotal(champion), 550, `${id} is off the champion line`);
    assert.strictEqual(champion.types[1], 'Ancient', `${id} carries no seal`);
    assert.strictEqual(champion.baseStats.mpRegen, 20, `${id} moves the regen ceiling`);
    assert.strictEqual(champion.moveIds.length, MOVE_CAP);
    const categories = new Set(champion.moveIds.map((m) => moves[m].category));
    assert.ok(categories.has('physical') && categories.has('magical'), `${id} swings on one pipeline only`);
    for (const stat of Object.keys(champion.baseStats)) {
      if (stat === 'mpRegen') continue;
      assert.strictEqual(champion.baseStats[stat as keyof typeof champion.baseStats] % 5, 0, `${id}.${stat} is not a multiple of 5`);
    }
  }
});

test('guardians: Ancient is a pure defensive wall — nothing is super-effective on any champion', () => {
  for (const id of CHAMPION_IDS) {
    for (const attacker of Object.keys(typeChart) as (keyof typeof typeChart)[]) {
      assert.ok(resolveTypeMult(typeChart, attacker, enemies[id].types) <= 1, `${attacker} breaks ${id}'s wall`);
    }
  }
});

test("guardians: every champion's mortal half sits inside its own Location's spawn types", () => {
  // So the Location's answer is the Guardian's answer in every case today — the one exception the
  // run could carry is still an open question (docs/titanspawn-overhaul.md §10).
  for (const location of Object.values(locations)) {
    if (!location.guardianFinalEnemyId || !location.spawnTypes?.length) continue;
    const [mortal] = enemies[location.guardianFinalEnemyId].types;
    assert.ok(location.spawnTypes.includes(mortal), `${location.id}'s champion is ${mortal}, outside ${location.spawnTypes.join('/')}`);
  }
  // The Foundry's answer runs out at its Guardian: Water is 2x on every Fire spawn and 1x here.
  assert.strictEqual(resolveTypeMult(typeChart, 'Water', enemies[LAVA_BEAST_ID].types), 1);
});

test('guardians: Yugzulach and the Kraken carry their authored kits', () => {
  assert.deepStrictEqual([...enemies[YUGZULACH_ID].moveIds], ['runicBlast', 'forgottenCurse', 'duskBlade', 'eclipse']);
  assert.deepStrictEqual([...enemies[KRAKEN_ID].moveIds], ['aquaSlice', 'maelstrom', 'archonBlast', 'tsunami']);
});

test('guardians: the Elder Bough is one turn paying out three times, and Speed 30 is the price', () => {
  const guardian = enemies[ELDER_BOUGH_ID];
  assert.deepStrictEqual([...guardian.moveIds], ['runicBlast', 'overgrowth', 'branchSlam', 'forceOfNature']);
  // Overgrowth is the three-payout turn: Renew on itself, Attack under Verdant Earth, and the
  // switch that doubles Branch Slam's 80 base power.
  const selfPlant = statusApplicationsOf(moves.overgrowth).find((app) => app.statusId === 'Renew')!.magnitude!;
  assert.strictEqual(selfPlant, 150);
  assert.strictEqual(moves.branchSlam.conditionalPower!.requiresUserStatus, 'Renew');
  assert.strictEqual(moves.forceOfNature.fieldEffectApplication, 'verdantEarth');
  assert.ok(guardian.baseStats.manaPool >= moves.overgrowth.manaCost + moves.branchSlam.manaCost);
  for (const id of CHAMPION_IDS) {
    if (id === ELDER_BOUGH_ID) continue;
    assert.ok(guardian.baseStats.speed < enemies[id].baseStats.speed, `the Elder Bough outruns the ${id}`);
  }
});

test('guardians: the Lava Beast lights its own ground and grinds on it, and never burns itself', () => {
  const guardian = enemies[LAVA_BEAST_ID];
  assert.deepStrictEqual([...guardian.moveIds], ['runicBlast', 'spreadingBlaze', 'immolate', 'firebrand']);
  assert.ok(guardian.moveIds.includes('spreadingBlaze'), 'the boss no longer lights the ground it burns on');
  // Volcanic Surge's self Burn did not decay on the boss's own Scorched Land — guarded, not assumed.
  for (const moveId of guardian.moveIds) {
    for (const app of statusApplicationsOf(moves[moveId])) {
      assert.notStrictEqual(app.target, 'self', `${moveId} puts ${app.statusId} back on the Guardian`);
    }
  }
  const perRound = Math.max(...guardian.moveIds.map((id) => moves[id].manaCost));
  assert.ok(guardian.baseStats.manaPool >= perRound * 3, 'the Guardian has to Rest inside a normal fight');
});

test('guardians: the Skeleton King is the lowest-HP champion, and that IS the fight', () => {
  const guardian = enemies[SKELETON_KING_ID];
  assert.deepStrictEqual([...guardian.moveIds], ['runicBlast', 'poltergeist', 'wailingFlight', 'vengeance']);
  // It plants its own mark and then triples under 25%.
  assert.ok(guardian.moveIds.some((m) => statusApplicationsOf(moves[m]).some((a) => a.statusId === 'Haunt')));
  assert.ok(guardian.moveIds.includes('vengeance'));
  for (const id of CHAMPION_IDS) {
    if (id === SKELETON_KING_ID) continue;
    assert.ok(guardian.baseStats.hp < enemies[id].baseStats.hp, `the ${id} is squishier than the King`);
  }
  // No self-destruct: a boss that ends itself makes turtling the answer.
  assert.ok(!guardian.moveIds.includes('lastRites'));
  for (const moveId of guardian.moveIds) {
    for (const app of statusApplicationsOf(moves[moveId])) {
      assert.notStrictEqual(app.target, 'self', `${moveId} puts ${app.statusId} back on the Guardian`);
    }
  }
});

test('guardians: every champion, its unsealed twin and the Endbringer have a figure, and the seal comes off with the Ancient half', () => {
  const ancient = getTypeColor('Ancient');
  for (const id of CHAMPION_IDS) {
    for (const pose of ['idle', 'attack', 'hurt'] as const) {
      const sealed = guardianMarkup(id, pose, 't');
      const unsealed = guardianMarkup(unsealedIdFor(id), pose, 't');
      assert.ok(sealed.length > 0 && unsealed.length > 0, `${id} has no ${pose} figure`);
      assert.notStrictEqual(sealed, unsealed, `${id}'s unsealed figure still wears the seal`);
      // The ring is the one Ancient-coloured thing on a Guardian, and the finale's body has none of it.
      assert.ok(sealed.includes(ancient), `${id}'s seal is not drawn in the Ancient hue`);
      assert.ok(!unsealed.includes(ancient), `${id} unsealed still carries the Ancient hue`);
    }
  }
  assert.ok(guardianMarkup(ENDBRINGER_ID, 'idle', 't').includes(ancient), 'the Endbringer is not drawn in the Ancient hue');
  assert.ok(isGuardianFigure(ENDBRINGER_ID) && isGuardianFigure(unsealedIdFor(KRAKEN_ID)));
  assert.strictEqual(guardianMarkup('valor', 'idle', 't'), '', 'a hero is never drawn as a Guardian');
});
