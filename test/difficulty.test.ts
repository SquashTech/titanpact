import * as assert from 'assert';
import { test } from './harness';
import { ENCOUNTERS_PER_ACT, MAX_LEVEL, levelAfterEncounters, levelOf } from '../src/run/growth';
import {
  ACT_ONE_ELITE_HERO_COUNT,
  CHAMPION_LEVEL_BONUS,
  ENCOUNTERS_BEFORE_NODE,
  ENEMY_LEVEL_OFFSET,
  NO_SCALING,
  championLevel,
  encounterHeroCountOverride,
  encounterScaling,
  enemyLevelFor,
  parLevelAtNode,
  type EncounterNodeKind,
} from '../src/run/difficulty';
import { appendFinalEnemy, generateEncounter, generateSpawnEncounter } from '../src/run/enemyGen';
import { MOVE_CAP } from '../src/run/progression';
import { MASTERY_EVOLUTION, masteryForAct } from '../src/run/mastery';
import { heroes } from '../src/data/heroes';
import { equipment, familyFitsHero, rollFittingGear } from '../src/data/equipment';
import { ENCHANTMENTS } from '../src/run/equipment';
import { enemies } from '../src/data/enemies';
import { titanspawn } from '../src/data/titanspawn';
import { locations } from '../src/data/locations';
import { mobEncounter } from '../src/run/spawn';
import { progressionTable } from '../src/data/progression';
import { SEAL_ACTS, TOTAL_ACTS } from '../src/run/state';
import { grantBudgetTotal } from '../src/run/statBudget';
import type { StatKey } from '../src/engine/content';

const NODE_KINDS: readonly EncounterNodeKind[] = ['fight', 'skirmish', 'battle', 'elite', 'boss'];

function growthTotal(grants: Partial<Record<string, number>>): number {
  return grantBudgetTotal(grants as Partial<Record<StatKey, number>>);
}

test('difficulty: an enemy level is the player par entering its node, plus the kind offset', () => {
  for (let act = 1; act <= SEAL_ACTS; act++) {
    for (const kind of NODE_KINDS) {
      const par = levelAfterEncounters((act - 1) * ENCOUNTERS_PER_ACT + ENCOUNTERS_BEFORE_NODE[kind]);
      assert.strictEqual(parLevelAtNode(kind, act), par, `act ${act} ${kind} par`);
      assert.strictEqual(
        enemyLevelFor(kind, act),
        Math.max(1, Math.min(MAX_LEVEL, par + ENEMY_LEVEL_OFFSET[kind])),
        `act ${act} ${kind}: the level must read off the player curve, not a table beside it`
      );
      assert.strictEqual(encounterScaling(kind, act).level, enemyLevelFor(kind, act));
    }
  }
});

test('difficulty: the offsets order the act — opener under par, Skirmish at it, Elite over it, the champion over its escorts', () => {
  assert.ok(ENEMY_LEVEL_OFFSET.fight < 0, 'the opener is the act\'s lightest fight');
  assert.ok(ENEMY_LEVEL_OFFSET.skirmish >= 0, 'a Skirmish contract never trails a hire on level (test/recruitment)');
  assert.ok(ENEMY_LEVEL_OFFSET.elite > ENEMY_LEVEL_OFFSET.skirmish, 'the Elite is the fork\'s harder tile');
  // The Guardian is beaten on its BODY — a 550 champion over the act's tier of escorts — so its
  // level sits under par (docs/enemy-levels.md §4); the champion still tops its own escorts.
  assert.ok(ENEMY_LEVEL_OFFSET.boss <= 0 && CHAMPION_LEVEL_BONUS > 0);
  for (let act = 1; act <= SEAL_ACTS; act++) {
    assert.ok(enemyLevelFor('fight', act) < enemyLevelFor('skirmish', act), `act ${act}: opener under the Skirmish`);
    assert.ok(enemyLevelFor('skirmish', act) < enemyLevelFor('elite', act), `act ${act}: Skirmish under the Elite`);
    assert.ok(championLevel(enemyLevelFor('boss', act)) > enemyLevelFor('boss', act), `act ${act}: the champion over its escorts`);
  }
});

test('difficulty: levels never run backwards across the run, and clamp at the cap and the floor', () => {
  for (const kind of NODE_KINDS) {
    for (let act = 2; act <= SEAL_ACTS; act++) {
      assert.ok(enemyLevelFor(kind, act) >= enemyLevelFor(kind, act - 1), `${kind} act ${act} goes backwards`);
    }
  }
  assert.strictEqual(enemyLevelFor('fight', 1), 1, 'the run opener is level 1 — the on-ramp');
  assert.ok(enemyLevelFor('finale', TOTAL_ACTS) <= MAX_LEVEL);
  assert.strictEqual(championLevel(MAX_LEVEL), MAX_LEVEL);
  // A junk act clamps rather than producing an undefined level.
  assert.strictEqual(enemyLevelFor('boss', 0), enemyLevelFor('boss', 1));
  assert.ok(Number.isInteger(enemyLevelFor('boss', 99)));
});

