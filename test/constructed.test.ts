import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { progressionTable } from '../src/data/progression';
import { equipment } from '../src/data/equipment';
import { classes } from '../src/data/classes';
import { passives } from '../src/data/passives';
import { buildCombatState } from '../src/run/buildCombatState';
import { gradeExpectedPoints, levelOf } from '../src/run/growth';
import { innatePassiveIdsFor } from '../src/run/innate';
import { MASTERY_CAP } from '../src/run/mastery';
import {
  CONSTRUCTED_LEVEL,
  TEAM_SIZE,
  constructedEntry,
  constructedHeroIds,
  constructedMovePool,
  constructedSide,
  expectedGrowthGrants,
  isTeamReady,
  slotProblems,
  teamProblems,
  type ConstructedContent,
  type Team,
  type TeamSlot,
} from '../src/run/constructed';

const content: ConstructedContent = { heroes, table: progressionTable, equipment, classes };

const cinder = (over: Partial<TeamSlot> = {}): TeamSlot => ({
  heroId: 'cinderKnight',
  pathId: 'cinderKnight-ironclad',
  moveIds: ['singe', 'setAlight', 'kindle'],
  itemIds: ['sword.mythic.blazing', 'plate.mythic'],
  classId: 'duelist',
  ...over,
});

function typeTeam(type: string): Team {
  const six = Object.values(heroes).filter((h) => h.types[0] === type).slice(0, TEAM_SIZE);
  return {
    name: type,
    slots: six.map((h) => ({ heroId: h.id, pathId: progressionTable.evolutions[h.id][0].paths[0].id, moveIds: [...h.moveIds], itemIds: [], classId: null })),
  };
}

test('constructed: growth is the expected line, every roll at its grade mean', () => {
  const grants = expectedGrowthGrants(heroes.cinderKnight);
  assert.strictEqual(grants.hp, Math.round((CONSTRUCTED_LEVEL - 1) * gradeExpectedPoints('S') * 3));
  assert.strictEqual(grants.attack, Math.round((CONSTRUCTED_LEVEL - 1) * gradeExpectedPoints('A')));
  assert.deepStrictEqual(expectedGrowthGrants(heroes.cinderKnight), grants);
});

test('constructed: a legal slot has no problems', () => {
  assert.deepStrictEqual(slotProblems(content, cinder()), []);
});

test('constructed: the pool holds the kit, the path line, the signature and the Class move', () => {
  const pool = constructedMovePool(content, cinder());
  for (const id of ['singe', 'kindle', 'hammerbrand', 'feint']) assert.ok(pool.includes(id), id);
  assert.ok(!constructedMovePool(content, cinder({ classId: null })).includes('feint'));
});

test('constructed: illegal slots say why', () => {
  assert.ok(slotProblems(content, cinder({ moveIds: [] })).length > 0);
  assert.ok(slotProblems(content, cinder({ moveIds: ['singe', 'setAlight', 'kindle', 'moltenLash', 'firebrand'] })).length > 0);
  assert.ok(slotProblems(content, cinder({ moveIds: ['singe', 'singe'] })).length > 0);
  assert.ok(slotProblems(content, cinder({ moveIds: ['singe', 'tidalWave'] })).length > 0);
  assert.ok(slotProblems(content, cinder({ pathId: 'crimson-cinderveil' })).length > 0);
  assert.ok(slotProblems(content, cinder({ itemIds: ['sword.epic'] })).length > 0);
  assert.ok(slotProblems(content, cinder({ itemIds: ['sword.mythic', 'sword.mythic.blazing'] })).length > 0);
  assert.ok(slotProblems(content, cinder({ itemIds: ['sword.mythic', 'plate.mythic', 'ring.mythic', 'boots.mythic'] })).length > 0);
  assert.deepStrictEqual(slotProblems(content, cinder({ itemIds: ['worldbreaker.blazing'] })), []);
});

test('constructed: the hero gate reads any starred path', () => {
  const unlocked = constructedHeroIds({ evolutionStars: { cinderKnight: ['cinderKnight-ironclad'], crimson: [] } });
  assert.deepStrictEqual([...unlocked], ['cinderKnight']);
  assert.deepStrictEqual(slotProblems(content, cinder({ pathId: 'cinderKnight-thunderblaze', moveIds: ['singe'] }), unlocked), []);
  assert.ok(slotProblems(content, { ...cinder(), heroId: 'crimson', pathId: null, moveIds: ['ember'], classId: null }, unlocked).length > 0);
});

test('constructed: a team is six distinct heroes', () => {
  const team = typeTeam('Fire');
  assert.ok(isTeamReady(content, team));
  assert.ok(!isTeamReady(content, { ...team, slots: team.slots.slice(1) }));
  assert.ok(teamProblems(content, { ...team, slots: [...team.slots.slice(0, 5), team.slots[0]] }).length > 0);
});

test('constructed: the entry is level 30, mastered, evolved, and holds exactly the slot', () => {
  const entry = constructedEntry(content, cinder());
  assert.strictEqual(levelOf(entry), CONSTRUCTED_LEVEL);
  assert.strictEqual(entry.mastery, MASTERY_CAP);
  assert.deepStrictEqual(innatePassiveIdsFor(heroes.cinderKnight, entry), heroes.cinderKnight.masteredPassiveIds);
  assert.deepStrictEqual(entry.chosenPathIds, ['cinderKnight-ironclad']);
  assert.strictEqual(entry.evolutionTypeGraft, 'Iron');
  assert.ok(entry.evolutionPassiveGrants.includes('cinderguard'));
  assert.deepStrictEqual(entry.unlockedMoveIds, ['singe', 'setAlight', 'kindle']);
  assert.deepStrictEqual(entry.equipment, ['sword.mythic.blazing', 'plate.mythic']);
  assert.strictEqual(entry.classId, 'duelist');
});

test('constructed: a rewire trades base and growth', () => {
  const entry = constructedEntry(content, cinder({ pathId: 'cinderKnight-explosive', moveIds: ['immolate'] }));
  const own = (stat: 'attack' | 'intelligence') => heroes.cinderKnight.baseStats[stat] + (entry.growthStatGrants[stat] ?? 0);
  assert.strictEqual(entry.evolutionStatGrants.attack, own('intelligence') - own('attack'));
  assert.ok(entry.offenseSwapped);
});

test('constructed: two teams build a fight — authored leads on one side, picked in the fight on the other', () => {
  const player = constructedSide(content, typeTeam('Fire'));
  const waterIds = typeTeam('Water').slots.map((s) => s.heroId);
  const ai = constructedSide(content, typeTeam('Water'), [waterIds[0], waterIds[1]]);
  assert.deepStrictEqual(player.squad.activeIds, [null, null]);
  assert.deepStrictEqual(player.run.consumables, { hpPotion: 0, mpPotion: 0, revive: 0 });
  const state = buildCombatState(1, heroes, equipment, [
    { side: 'A', squad: player.squad, roster: player.run.roster },
    { side: 'B', squad: ai.squad, roster: ai.run.roster },
  ], passives);
  assert.strictEqual(Object.keys(state.combatants).length, TEAM_SIZE * 2);
  for (const c of Object.values(state.combatants)) assert.ok(c.currentHp > 0 && c.currentMana > 0);
});