test('difficulty: an enemy carries the growth its level earned — the ONE stat axis', () => {
  for (const act of [1, 2, 3, 4, 5]) {
    const scaling = encounterScaling('elite', act);
    const { run } = generateEncounter('elite', 3, heroes, { scaling });
    for (const entry of run.roster) {
      assert.strictEqual(levelOf(entry), scaling.level, `act ${act} level`);
      assert.deepStrictEqual(entry.evolutionStatGrants, {}, `act ${act}: no node-kind bonus, no act-steps`);
      const gained = growthTotal(entry.growthStatGrants);
      if (scaling.level > 1) {
        assert.ok(gained > (scaling.level - 1) * 4, `act ${act} ${entry.heroId}: ${gained} over ${scaling.level - 1} levels is too thin to be a roll`);
      } else {
        assert.strictEqual(gained, 0);
      }
    }
  }
});

test('difficulty: the champion arrives CHAMPION_LEVEL_BONUS over its escorts, grown to that level', () => {
  const scaling = encounterScaling('boss', 4);
  const base = generateEncounter('boss', 8, heroes, { scaling });
  const { run } = appendFinalEnemy(base, 'lavaBeast', enemies, 9, scaling);
  const champion = run.roster.find((r) => r.rosterId === 'lavaBeast')!;
  assert.strictEqual(levelOf(champion), championLevel(scaling.level));
  assert.strictEqual(levelOf(champion), scaling.level + CHAMPION_LEVEL_BONUS);
  assert.ok(growthTotal(champion.growthStatGrants) > 0, 'a champion is no longer a flat line');
  assert.strictEqual(champion.mastery, scaling.mastery);
});

test('difficulty: scaled enemies arrive at the act\'s pips, and evolve on the SAME gate a roster hero reads', () => {
  // One model for everybody (docs/xp-overhaul.md §4, docs/mastery.md §4): an enemy holds the
  // act's Mastery (masteryForAct), so it is evolved exactly when a roster hero with those pips
  // would be — every hero-pool enemy from Act 4 — and a contract hero IS the enemy you beat.
  for (const act of [1, 2, 3, 4, 5]) {
    const scaling = encounterScaling('elite', act);
    assert.strictEqual(scaling.mastery, masteryForAct(act));
    const { run } = generateEncounter('elite', 12, heroes, { scaling, progression: progressionTable });
    for (const entry of run.roster) {
      const evolved = scaling.mastery >= MASTERY_EVOLUTION;
      assert.strictEqual(levelOf(entry), scaling.level, `act ${act} level`);
      assert.strictEqual(entry.mastery, scaling.mastery, `act ${act} pips`);
      assert.strictEqual(
        entry.chosenPathIds.length,
        evolved ? 1 : 0,
        `act ${act} ${entry.heroId} should ${evolved ? '' : 'not '}have evolved`
      );
    }
  }
});

test('difficulty: a scaled enemy spends its level-ups on moves, never past MOVE_CAP', () => {
  const { run } = generateEncounter('elite', 21, heroes, {
    scaling: encounterScaling('elite', 5),
    progression: progressionTable,
  });
  for (const entry of run.roster) {
    assert.ok(entry.unlockedMoveIds.length <= MOVE_CAP, `${entry.heroId} has ${entry.unlockedMoveIds.length} moves`);
    assert.strictEqual(new Set(entry.unlockedMoveIds).size, entry.unlockedMoveIds.length);
    // Act 5's Elite is past every schedule offer: six on top of three starting moves always reach the cap.
    assert.strictEqual(entry.unlockedMoveIds.length, MOVE_CAP);
  }
});

test('difficulty: an unscaled encounter is byte-for-byte the authored content at level 1', () => {
  const { run } = generateEncounter('fight', 4, heroes, { scaling: NO_SCALING, progression: progressionTable });
  for (const entry of run.roster) {
    assert.strictEqual(levelOf(entry), 1);
    assert.deepStrictEqual(entry.evolutionStatGrants, {});
    assert.deepStrictEqual(entry.growthStatGrants, {});
    assert.deepStrictEqual(entry.chosenPathIds, []);
    assert.deepStrictEqual(entry.unlockedMoveIds, [...heroes[entry.heroId].moveIds]);
  }
});

test('difficulty: a spawn levels off its line\'s grades, and has no progression to cash a level in for', () => {
  const act5 = encounterScaling('fight', 5);
  const { run } = generateSpawnEncounter(11, { types: null, leaderTier: 'mid', escortTier: 'early', escortCount: 3, scaling: act5 });
  for (const entry of run.roster) {
    assert.strictEqual(levelOf(entry), act5.level);
    assert.ok(growthTotal(entry.growthStatGrants) > 0, 'a spawn rolls growth like anyone');
    assert.deepStrictEqual(entry.evolutionStatGrants, {});
    assert.deepStrictEqual(entry.chosenPathIds, []);
    assert.deepStrictEqual(entry.unlockedMoveIds, [...titanspawn[entry.heroId].moveIds]);
  }

  // The run's opener is level 1: the authored Early line, untouched.
  const { run: opener } = mobEncounter('fight', locations.wildsEdge, 1, 7, encounterScaling('fight', 1));
  for (const entry of opener.roster) {
    assert.strictEqual(levelOf(entry), 1);
    assert.deepStrictEqual(entry.growthStatGrants, {});
  }
});

test('difficulty: a loadout hands every enemy its item and passives', () => {
  const loadout = { gear: { common: 1, rare: 0, epic: 0, legendary: 0, mythic: 0 }, passiveIds: ['bloodthirst'] } as const;
  const { run } = generateEncounter('elite', 5, heroes, { scaling: encounterScaling('elite', 3), loadout });
  for (const entry of run.roster) {
    assert.strictEqual(entry.equipment.length, 1, `${entry.heroId} should hold one item`);
    assert.deepStrictEqual([...entry.bonusPassiveGrants], ['bloodthirst']);
  }
  const { run: bare } = generateEncounter('elite', 5, heroes, { scaling: encounterScaling('elite', 3) });
  for (const entry of bare.roster) {
    assert.strictEqual(entry.equipment.length, 0);
    assert.deepStrictEqual([...entry.bonusPassiveGrants], []);
  }
});

test('difficulty: an enemy wears gear that FITS it, and a contract keeps that piece (docs/gear-absorption.md §7)', () => {
  // The family suits the offensive stat the hero swings with, and an enchant is a type it fields:
  // the piece the player saw it wearing is the piece the contract arrives with, so it must be
  // a piece the player would have chosen.
  assert.ok(familyFitsHero('sword', heroes.cinderKnight.baseStats), 'a physical hero fits a Sword');
  assert.ok(!familyFitsHero('staff', heroes.cinderKnight.baseStats), 'and not a Staff');
  assert.ok(familyFitsHero('plate', heroes.cinderKnight.baseStats), 'a defensive family fits anyone');
  assert.ok(familyFitsHero('crest', heroes.cinderKnight.baseStats), 'the Crest carries both and fits anyone');

  const loadout = { gear: { common: 0, rare: 1, epic: 0, legendary: 0, mythic: 0 } } as const;
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const { run } = generateEncounter('elite', seed, heroes, { scaling: encounterScaling('elite', 4), loadout });
    for (const entry of run.roster) {
      const hero = heroes[entry.heroId];
      const item = equipment[entry.equipment[0]];
      assert.ok(item?.familyId, `${entry.heroId} holds nothing`);
      assert.ok(familyFitsHero(item.familyId!, hero.baseStats), `${entry.heroId} wears a ${item.name}`);
      if (item.enchantId) assert.ok(hero.types.includes(ENCHANTMENTS[item.enchantId]), `${entry.heroId} wears an off-type ${item.name}`);
    }
  }

  // Forced enchant: with the roll pinned high the piece is enchanted, and always in the hero's own type.
  let calls = 0;
  const always = () => (calls++ === 0 ? 0.5 : 0);
  for (let i = 0; i < 20; i++) {
    calls = 0;
    const item = rollFittingGear(heroes.cinderKnight.baseStats, heroes.cinderKnight.types, loadout.gear, always)!;
    assert.ok(item.enchantId && heroes.cinderKnight.types.includes(ENCHANTMENTS[item.enchantId]), item.name);
  }
});

test('difficulty: scaling stays deterministic per seed', () => {
  const opts = { scaling: encounterScaling('elite', 4), progression: progressionTable } as const;
  const a = generateEncounter('elite', 77, heroes, opts);
  const b = generateEncounter('elite', 77, heroes, opts);
  assert.deepStrictEqual(a.run.roster, b.run.roster);
});

test('difficulty: Act 1 never fields more bodies than the player holds', () => {
  // The player's roster ramps 2 -> 3 -> 4 across Act 1 while the encounter size never did. That
  // was patched for the Elite alone with a hand-tuned 3; the rule replaces the constant, and
  // reproduces it exactly at the roster size that node is actually met with.
  assert.strictEqual(encounterHeroCountOverride('elite', 1, ACT_ONE_ELITE_HERO_COUNT, 4), ACT_ONE_ELITE_HERO_COUNT);

  // The Skirmish is the node this fixes: it is met with TWO heroes and fielded four.
  assert.strictEqual(encounterHeroCountOverride('skirmish', 1, 2, 4), 2);

  // A full roster takes the standard count — the cap only ever shrinks a fight.
  for (const nodeType of ['skirmish', 'elite', 'battle']) {
    assert.strictEqual(encounterHeroCountOverride(nodeType, 1, 4, 4), undefined, `${nodeType} at a full roster`);
    assert.strictEqual(encounterHeroCountOverride(nodeType, 1, 6, 4), undefined, `${nodeType} above the standard count`);
  }

  // Acts 2+ are untouched: the roster is full by then, and being outnumbered is the Elite's job.
  for (const act of [2, 3, 4, 5, 6]) {
    assert.strictEqual(encounterHeroCountOverride('elite', act, 2, 4), undefined, `act ${act} must not be resized`);
  }

  // An empty roster is a fixture, not a fight — it must not produce a zero-body encounter.
  assert.strictEqual(encounterHeroCountOverride('skirmish', 1, 0, 4), undefined);
});
